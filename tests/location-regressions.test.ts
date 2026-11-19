import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMapData } from '../src/data';
import { findPlaces, placeResultContext, resolvePlaces } from '../src/search/places';
import { measureRoute } from '../src/measure/route';
import { approximateRouteDistance } from '../src/measure/distance';
import { walkingPath, type WalkingGrid } from '../src/measure/walking';
const raw = JSON.parse(readFileSync(new URL('../public/data/bible-places.geojson', import.meta.url), 'utf8'));
const data = parseMapData(raw);
const resolve = (name: string) => resolvePlaces(data.places, name);

describe('reported location identity regressions', () => {
  it('rejects invalid geographic coordinates instead of silently losing places', () => {
    const invalid = structuredClone(data.places[0]!);
    invalid.geometry.coordinates = [200, 95];
    expect(() => parseMapData({ type: 'FeatureCollection', features: [invalid] })).toThrow('invalid place or coordinate');
  });
  it('preserves every unique canonical name regardless of colliding aliases', () => {
    for (const place of data.places) {
      expect(resolve(place.properties.name).map((match) => match.properties.id)).toEqual([place.properties.id]);
    }
  });
  it('preserves source uncertainty areas and stronger non-geographic interpretations', () => {
    const horem = resolve('Horem')[0]!;
    expect(horem.properties.locationRole).toBe('Representative point');
    expect(horem.properties.locationNote).toContain('50 km');
    expect(resolve('Hashmonah')[0]?.properties.locationNote).toContain('30 km');
    expect(resolve('Gibea')[0]?.properties.sourceCaveat).toContain('not a place');
  });
  it('does not let aliases steal canonical Hebron or Paran', () => {
    expect(resolve('Jerusalem').map((p) => p.properties.id)).toEqual(['a15257a']);
    expect(resolve('Hebron').map((p) => p.properties.id)).toEqual(['a85151a']);
    expect(resolve('Paran').map((p) => p.properties.id)).toEqual(['aa6b19b']);
    expect(resolve('Mount Paran').map((p) => p.properties.id)).toEqual(['af693b8']);
  });
  it('requires a biblical context for homonymous Edrei and Mount Seir', () => {
    expect(resolve('Edrei')).toHaveLength(2);
    expect(resolve('Mount Seir')).toHaveLength(2);
    expect(resolve('Edrei (Numbers 21:33)')[0]?.geometry.coordinates).toEqual([36.106111, 32.625278]);
    expect(data.places.find((p) => p.properties.id === 'ae981db')?.geometry.coordinates).toEqual([35.3166, 30.1843]);
  });
  it('uses the source-leading ancient identification for Laban, including its indirect modern basis', () => {
    expect(resolve('Laban')[0]?.properties.modernName).toBe('Wadi el Beidha');
    expect(resolve('Laban')[0]?.geometry.coordinates).toEqual([34.704, 29.99321]);
  });
  it('labels the southern Dizahab preference and retains the higher ranked northern alternative', () => {
    const place = resolve('Dizahab')[0]!;
    expect(place.geometry.coordinates).toEqual([34.504722, 28.493056]);
    expect(place.properties.confidence).toContain('less than 10%');
    expect(place.properties.candidates?.find((p) => p.name === 'Ad Duhaybah')?.coordinates).toEqual([36.050752, 31.806601]);
  });
  it.each([
    ['Edrei Deut 3:1', 'aaa6f7a', 'Deuteronomy 3:1'],
    ['Aroer (Deuteronomy 2:36)', 'ae46f2e', 'Deuteronomy 2:36'],
    ['Brook Zered', 'ab5161f', 'Deuteronomy 2:13'],
    ['Valley of Arnon', 'af4c2cd', 'Deuteronomy 2:24'],
  ])('finds the reported reference or translation %s without duplicating the place', (query, id, ref) => {
    const matches = findPlaces(data.places, query);
    expect(matches[0]?.properties.id).toBe(id);
    expect(placeResultContext(matches[0]!, query)).toContain(ref);
  });
  it('does not confuse Deuteronomy 3:1 with 3:10', () => {
    expect(findPlaces(data.places, 'Deut 3:1').every((p) => p.properties.references.includes('Deuteronomy 3:1'))).toBe(true);
  });
  it('retains a sourced line for the Valley of Arnon and the Numbers Zered valley', () => {
    for (const id of ['af4c2cd', 'aaa2177']) {
      const place = data.places.find((p) => p.properties.id === id)!;
      expect(place.properties.hasRiverGeometry).toBe(true);
      const course = data.features.features.find((f) => f.properties.placeId === id && f.properties.kind === 'river-course')!;
      expect(['LineString', 'MultiLineString']).toContain(course.geometry.type);
      expect(course.properties.basisId).toBe(place.properties.selectedCandidateId);
    }
  });
  it('provides source river courses for every river with line geometry available', () => {
    const rivers = data.places.filter((p) => p.properties.featureType === 'River');
    const courses = data.features.features.filter((f) => f.properties.kind === 'river-course');
    expect(courses.length).toBeGreaterThan(20);
    for (const river of rivers.filter((p) => p.properties.hasRiverGeometry)) {
      const course = courses.find((f) => f.properties.placeId === river.properties.id)!;
      expect(['LineString', 'MultiLineString']).toContain(course.geometry.type);
      expect(course.properties.sourceGeometryId).toBeTruthy();
    }
  });
});

describe('land detour estimation', () => {
  const grid = JSON.parse(readFileSync(new URL('../public/data/walking-grid.json', import.meta.url), 'utf8')) as WalkingGrid;
  it('detours around the Dead Sea instead of measuring across it', () => {
    const stops = [[35.1, 31.5], [35.65, 31.5]] as const;
    const path = walkingPath(grid, stops)!;
    expect(path).toBeDefined();
    expect(approximateRouteDistance(path).kilometers).toBeGreaterThan(approximateRouteDistance(stops).kilometers * 1.3);
    for (const [lon, lat] of path) expect(grid.rows[Math.round((lat - grid.south) / grid.step)]?.[Math.round((lon - grid.west) / grid.step)]).toBe('1');
  });
  it('reports each leg with the chosen method and totals its actual route', () => {
    const stops = [[35.1, 31.5], [35.65, 31.5], [35.2, 31.8]] as const;
    const direct = measureRoute(stops)!;
    const land = measureRoute(stops, grid)!;
    expect(direct.legs).toHaveLength(2);
    expect(land.legs).toHaveLength(2);
    expect(land.legs[0]!.kilometers).toBeGreaterThan(direct.legs[0]!.kilometers * 1.3);
    expect(direct.legs[0]).toEqual(approximateRouteDistance(stops.slice(0, 2)));
    expect(land.legs[0]).toEqual(approximateRouteDistance([stops[0], ...walkingPath(grid, stops.slice(0, 2))!, stops[1]]));
    expect(land.path[0]).toEqual(stops[0]);
    expect(land.path.at(-1)).toEqual(stops.at(-1));
    expect(land.kilometers).toBe(approximateRouteDistance(land.path).kilometers);
    expect(measureRoute([[33.36, 35.17], [35.2, 31.8], [35.1, 31.5]], grid)).toBeUndefined();
  });
  it('returns unavailable for an island-to-mainland journey and out-of-coverage points', () => {
    expect(walkingPath(grid, [[33.36, 35.17], [35.2, 31.8]])).toBeUndefined();
    expect(walkingPath(grid, [[-123, 49], [35, 32]])).toBeUndefined();
  });
  it('keeps identical stops valid for the map line', () => {
    const path = walkingPath(grid, [[35.2, 31.8], [35.2, 31.8]])!;
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(approximateRouteDistance(path).kilometers).toBe(0);
  });
  it('routes a long Mediterranean journey on land', () => {
    const path = walkingPath(grid, [[12.48, 41.9], [35.2, 31.8]]);
    expect(path).toBeDefined();
    expect(approximateRouteDistance(path!).kilometers).toBeGreaterThan(3000);
  });
});
