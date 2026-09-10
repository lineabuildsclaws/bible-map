# Bible Map project memory

Last updated: 2026-09-09

## Current product state

Bible Map is a static Vite/TypeScript/MapLibre application for exploring
biblical geography across the Protestant Bible from Genesis through Revelation.
The generated dataset contains 1,278 directly referenced, mappable place
records. Seven directly referenced records are recognized but not plotted
because the source provides no identifiable location: Azazel, Bamah,
Biziothiah, Holy Place, Most Holy Place, Nod, and Nohah.

The current public Cloudflare Pages deployment is:

<https://interactivebiblemap.pages.dev/>

It was created as a free Cloudflare Pages Direct Upload project and is not
connected to GitHub. The 2026-09-09 deployment was verified in Chrome: the app
loaded without console errors, reported all 1,278 mapped places, and a search
for Rome returned New Testament references. Cloudflare honors the security
headers in `public/_headers`.

The existing GitHub Pages site remains available and was deliberately left
unaffected:

<https://lineabuildsclaws.github.io/bible-map/>

The GitHub repository was still public at the end of this session. The current
full-Bible and marker-density work is local and uncommitted, so the GitHub Pages
site may remain on its older Genesis-only build until an intentional commit is
made. Do not make the repository private, commit, or push without confirming
that the user wants that remote change.

## Product intent and open context

- The intended experience is a calm, interactive 2D atlas that shows biblical
  places in geographic context.
- The user has trypophobia. Dense fields of small or hollow circular markers
  are uncomfortable and must be avoided. Map density is a product and
  accessibility constraint, not merely a styling preference.
- Major, frequently mentioned landmarks should appear first. Obscure places
  should stay hidden until the user zooms in closely, while a searched or
  selected place must always remain visible.
- The project documents desired behavior but does not yet record the user's
  personal reason for choosing to build a custom Bible map instead of using an
  existing product. Do not invent that rationale; ask the user if it becomes
  relevant.

## Implemented behavior

- The desktop UI uses a persistent left sidebar; mobile uses a vertically
  constrained, scrollable version above the map.
- The sidebar has Search and Distance tabs with keyboard-accessible tab
  switching.
- Search accepts biblical names, alternate names, translation variants, and
  leading modern identifications. Selecting a result centers the map and shows
  place details in the sidebar.
- Place details include feature type, identification confidence, modern
  association, Bible mention count and references, source, and alternative
  proposals.
- Place details appear only in Search mode. They are hidden while Distance mode
  is active.
- Distance mode starts with two place fields and supports up to seven ordered
  places. Extra fields can be added or removed.
- There is intentionally no flip/reverse control: this is a measurement tool,
  not turn-by-turn directions.
- A measurement draws numbered markers and a dashed line through the places in
  entered order, frames the full path, and displays the cumulative distance in
  kilometres and miles.
- Distance is the sum of great-circle distances between each consecutive pair
  of stored coordinates. It is explicitly described as approximate and is not
  an inferred ancient travel route.
- Map markers and labels are combined and collision-aware. Settlements use
  circles, natural features use diamonds, regions/territories use hexagons, and
  uncertain locations use filled triangles rather than hollow dotted rings.
- Bible-mention thresholds currently reveal places at these approximate zooms:
  100+ mentions at zoom 3; 50+ at 4.5; 25+ at 8.5; 10+ at 10; 5+ at 11;
  2+ at 12; and single-mention places at 13. The selected place bypasses these
  thresholds and is always shown.
- Only currently visible markers are clickable. Debated location areas retain
  their explicit uncertainty treatment when selected.
- Normal MapLibre pan/zoom remains available. Middle-mouse drag panning is also
  supported by `src/map/middle-mouse-pan.ts`.

## Important files

- `src/main.ts`: application DOM, sidebar, Search and Distance interactions.
- `src/map/create-map.ts`: MapLibre setup, density thresholds, layers, marker
  images, place selection, distance overlays, and viewport framing.
- `src/measure/distance.ts`: great-circle and cumulative route calculations.
- `src/search/places.ts`: place matching and ranking.
- `src/styles/app.css`: desktop/mobile layout and all visual treatments.
- `public/data/bible-places.geojson`: generated full-Bible display dataset.
- `public/data/phase1-places.geojson`: curated contextual records and overrides.
- `scripts/generate-bible-data.mjs`: generates the display dataset from the
  OpenBible source snapshot and curated records.
- `public/_headers`: security headers used by Cloudflare Pages.
- `tests/distance.test.ts`: distance calculation coverage.
- `tests/places.test.ts`: search, parsing, dataset coverage, mention counts, and
  reference-link coverage.

## Validation and local preview

The standard full validation command is:

```sh
npm run check
```

At the end of the 2026-09-09 session, linting, 26 Vitest tests, TypeScript
checking, and the production Vite build all passed. Vite reports an expected
large-chunk warning because MapLibre and its worker dominate the client bundle.

Run the current workspace locally with:

```sh
npm run dev -- --host 127.0.0.1
```

A development server was last used at <http://127.0.0.1:5174/>, but future
sessions should verify the active port rather than assuming the process
survived.

## Git and deployment workflow

- Remote: `https://github.com/lineabuildsclaws/bible-map.git`
- Primary branch: `main`
- `.github/workflows/ci.yml` runs checks, audits dependencies and licenses,
  builds the site, and deploys GitHub Pages after pushes to `main`.
- This clone is configured with `core.hooksPath=.githooks`.
- `.githooks/post-commit` automatically pushes every successful local commit to
  the current branch's configured remote counterpart.
- Because commits auto-push in this clone, do not create a commit unless the
  resulting public remote update is intended.
- Cloudflare Pages currently uses Direct Upload. To update it, run
  `npm run check`, then upload the contents of `dist/` to the
  `interactivebiblemap` Pages project. A GitHub push does not update Cloudflare.
- The Cloudflare deployment does not expose the GitHub username or repository
  in its public URL. A future custom domain can be added without interrupting
  either existing public URL.

## Data, attribution, and product constraints

- Place data is adapted from OpenBible.info under CC BY 4.0.
- The basemap is OpenFreeMap with OpenStreetMap contributor attribution.
- Identification confidence, representative points, and debated locations must
  remain explicit; do not present uncertain ancient geography as exact.
- Sodom and Gomorrah are treated as competing candidate regions, not settled
  facts.
- Keep the application static, account-free, and tracking-free unless the
  product direction is explicitly changed.
- Do not add modern routing or imply historically accurate paths. Measurement
  lines are visual connections between mapped coordinates only.
