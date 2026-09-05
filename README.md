# Bible Map

A calm, interactive 2D atlas for seeing biblical places in geographic context.
The current release covers all 116 mappable place records mentioned in Genesis
in the source snapshot, from Crete to Elam and Arabia to Armenia. Nod is also
recognized in the coverage note, but is not plotted because its location is
unknown in the source data.

## What the Genesis map does

- searches biblical names, translation variants, and leading modern associations;
- uses zoom-aware label tiers to keep continent and local views readable;
- searches and immediately centers a selected place, with no cinematic flight;
- uses an appropriate selection zoom for broad regions and precise sites;
- explains feature type, confidence, modern association, Genesis references,
  source, and alternative proposals;
- treats Sodom and Gomorrah as competing candidate regions, not settled facts.

## Local development

Requires Node 22+ and npm 10+.

```sh
npm ci
npm run dev
```

Quality checks:

```sh
npm run check
npm run audit
npm run licenses
```

The production bundle is created by `npm run build` in `dist/`. It intentionally
omits source maps.

## Data refresh

The browser loads a static, display-oriented GeoJSON file rather than querying
the source at runtime. To refresh it:

1. Retrieve the current [OpenBible Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data).
2. Run `scripts/generate-genesis-data.mjs` against the downloaded
   `data/ancient.jsonl`, setting `OPENBIBLE_COMMIT` and `OPENBIBLE_RETRIEVED`.
3. Review the generated count, the `unlocatedPlaces` metadata, lower-confidence
   records, and the curated Phase 1 overrides—notably Sodom and Gomorrah.
4. Update the source commit and retrieval date in `ATTRIBUTIONS.md`.
5. Preserve CC BY 4.0 attribution and describe the adaptation.
6. Run the quality checks above and manually verify the selected-place and
   uncertainty treatments in a browser.

Example:

```sh
OPENBIBLE_COMMIT=<commit> OPENBIBLE_RETRIEVED=<yyyy-mm-dd> \
  node scripts/generate-genesis-data.mjs /path/to/Bible-Geocoding-Data/data/ancient.jsonl
```

## Deployment

The included GitHub Actions workflow runs checks on pushes and pull requests,
then deploys the default branch to GitHub Pages. In repository settings, set
**Pages → Source** to **GitHub Actions**. The Vite build uses relative asset
paths, so it works on a project page without a custom domain.

The `public/_headers` file is included for a future static host that supports
custom response headers. GitHub Pages does not honor it; see `SECURITY.md` for
the resulting limitation.

## Attribution and licensing

See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) for required data, map, and renderer
attribution. Original source code is [MIT licensed](./LICENSE). The included
biblical-geography data remains separately licensed CC BY 4.0, and the basemap
data carries OpenStreetMap’s ODbL notice.

## Roadmap

- Passage mode: search a Genesis passage, highlight referenced places, and fit
  them into one quiet map view.
- Modern-name support: alternate-name search and optional modern labels.
- No satellite imagery, accounts, tracking, or numeric distance measurement is
  planned for the initial product.
