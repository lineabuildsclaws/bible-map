export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const PHASE_DATA_URL = `${import.meta.env.BASE_URL}data/phase1-places.geojson`;

export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [34.15, 30.75],
  [36.05, 32.85],
];

export const INITIAL_VIEW = {
  center: [35.12, 31.83] as [number, number],
  zoom: 7.15,
};
