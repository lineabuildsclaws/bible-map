import { Map as MapLibreMap, NavigationControl, type GeoJSONSource, type MapGeoJSONFeature, type MapMouseEvent } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { INITIAL_VIEW, MAP_BOUNDS, MAP_STYLE_URL } from '../config';
import type { PhaseData, PlaceFeature } from '../types';

const PHASE_SOURCE_ID = 'phase1-places';
const SELECTED_SOURCE_ID = 'selected-place';
const PLACE_HIT_LAYER_ID = 'place-hit-area';

export interface BibleMapController {
  selectPlace: (place: PlaceFeature, options?: { move?: boolean }) => void;
  destroy: () => void;
}

interface CreateBibleMapOptions {
  container: HTMLElement;
  data: PhaseData;
  onPlaceSelected: (place: PlaceFeature) => void;
  onReady: () => void;
}

function emptyFeatureCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function featureForSource(place: PlaceFeature): FeatureCollection {
  return { type: 'FeatureCollection', features: [place] };
}

function featureId(feature: MapGeoJSONFeature): string | undefined {
  const id = feature.properties.id;
  return typeof id === 'string' ? id : undefined;
}

export function createBibleMap(options: CreateBibleMapOptions): BibleMapController {
  const { container, data, onPlaceSelected, onReady } = options;
  const placesById = new Map(data.places.map((place) => [place.properties.id, place]));

  const map = new MapLibreMap({
    container,
    style: MAP_STYLE_URL,
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    minZoom: 6.2,
    maxZoom: 13.5,
    maxBounds: MAP_BOUNDS,
    renderWorldCopies: false,
    attributionControl: false,
    pitchWithRotate: false,
    dragRotate: false,
    touchPitch: false,
  });

  // The app shell uses a viewport-height grid. In some browsers MapLibre can
  // initialize before that grid has resolved its final row height, leaving a
  // correctly positioned control UI over a zero-sized drawing buffer. Resize
  // after the first layout and whenever the frame changes so the canvas always
  // matches the visible map area.
  const resizeMap = (): void => {
    map.resize();
  };
  const resizeObserver = new ResizeObserver(resizeMap);
  resizeObserver.observe(container);
  requestAnimationFrame(resizeMap);
  map.on('load', resizeMap);

  const selectPlace = (place: PlaceFeature, { move = true }: { move?: boolean } = {}): void => {
    const selectedSource = map.getSource(SELECTED_SOURCE_ID) as GeoJSONSource | undefined;
    selectedSource?.setData(featureForSource(place));

    if (move) {
      const [longitude, latitude] = place.geometry.coordinates;
      if (longitude === undefined || latitude === undefined) return;
      map.jumpTo({
        center: [longitude, latitude],
        zoom: Math.max(map.getZoom(), 9.2),
      });
    }

    onPlaceSelected(place);
  };

  // Do not wait for every remote tile to finish before the app becomes useful.
  // `style.load` is sufficient to add our self-contained GeoJSON layers and keeps
  // search available if a provider is briefly slow to return vector tiles.
  map.on('style.load', () => {
    if (map.getSource(PHASE_SOURCE_ID)) return;

    map.addSource(PHASE_SOURCE_ID, { type: 'geojson', data: data.features });
    map.addSource(SELECTED_SOURCE_ID, { type: 'geojson', data: emptyFeatureCollection() });

    map.addLayer({
      id: 'candidate-area-fill',
      type: 'fill',
      source: PHASE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'candidate-area'],
      paint: {
        'fill-color': '#b58b47',
        'fill-opacity': 0.11,
      },
    });

    map.addLayer({
      id: 'candidate-area-outline',
      type: 'line',
      source: PHASE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'candidate-area'],
      paint: {
        'line-color': '#9b6a25',
        'line-width': 1.8,
        'line-opacity': 0.8,
        'line-dasharray': [2.5, 2.1],
      },
    });

    map.addLayer({
      id: 'place-markers',
      type: 'circle',
      source: PHASE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'place'],
      paint: {
        'circle-radius': ['match', ['get', 'status'], 'associated', 4.5, 'uncertain', 7.5, 5.4],
        'circle-color': ['match', ['get', 'status'], 'associated', '#66897e', 'uncertain', '#f5efe1', '#3c6659'],
        'circle-stroke-color': ['match', ['get', 'status'], 'uncertain', '#9b6a25', '#f7f2e8'],
        'circle-stroke-width': ['match', ['get', 'status'], 'uncertain', 2, 1.5],
        'circle-opacity': 1,
      },
    });

    map.addLayer({
      id: 'place-labels',
      type: 'symbol',
      source: PHASE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'place'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['match', ['get', 'status'], 'uncertain', 13, 14],
        'text-offset': ['get', 'labelOffset'],
        'text-anchor': ['get', 'labelAnchor'],
        'text-justify': 'auto',
        'text-line-height': 1.12,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': ['match', ['get', 'status'], 'uncertain', '#84531d', 'associated', '#315f54', '#28231d'],
        'text-halo-color': '#faf8f2',
        'text-halo-width': 1.8,
      },
    });

    map.addLayer({
      id: 'water-anchor-labels',
      type: 'symbol',
      source: PHASE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'anchor'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 15,
        'text-letter-spacing': 0.11,
        'text-line-height': 1.18,
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#477997',
        'text-halo-color': '#dcecf1',
        'text-halo-width': 1.2,
        'text-opacity': 0.84,
      },
    });

    map.addLayer({
      id: 'selected-place-halo',
      type: 'circle',
      source: SELECTED_SOURCE_ID,
      paint: {
        'circle-radius': 17,
        'circle-color': '#e2ae3b',
        'circle-opacity': 0.25,
        'circle-stroke-color': '#8a5a12',
        'circle-stroke-width': 2.2,
        'circle-stroke-opacity': 0.98,
      },
    });

    map.addLayer({
      id: 'selected-place-marker',
      type: 'circle',
      source: SELECTED_SOURCE_ID,
      paint: {
        'circle-radius': 6.5,
        'circle-color': '#8a5a12',
        'circle-stroke-color': '#fffaf0',
        'circle-stroke-width': 2,
      },
    });

    map.addLayer({
      id: 'selected-place-label',
      type: 'symbol',
      source: SELECTED_SOURCE_ID,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 15,
        'text-offset': ['get', 'labelOffset'],
        'text-anchor': ['get', 'labelAnchor'],
        'text-line-height': 1.12,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#593604',
        'text-halo-color': '#fffaf0',
        'text-halo-width': 2.5,
      },
    });

    map.addLayer({
      id: PLACE_HIT_LAYER_ID,
      type: 'circle',
      source: PHASE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'place'],
      paint: {
        'circle-radius': 18,
        'circle-opacity': 0,
        'circle-stroke-opacity': 0,
      },
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('mousemove', (event: MapMouseEvent) => {
      const isOverPlace = map.queryRenderedFeatures(event.point, { layers: [PLACE_HIT_LAYER_ID] }).length > 0;
      map.getCanvas().style.cursor = isOverPlace ? 'pointer' : '';
    });

    map.on('mouseout', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', (event: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(event.point, { layers: [PLACE_HIT_LAYER_ID] })[0];
      if (!feature) return;

      const id = featureId(feature);
      const place = id ? placesById.get(id) : undefined;
      if (place) selectPlace(place);
    });

    onReady();
  });

  return {
    selectPlace,
    destroy: () => {
      resizeObserver.disconnect();
      map.off('load', resizeMap);
      map.remove();
    },
  };
}
