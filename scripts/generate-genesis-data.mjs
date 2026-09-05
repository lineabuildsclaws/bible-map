import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ancientDataPath = process.argv[2];

if (!ancientDataPath) {
  throw new Error('Usage: node scripts/generate-genesis-data.mjs /path/to/data/ancient.jsonl');
}

const projectRoot = resolve(import.meta.dirname, '..');
const curatedDataPath = resolve(projectRoot, 'public/data/phase1-places.geojson');
const outputPath = resolve(projectRoot, 'public/data/genesis-places.geojson');
const sourceCommit = process.env.OPENBIBLE_COMMIT ?? 'unknown';
const retrieved = process.env.OPENBIBLE_RETRIEVED ?? new Date().toISOString().slice(0, 10);

const [ancientText, curatedText] = await Promise.all([
  readFile(resolve(ancientDataPath), 'utf8'),
  readFile(curatedDataPath, 'utf8'),
]);

const ancientPlaces = ancientText
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const curatedData = JSON.parse(curatedText);

const curatedPlacesByAncientId = new Map(
  curatedData.features
    .filter((feature) => feature.properties?.kind === 'place')
    .map((feature) => {
      const match = feature.properties.sourceUrl?.match(/\/ancient\/([^/]+)/);
      return match ? [match[1], feature] : undefined;
    })
    .filter(Boolean),
);
const contextualFeatures = curatedData.features
  .filter((feature) => feature.properties?.kind !== 'place')
  .map((feature) =>
    feature.properties?.kind === 'candidate-area'
      ? {
          ...feature,
          properties: { ...feature.properties, candidateForIds: ['a0aa664', 'aa572e2'] },
        }
      : feature,
  );

function genesisVerses(place) {
  return (place.verses ?? [])
    .filter((verse) => verse.osis.startsWith('Gen.'))
    .map((verse) => verse.readable.replace(/^Gen /, 'Genesis '));
}

function primaryTranslationName(place) {
  return Object.entries(place.translation_name_counts ?? {})
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? place.friendly_id;
}

function humanizeType(value) {
  return value[0]?.toUpperCase() + value.slice(1);
}

function hash(value) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.codePointAt(0)) >>> 0;
  return result;
}

function labelPlacement(id) {
  const placements = [
    { labelOffset: [0.9, 0], labelAnchor: 'left' },
    { labelOffset: [-0.9, 0], labelAnchor: 'right' },
    { labelOffset: [0, 1.05], labelAnchor: 'top' },
    { labelOffset: [0, -1.05], labelAnchor: 'bottom' },
  ];
  return placements[hash(id) % placements.length];
}

function confidenceFor(score, secondScore) {
  const competing = secondScore !== undefined && secondScore >= Math.max(100, score * 0.6);
  if (score >= 850 && !competing) return { status: 'confirmed', confidence: 'High confidence' };
  if (score >= 500 && !competing) {
    return { status: 'identified', confidence: score >= 650 ? 'Strong candidate' : 'Leading candidate' };
  }
  if (competing) return { status: 'uncertain', confidence: 'Competing proposals' };
  return { status: 'uncertain', confidence: score >= 200 ? 'Tentative identification' : 'Highly uncertain' };
}

function zoomFor(featureType, referenceCount) {
  const broadFeatures = new Set(['Region', 'River', 'Body of water', 'Mountain range', 'Valley']);
  const selectionZoom = featureType === 'Region' ? 5.4 : broadFeatures.has(featureType) ? 6.2 : 9.2;
  let labelMinZoom = 8.2;
  if (referenceCount >= 8) labelMinZoom = 3.8;
  else if (broadFeatures.has(featureType) && referenceCount >= 2) labelMinZoom = 4.5;
  else if (referenceCount >= 4) labelMinZoom = 5.2;
  else if (referenceCount >= 2) labelMinZoom = 6.2;
  return { selectionZoom, labelMinZoom };
}

const genesisRecords = ancientPlaces.filter((place) => genesisVerses(place).length > 0);
const rawRecords = [];
const unlocatedPlaces = [];

for (const place of genesisRecords) {
  const references = genesisVerses(place);
  const associations = Object.entries(place.modern_associations ?? {})
    .map(([id, association]) => ({ id, ...association }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
  const primaryAssociation = associations[0];
  const resolutions = place.identifications.flatMap((identification) => identification.resolutions ?? []);
  const primaryResolution =
    resolutions
      .filter((resolution) => resolution.lonlat && resolution.modern_basis_id === primaryAssociation?.id)
      .sort((left, right) => (right.best_path_score ?? 0) - (left.best_path_score ?? 0))[0] ??
    resolutions.find((resolution) => resolution.lonlat);

  if (!primaryResolution) {
    unlocatedPlaces.push(primaryTranslationName(place));
    continue;
  }

  const coordinates = primaryResolution.lonlat.split(',').map(Number);
  if (coordinates.length !== 2 || coordinates.some((value) => !Number.isFinite(value))) {
    throw new Error(`Invalid coordinates for ${place.friendly_id}: ${primaryResolution.lonlat}`);
  }

  const featureType = humanizeType(primaryResolution.type ?? place.types?.[0] ?? 'place');
  const primaryScore = primaryAssociation?.score ?? primaryResolution.best_path_score ?? 0;
  const curated = curatedPlacesByAncientId.get(place.id);
  const derivedConfidence = confidenceFor(primaryScore, associations[1]?.score);
  const placement = curated?.properties ?? labelPlacement(place.id);
  const zoom = zoomFor(featureType, references.length);
  const translationNames = Object.keys(place.translation_name_counts ?? {});

  rawRecords.push({
    place,
    canonicalName: curated?.properties.name ?? primaryTranslationName(place),
    aliases: [...new Set([place.friendly_id.replace(/ \d+$/, ''), ...translationNames])],
    references,
    associations,
    coordinates,
    featureType,
    primaryScore,
    primaryAssociation,
    primaryResolution,
    curated,
    derivedConfidence,
    placement,
    zoom,
  });
}

const duplicateNameCounts = rawRecords.reduce((counts, record) => {
  counts.set(record.canonicalName, (counts.get(record.canonicalName) ?? 0) + 1);
  return counts;
}, new Map());

const placeFeatures = rawRecords.map((record) => {
  const {
    place,
    canonicalName,
    aliases,
    references,
    associations,
    coordinates,
    featureType,
    primaryScore,
    primaryAssociation,
    curated,
    derivedConfidence,
    placement,
    zoom,
  } = record;
  const duplicate = (duplicateNameCounts.get(canonicalName) ?? 0) > 1;
  const displayName = duplicate ? `${canonicalName} (Genesis ${references[0].match(/\d+/)?.[0]})` : canonicalName;
  const status = curated?.properties.status ?? derivedConfidence.status;
  const confidence = curated?.properties.confidence ?? derivedConfidence.confidence;
  const modernName = primaryAssociation?.name ?? 'No settled modern identification';
  const alternativeCount = Math.max(0, associations.length - 1);
  const representativeRegion = record.primaryResolution.lonlat_type === 'representative point';
  const description =
    curated?.properties.description ??
    (representativeRegion
      ? `A ${featureType.toLocaleLowerCase()} mentioned in Genesis, shown with a representative point for its broader geographic area.`
      : `A ${featureType.toLocaleLowerCase()} mentioned in Genesis, mapped at ${modernName}, the leading identification in the OpenBible.info dataset.`);
  const labelPriority = Math.round(
    Math.max(0, primaryScore) / 5 + Math.min(references.length, 20) * 24 + (status === 'confirmed' ? 40 : 0),
  );

  return {
    type: 'Feature',
    properties: {
      id: place.id,
      kind: 'place',
      name: displayName,
      label: curated?.properties.label ?? displayName,
      alternateNames: aliases.filter((alias) => alias !== displayName),
      labelOffset: placement.labelOffset,
      labelAnchor: placement.labelAnchor,
      labelMinZoom: zoom.labelMinZoom,
      labelPriority,
      selectionZoom: zoom.selectionZoom,
      featureType,
      locationRole: representativeRegion ? 'Representative point' : 'Leading identification',
      status,
      confidence,
      confidenceScore: primaryScore,
      modernName,
      alternativeCount,
      references,
      description,
      sourceUrl: `https://www.openbible.info/geo/ancient/${place.id}/${place.url_slug}`,
    },
    geometry: { type: 'Point', coordinates },
  };
});

placeFeatures.sort((left, right) => left.properties.name.localeCompare(right.properties.name));

const output = {
  type: 'FeatureCollection',
  metadata: {
    title: 'Bible Map — Genesis places',
    scope: 'Every mappable place record with a Genesis reference in the source dataset',
    source: 'Adapted from OpenBible.info Bible Geocoding Data (CC BY 4.0)',
    sourceCommit,
    retrieved,
    mappablePlaceCount: placeFeatures.length,
    unlocatedPlaces: unlocatedPlaces.sort(),
    method:
      'Each ancient place is shown at the highest-scoring modern association with coordinates. Lower-confidence and competing identifications are marked uncertain.',
  },
  features: [...contextualFeatures, ...placeFeatures],
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${placeFeatures.length} mappable Genesis places to ${outputPath}.`);
console.log(`Unlocated: ${unlocatedPlaces.join(', ') || 'none'}.`);
