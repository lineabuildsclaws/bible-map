export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const BIBLE_DATA_URL = `${import.meta.env.BASE_URL}data/bible-places.geojson`;

export const MAP_BOUNDS: [[number, number], [number, number]] = [
  [-10, 5],
  [72, 52],
];

export const INITIAL_VIEW = {
  center: [31, 30] as [number, number],
  zoom: 3 as const,
};
