import { describe, expect, it } from 'vitest';
import { bibleReferenceUrl } from '../src/bible/references';
import { parsePhaseData } from '../src/data';
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
      labelOffset: [0, 0],
      labelAnchor: 'center',
      featureType: 'Settlement',
      status: 'identified',
      confidence: 'Test confidence',
      confidenceScore: 1,
      modernName,
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

describe('phase data parsing', () => {
  it('accepts a valid searchable place feature', () => {
    const item = place('Shechem', 'Tell Balatah');
    const data = parsePhaseData({ type: 'FeatureCollection', features: [item] });
    expect(data.places).toHaveLength(1);
    expect(data.places[0]?.properties.name).toBe('Shechem');
  });

  it('rejects malformed data', () => {
    expect(() => parsePhaseData({ type: 'FeatureCollection', features: [] })).toThrow('does not contain any searchable places');
  });
});

describe('Bible reference links', () => {
  it('opens a reference directly in the STEP Bible ESV passage reader', () => {
    const url = new URL(bibleReferenceUrl('Genesis 12:6'));
    expect(url.origin).toBe('https://www.stepbible.org');
    expect(url.searchParams.get('q')).toBe('reference=Genesis.12.6|version=ESV');
    expect(url.searchParams.has('skipwelcome')).toBe(true);
  });
});
