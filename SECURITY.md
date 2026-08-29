# Security policy

## Design constraints

Bible Map Phase 1 is a static, anonymous site. It intentionally has no
accounts, cookies, analytics, uploads, user-generated content, backend, or
private API keys. The only network connection made by the browser is to the
configured public basemap provider.

Do not add secrets to this repository or frontend environment variables. In
particular, never put credentials in a `VITE_*` value: all values with that
prefix are sent to the browser at build time.

## Security controls

- `index.html` has a restrictive CSP compatible with the self-hosted app and
  the configured MapLibre worker/tile provider.
- `public/_headers` supplies additional headers for hosts that honor it.
  GitHub Pages does not apply custom `_headers`; its deployment therefore uses
  the CSP meta tag, while header-only controls such as `frame-ancestors` cannot
  be enforced there.
- Source maps are disabled in production builds.
- Dynamic strings from the data file are rendered with DOM text APIs, not
  `innerHTML`.
- External links are chosen from trusted, static application data and opened
  with `noopener noreferrer`.

## Dependency process

Use exact versions in `package.json` and the committed lockfile. Before a
release run:

```sh
npm ci
npm run check
npm run audit
npm run licenses
```

Review any dependency change for maintenance status, install-time scripts, and
license compatibility. Do not add a package merely for a small utility that
can be implemented locally.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Until a dedicated
security contact exists, notify the repository owner privately and include
reproduction steps and affected version information.
