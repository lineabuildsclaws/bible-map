import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ancientDataPath = process.argv[2];

if (!ancientDataPath) {
  throw new Error('Usage: node scripts/generate-bible-data.mjs /path/to/data/ancient.jsonl');
}

const projectRoot = resolve(import.meta.dirname, '..');
const curatedDataPath = resolve(projectRoot, 'public/data/phase1-places.geojson');
const outputPath = resolve(projectRoot, 'public/data/bible-places.geojson');
const sourceCommit = process.env.OPENBIBLE_COMMIT ?? 'unknown';
const retrieved = process.env.OPENBIBLE_RETRIEVED ?? new Date().toISOString().slice(0, 10);

const BOOK_NAMES = {
  Gen: 'Genesis',
  Exod: 'Exodus',
  Lev: 'Leviticus',
  Num: 'Numbers',
  Deut: 'Deuteronomy',
  Josh: 'Joshua',
  Judg: 'Judges',
  Ruth: 'Ruth',
  '1Sam': '1 Samuel',
  '2Sam': '2 Samuel',
  '1Kgs': '1 Kings',
  '2Kgs': '2 Kings',
  '1Chr': '1 Chronicles',
  '2Chr': '2 Chronicles',
  Ezra: 'Ezra',
  Neh: 'Nehemiah',
  Esth: 'Esther',
  Job: 'Job',
  Ps: 'Psalms',
  Prov: 'Proverbs',
  Eccl: 'Ecclesiastes',
  Song: 'Song of Solomon',
  Isa: 'Isaiah',
  Jer: 'Jeremiah',
  Lam: 'Lamentations',
  Ezek: 'Ezekiel',
  Dan: 'Daniel',
  Hos: 'Hosea',
  Joel: 'Joel',
  Amos: 'Amos',
  Obad: 'Obadiah',
  Jonah: 'Jonah',
  Mic: 'Micah',
  Nah: 'Nahum',
  Hab: 'Habakkuk',
  Zeph: 'Zephaniah',
  Hag: 'Haggai',
  Zech: 'Zechariah',
  Mal: 'Malachi',
  Matt: 'Matthew',
  Mark: 'Mark',
  Luke: 'Luke',
  John: 'John',
  Acts: 'Acts',
  Rom: 'Romans',
  '1Cor': '1 Corinthians',
  '2Cor': '2 Corinthians',
  Gal: 'Galatians',
  Eph: 'Ephesians',
  Phil: 'Philippians',
  Col: 'Colossians',
  '1Thess': '1 Thessalonians',
  '2Thess': '2 Thessalonians',
  '1Tim': '1 Timothy',
  '2Tim': '2 Timothy',
  Titus: 'Titus',
  Phlm: 'Philemon',
  Heb: 'Hebrews',
  Jas: 'James',
  '1Pet': '1 Peter',
  '2Pet': '2 Peter',
  '1John': '1 John',
  '2John': '2 John',
  '3John': '3 John',
  Jude: 'Jude',
  Rev: 'Revelation',
};

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

function bibleReferences(place) {
  return (place.verses ?? []).map((verse) => {
    const [book, chapter, verseNumber] = verse.osis.split('.');
    const bookName = BOOK_NAMES[book];
    if (!bookName || !chapter || !verseNumber) throw new Error(`Unsupported Bible reference: ${verse.osis}`);
    return `${bookName} ${chapter}:${verseNumber}`;
  });
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
  let labelMinZoom = 13;
  if (referenceCount >= 100) labelMinZoom = 3;
  else if (referenceCount >= 50) labelMinZoom = 4.5;
  else if (referenceCount >= 25) labelMinZoom = 8.5;
  else if (referenceCount >= 10) labelMinZoom = 10;
  else if (referenceCount >= 5) labelMinZoom = 11;
  else if (referenceCount >= 2) labelMinZoom = 12;
  return { selectionZoom, labelMinZoom };
}

const rawRecords = [];
const unlocatedPlaces = [];

for (const place of ancientPlaces) {
  const references = bibleReferences(place);
  if (references.length === 0) continue;

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
  const displayName = duplicate ? `${canonicalName} (${references[0]})` : canonicalName;
  const status = curated?.properties.status ?? derivedConfidence.status;
  const confidence = curated?.properties.confidence ?? derivedConfidence.confidence;
  const modernName = primaryAssociation?.name ?? 'No settled modern identification';
  const alternativeCount = Math.max(0, associations.length - 1);
  const representativeRegion = record.primaryResolution.lonlat_type === 'representative point';
  const description =
    curated?.properties.description ??
    (representativeRegion
      ? `A ${featureType.toLocaleLowerCase()} mentioned in the Bible, shown with a representative point for its broader geographic area.`
      : `A ${featureType.toLocaleLowerCase()} mentioned in the Bible, mapped at ${modernName}, the leading identification in the OpenBible.info dataset.`);
  const labelPriority = Math.round(
    Math.max(0, primaryScore) / 5 + Math.min(references.length, 20) * 24 + (status === 'confirmed' ? 40 : 0),
  );

  return {
    type: 'Feature',
    properties: {
      id: place.id,
      kind: 'place',
      name: displayName,
      label: curated?.properties.label ?? canonicalName,
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
      mentionCount: references.length,
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
    title: 'Bible Map — biblical places',
    scope: 'Every mappable place record in the Protestant Bible covered by the source dataset',
    source: 'Adapted from OpenBible.info Bible Geocoding Data (CC BY 4.0)',
    sourceCommit,
    retrieved,
    sourcePlaceCount: rawRecords.length + unlocatedPlaces.length,
    mappablePlaceCount: placeFeatures.length,
    unlocatedPlaces: unlocatedPlaces.sort(),
    method:
      'Each ancient place is shown at the highest-scoring modern association with coordinates. Lower-confidence and competing identifications are marked uncertain.',
  },
  features: [...contextualFeatures, ...placeFeatures],
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${placeFeatures.length} mappable Bible places to ${outputPath}.`);
console.log(`Unlocated: ${unlocatedPlaces.join(', ') || 'none'}.`);
