import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bibleReferenceUrl } from '../src/bible/references';
import { parseMapData } from '../src/data';
import { findPlaces, normalizeSearchTerm } from '../src/search/places';
import type { PlaceFeature } from '../src/types';

function place(name: string, modernName: string): PlaceFeature {
  return {
    type: 'Feature',
    properties: {
      id: name.toLowerCase().replaceAll(' ', '-'),
      kind: 'place',
      name,
      label: name,
      alternateNames: [],
      labelOffset: [0, 0],
      labelAnchor: 'center',
      labelMinZoom: 6.2,
      labelPriority: 100,
      selectionZoom: 9.2,
      featureType: 'Settlement',
      locationRole: 'Leading identification',
      status: 'identified',
      confidence: 'Test confidence',
      confidenceScore: 1,
      modernName,
      alternativeCount: 0,
      mentionCount: 1,
      references: ['Genesis 1:1'],
      description: 'Test place.',
      sourceUrl: 'https://www.openbible.info/geo/',
    },
    geometry: { type: 'Point', coordinates: [35, 31] },
  };
}

describe('place search', () => {
  const places = [place('Ai', 'Et Tell'), place('Bethel', 'Beitin'), place('Oak of Moreh', 'Tell Balatah')];

  it('normalizes whitespace and case', () => {
    expect(normalizeSearchTerm('  OAK   of MOREH  ')).toBe('oak of moreh');
  });

  it('prioritizes exact biblical names', () => {
    expect(findPlaces(places, 'bethel').map((result) => result.properties.name)).toEqual(['Bethel']);
  });

  it('can find included modern associations and rank a prefix ahead of an internal match', () => {
    expect(findPlaces(places, 'tell').map((result) => result.properties.name)).toEqual(['Oak of Moreh', 'Ai']);
  });
});

describe('Bible data parsing', () => {
  it('accepts a valid searchable place feature', () => {
    const item = place('Shechem', 'Tell Balatah');
    const data = parseMapData({ type: 'FeatureCollection', features: [item] });
    expect(data.places).toHaveLength(1);
    expect(data.places[0]?.properties.name).toBe('Shechem');
  });

  it('rejects malformed data', () => {
    expect(() => parseMapData({ type: 'FeatureCollection', features: [] })).toThrow('does not contain any searchable places');
  });
});

describe('Bible map coverage', () => {
  const source = JSON.parse(
    readFileSync(new URL('../public/data/bible-places.geojson', import.meta.url), 'utf8'),
  ) as unknown;
  const data = parseMapData(source);

  it('contains every directly referenced, mappable Bible record from the source snapshot', () => {
    expect(data.places).toHaveLength(1278);
    expect(data.unlocatedPlaces).toEqual([
      'Azazel',
      'Bamah',
      'Biziothiah',
      'Holy Place',
      'Most Holy Place',
      'Nod',
      'Nohah',
    ]);
    expect(new Set(data.places.map((item) => item.properties.id)).size).toBe(data.places.length);
    expect(new Set(data.places.map((item) => item.properties.name)).size).toBe(data.places.length);
    expect(data.places.every((item) => item.properties.mentionCount === item.properties.references.length)).toBe(true);
  });

  it('defers low-mention places until close zoom', () => {
    const expectedZoom = (mentions: number): number => {
      if (mentions >= 100) return 3;
      if (mentions >= 50) return 4.5;
      if (mentions >= 25) return 8.5;
      if (mentions >= 10) return 10;
      if (mentions >= 5) return 11;
      if (mentions >= 2) return 12;
      return 13;
    };

    expect(
      data.places.every(
        (item) => item.properties.labelMinZoom === expectedZoom(item.properties.mentionCount),
      ),
    ).toBe(true);
  });

  it('contains references from both Testaments', () => {
    const references = data.places.flatMap((item) => item.properties.references);
    expect(references.some((reference) => reference.startsWith('Genesis '))).toBe(true);
    expect(references.some((reference) => reference.startsWith('Matthew '))).toBe(true);
    expect(references.some((reference) => reference.startsWith('Revelation '))).toBe(true);
  });

  it.each(['Athens', 'Corinth', 'Damascus', 'Ephesus', 'Nazareth', 'Nineveh', 'Rome', 'Ur'])(
    'finds %s by its biblical name',
    (name) => {
      expect(findPlaces(data.places, name)[0]?.properties.name).toBe(name);
    },
  );
});

describe('Bible reference links', () => {
  it('opens a reference directly in the STEP Bible ESV passage reader', () => {
    const url = new URL(bibleReferenceUrl('Genesis 12:6'));
    expect(url.origin).toBe('https://www.stepbible.org');
    expect(url.searchParams.get('q')).toBe('reference=Genesis.12.6|version=ESV');
    expect(url.searchParams.has('skipwelcome')).toBe(true);
  });

  it('supports numbered book names', () => {
    const url = new URL(bibleReferenceUrl('1 Samuel 3:1'));
    expect(url.searchParams.get('q')).toBe('reference=1 Samuel.3.1|version=ESV');
  });
});
