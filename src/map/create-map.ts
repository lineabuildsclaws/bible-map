import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { INITIAL_VIEW, MAP_BOUNDS, MAP_STYLE_URL } from '../config';
import type { BibleMapData, PlaceFeature } from '../types';

const MAP_SOURCE_ID = 'genesis-places';
const SELECTED_SOURCE_ID = 'selected-place';
const LOCAL_CITY_LAYER_ID = 'label_city_local';
const LOCAL_PLACE_MIN_ZOOM = 10.5;
const OVERVIEW_CITY_MAX_RANK = 7;
const CANDIDATE_AREA_LAYER_IDS = ['candidate-area-fill', 'candidate-area-outline'] as const;
const CANDIDATE_PLACE_IDS = new Set(['a0aa664', 'aa572e2']);
const LABEL_TIERS = [3.8, 4.5, 5.2, 6.2, 8.2] as const;
const PLACE_HIT_LAYER_IDS = LABEL_TIERS.map((tier) => `place-hit-area-${tier}`);
const QUIET_BASEMAP_LABELS = [
  ['label_town', LOCAL_PLACE_MIN_ZOOM],
  ['label_village', 11.25],
  ['label_other', 12],
] as const;
const ENGLISH_BASEMAP_LABEL: ExpressionSpecification = [
  'case',
  ['has', 'name:nonlatin'],
  ['coalesce', ['get', 'name_en'], ['get', 'name:latin']],
  ['coalesce', ['get', 'name_en'], ['get', 'name']],
];

// MapLibre normally resolves its data worker beside its own module. Vite rolls
// the main module into our application bundle, so that default URL would point
// to a non-existent file in `assets/` after deployment. Importing the worker
// as a bundled worker keeps its shared dependencies intact, serves the decoder
// from the same origin, and works with our CSP.
setWorkerUrl(mapLibreWorkerUrl);

export interface BibleMapController {
  selectPlace: (place: PlaceFeature, options?: { move?: boolean; preserveZoom?: boolean }) => void;
  destroy: () => void;
}

interface CreateBibleMapOptions {
  container: HTMLElement;
  data: BibleMapData;
  detailPanel: HTMLElement;
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

function configureBasemapLabels(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;

    const textField = layer.layout?.['text-field'];
    if (JSON.stringify(textField).includes('name:nonlatin')) {
      map.setLayoutProperty(layer.id, 'text-field', ENGLISH_BASEMAP_LABEL);
    }
  }

  for (const [layerId, minZoom] of QUIET_BASEMAP_LABELS) {
    if (map.getLayer(layerId)) map.setLayerZoomRange(layerId, minZoom, 24);
  }

  const cityLayer = map.getStyle().layers?.find((layer) => layer.id === 'label_city');
  if (cityLayer?.type !== 'symbol' || map.getLayer(LOCAL_CITY_LAYER_ID)) return;

  map.addLayer(
    {
      ...cityLayer,
      id: LOCAL_CITY_LAYER_ID,
      minzoom: LOCAL_PLACE_MIN_ZOOM,
      filter: [
        'all',
        ['==', ['get', 'class'], 'city'],
        ['!=', ['get', 'capital'], 2],
        ['>', ['coalesce', ['get', 'rank'], 99], OVERVIEW_CITY_MAX_RANK],
      ],
    },
    'label_city_capital',
  );
  map.setFilter('label_city', [
    'all',
    ['==', ['get', 'class'], 'city'],
    ['!=', ['get', 'capital'], 2],
    ['<=', ['coalesce', ['get', 'rank'], 99], OVERVIEW_CITY_MAX_RANK],
  ]);
}

function setCandidateAreaVisibility(map: MapLibreMap, placeId?: string): void {
  const visible = placeId !== undefined && CANDIDATE_PLACE_IDS.has(placeId);
  for (const layerId of CANDIDATE_AREA_LAYER_IDS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
  }
}

export function createBibleMap(options: CreateBibleMapOptions): BibleMapController {
  const { container, data, detailPanel, onPlaceSelected, onReady } = options;
  const placesById = new Map(data.places.map((place) => [place.properties.id, place]));

  const map = new MapLibreMap({
    container,
    style: MAP_STYLE_URL,
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    minZoom: 3.2,
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

  const detailPopup = new Popup({
    anchor: 'bottom',
    className: 'place-details-popup',
    closeButton: false,
    closeOnClick: false,
    focusAfterOpen: false,
    maxWidth: 'none',
    offset: 24,
  });
  let lastSelectedPlaceId: string | undefined;

  const selectPlace = (
    place: PlaceFeature,
    { move = true, preserveZoom = false }: { move?: boolean; preserveZoom?: boolean } = {},
  ): void => {
    lastSelectedPlaceId = place.properties.id;
    const selectedSource = map.getSource(SELECTED_SOURCE_ID) as GeoJSONSource | undefined;
    selectedSource?.setData(featureForSource(place));
    setCandidateAreaVisibility(map, place.properties.id);

    const [longitude, latitude] = place.geometry.coordinates;
    if (longitude === undefined || latitude === undefined) return;

    if (move) {
      const selectionZoom = place.properties.selectionZoom;
      map.jumpTo({
        center: [longitude, latitude],
        zoom: preserveZoom ? map.getZoom() : selectionZoom <= 6.2 ? selectionZoom : Math.max(map.getZoom(), selectionZoom),
      });
    }

    onPlaceSelected(place);
    detailPanel.classList.add('place-panel--anchored');
    detailPopup.setLngLat([longitude, latitude]).setDOMContent(detailPanel).addTo(map);
  };

  const clearSelection = (): void => {
    const selectedSource = map.getSource(SELECTED_SOURCE_ID) as GeoJSONSource | undefined;
    selectedSource?.setData(emptyFeatureCollection());
    setCandidateAreaVisibility(map);
    detailPopup.remove();
  };

  // Do not wait for every remote tile to finish before the app becomes useful.
  // `style.load` is sufficient to add our self-contained GeoJSON layers and keeps
  // search available if a provider is briefly slow to return vector tiles.
  map.on('style.load', () => {
    if (map.getSource(MAP_SOURCE_ID)) return;

    configureBasemapLabels(map);

    map.addSource(MAP_SOURCE_ID, { type: 'geojson', data: data.features });
    map.addSource(SELECTED_SOURCE_ID, { type: 'geojson', data: emptyFeatureCollection() });

    map.addLayer({
      id: 'candidate-area-fill',
      type: 'fill',
      source: MAP_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'candidate-area'],
      layout: {
        visibility: 'none',
      },
      paint: {
        'fill-color': '#b58b47',
        'fill-opacity': 0.11,
      },
    });

    map.addLayer({
      id: 'candidate-area-outline',
      type: 'line',
      source: MAP_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'candidate-area'],
      layout: {
        visibility: 'none',
      },
      paint: {
        'line-color': '#9b6a25',
        'line-width': 1.8,
        'line-opacity': 0.8,
        'line-dasharray': [2.5, 2.1],
      },
    });

    for (const tier of LABEL_TIERS) {
      const tierFilter: ExpressionSpecification = [
        'all',
        ['==', ['get', 'kind'], 'place'],
        ['==', ['get', 'labelMinZoom'], tier],
      ];

      map.addLayer({
        id: `place-markers-${tier}`,
        type: 'circle',
        source: MAP_SOURCE_ID,
        minzoom: tier,
        filter: tierFilter,
        paint: {
          'circle-radius': ['match', ['get', 'status'], 'uncertain', 7.2, ['match', ['get', 'featureType'], 'Region', 6.2, 5.2]],
          'circle-color': [
            'case',
            ['==', ['get', 'status'], 'uncertain'],
            '#f5efe1',
            [
              'match',
              ['get', 'featureType'],
              ['River', 'Body of water', 'Valley', 'Mountain range', 'Natural area', 'Hill'],
              '#477997',
              'Region',
              '#756b51',
              '#3c6659',
            ],
          ],
          'circle-stroke-color': ['match', ['get', 'status'], 'uncertain', '#9b6a25', '#f7f2e8'],
          'circle-stroke-width': ['match', ['get', 'status'], 'uncertain', 2, 1.5],
          'circle-opacity': 1,
        },
      });
    }

    for (const tier of LABEL_TIERS) {
      map.addLayer({
        id: `place-labels-${tier}`,
        type: 'symbol',
        source: MAP_SOURCE_ID,
        minzoom: tier,
        filter: ['all', ['==', ['get', 'kind'], 'place'], ['==', ['get', 'labelMinZoom'], tier]],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['match', ['get', 'status'], 'uncertain', 12.5, ['match', ['get', 'featureType'], 'Region', 14.5, 13.5]],
          'text-offset': ['get', 'labelOffset'],
          'text-anchor': ['get', 'labelAnchor'],
          'text-justify': 'auto',
          'text-line-height': 1.12,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'symbol-sort-key': ['*', -1, ['get', 'labelPriority']],
        },
        paint: {
          'text-color': [
            'match',
            ['get', 'status'],
            'uncertain',
            '#84531d',
            'associated',
            '#315f54',
            [
              'match',
              ['get', 'featureType'],
              ['River', 'Body of water', 'Valley', 'Mountain range', 'Natural area', 'Hill'],
              '#315f79',
              'Region',
              '#5e563f',
              '#28231d',
            ],
          ],
          'text-halo-color': '#faf8f2',
          'text-halo-width': 1.8,
        },
      });
    }

    map.addLayer({
      id: 'water-anchor-labels',
      type: 'symbol',
      source: MAP_SOURCE_ID,
      minzoom: 6,
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

    for (const tier of LABEL_TIERS) {
      map.addLayer({
        id: `place-hit-area-${tier}`,
        type: 'circle',
        source: MAP_SOURCE_ID,
        minzoom: tier,
        filter: ['all', ['==', ['get', 'kind'], 'place'], ['==', ['get', 'labelMinZoom'], tier]],
        paint: {
          'circle-radius': 18,
          'circle-opacity': 0,
          'circle-stroke-opacity': 0,
        },
      });
    }

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('mousemove', (event: MapMouseEvent) => {
      const isOverPlace = map.queryRenderedFeatures(event.point, { layers: PLACE_HIT_LAYER_IDS }).length > 0;
      map.getCanvas().style.cursor = isOverPlace ? 'pointer' : '';
    });

    map.on('mouseout', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', (event: MapMouseEvent) => {
      const clickedPlaces = map
        .queryRenderedFeatures(event.point, { layers: PLACE_HIT_LAYER_IDS })
        .map((feature) => {
          const id = featureId(feature);
          return id ? placesById.get(id) : undefined;
        })
        .filter((place): place is PlaceFeature => place !== undefined);

      if (clickedPlaces.length === 0) {
        clearSelection();
        return;
      }

      const place =
        clickedPlaces.find((candidate) => candidate.properties.id === lastSelectedPlaceId) ??
        clickedPlaces.sort((left, right) => right.properties.confidenceScore - left.properties.confidenceScore)[0];
      if (place) selectPlace(place, { preserveZoom: true });
    });

    onReady();
  });

  return {
    selectPlace,
    destroy: () => {
      resizeObserver.disconnect();
      map.off('load', resizeMap);
      detailPopup.remove();
      map.remove();
    },
  };
}
