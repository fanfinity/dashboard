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

There is **no unit-test runner**. The behavioural gate is `pnpm smoke:dist`, which builds,
serves `dist/spa`, signs in for real, walks every route in the screen manifest, and fails on any
console error, uncaught error, rendered `ErrorState`, unresolved route, or missing `<h1>`.
It needs `SMOKE_EMAIL`/`SMOKE_PASSWORD` in `.env` (see `.env.example`).

`pnpm build` is the other gate worth leaning on: it hard-fails on unresolved `@/` imports,
unimported components and malformed templates.

**Never run `pnpm dev` (or `quasar dev`) yourself.** The user always runs the dev server
themselves in watch mode, in a separate terminal. It's already running with HMR — edits to
source files apply automatically, so there's no need to start, stop, or restart it.

## Stack

Quasar 2 (Quasar CLI with Vite) + Vue 3 (`<script setup>`) + vue-router. Styling is **Tailwind
CSS v4** (via `@tailwindcss/vite` + PostCSS) used alongside Quasar's own components and SCSS —
both `app.scss` and `tailwind.css` are loaded. Charts use ApexCharts (`vue3-apexcharts`).

Router uses **hash mode** (`vueRouterMode: 'hash'` in `quasar.config.js`). The `@/` alias maps
to `src/`. All app routes are children of `src/layouts/MainLayout.vue`.

## Screen manifest — routes are generated, not hand-written

`src/router/screens.js` is the single source of truth for every route.
`src/router/routes.js` builds the table from it with `import.meta.glob` (lazy loading is
preserved) and **must not be hand-edited**. A manifest entry whose page file is missing throws
at module load rather than 404-ing silently.

`screens.js` is deliberately import-free — no Vue, no `@/` aliases — so plain Node can read it.
`scripts/smoke.mjs` walks every route from it.

The product backlog (54 screens, GitHub issues #16–#69) is scaffolded: every screen already
exists as a stub page at its final path. Implementing one means **rewriting that file in place**,
never creating a file and registering a route.

## UI primitives

`src/components/ui/` holds the shared building blocks — `PageHeader`, `DataTable`, `EmptyState`,
`ErrorState`, `LoadingState`, `StatusBadge` and friends. **Use them; do not re-implement their
markup and do not copy their class strings into a page.** Read `docs/ui-conventions.md` before
writing any new screen.

This is not only about consistency: `scripts/smoke.mjs` detects a broken screen by looking for
the single `[data-smoke="error"]` selector that `ErrorState` renders. Hand-rolled error blocks
would leave the only behavioural gate in the repo with nothing to assert on.

## Mock data supersedes the issue acceptance criteria

Every backlog issue says _"fetch through the generated orval client in `src/api/`"_. **That is
wrong for these screens** — there is no backend behind any of them. Data comes from mock JSON in
`public/data/`, loaded through `useMockResource()`, which follows the same
`{ data, loading, error, load() }` contract as everything else. `src/api/` remains reserved for
the real accounts/RBAC backend.

## Frozen files

These are owned by the foundation phase. If a task seems to require editing one, that is a
blocker to report, not an edit to make — see `docs/agent-workflow.md`.

`src/router/**` · `src/layouts/**` · `src/components/ui/**` ·
`src/composables/{useMockResource,useEntitlements,useDiagram,useTemplates}.js` ·
`package.json` · `quasar.config.js` · `index.html` · `.gitignore` · `scripts/**` · this file

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
   - The public connector catalog (`useConnectorCatalog.js`) hits `/api/sources` directly — that
     endpoint is public/CORS-open, no key.

3. **The Fanfinity backend** (accounts/RBAC API; `https://api-staging.fanfinity.io`
   on staging, local `../backend` via `make run` in dev):
   - Client is **generated by orval** from the backend's OpenAPI spec: `pnpm openapi`
     re-pulls `openapi/fanfinity-api.json` from staging and regenerates `src/api/`
     (typed fetchers like `getMe()` plus `@tanstack/vue-query` composables like
     `useGetMe()`; vue-query is registered in `src/boot/vue-query.js`). Never edit
     `src/api/fanfinity.ts` or `src/api/model/` by hand.
   - Auth lives in `src/api/mutator.js` (`customFetch`): prefixes `VITE_API_BASE`
     (fallback `http://localhost:8080`), attaches the Identity Platform ID token as
     a Bearer header, retries once with a force-refreshed token on 401, and throws
     `ApiError` (status + RFC 9457 problem+json body) on non-2xx.
   - `useMe.js` bootstraps the session: `useAuth.js`'s `onAuthStateChanged` calls
     `loadMe()`/`clearMe()`, populating `me` + `memberships` from `GET /v1/me`
     (best-effort — errors never block routing).
   - The backend **requires a verified email** (`401 Email is not verified`), and its
     `CORS_ALLOW_ORIGINS` must include the dashboard origin (staging currently allows
     only `https://dashboard-staging.fanfinity.io`, so browser calls from
     `localhost:9000` to staging are CORS-blocked).

4. **Derived / client-only state** built on top of the event stream:
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

## Authentication & multi-tenancy

Sign-in is Google Cloud Identity Platform (the Firebase Auth JS SDK) email/password auth,
gated by [multi-tenancy](https://docs.cloud.google.com/identity-platform/docs/multi-tenancy):

- `src/firebase.js` calls `initializeApp`/`getAuth`, then pins `auth.tenantId` from
  `VITE_FIREBASE_DEFAULT_TENANT_ID` at module init. `auth.tenantId` is an in-memory-only
  SDK property (never persisted), so it must be re-set on every full page load — which
  happens naturally here since this module's top-level code reruns each load.
- `src/composables/useAuth.js` follows the same module-singleton pattern as `useJitsu.js`:
  a lazily-attached `onAuthStateChanged` listener backing reactive `user`/`loading`/`error`,
  exposed via `useAuth()` returning `{ user, loading, error, signUp, signIn, logOut,
tenantId }`. It also exports `waitForAuthReady()`, a promise resolved on the _first_
  auth-state callback — needed because that callback is async, so anything deciding access
  on page load (like the router guard) must await it rather than read `user.value`
  immediately.
- `src/router/routes.js` tags the top-level `/` (`MainLayout`) route with
  `meta: { requiresAuth: true }`; `src/router/index.js`'s `beforeEach` awaits
  `waitForAuthReady()` and redirects to `/login?redirect=<path>` if signed out. `/login`
  itself carries no such meta.
- **Only one tenant exists today** (`fanfinity-app-fcsgt` / display name `fanfinity-app`,
  in the `koratona-9791a` project), so every user authenticates into it via the env var
  above — there is no per-user or per-email-domain tenant selection. Building that requires
  a lookup mechanism backed by a database/backend (Identity Platform's client SDK has no
  tenant-discovery API), and this repo has no owned backend (see "Data architecture" above).
  That's intentionally deferred until a second tenant exists to justify it — don't add a
  static domain→tenant mapping as a substitute; it won't scale past one real lookup case.

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
