import { PHASE_DATA_URL } from './config';
import type { PhaseData, PhaseFeature, PhaseFeatureCollection, PlaceFeature, PlaceProperties, PlaceStatus } from './types';

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
    isLabelOffset(value.labelOffset) &&
    typeof value.labelAnchor === 'string' &&
    typeof value.featureType === 'string' &&
    typeof value.status === 'string' &&
    PLACE_STATUSES.has(value.status as PlaceStatus) &&
    typeof value.confidence === 'string' &&
    typeof value.confidenceScore === 'number' &&
    typeof value.modernName === 'string' &&
    isStringArray(value.references) &&
    typeof value.description === 'string' &&
    typeof value.sourceUrl === 'string'
  );
}

function isPhaseFeature(value: unknown): value is PhaseFeature {
  return (
    isRecord(value) &&
    value.type === 'Feature' &&
    isRecord(value.properties) &&
    isRecord(value.geometry) &&
    typeof value.geometry.type === 'string'
  );
}

function isPlaceFeature(value: PhaseFeature): value is PlaceFeature {
  return value.geometry.type === 'Point' && isPlaceProperties(value.properties);
}

export function parsePhaseData(value: unknown): PhaseData {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error('The Phase 1 map data is not a GeoJSON FeatureCollection.');
  }

  if (!value.features.every(isPhaseFeature)) {
    throw new Error('The Phase 1 map data contains an invalid feature.');
  }

  const features: PhaseFeatureCollection = {
    type: 'FeatureCollection',
    features: value.features,
  };
  const places = features.features.filter(isPlaceFeature);

  if (places.length === 0) {
    throw new Error('The Phase 1 map data does not contain any searchable places.');
  }

  return { features, places };
}

export async function loadPhaseData(): Promise<PhaseData> {
  const response = await fetch(PHASE_DATA_URL, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`The Phase 1 place data could not be loaded (${response.status}).`);
  }

  return parsePhaseData(await response.json());
}
