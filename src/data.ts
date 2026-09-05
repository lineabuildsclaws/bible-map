import { GENESIS_DATA_URL } from './config';
import type { BibleMapData, MapFeature, MapFeatureCollection, PlaceFeature, PlaceProperties, PlaceStatus } from './types';

const PLACE_STATUSES: ReadonlySet<string> = new Set(['confirmed', 'identified', 'associated', 'uncertain']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isLabelOffset(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((item) => typeof item === 'number');
}

function isPlaceProperties(value: unknown): value is PlaceProperties {
  if (!isRecord(value)) return false;

  return (
    value.kind === 'place' &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.label === 'string' &&
    isStringArray(value.alternateNames) &&
    isLabelOffset(value.labelOffset) &&
    typeof value.labelAnchor === 'string' &&
    typeof value.labelMinZoom === 'number' &&
    typeof value.labelPriority === 'number' &&
    typeof value.selectionZoom === 'number' &&
    typeof value.featureType === 'string' &&
    (value.locationRole === 'Leading identification' || value.locationRole === 'Representative point') &&
    typeof value.status === 'string' &&
    PLACE_STATUSES.has(value.status as PlaceStatus) &&
    typeof value.confidence === 'string' &&
    typeof value.confidenceScore === 'number' &&
    typeof value.modernName === 'string' &&
    typeof value.alternativeCount === 'number' &&
    isStringArray(value.references) &&
    typeof value.description === 'string' &&
    typeof value.sourceUrl === 'string'
  );
}

function isMapFeature(value: unknown): value is MapFeature {
  return (
    isRecord(value) &&
    value.type === 'Feature' &&
    isRecord(value.properties) &&
    isRecord(value.geometry) &&
    typeof value.geometry.type === 'string'
  );
}

function isPlaceFeature(value: MapFeature): value is PlaceFeature {
  return value.geometry.type === 'Point' && isPlaceProperties(value.properties);
}

export function parseMapData(value: unknown): BibleMapData {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error('The Genesis map data is not a GeoJSON FeatureCollection.');
  }

  if (!value.features.every(isMapFeature)) {
    throw new Error('The Genesis map data contains an invalid feature.');
  }

  const features: MapFeatureCollection = {
    type: 'FeatureCollection',
    features: value.features,
  };
  const places = features.features.filter(isPlaceFeature);

  if (places.length === 0) {
    throw new Error('The Genesis map data does not contain any searchable places.');
  }

  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const unlocatedPlaces = isStringArray(metadata.unlocatedPlaces) ? metadata.unlocatedPlaces : [];
  return { features, places, unlocatedPlaces };
}

export async function loadMapData(): Promise<BibleMapData> {
  const response = await fetch(GENESIS_DATA_URL, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`The Genesis place data could not be loaded (${response.status}).`);
  }

  return parseMapData(await response.json());
}
