export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const GENESIS_DATA_URL = `${import.meta.env.BASE_URL}data/genesis-places.geojson`;

export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [15, 5],
  [60, 50],
];

export const INITIAL_VIEW = {
  center: [36.25, 30.5] as [number, number],
  zoom: 4.15,
};
