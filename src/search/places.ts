import type { PlaceFeature } from '../types';

export function normalizeSearchTerm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function scorePlace(place: PlaceFeature, query: string): number {
  const name = normalizeSearchTerm(place.properties.name);
  const modernName = normalizeSearchTerm(place.properties.modernName);

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (modernName === query) return 3;
  if (modernName.startsWith(query)) return 4;
  if (modernName.includes(query)) return 5;
  return Number.POSITIVE_INFINITY;
}

export function findPlaces(places: readonly PlaceFeature[], rawQuery: string, limit = 6): PlaceFeature[] {
  const query = normalizeSearchTerm(rawQuery);
  if (!query) return [];

  return places
    .map((place) => ({ place, score: scorePlace(place, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.place.properties.name.localeCompare(right.place.properties.name))
    .slice(0, limit)
    .map(({ place }) => place);
}
