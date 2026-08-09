# Brand rename — Fanfinity → Sfere

Status of the rebrand: what has shipped in the codebase, and what is still
outstanding. The outstanding items are almost all blocked on something outside
this repo — DNS, a GCP resource, the backend's OpenAPI spec, a design file.

The codemod that did the mechanical half is `tools/brand-rename.mjs`. Run
`node tools/brand-rename.mjs --verify` at any time: it prints every remaining
`fanfinity` in the tree together with the reason it survived. **That output and
the "Pending" section below must agree.** A surviving occurrence with no entry
here is a bug in the script; an entry here with no surviving occurrence means
something was renamed that should have been deferred.

---

## Done

### The codemod

`tools/brand-rename.mjs` — a selective replace, not `s/fanfinity/sfere/g`. It
carries two lists: `SKIPPED_PATHS` (files never opened) and `PRESERVED_SPANS`
(exact substrings that survive inside files that are otherwise rewritten). It
defaults to a dry run and needs `--write` to touch anything.

It lives in `tools/` rather than `scripts/` because `scripts/**` is a frozen
path.

Applied: **104 lines across 41 files.**

### Copy, code and data

- All user-facing product copy — page subtitles, empty-state descriptions, form
  hints, destructive-action confirmations, field placeholders.
- All mock data in `public/data/` — sender names and addresses
  (`hello@sfere.io`), asset URLs (`assets.sfere.io`), warehouse hosts and
  service users (`SFERE_SVC`, `sfere-prod.eu-central-1.snowflakecomputing.com`),
  seeded user accounts, workspace name and slug.
- Code comments and composable-level docs.
- `README.md`, `docs/sfere-design-system.md`, `docs/ui-conventions.md`,
  `docs/reference/meiro/README.md`, `CLAUDE.md`.
- `.devcontainer/devcontainer.json` container name.
- `.github/workflows/deploy-pages.yml` comments.

### The design system, applied

Previously the Sfere tokens existed but applied to nothing. They now drive the
whole app.

- **`src/css/tailwind.css` is now an alias layer.** The names the 54 screens are
  written against (`--color-brand`, `--color-ink`, `--color-muted`,
  `--color-subtle`, `--color-sidebar`, `--color-fill`, `--color-line`,
  `--color-line2`, `--color-success*`, `--font-sans`) all resolve to values from
  `src/css/sfere.css`. No markup changed anywhere; every screen inherits the
  palette. Reverting that one file undoes the entire visual change.
- **`--color-brand`: `#3800c1` → `#854dff`** (sfere-600). Passes AA on white.
- **Typography.** Body is Inter. `h1`–`h6` get Bricolage Grotesque via an
  unlayered element rule at the bottom of `tailwind.css` — unlayered so it beats
  both Tailwind's layered utilities and Quasar's unlayered base, which is the
  same collision `docs/ui-conventions.md` rules 2–3 describe. The four
  `@fontsource/plus-jakarta-sans` imports were dropped from `tailwind.css`.
- **`src/css/quasar.variables.scss`: `$primary` → `#854dff`.** Without this,
  Quasar's own `q-toggle` / `q-select` / `q-checkbox` / spinners keep painting
  the old purple regardless of the Tailwind tokens.
- **`--color-chart-1` → `#854dff`**, so a chart's primary series and the app
  accent are the same purple.
- **Hardcoded hexes** in `src/components/shell/ThroughputChart.vue`,
  `src/components/monitoring/chart-palette.js` and
  `src/assets/dashboard/ic-integrations.svg` repointed. These bypassed the token
  layer and would otherwise have stayed old-brand.

One addition to the documented mapping: **`--color-success-line` → `#a7f3d0`.**
`sfere.css` carries `success` and `success-soft` but no border step, and
emerald-200 sits on the same ramp as both.

**Two pairs of tokens collapse to one value each** — `line`/`line2` and
`muted`/`subtle`. Both names in each pair are kept so no markup changes, but
there is no longer a visual difference between them.

The `muted`/`subtle` collapse was worth arguing about. Keeping them distinct
means moving `subtle` up the neutral ramp, and `#a1a1a1` — the obvious next
step — is **2.6:1 on white**, under the 4.5:1 AA floor. `subtle` carries column
headers and hints, which are content, so that is not an acceptable trade: it
would have shipped a contrast regression across all 54 screens against a value
(`#6a7282`, 4.8:1) that passed. Grey-on-white hits the floor at about `#767676`,
so no value both separates from `muted` (`#737373`, 4.7:1) and stays legible.
Both tokens take `#737373`; the third hierarchy level has to come from weight or
size instead. See item 8.

### Logo and mark

- `src/layouts/MainLayout.vue` renders `public/brand/sfere-logo.svg` at 22px.
  Served from `public/brand/` rather than imported from `src/assets/`, so there
  is one copy of the brand asset shared with `SfereLogo` and the design-system
  page.
- `src/assets/dashboard/logo.svg` (the old wordmark) deleted; nothing imported
  it afterwards.
- `public/favicon.svg` redrawn from `sfere-mark.svg`. The three faintest nodes
  (r=1.4 at 38% opacity) are dropped and the viewBox squared — at 16px they
  rendered as grey mush.

### History removed

The design system used to document itself as "Fanfinity becoming Sfere". After
the token repoint those statements were not merely off-brand, they were false.

- `src/components/sfere-docs/sections/MigrationNotes.vue` **deleted** — the
  component was entirely a before/after token mapping table. Removed from
  `DesignSystemPage.vue` and from its section nav. The old values it held are
  preserved in the "Deviations" table above and in git history.
- Design-system page: eyebrow "Fanfinity is becoming Sfere" → "Design system";
  the "Screens rebranded: 0 — additive by design" stat → "Screens on the tokens:
  54".
- `src/css/sfere.css` rule 1 rewritten: it claimed "ADDITIVE ONLY … nothing here
  redefines a token in tailwind.css", which is now the opposite of the truth.
- `docs/sfere-design-system.md`: "What this branch does and does not do" →
  "How it reaches the app"; "Adopting it" → "The alias layer".
- `CLAUDE.md`: "It is additive and applies to nothing" → a description of what
  the tokens actually cover, plus a rule against hardcoding hexes in screens.

### Frozen files edited

Authorized as a foundation-phase change and recorded in
`docs/sfere-design-system.md`:

| File                         | Change                                           |
| ---------------------------- | ------------------------------------------------ |
| `package.json`               | `name`, `description`, `keywords`, `productName` |
| `src/layouts/MainLayout.vue` | sidebar logo source and `alt`                    |
| `quasar.config.js`           | `appId` → `sfere-dashboard`                      |
| `src/router/routes.js`       | one comment                                      |
| `CLAUDE.md`                  | design-system and frozen-files sections          |

`index.html` was **not** edited. Its `<title>` interpolates `productName` from
`package.json`, so the browser tab already reads "Sfere"; the only brand strings
left in that file are live CSP hosts (see below).

### Gates

- `pnpm build` — passes.
- `pnpm lint` — passes.
- **Smoke — 54/54 routes clean.** Signs in for real and walks every route in the
  screen manifest, failing on any console error, uncaught error, rendered
  `ErrorState`, unresolved route or missing `<h1>`. This is what confirms the
  deleted component, the `MainLayout` logo rebinding and the token repoint are
  clean at runtime rather than just at build time.

  Note: `pnpm smoke:dist` aborts with "SMOKE_EMAIL / SMOKE_PASSWORD are unset"
  even when both are set in `.env`. `scripts/smoke.mjs` reads `process.env`
  directly and never loads the file, so the documented invocation cannot work
  as written. Run it as:

  ```bash
  pnpm build && node --env-file=.env scripts/smoke.mjs --serve
  ```

  Pre-existing and unrelated to the rename. Fixing it properly means adding
  `--env-file=.env` to the `smoke` / `smoke:dist` scripts in `package.json`, or
  calling `process.loadEnvFile()` in `scripts/smoke.mjs` the way
  `quasar.config.js` already does — both frozen files, and neither is a brand
  change, so it is left alone here.

- Browser check on `#/design-system` and `#/login`: `--color-brand` resolves to
  `#854dff`, body font to Inter, `h1` to Bricolage Grotesque Variable, tab title
  to "Sfere", and the brand SVGs serve 200 from `public/brand/`.

---

## Pending

Ordered roughly by what blocks what.

### 1. Environment files — deliberately untouched

`.env` and `.env.example` were excluded on instruction and are in the codemod's
`SKIPPED_PATHS`. When they move, they move together, and
`VITE_FIREBASE_DEFAULT_TENANT_ID` is the one that matters — see item 3.

### 2. DNS and deploy targets

Every one of these is a live record. Renaming the string in the repo without
first creating the DNS entry takes the app down.

| Where                                                                                                 | Value                                                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `public/CNAME`                                                                                        | `app-dev.fanfinity.io`                                                   |
| `quasar.config.js` comment                                                                            | `app-dev.fanfinity.io`                                                   |
| `index.html` CSP `img-src` / `connect-src`                                                            | `console.fanfinity.io`                                                   |
| `index.html` CSP, `.github/workflows/deploy-pages.yml`                                                | `api-staging.fanfinity.io`                                               |
| `index.html` CSP, `src/composables/useProfileApi.js`                                                  | `api.fanfinity.io`                                                       |
| `src/composables/useConnectorCatalog.js`, `useJitsu.js`, `useLiveEvents.js`, `quasar.config.js` proxy | `console.fanfinity.io`                                                   |
| `CLAUDE.md`                                                                                           | `dashboard-staging.fanfinity.io` (the backend's whitelisted CORS origin) |

**Order:** new hostnames live and serving → update CSP and the proxy target →
update `CNAME` → retire the old records. The CSP is the trap: it is a static
meta tag, so a host that is not listed is blocked at runtime with no build-time
warning.

### 3. Identity Platform tenant

`fanfinity-app` (display name `fanfinity-app`, id `fanfinity-app-fcsgt`, project
`koratona-9791a`) is referenced in `src/firebase.js` and `CLAUDE.md`, and set via
`VITE_FIREBASE_DEFAULT_TENANT_ID`.

A tenant's id is immutable. Renaming means creating a new tenant and migrating
users — every existing user's credentials live in the old one. This is a real
migration, not a string change, and it should not be started before item 1.

### 4. The accounts/RBAC backend

Separate service, separate deployment, still named Fanfinity. Everything here
follows _its_ rename, not this repo's:

- `openapi/fanfinity-api.json` — pulled from the backend; `"title": "Fanfinity Backend"`.
- `src/api/fanfinity.ts` and `src/api/model/*.ts` — orval output. The
  `Fanfinity Backend` header on every file comes from the spec's title. Editing
  them by hand is forbidden by `CLAUDE.md` and would be reverted by the next
  `pnpm openapi`.
- `orval.config.js` — target key and paths.
- `docs/backend-auth-integration.md` — documents that service.
- `package.json` `openapi:pull` script URL.

**Sequence:** backend renames → its OpenAPI `title` changes → `pnpm openapi`
regenerates → rename `openapi/fanfinity-api.json` and `src/api/fanfinity.ts`
together with the `orval.config.js` target and the two import sites
(`src/composables/useMe.js`, `src/boot/vue-query.js`).

### 5. The Jitsu consent localStorage key

`fanfinity_jitsu_consent`, in `src/composables/useJitsu.js`.

Renaming it outright silently discards every existing user's consent decision
and re-prompts them. The fix is a migration, not a rename:

```js
const CONSENT_KEY = 'sfere_jitsu_consent'
const LEGACY_CONSENT_KEY = 'fanfinity_jitsu_consent'
// on read: fall back to the legacy key, write the value forward under the new
// key, then remove the legacy one.
```

Worth doing, but it is a behaviour change and belongs in its own commit.

### 6. Raster favicons

`public/favicon.ico` and `public/icons/favicon-{16,32,96,128}x128.png` are still
the old mark. They cannot be regenerated from here — they need an export from
the source design file at each size. `public/favicon.svg` is done and is what
every modern browser uses, so this is cosmetic-on-legacy-browsers, not blocking.

### 7. Migrating screens onto the component kit

Separate from the tokens and much larger. All 54 screens now render in Sfere
colours and type, but they are built from `src/components/ui/`, not
`src/components/sfere/`. Moving a screen is a per-screen rewrite in place (the
screen manifest means never adding a route). No deadline implied — the tokens
already carry the brand.

### 8. Visual audit after the token change

Not blocked on anything; should happen soon. `pnpm smoke:dist` will not catch
any of this — it asserts console errors, rendered `ErrorState`, unresolved
routes and a present `<h1>`, none of which a colour change trips.

Worth a human pass:

- **Screens leaning on `text-subtle` vs `text-muted` for hierarchy.** These are
  now the same colour (see the Done section for why). Anywhere the distinction
  was carrying real meaning — a table column header against its cells, a hint
  under a filled field — needs a weight or size change to get it back.
- **Anything relying on `line` vs `line2` contrast.** They are now identical.
- **Headings.** Bricolage Grotesque is a wider, higher-contrast face than Plus
  Jakarta Sans; long headings in narrow columns may now wrap where they didn't.
- **Charts.** ApexCharts resolves `var(--color-chart-N)` at render; series 1 is
  the new purple against the same eight companions.

### 9. Loose ends

- `@fontsource/plus-jakarta-sans` is still a dependency in `package.json` but is
  no longer imported. Removable once nothing references the face — note that
  `--font-sfere-display` still lists it as a fallback.
- `docs/reference/meiro/README.md` refers to a capture harness at
  `fanfinity/merio/` in another repo. Preserved because it is a real path there.
- `src/components/shell/ThroughputChart.vue` carries a stale comment claiming
  `var(--color-chart-N)` tokens "are not defined in src/css/tailwind.css". They
  are. Pre-existing, unrelated to the rename, but it is misleading.
