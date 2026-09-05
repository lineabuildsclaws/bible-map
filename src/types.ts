import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';

export type PlaceStatus = 'confirmed' | 'identified' | 'associated' | 'uncertain';

export interface PlaceProperties extends Record<string, unknown> {
  id: string;
  kind: 'place';
  name: string;
  label: string;
  alternateNames: string[];
  labelOffset: [number, number];
  labelAnchor: 'left' | 'right' | 'top' | 'bottom' | 'center';
  labelMinZoom: number;
  labelPriority: number;
  selectionZoom: number;
  featureType: string;
  locationRole: 'Leading identification' | 'Representative point';
  status: PlaceStatus;
  confidence: string;
  confidenceScore: number;
  modernName: string;
  alternativeCount: number;
  references: string[];
  description: string;
  sourceUrl: string;
}

export type PlaceFeature = Feature<Point, PlaceProperties>;
export type MapFeature = Feature<Geometry, Record<string, unknown>>;
export type MapFeatureCollection = FeatureCollection<Geometry, Record<string, unknown>>;

export interface BibleMapData {
  features: MapFeatureCollection;
  places: PlaceFeature[];
  unlocatedPlaces: string[];
}
