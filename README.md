# Bible Map

A calm, interactive 2D atlas for seeing biblical places in geographic context.
The current release covers all 1,278 directly referenced place records with
usable coordinates in the source snapshot, spanning the Protestant Bible from
Genesis through Revelation. Seven directly referenced records are recognized
but not plotted because the source provides no identifiable location.

## What the Bible map does

- searches biblical names, translation variants, and leading modern associations;
- uses Bible-mention thresholds to show major landmarks first and defer obscure
  places until close zoom;
- searches and immediately centers a selected place, with no cinematic flight;
- measures an ordered path through up to seven mapped places using approximate straight-line distances;
- uses an appropriate selection zoom for broad regions and precise sites;
- explains feature type, confidence, modern association, Bible references,
  source, and alternative proposals;
- treats Sodom and Gomorrah as competing candidate regions, not settled facts.

## Local development

Requires Node 22+ and npm 10+.

```sh
npm ci
npm run dev
```

This checkout uses the versioned `.githooks/post-commit` hook to push each
successful local commit to its branch's configured remote automatically. Enable
it in a new clone with:

```sh
git config core.hooksPath .githooks
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
2. Run `scripts/generate-bible-data.mjs` against the downloaded
   `data/ancient.jsonl`, setting `OPENBIBLE_COMMIT` and `OPENBIBLE_RETRIEVED`.
3. Review the generated count, the `unlocatedPlaces` metadata, duplicate-name
   disambiguation, lower-confidence records, and curated overrides—notably
   Sodom and Gomorrah.
4. Update the source commit and retrieval date in `ATTRIBUTIONS.md`.
5. Preserve CC BY 4.0 attribution and describe the adaptation.
6. Run the quality checks above and manually verify the selected-place and
   uncertainty treatments in a browser.

Example:

```sh
OPENBIBLE_COMMIT=<commit> OPENBIBLE_RETRIEVED=<yyyy-mm-dd> \
  npm run data:generate -- /path/to/Bible-Geocoding-Data/data/ancient.jsonl
```

## Deployment

The primary public deployment is the free Cloudflare Pages Direct Upload site
at <https://interactivebiblemap.pages.dev/>. It is not connected to GitHub; run
`npm run check`, then upload the contents of `dist/` to the
`interactivebiblemap` Pages project when publishing an update.

The included GitHub Actions workflow runs checks on pushes and pull requests,
then deploys the default branch to GitHub Pages. In repository settings, set
**Pages → Source** to **GitHub Actions**. The Vite build uses relative asset
paths, so it works on a project page without a custom domain.

Cloudflare Pages honors the security policy in `public/_headers`. GitHub Pages
does not honor custom `_headers`; see `SECURITY.md` for the resulting
limitation.

## Attribution and licensing

See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) for required data, map, and renderer
attribution. Original source code is [MIT licensed](./LICENSE). The included
biblical-geography data remains separately licensed CC BY 4.0, and the basemap
data carries OpenStreetMap’s ODbL notice.

## Roadmap

- Passage mode: search a Bible passage, highlight referenced places, and fit
  them into one quiet map view.
- Modern-name support: alternate-name search and optional modern labels.
- No satellite imagery, accounts, tracking, or turn-by-turn route reconstruction
  is planned for the initial product.
