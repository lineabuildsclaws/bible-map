import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';

export type PlaceStatus = 'confirmed' | 'identified' | 'associated' | 'uncertain';

export interface PlaceProperties extends Record<string, unknown> {
  id: string;
  kind: 'place';
  name: string;
  label: string;
  labelOffset: [number, number];
  labelAnchor: 'left' | 'right' | 'top' | 'bottom' | 'center';
  featureType: string;
  status: PlaceStatus;
  confidence: string;
  confidenceScore: number;
  modernName: string;
  references: string[];
  description: string;
  sourceUrl: string;
}

export type PlaceFeature = Feature<Point, PlaceProperties>;
export type PhaseFeature = Feature<Geometry, Record<string, unknown>>;
export type PhaseFeatureCollection = FeatureCollection<Geometry, Record<string, unknown>>;

export interface PhaseData {
  features: PhaseFeatureCollection;
  places: PlaceFeature[];
}
