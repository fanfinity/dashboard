# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (Node `>= 22.12`). `postinstall` runs `quasar prepare`.

```bash
pnpm install       # install deps (regenerates .quasar/)
pnpm dev           # quasar dev — HMR dev server, opens browser, runs the /japi proxy
pnpm build         # quasar build — static SPA into dist/spa
pnpm lint          # oxfmt (format) then oxlint --fix
pnpm lint:check    # oxfmt --check then oxlint (CI-style, no writes)
```

Linting/formatting is **oxlint + oxfmt**, not ESLint/Prettier. oxfmt style: no semicolons,
single quotes, printWidth 80, `arrowParens: avoid`, no trailing commas. oxlint runs only the
`correctness` category as errors (max 10 warnings).

There is **no test runner configured** — `playwright` is a devDependency but no test scripts
or specs exist yet.

## Stack

Quasar 2 (Quasar CLI with Vite) + Vue 3 (`<script setup>`) + vue-router. Styling is **Tailwind
CSS v4** (via `@tailwindcss/vite` + PostCSS) used alongside Quasar's own components and SCSS —
both `app.scss` and `tailwind.css` are loaded. Charts use ApexCharts (`vue3-apexcharts`).

Router uses **hash mode** (`vueRouterMode: 'hash'` in `quasar.config.js`). The `@/` alias maps
to `src/`. All app routes are children of `src/layouts/MainLayout.vue`; see `src/router/routes.js`.

## Data architecture

There is no owned application backend. Pages get data from three places, and the composables
all follow the same `{ data, loading, error, load() }` contract (`src/composables/`):

1. **Static mock JSON** in `public/data/*.json`, fetched via `import.meta.env.BASE_URL`
   (e.g. `ContactDetailPage.vue` loads `data/contacts.json` + `data/contact-details.json`).
   Most pages also define inline mock arrays for demo content.

2. **The Jitsu events backend** (`console.fanfinity.io`):
   - **Read** incoming events (`useLiveEvents.js`) through a same-origin dev proxy: the browser
     calls `/japi/*`, and `devServer.proxy` in `quasar.config.js` forwards to
     `https://console.fanfinity.io/api/*` with an API key as a Bearer token. This endpoint
     requires auth and is not CORS-enabled, so the proxy is the only way to reach it from the
     browser — **and the proxy only exists in `pnpm dev`**. A production build has no proxy and
     needs an equivalent reverse proxy in front of it.
   - **Write** events (`useJitsu.js`) via the bundled `@jitsu/js` browser SDK (POSTs directly to
     the console origin, allowed by CSP).
   - The public connector catalog (`useSourcesCatalog.js`) hits `/api/sources` directly — that
     endpoint is public/CORS-open, no key.

3. **Derived / client-only state** built on top of the event stream:
   - `useJitsuContacts.js` folds the raw event log into unique contact records so real visitors
     appear in the same Contacts table as mock contacts.
   - `useIdentityResolution.js` does probabilistic identity stitching over those contacts
     (rarity-weighted, Fellegi–Sunter-style scoring — see the file's header comment).
   - `useSegments.js` persists segment filter definitions in `localStorage` (no backend to
     store them). Its `FIELDS` accessors read the event shape produced by
     `useLiveEvents`' `mapIncomingEvent()` — keep them in sync if that mapper changes.

## Content-Security-Policy constraints

`index.html` sets a strict CSP: `default-src 'self'`, `script-src 'self'`, images/connections
whitelisted only to `console.fanfinity.io` (plus `ws://localhost:*` in dev). This shapes several
decisions and will break new code that ignores it:

- **Any new external host** (API, image CDN, font, analytics) must be added to the CSP meta tag.
- `assetsInlineLimit` is forced to `0` in `quasar.config.js` so no asset is inlined as a `data:`
  URI (which the CSP would block). Prefer real asset files / SVG endpoints over data URIs.
- Third-party JS must be bundled via npm (first-party `script-src 'self'`), not loaded from a CDN.

## Environment / secrets

Config lives in a gitignored `.env` at the project root:

- `EVENTS_API_KEY` (`keyId:secret`) — read **server-side** by `quasar.config.js` at config time
  (via `process.loadEnvFile`) and injected by the dev proxy. Never shipped to the client bundle.
- `VITE_*` vars (`VITE_EVENTS_WORKSPACE_ID`, `VITE_EVENTS_ACTOR_ID`, `VITE_JITSU_HOST`,
  `VITE_JITSU_WRITE_KEY`) are client-exposed by design and override in-code fallbacks. The Jitsu
  browser write key is public by design (it only authorizes ingestion).

Jitsu ingestion is **consent-gated**: `useJitsu.js` starts in a restrictive privacy mode
(nothing sent, IPs stripped, no user IDs) until the user answers `JitsuConsentBanner.vue`;
the decision is stored under the `fanfinity_jitsu_consent` localStorage key.
