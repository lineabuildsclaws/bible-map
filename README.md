# Bible Map

A calm, interactive 2D atlas for seeing biblical places in geographic context.
Phase 1 is a focused Genesis-era vertical slice: Shechem, Oak of Moreh, Bethel,
Ai, Hebron, Oak of Mamre, and explicitly uncertain Sodom and Gomorrah proposal
areas.

## What Phase 1 does

- keeps biblical place labels visible and readable on a restrained 2D basemap;
- searches and immediately centers a selected place, with no cinematic flight;
- preserves nearby landmarks to make spatial relationships clear;
- explains feature type, confidence, Bible references, source, and uncertainty;
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

The Phase 1 data is a reviewed, display-oriented subset rather than a live
client-side copy of the full source dataset. To refresh it:

1. Retrieve the current [OpenBible Bible Geocoding Data](https://github.com/openbibleinfo/Bible-Geocoding-Data).
2. Re-check place IDs, coordinates, confidence values, references, and source
   records—notably Sodom and Gomorrah.
3. Update `public/data/phase1-places.geojson` and its source commit in
   `ATTRIBUTIONS.md`.
4. Preserve CC BY 4.0 attribution and describe the adaptation.
5. Run the quality checks above and manually verify the selected-place and
   uncertainty treatments in a browser.

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

- Passage mode: search a passage, highlight referenced places, and fit them
  into one quiet map view.
- Modern-name support: alternate-name search and optional modern labels.
- No satellite imagery, accounts, tracking, or numeric distance measurement is
  planned for the initial product.
