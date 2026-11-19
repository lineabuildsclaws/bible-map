import { readFile, writeFile } from 'node:fs/promises';
const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const data = await read('../public/data/bible-places.geojson');
const baseline = await read('./source-baseline.json');
const records = new Map(baseline.records.map((record) => [record.id, record]));
const places = data.features.filter((feature) => feature.properties.kind === 'place');
const corrections = await read('./location-overrides.json');
const errors = [];
const exceptions = [];
const close = (a, b) => a?.length === 2 && b?.length === 2 && a.every((value, i) => Number.isFinite(value) && Math.abs(value - b[i]) < 0.000001);
const aliases = new Map();
for (const place of places) {
  const p = place.properties;
  const record = records.get(p.id);
  if (!record) { errors.push(`${p.id}: no source baseline`); continue; }
  const correction = corrections[p.id];
  const corrected = correction && correction.basisId === p.selectedCandidateId && close(correction.coordinates, place.geometry.coordinates);
  if (corrected) exceptions.push({ id: p.id, reason: correction.reason, sourceUrl: correction.sourceUrl });
  const candidate = p.candidates?.find((item) => item.id === p.selectedCandidateId);
  if (!candidate || !close(candidate.coordinates, place.geometry.coordinates)) errors.push(`${p.id}: selected candidate and displayed point differ`);
  if (!corrected && !record.points.some((point) => point.basisId === p.selectedCandidateId && close(point.coordinates, place.geometry.coordinates))) errors.push(`${p.id}: displayed point not supported by pinned source`);
  if (p.selectedCandidateId !== record.preferredBasisId) {
    if (p.id === 'afcb77d' && p.selectedCandidateId === 'mc070bb' && p.confidence.includes('less than 10%')) exceptions.push({ id: p.id, reason: 'Explicit project preference for southern Dahab; source ranks Ad Duhaybah higher.' });
    else errors.push(`${p.id}: displayed identification differs from source-leading identification`);
  }
  if (p.sourceCommit !== baseline.sourceCommit) errors.push(`${p.id}: source revision differs`);
  for (const candidate of p.candidates ?? []) {
    if (!(correction && candidate.id === correction.basisId && close(candidate.coordinates, correction.coordinates)) && !record.points.some((point) => point.basisId === candidate.id && close(point.coordinates, candidate.coordinates))) errors.push(`${p.id}: unsupported alternative ${candidate.id}`);
  }
  for (const name of [p.name, ...p.alternateNames]) {
    const key = name.trim().replace(/\s+/g, ' ').toLowerCase();
    const entries = aliases.get(key) ?? new Set(); entries.add(p.id); aliases.set(key, entries);
  }
  if (p.hasRiverGeometry && !data.features.some((feature) => feature.properties.kind === 'river-course' && feature.properties.placeId === p.id && ['LineString', 'MultiLineString'].includes(feature.geometry.type))) errors.push(`${p.id}: missing river course`);
}
if (places.length !== records.size) errors.push(`Coverage differs: ${places.length} displayed / ${records.size} source records`);
const collisions = [...aliases].filter(([, ids]) => ids.size > 1).map(([name, ids]) => ({ name, ids: [...ids] }));
const prior = process.argv.includes('--retry') ? await read('../docs/location-audit-live.json') : undefined;
const live = prior ? prior.liveChecks.filter((check) => check.matches) : [];
if (process.argv.includes('--live') || process.argv.includes('--live-changed') || prior) {
  const changed = await read('../docs/location-changes.json');
  const selected = new Set([...changed.map((place) => place.id), 'aaa6f7a', 'ae981db', 'aa6b19b', 'ad763b1', 'afcb77d']);
  const retryIds = new Set(prior?.liveChecks.filter((check) => !check.matches).map((check) => check.id));
  const queue = places.filter((place) => prior ? retryIds.has(place.properties.id) : process.argv.includes('--live') || selected.has(place.properties.id));
  let index = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (index < queue.length) {
      const place = queue[index++]; const p = place.properties;
      const url = `https://a.openbible.info/geo/data/${p.id}.geojson`;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.json();
        const match = source.features.find((feature) => feature.properties.id === p.candidates.find((candidate) => candidate.id === p.selectedCandidateId)?.sourcePointId);
        const matches = match && close(match.geometry.coordinates, place.geometry.coordinates);
        live.push({ id: p.id, name: p.name, url, matches: Boolean(matches) });
        if (!matches) errors.push(`${p.id}: current website coordinates differ or point is missing; review source drift`);
      } catch (error) { live.push({ id: p.id, url, error: error.message }); errors.push(`${p.id}: live verification unavailable`); }
    }
  }));
}
const report = { checkedAt: new Date().toISOString(), sourceCommit: baseline.sourceCommit, checked: places.length, errors, intentionalExceptions: exceptions, aliasCollisions: collisions, liveChecks: live.sort((a, b) => a.id.localeCompare(b.id)) };
await writeFile(new URL(live.length ? '../docs/location-audit-live.json' : '../docs/location-audit.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`${places.length} locations checked; ${errors.length} errors; ${exceptions.length} documented exceptions; ${collisions.length} ambiguous names; ${live.length} live coordinate comparisons.`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
