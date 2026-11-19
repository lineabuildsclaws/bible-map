# Source course geometry

River GeoJSON files were retained during the October 24 location work. Valley, wadi and canal GeoJSON files were retrieved on November 18, 2026 from https://a.openbible.info/geo/data/<ancient-id>.geojson under OpenBible.info CC BY 4.0.

The generator matches geometry IDs and the selected modern basis from the pinned ancient.jsonl revision 7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f. It preserves a LineString or MultiLineString only when that selected resolution has an available matching source course. It does not substitute a different candidate's river for a region or valley with only an area/point identification. The resulting dataset has 40 selected courses (28 rivers and 12 valleys/wadis). Representative coordinates remain internal measurement anchors.
