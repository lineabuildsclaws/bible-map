# Attributions and data notices

## Application code

The original application code in this repository is licensed under the [MIT License](./LICENSE).

## Biblical geography data

`public/data/phase1-places.geojson` is an intentionally small, adapted Phase 1
selection derived from [OpenBible.info Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data),
retrieved at commit `7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f` on 2026-08-29.
It is made available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The source data was processed into a presentation-oriented GeoJSON subset:

- only the Phase 1 places and uncertainty candidates are included;
- labels, concise reference lists, and interface descriptions were written for this application;
- Sodom and Gomorrah are deliberately represented as uncertain proposal areas rather than fixed locations.

Please credit “OpenBible.info Bible Geocoding Data, adapted” and link to the
source repository when reusing this data subset.

No OpenBible images or Bible verse text are included in this application.

## Basemap and map renderer

- Map rendering: [MapLibre GL JS](https://maplibre.org/), BSD 3-Clause License.
- Basemap style and tiles: [OpenFreeMap](https://openfreemap.org/), using its Positron style.
- Geographic data in the basemap: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
  available under the [Open Database License](https://opendatacommons.org/licenses/odbl/).
- Vector-tile production: © [OpenMapTiles](https://openmaptiles.org/), with the provider notices carried by the style.

The map interface displays the provider attribution while it is in use.

## Dependency inventory

`THIRD_PARTY_LICENSES.json` is generated from the locked installed dependency
tree with `npm run licenses`. It records the resolved package versions and
declared licenses. It is an inventory, not a replacement for individual
license texts or notices.
