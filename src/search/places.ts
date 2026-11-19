import type { PlaceFeature } from '../types';

export function normalizeSearchTerm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

const BOOK_ALIASES: Record<string, string> = {
  gen: 'genesis', exod: 'exodus', lev: 'leviticus', num: 'numbers', deut: 'deuteronomy',
  deuter: 'deuteronomy', josh: 'joshua', judg: 'judges', sam: 'samuel', kgs: 'kings',
  chr: 'chronicles', ps: 'psalms', prov: 'proverbs', isa: 'isaiah', jer: 'jeremiah',
  ezek: 'ezekiel', matt: 'matthew', mk: 'mark', lk: 'luke', jn: 'john', rev: 'revelation',
};

function referenceQuery(query: string): { name: string; reference: string } | undefined {
  const match = query.match(/^(.*?)\(?((?:[1-3]\s+)?[a-z]+)\.?\s+(\d+)(?::(\d+))?\)?$/);
  if (!match) return undefined;
  const book = match[2]!.replace(/[a-z]+$/, (word) => BOOK_ALIASES[word] ?? word);
  return { name: match[1]!.trim(), reference: `${book} ${match[3]}${match[4] ? `:${match[4]}` : ''}` };
}

function matchesReference(reference: string, query: string): boolean {
  const normalized = normalizeSearchTerm(reference);
  return normalized === query || (!query.includes(':') && normalized.startsWith(`${query}:`));
}

/** Surface the queried translation and one reference per book, including Deuteronomy. */
export function placeResultContext(place: PlaceFeature, rawQuery: string): string {
  const query = normalizeSearchTerm(rawQuery);
  const refQuery = referenceQuery(query);
  const matching = refQuery ? place.properties.references.filter((ref) => matchesReference(ref, refQuery.reference)) : [];
  const byBook = new Map<string, string>();
  for (const ref of place.properties.references) {
    const book = ref.replace(/ \d.*$/, '');
    if (!byBook.has(book)) byBook.set(book, ref);
  }
  const refs = [...new Set([...matching, ...place.properties.references.slice(0, 3), ...byBook.values()])];
  const shown = refs.slice(0, 4);
  const alias = place.properties.alternateNames.find((name) => normalizeSearchTerm(name) === query);
  return `${alias && normalizeSearchTerm(place.properties.name) !== query ? `${alias} · ` : ''}${shown.join(' · ')}${refs.length > shown.length ? ' · more references' : ''} · ${place.properties.modernName}`;
}

function scorePlace(place: PlaceFeature, query: string): number {
  const name = normalizeSearchTerm(place.properties.name);
  const modernName = normalizeSearchTerm(place.properties.modernName);
  const alternateNames = place.properties.alternateNames.map(normalizeSearchTerm);

  if (name === query) return 0;
  if (alternateNames.includes(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (name.includes(query)) return 3;
  if (alternateNames.some((alternateName) => alternateName.startsWith(query))) return 4;
  if (alternateNames.some((alternateName) => alternateName.includes(query))) return 5;
  if (modernName === query) return 6;
  if (modernName.startsWith(query)) return 7;
  if (modernName.includes(query)) return 8;
  const refQuery = referenceQuery(query);
  if (refQuery && place.properties.references.some((ref) => matchesReference(ref, refQuery.reference))) {
    if (!refQuery.name || [name, ...alternateNames].some((value) => value.includes(refQuery.name))) return 9;
  }
  return Number.POSITIVE_INFINITY;
}

export function findPlaces(places: readonly PlaceFeature[], rawQuery: string, limit = 10): PlaceFeature[] {
  const query = normalizeSearchTerm(rawQuery);
  if (!query) return [];

  return places
    .map((place) => ({ place, score: scorePlace(place, query) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((left, right) => left.score - right.score || left.place.properties.name.localeCompare(right.place.properties.name))
    .slice(0, limit)
    .map(({ place }) => place);
}

/** Never silently choose between distinct biblical records sharing an alias. */
export function resolvePlaces(places: readonly PlaceFeature[], rawQuery: string): PlaceFeature[] {
  const query = normalizeSearchTerm(rawQuery);
  if (!query) return [];
  const canonical = places.filter((place) => normalizeSearchTerm(place.properties.name) === query);
  if (canonical.length) return canonical;
  const aliases = places.filter((place) => place.properties.alternateNames.some((name) => normalizeSearchTerm(name) === query));
  if (aliases.length) return aliases;
  const modern = places.filter((place) => normalizeSearchTerm(place.properties.modernName) === query);
  if (modern.length) return modern;
  return findPlaces(places, rawQuery);
}
