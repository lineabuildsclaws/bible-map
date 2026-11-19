# Bible Map project memory

Last updated: 2026-11-18

## User meaning of fixed

The user explicitly clarified: “When I say fix the issue, I always mean the live site.” A fix is complete only after deploying to https://interactivebiblemap.pages.dev/ and verifying the served build and reported behavior. Local implementation or passing tests alone must never be reported as fixed. The user authorized deploying the full email-issue backlog on November 18.

## Live release on 2026-11-18

The complete 16-item email issue backlog is deployed to the existing Cloudflare Pages production site and verified there. Production deployment: `173fcf4c-f93c-4092-9141-6a770b635a62`; application asset `index-CQHd5N22.js`. Every public application/data file matched the release archive byte for byte. See `docs/RELEASE-2026-11-18.md` and `docs/issue-audit-2026-11-18/` for per-issue closure and screenshots.

Search and Distance share ranked suggestions and reference context, including name-plus-reference queries such as `Edrei Deut 3:1`. Distance selections retain biblical identity. Every leg now has its own distance for the selected method. The dataset has 40 source courses, including available valley/wadi lines; Valley of Arnon and Brook Zered have clearer names with old aliases retained. Selected courses frame their full extent. Previous local-only fixes (canonical identity, Laban, southern Dizahab, land detours, reorder and Clear All) are included in this production release. Document/data responses use no-cache.

`npm run check` passed with 45 tests. Full live source audit matched all 1,278 selected coordinates. Live browser checks covered matching suggestions, measured identities, land/direct leg distances, mouse/keyboard/button reorder, Clear All, stop limit/removal, mobile contexts and source line rendering, with no application errors. No Git commit/push was made; the older GitHub Pages site is outside this release.

## Local changes on 2026-10-24

The email issue backlog has been implemented locally; these changes have not
been committed, pushed or deployed. See `docs/LOCATION-QA.md` for root causes,
release QA and reproduction. Distance now prioritizes canonical biblical names,
requires reference-qualified choices for ambiguous names, retains alternative
identifications, supports drag/keyboard/button reordering and Clear All, and
provides a coarse land-detour estimate as well as straight-line measurement.
The user explicitly requested sensible distances around seas; the new estimate
uses modern Natural Earth land/lake geometry without roads or historical-route
claims. Earlier straight-line-only constraints below are superseded by this.

The generator now ranks ancient identifications before resolving modern bases,
fixing Laban and 32 other selections (including the explicit southern Dizahab
preference). A full live coordinate audit additionally corrected Apollonia's
source drift. Dizahab remains labeled less than 10% confidence, with the northern
alternative selectable. River courses are retained from source GeoJSON, while
internal representative points remain available for measurement. All 1,278
selected coordinates were compared to current OpenBible GeoJSON with zero
remaining mismatches. `npm run check` now includes the pinned-source audit;
`npm run data:audit:live` reruns live comparisons. The live report is separate
from the offline report to preserve release evidence.

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
connected to GitHub. The November 18, 2026 production release supersedes the September build (see release record above). The 2026-09-09 deployment was verified in Chrome: the app
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

## Follow-up corrections November 18

Deployed index-CnPNKvnV.js: land routes now connect exact selected endpoints to the grid and count these connections; removed duplicate modern-identification stop list from distance results; replaced visible reorder arrows/buttons with :: grip on hover/focus. Verified Jerusalem–Chezib live and mouse dragging. 45 tests and build passed. Land routing remains a coarse estimate.

## Distance UI clarification November 18

User requests strict scope: no second location-proposal menu after selecting a Distance suggestion, and no distance-method menu. Both removed from Distance. Keep default land estimation. :: grip belongs outside input on LEFT, shown on hover/focus. Replaced native HTML drag with captured pointer gesture; verified actual mouse dragging in both directions on live production. Deployed asset index-Cvged3kJ.js; 45 tests and full check pass. Screenshot live-left-grip.jpg.

## Latest distance preference and layout correction

User explicitly wants straight-line distance only, without any method selector. Supersedes prior land-estimation preference. Removed live walking-grid fetch and routing from Distance UI; all legs and map lines use exact selected points. Fixed remove-stop × occupying its own row: now third grid column on same input row. Verified three stops Chezib/Jerusalem/Hebron, 61 km straight-line total, inline removal live. Asset index-CIFcZycm.js, CSS index-C3Jhn-Qx.css; public files byte-verified.

## Latest units and button styling

Distance UI displays kilometres only (total and legs), no miles. Add Place and Clear All have equal 116×36 CSS pixel dimensions with matching 16px/400 typography; verified live. Deployed index-Dd5Hoimn.js and index-p7hJW4KB.css, byte matched to public assets. 45 tests and checks passed.
