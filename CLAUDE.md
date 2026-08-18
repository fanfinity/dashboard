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

**Pass oxfmt no path.** `oxfmt --check src/` covers only `src/`, but the scripts above run it
over the whole repo — `CLAUDE.md`, `docs/**`, `public/data/*.json` and `scripts/` included.
Linting only `src/` is how a green local run turns into a red CI run.

There is **no unit-test runner**. The behavioural gate is `pnpm smoke:dist`, which builds,
serves `dist/spa`, signs in for real, walks every route in the screen manifest, and fails on any
console error, uncaught error, rendered `ErrorState`, unresolved route, or missing `<h1>`.
It needs `SMOKE_EMAIL`/`SMOKE_PASSWORD` in `.env` (see `.env.example`) — but **`smoke.mjs` never
loads `.env` itself**, it only reads `process.env`, so bare `pnpm smoke:dist` exits 2 unless those
two are already exported in the shell. The form that works from a clean shell is
`pnpm build && node --env-file=.env scripts/smoke.mjs --serve`, and that is what
`.vscode/tasks.json` runs. Teaching `smoke.mjs` to call `process.loadEnvFile()` itself would fix
it properly and nobody has done it yet.

`SMOKE_ROUTES` narrows the walk while iterating —
`SMOKE_ROUTES=/pipes,/sources node --env-file=.env scripts/smoke.mjs --serve` — then run it
unfiltered once to confirm nothing else broke. A route named there that is not in the manifest
is an error, not a silent skip.

`pnpm build` is the other gate worth leaning on: it hard-fails on unresolved `@/` imports,
unimported components and malformed templates.

**Never run `pnpm dev` (or `quasar dev`) yourself.** The user always runs the dev server
themselves in watch mode, in a separate terminal. It's already running with HMR — edits to
source files apply automatically, so there's no need to start, stop, or restart it.

**Use `pnpm worktree <name>` to create a worktree**, never bare `git worktree add`. `.env` is
gitignored, so `git worktree add` copies tracked files only and leaves the new tree with no
Firebase config — sign-in then fails and the auth guard bounces every route to `/login`, which
looks like a broken app rather than a missing file. The script copies `.env` across and runs
`pnpm install`, which is needed because `postinstall` runs `quasar prepare`. Each worktree gets
its own `dist/`, so concurrent builds do not race.

`.vscode/tasks.json` is committed and wraps each of the commands above as a VS Code task
(command palette → "Tasks: Run Task"). Two things about it: `options.shell` forces a **login**
zsh (`zsh -l -c`) because VS Code otherwise runs a non-login shell that never sources
`.zprofile`, so `nvm`/`pnpm` don't resolve; and its "Dev server" task exists for the user, not
for you — the rule above still holds.

## Stack

Quasar 2 (Quasar CLI with Vite) + Vue 3 (`<script setup>`) + vue-router. Styling is **Tailwind
CSS v4** (via `@tailwindcss/vite` + PostCSS) used alongside Quasar's own components and SCSS —
both `app.scss` and `tailwind.css` are loaded. Charts use ApexCharts (`vue3-apexcharts`).

Router uses **hash mode** (`vueRouterMode: 'hash'` in `quasar.config.js`). The `@/` alias maps
to `src/`. All app routes are children of `src/layouts/MainLayout.vue`, except `/login` and
`/design-system`, which are top-level and unauthenticated.

Hash mode has one consequence worth internalising: the whole route lives after the first `#`,
so an in-page `href="#some-id"` **replaces the route** instead of scrolling. Anchor navigation
has to go through `scrollIntoView` — see `src/pages/design-system/DesignSystemPage.vue`.

### Two Quasar/Tailwind cascade collisions

Tailwind v4 emits utilities into `@layer utilities`; Quasar's base stylesheet is **unlayered**,
and unlayered CSS beats layered CSS regardless of specificity. Both of these have cost real time:

1. **Headings need the important _suffix_** — `text-2xl!`, never `!text-2xl`. Covered at length
   in `docs/ui-conventions.md` rules 2–3.
2. **A bare `hidden` can never be turned back on.** Quasar ships
   `.hidden { display: none !important }`, so `class="hidden lg:block"` is permanently hidden at
   every width. Use the inverse variant — `class="max-lg:hidden"` — which generates a class name
   Quasar does not define. If an element is inexplicably invisible, look for a bare `hidden`.

## Screen manifest — routes are generated, not hand-written

`src/router/screens.js` is the single source of truth for every route.
`src/router/routes.js` builds the table from it with `import.meta.glob` (lazy loading is
preserved) and **must not be hand-edited**. A manifest entry whose page file is missing throws
at module load rather than 404-ing silently.

`screens.js` is deliberately import-free — no Vue, no `@/` aliases — so plain Node can read it.
`scripts/smoke.mjs` walks every route from it — every route in `screens`, that is, not in
`legacyScreens`. That split is load-bearing for `/live-events`, which reads the events backend
through the `/japi` dev proxy that a production build does not have.

A screen's **`group` field does three jobs**, so it has to be accurate: it picks the sidebar
section, and it is the feature-activation key that decides whether the route renders its real
page or `ComingSoonPanel`. `routes.js` throws at module load if a `group` has no entry in
`src/config/features.js`.

The product backlog (54 screens, GitHub issues #16–#69) is scaffolded: every screen already
exists as a stub page at its final path. Implementing one means **rewriting that file in place**,
never creating a file and registering a route.

One place the nav deliberately departs from one-row-per-route: **Connectors is a tab on
`/sources`**, not a screen. Browsing connector _types_ is a step in adding a source, so it lives
in `src/components/sources/ConnectorCatalog.vue` behind `/sources?tab=connectors`, and the old
`/connectors` URL redirects there from `routes.js`. Tab state is a query rather than a child route
because both halves are the same screen with the same `<h1>` — a child route would put Connectors
back in the sidebar, which is exactly what this undid.

## Feature activation — most of the sidebar is switched off

Only the CDP core is live: **Dashboard, Live events, Sources, Destinations, Pipes** and
**Settings**. The other ten modules (Warehouse, Monitoring, Profiles, Audiences, Campaigns,
Engage, Reporting, Demo lab, Secrets, Authorizations) are built but dark, and get switched on one
at a time as they become real.

`src/config/features.js` is the registry — pure data, one entry per module, `enabled` being the
shipped default. `src/composables/useFeatures.js` layers per-browser overrides from
`localStorage` (`sfere_feature_activation`) on top, and **Settings → Feature activation** is the
UI for those overrides.

- **To ship a module to everyone**: flip `enabled` in `features.js`. That is the permanent change.
- **To try one out yourself**: use the toggle. It writes only the keys you touched, so a later
  default flip still reaches you.
- `settings` carries `locked: true` because it hosts the panel — switching it off would take every
  other switch with it. `useFeatures().setActive()` refuses locked keys, not just the UI.

**This is not `useEntitlements`, and the two must not be merged.** An entitlement asks "did this
account buy the module?" and defaults optimistically **on**; activation asks "is it built yet?"
and defaults **off**. They also fail differently in the nav: an entitlement you lack removes the
row, while an inactive module renders an inert row with a `Soon` pill, because a missing row says
"does not exist" and a dimmed one says "not yet". Engage is subject to both.

The gate is in `MainLayout.vue`'s `q-page-container`, which renders `ComingSoonPanel` **instead
of** `<router-view>` when `route.meta.group` is inactive. Deliberately not a `beforeEach` guard: a
guard can only redirect, which throws away the URL you asked for. This way the address survives,
the real page component never mounts (so nothing it fetches on mount runs), and
`ComingSoonPanel` renders the screen's own title as a real `<h1>` — which is what lets
`pnpm smoke:dist` keep walking **all 54 routes** instead of being narrowed to the active few.
Any new gating must preserve that; a redirect would silently drop the gate to ~6 routes.

## UI primitives

`src/components/ui/` is **the** component kit — 39 components, all built on the Sfere token
layer. **Use them; do not re-implement their markup and do not copy their class strings into a
page.** Read `docs/ui-conventions.md` before writing any new screen.

Two naming schemes live in the folder, for a reason worth knowing:

- **16 screen primitives keep the names the screens already imported** — `PageHeader`,
  `DataTable`, `EmptyState`, `ErrorState`, `LoadingState`, `StatusBadge`, `CardPanel`,
  `NoticeBanner`, `StatCard`, `TabNav`, `FormField`, `FormSection`, `ConfirmDialog`,
  `DefinitionList`, `SelectableCard`, `ToolbarSearch`. Keeping the filenames is what let the
  Sfere implementations replace the originals across 104 files without rewriting 571 imports.
  A few of those names are now worse than what they hold (`CardPanel` is a card, `NoticeBanner`
  is an alert); that was the price of the swap.
- **23 keep their `Sfere*` names** — `SfereButton`, `SfereInput`, `SfereTable`, `SfereSection`,
  `SfereFeatureCard` and friends. These have no pre-Sfere counterpart, and the prefix keeps
  `SfereTable` distinguishable from a bare `<table>` and from `QTable`.

This is not only about consistency: `scripts/smoke.mjs` detects a broken screen by looking for
the single `[data-smoke="error"]` selector that `ErrorState` renders. Hand-rolled error blocks
would leave the only behavioural gate in the repo with nothing to assert on.

## The Sfere design system

`src/css/sfere.css` holds the token layer, measured off the live marketing site
(<https://sfere.io>) rather than eyeballed, and `src/components/ui/` holds the 39-component kit
built on it. Browse the whole thing at **`#/design-system`** (hash mode — not `/design-system`);
no sign-in required.

`src/css/tailwind.css` declares `--color-brand`, `--color-muted`, `--color-line`, `--font-sans`
and friends as aliases pointing at the `sfere-*` values, so a screen written against the app-side
names still resolves to Sfere. `src/css/quasar.variables.scss` sets `$primary` to the same purple
so Quasar's own controls match. **Never hardcode a hex in a screen** — that is what broke when the
brand changed, and the alias layer only works if nothing bypasses it.

**There is one kit.** The pre-Sfere primitives were replaced in place, not deprecated alongside
it: all 54 screens now render Sfere components.

Rules for touching it:

- The kit has exactly **two `data-smoke` attributes** — `ErrorState` (`error`) and `EmptyState`
  (`empty`) — and exactly **one Quasar dependency**, `ConfirmDialog` wrapping `q-dialog`. Both
  are named carve-outs in `docs/sfere-design-system.md`; neither is licence to add a third.
- `sfere.css` is imported from `src/css/tailwind.css` rather than registered in
  `quasar.config.js`'s `css: [...]` array. Either works; the import keeps the whole token layer
  reachable from one stylesheet.
- `StatusBadge` takes `tone`, not `variant`, and there is no `enabled` shorthand — write
  `:tone="x ? 'success' : 'neutral'"`. `FormField` takes `for-id`, not `for`.
- The three brand faces (Bricolage Grotesque, Inter, Geist Mono) are self-hosted `@fontsource`
  packages. The CSP is `default-src 'self'`, so the Google Fonts CDN is blocked; any new face
  must be added the same way.
- `/design-system` is registered directly in `routes.js` rather than in the screen manifest, so
  `scripts/smoke.mjs` does not cover it. `pnpm build` does.

Read `docs/sfere-design-system.md` before adding a component or changing a token.

### Published to claude.ai/design (tokens only)

The token layer is published as a company-wide design system at
`https://claude.ai/design/p/51046f6e-0f11-47c7-9d1e-66a183ec2ac7`. **Only the tokens and
fonts cross over — `src/components/ui/` does not.** Claude Design's agent builds in React;
the kit is Vue, so the uploaded `_ds_bundle.js` is a deliberately empty namespace. Anyone
designing there composes their own components from the Sfere tokens.

Rebuild and re-upload with:

```bash
node tools/build-design-sync-bundle.mjs        # emits ds-bundle/ (gitignored)
node .ds-sync/package-validate.mjs ./ds-bundle # the real gate — must exit 0
```

The builder is hand-written (in `tools/`, where one-off maintenance lives) because the bundled
`/design-sync` converter only supports React design systems. **Never ship `src/css/sfere.css`
raw** — it is Tailwind v4 source (`@theme`, `@utility`, bare `@fontsource` imports) and a
browser silently ignores all three, producing designs with no tokens and no fonts.

Sync inputs live in `.design-sync/` (committed): `config.json`, `NOTES.md` (read it before
re-running) and `conventions.md`. That last one is prepended to the uploaded README and
inlined into the design agent's prompt; it enumerates 54 token names, so **re-verify it
against the built CSS whenever a token is renamed** — a name that no longer resolves makes
every design the agent builds silently unstyled.

## Mock data supersedes the issue acceptance criteria

Every backlog issue says _"fetch through the generated orval client in `src/api/`"_. **That is
wrong for these screens** — there is no backend behind any of them. Data comes from mock JSON in
`public/data/`, loaded through `useMockResource()`, which follows the same
`{ data, loading, error, load() }` contract as everything else. `src/api/` remains reserved for
the real accounts/RBAC backend.

## Files that reach every screen

Nothing in this repo is off-limits to edit. But a handful of files are load-bearing enough that
changing one changes every screen at once, so they are worth a moment's thought and a line in the
commit message rather than a drive-by edit mid-task:

`src/router/**` (the manifest generates all 54 routes) · `src/layouts/MainLayout.vue` (the nav
is the IA, and the feature gate lives in its `q-page-container`) · `src/components/ui/**` (the
kit) · `src/config/features.js` + `src/composables/useFeatures.js` (which modules are switched
on at all) · `src/composables/{useMockResource,useEntitlements,useDiagram,useTemplates}.js` (the
`{ data, loading, error, load() }` contract every page is written against) · `quasar.config.js`
and `index.html` (build config and the CSP).

The bar is the same one that applies anywhere: if the change is right, make it and say why. If
you are reaching for one of these to work around a problem somewhere else, that is the signal to
stop and fix the actual problem.

`scripts/` holds what the build and the gates run; `tools/` holds one-off maintenance like
`tools/brand-rename.mjs` and `tools/make-favicons.mjs`.

`todos/` is gitignored working notes — planning docs and handover drafts that should not enter
shared history. `todos/brand-rename-todo.md` is the live record of what the rebrand still owes.
Because it is outside git, it is also outside the codemod's reach: `tools/brand-rename.mjs`
skips the whole directory.

## Data architecture

There is no owned application backend. Pages get data from three places, and the composables
all follow the same `{ data, loading, error, load() }` contract (`src/composables/`):

1. **Static mock JSON** in `public/data/*.json`, fetched via `import.meta.env.BASE_URL`
   (e.g. `ContactDetailPage.vue` loads `data/contacts.json` + `data/contact-details.json`).
   Most pages also define inline mock arrays for demo content.

   The fixtures are cross-referentially consistent — `pipes[].sourceId` resolves in
   `sources.json`, and so on. Adding fields and records is fine; **renaming or renumbering an
   existing `id` is not.** `screens.js`'s `smokeParams` point at those ids by value, and a
   broken lookup renders `undefined` silently rather than failing.

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
