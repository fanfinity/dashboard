# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (Node `>= 22.12`). `postinstall` runs `quasar prepare`.

```bash
pnpm install       # install deps (regenerates .quasar/)
pnpm dev           # quasar dev — HMR dev server, opens browser
pnpm build         # quasar build — static SPA into dist/spa
pnpm lint          # oxfmt (format) then oxlint --fix
pnpm lint:check    # oxfmt --check then oxlint (CI-style, no writes)
pnpm release <x>   # bump package.json, commit, tag vX.Y.Z (patch|minor|major|X.Y.Z)
pnpm docs:cdp      # Scalar reference for openapi/cdp-api-draft.yaml on :3001
```

Linting/formatting is **oxlint + oxfmt**, not ESLint/Prettier. oxfmt style: no semicolons,
single quotes, printWidth 80, `arrowParens: avoid`, no trailing commas. oxlint runs only the
`correctness` category as errors (max 10 warnings).

**Pass oxfmt no path.** `oxfmt --check src/` covers only `src/`, but the scripts above run it
over the whole repo — `CLAUDE.md`, `docs/**`, `public/data/*.json` and `scripts/` included.
Linting only `src/` is how a green local run turns into a red CI run.

**In Markdown, never let a hard wrap land inside an inline code span.** oxfmt formats
`docs/**` and `CLAUDE.md` too, and a continuation line that starts at column 0 — which is
what wrapping `` `flex-wrap: nowrap` `` mid-span produced in `docs/ui-conventions.md` — ends
the list item it sits in. oxfmt then reindents the rest of that item on **every** pass, so it
is not idempotent there: `oxfmt` followed by `oxfmt --check` still fails, and running the
formatter is not the fix. Keep the span whole on one line and indent the continuation to the
list marker's width.

There is **no unit-test runner**. The behavioural gate is `pnpm smoke:dist`, which builds,
serves `dist/spa`, signs in for real, walks every route in the screen manifest, and fails on any
console error, uncaught error, rendered `ErrorState`, unresolved route, or missing `<h1>`.
It needs `SMOKE_EMAIL`/`SMOKE_PASSWORD` in `.env` (see `.env.example`), and **`smoke.mjs` now
loads `.env` itself** via `process.loadEnvFile()`, so bare `pnpm smoke:dist` works from a clean
shell. That call does not overwrite variables already set, so `--env-file=.env` and a
workflow's `env:` block still win where they are used.

**It serves on port 9000, and that is load-bearing, not a default nobody thought about.**
Sign-in is a real cross-origin `POST` to `VITE_API_BASE` now, so the browser's origin has to be
one the backend's `CORS_ALLOW_ORIGINS` names — and the only localhost origin staging accepts is
exactly `http://localhost:9000` (not `127.0.0.1`, not the `4173` this used to use, which failed
at the preflight before reaching a single screen). It therefore **collides with `pnpm dev`**:
stop the dev server for the length of a local run. `serve-dist.mjs` says so on `EADDRINUSE`
rather than printing a bare stack. Only set `SMOKE_PORT` if the backend has been taught that
port too.

The other half of that: `SMOKE_EMAIL` must be a real account **on the backend `VITE_API_BASE`
points at**. The backend authenticates at the Identity Platform _project_ level, so an account
that only ever existed in the old tenant gets `401 Invalid email or password`; register it with
`POST /v1/register` against that same host. The script names which of the two failures it hit.

`SMOKE_ROUTES` narrows the walk while iterating — `SMOKE_ROUTES=/pipes,/sources pnpm smoke:dist`
— then run it unfiltered once to confirm nothing else broke. A route named there that is not in
the manifest is an error, not a silent skip.

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
for you — the rule above still holds. "Dev server + CDP docs" is a `dependsOn` compound
launching "Dev server" + "CDP API docs" together (see `pnpm docs:cdp` under Data architecture
below) — still user-run only, same as "Dev server".

## Deployment — Firebase Hosting, not GitHub Pages

Full detail in `docs/deployment.md`. The short version, because it changes how you
think about a merge:

- **Push to `main` deploys**, to <https://app-staging.sfere.io> (Firebase Hosting
  site `sfere-stg` in `koratona-9791a`), and then runs `scripts/smoke.mjs` against
  the deployed origin. **A tag `vX.Y.Z` deploys production** to
  <https://app.sfere.io> (site `sfere-app`), behind a required reviewer.
  **Every PR gets its own preview channel** and a bot comment with the URL.
- **Each environment builds its own bundle.** Vite inlines `VITE_API_BASE` at build
  time, so staging and production are different bytes. Do not collapse the three
  workflows into a shared build job — that ships the staging API host to production.
- **Cut releases with `pnpm release patch|minor|major`, never by hand.**
  `deploy-production.yml` refuses a tag that disagrees with `package.json`.
- **Production is not live yet, deliberately.** `app.sfere.io` is an empty site with
  a valid cert; the backend's production overlay has never been applied. The release
  workflow preflights `api.sfere.io/healthz` and hard-fails, which is the intended
  behaviour — see `docs/deployment.md`. Do not point production at the staging API
  to work around it.
- **The CSP gates new API hosts.** Adding a deployed origin means editing
  `index.html`'s `connect-src` _and_ the backend's `CORS_ALLOW_ORIGINS`. A missing
  CSP entry fails in the console looking exactly like a CORS error.
- **`firebase.json` has no catch-all rewrite, deliberately** — the router is hash
  mode, and a `**` -> `/index.html` rewrite would answer a mistyped `/data/*.json`
  with a 200 HTML body instead of an honest 404.
- Deploy auth is keyless WIF (`gh-deployer-dashboard`); there is no service-account
  JSON anywhere. The CLI is `npx --yes firebase-tools@15.24.0` — the `firebase` npm
  dependency in this repo is the **Auth SDK** and ships no binary.

`public/CNAME` and `.github/workflows/deploy-pages.yml` are gone, and `ci.yml` fails
the build if either reappears.

## Stack

Quasar 2 (Quasar CLI with Vite) + Vue 3 (`<script setup>`) + vue-router. Styling is **Tailwind
CSS v4** (via `@tailwindcss/vite` + PostCSS) used alongside Quasar's own components and SCSS —
both `app.scss` and `tailwind.css` are loaded. Charts use ApexCharts (`vue3-apexcharts`).

Router uses **hash mode** (`vueRouterMode: 'hash'` in `quasar.config.js`). The `@/` alias maps
to `src/`. All app routes are children of `src/layouts/MainLayout.vue`, except `/login`,
`/signup` and `/design-system`, which are top-level and unauthenticated.

Hash mode has one consequence worth internalising: the whole route lives after the first `#`,
so an in-page `href="#some-id"` **replaces the route** instead of scrolling. Anchor navigation
has to go through `scrollIntoView` — see `src/pages/design-system/DesignSystemPage.vue`.

### Seven Quasar/Tailwind cascade collisions

Tailwind v4 emits utilities into `@layer utilities`; Quasar's base stylesheet is **unlayered**,
and unlayered CSS beats layered CSS regardless of specificity. All seven of these have cost real
time:

1. **Headings need the important _suffix_** — `text-2xl!`, never `!text-2xl`. Covered at length
   in `docs/ui-conventions.md` rules 2–3.
2. **A bare `hidden` can never be turned back on** — and neither can `rotate-90`. Quasar ships
   `.hidden { display: none !important }` and `.rotate-90 { transform: rotate(90deg) }`, both
   unlayered, so `class="hidden lg:block"` is permanently hidden at every width and
   `class="rotate-90 sm:rotate-0"` is permanently rotated (which is why `PipeFlow.vue`'s arrows
   pointed _down_ between three side-by-side boxes). Use the inverse variant —
   `max-lg:hidden`, `max-sm:rotate-90` — which generates a class name Quasar does not define.
   The tell: a utility that works in its "on" breakpoint and refuses to switch off.
   The same `!important` form owns the disabled look: `[disabled] { opacity: .6; cursor:
not-allowed }`, so `disabled:opacity-45` and `disabled:cursor-not-allowed` are dead classes
   everywhere in this repo. A disabled state you actually control has to change something
   Quasar does not set — a colour, say. `SfereToggle` is the worked example.
3. **A `q-dialog` child is capped at 560px, and `mt-auto` does nothing on a bare block.** Quasar
   ships `.q-dialog__inner--minimized > div { max-width: 560px }` and margins on unclassed block
   elements, both unlayered. A three-column picker in a dialog silently renders as
   two-and-a-bit columns, and auto margins are ignored, until the suffix goes on:
   `w-[820px]!`, `mt-auto!`. `PersonaQuestion.vue` needs both. **`w-[Npx]!` alone is not
   enough** — the Quasar rule is a `max-width`, so the override has to be one too:
   `w-[min(720px,92vw)]! max-w-[min(720px,92vw)]!`, as on `/team` and `/billing`. A flat pixel
   max-width would stop the dialog shrinking on a narrow window, hence the `min()`.
4. **`class="flex"` wraps, and `flex-nowrap` cannot stop it.** Quasar's `.flex` is
   `display:flex; flex-wrap:wrap`, unlayered, so _every_ flex container in this repo wraps and
   the layered `flex-nowrap` utility loses to it. The symptom is a `justify-between` row whose
   label jumps **above** its control once the text gets long — which means it ships looking fine
   and breaks on the copy edit. Fix: `min-w-0 flex-1` on the child that should give way (that
   sets `flex-basis: 0` and removes the wrap decision), `shrink-0` on the one that must not.
   Full worked example in `docs/ui-conventions.md` rule 10.
5. **`mt-*` on a `<p>` does nothing** — this is #3's margin problem, and it is the one that
   silently degrades a card. Every `<p>` carries Quasar's unlayered `margin-bottom: 16px`, and a
   layered `mt-3` on it computes to `margin-top: 0`, so a card spaced `mt-3` / `mt-1.5` / `mt-3`
   renders as a flat 16px rhythm ignoring all three — plus sixteen pixels of dead space under the
   last line, which knocks its footer off the baseline the cards beside it sit on. It ships
   looking merely loose, and editing `mt-3` to `mt-4` changes nothing. Space cards with grid
   `gap` (no Quasar counterpart, so it applies) and pin the footer with `grid-rows-[1fr_auto]` —
   not `mt-auto!`, which resolves per flex line inside #4's wrapping flex.
   `docs/ui-conventions.md` rule 11; `SourceIntentPicker.vue` is the worked example.
   **Three unlayered rules in `sfere.css` now catch the cases that are never intentional**:
   `[class~='items-center'] > p` (a paragraph sharing a row with a control — `items-center`
   centres the _margin_ box, so the text sat 8px high next to every button it was paired
   with), `p:last-child` (the dead 16px under a card's last line), and the opt-in
   `.sfere-flush > p` for a container that already spaces its children with `gap`. There is
   deliberately **no blanket `p { margin: 0 }`**: stacked prose still wants its rhythm, and
   the smoke gate cannot see a spacing regression, so a global reset would be an unverifiable
   change to all 54 screens at once.
6. **`auto-fit` grid tracks measure a card at min-content and keep the answer.** An
   `auto-fit` track is min-content-sized in the first pass, and the min-content height of a
   `SelectableCard` — a #4 wrapping flex — at that width is enormous, so the row keeps it:
   `grid-cols-[repeat(auto-fit,minmax(260px,1fr))]` turned 219px cards into **637px at every
   viewport** on `/sources/new`, with columns still resolving to a normal 328px. Stay on
   `repeat(N,minmax(0,1fr))`, which is what `sm:grid-cols-2` expands to. Where the viewport is
   the wrong question — the sidebar collapses without changing it, so one 1024px window has two
   content widths — put a container query in front of those tracks (`@container` +
   `@min-[52rem]:grid-cols-3`). `docs/ui-conventions.md` rule 12.
7. **Anything inside `q-header` inherits white text, and that is how the responsive nav
   disappeared.** Quasar ships unlayered `.q-header { color: #fff }` and unlayered
   `.q-btn { color: inherit }`, so a layered `text-ink` on the header loses and the button
   never had a colour of its own — the hamburger was drawn in white on a `bg-white!` bar. It
   was present, focusable and clickable at every width below 1024px; it was simply invisible,
   which reads as "this app has no navigation under 1000px" and was filed as exactly that.
   Two halves to the fix and both are needed: `text-ink!` (important **suffix**) on the
   header, and a control that carries its own colour — `MainLayout` now uses
   `SfereIconButton` with a `menu` glyph from `sfereIcons.js` rather than
   `q-btn icon="menu"`. The same `.q-btn` unlayered `display: inline-flex` also beat the
   layered `lg:hidden` that was supposed to hide it on desktop, so it showed up beside a
   permanent sidebar too; `lg:hidden!` is what actually hides it.
   `docs/ui-conventions.md` rule 15.

## Screen manifest — routes are generated, not hand-written

`src/router/screens.js` is the single source of truth for every route.
`src/router/routes.js` builds the table from it with `import.meta.glob` (lazy loading is
preserved) and **must not be hand-edited**. A manifest entry whose page file is missing throws
at module load rather than 404-ing silently.

`screens.js` is deliberately import-free — no Vue, no `@/` aliases — so plain Node can read it.
`scripts/smoke.mjs` walks every route from it — every route in `screens`, that is, not in
`legacyScreens`. That split used to be load-bearing for `/live-events`, which read a
third-party events console through a `/japi` dev proxy a production build did not have. It no
longer is: `/live-events` reads `GET /v1/accounts/{account}/events/live` through the normal
data-source gate and has a mock fixture, so it would survive `pnpm smoke:dist` — promoting it
into `screens` is an
available, deliberate change that nobody has made yet.

A screen's **`group` field does three jobs**, so it has to be accurate: it picks the sidebar
section, and it is the feature-activation key that decides whether the route renders its real
page or `ComingSoonPanel`. `routes.js` throws at module load if a `group` has no entry in
`src/config/features.js`.

**A screen's `parent` field is the back button.** `parent: { name, label }` names the screen
this one drills down from, `routes.js` forwards it as `meta.parent`, and `PageHeader` renders
`← <label>` above the `<h1>` — so all 23 sub-screens (`/x/new`, `/x/trash`, `/x/:id`) get one
control in one place, and a page never hand-rolls a header nav button. That replaced seven of
them on the detail and trash screens, plus a header `Cancel` or `All models` on every create page,
which between them called the same trip four different things and were missing entirely from the
rest; if you find yourself adding an "All sources" button to `#actions`, the manifest entry is
what is missing. A create page's docked `StickyActionBar` "Back to X" is a **different**
affordance — the form's own cancel, at the bottom, next to submit — and stays.

Three parts of it are deliberate. It is **declared, not derived**: not from the path, because
`/profiles/search` and `/channels/email` have no `/profiles` or `/channels` route to return to;
and not from the parent's `title`, because those read `Warehouse Models — list view` while the
sidebar says `Warehouse models`, and a back button has to say what the nav says. It is **not
`router.back()`** — history is empty on a cold load, which is every deep link from Slack and
every route `scripts/smoke.mjs` visits, so the case where the control matters most is the case
history cannot answer; `routes.js` throws at module load if `parent.name` is not a screen, since
a `router-link` to an unknown name logs the console warning smoke fails on. And **top-level
screens have no `parent` on purpose** — the sidebar is their nav and their row is already lit.

This makes `PageHeader` the one route-aware component in the kit. It takes a `back` prop to
override the manifest, or `null` to suppress the link on a screen that has a parent but should
not offer the trip back; see `docs/ui-conventions.md` under `PageHeader.vue`.

**The connector catalog is connectable**: picking a card in `/sources?tab=connectors` opens
`ConnectorConnectPanel.vue` above the grid — named credential fields for Firebase, MongoDB,
Shopify, Stripe and GA4, a generic JSON box for the rest, plus a sync schedule. The field specs
live in `src/config/connectorCredentials.js` because `GET /v1/connectors` returns a name, a
package id and a licence but **no credential schema**; that file is what a real per-connector
schema replaces. There is no `POST .../connectors` endpoint, so the panel validates for real and
reports what it _would_ send — and it emits **field names only**, never values, so no page above
it can log a credential. The file input is a drop target that reads no bytes.

**`/sources/new` is a three-step guided flow, not a form**: an intent picker
(`src/config/sourceIntents.js` — six plain-English intents like "a website", each resolving to
template ids), the existing details form, then Install & confirm. **One page, three steps**,
because the steps share state — the intent picks the template, the template names the source, and
the created source is what the install guide needs a key from. Three routes would mean threading
that through query params, and a reload mid-flow would land on step 3 with nothing to install.

**Step 3 leads with what the backend already did, not with homework.** For a `web` or `zid`
source the create call also provisioned the ClickHouse destination and the pipe joining it, so
`ProvisionedPipePanel.vue` sits above the install guide and reveals that source → pipe →
destination chain node by node — and the screen's primary action becomes "Open this source"
rather than "Add a destination", which used to send people to build a second warehouse by hand.
**It is told twice, as a moment and as a record.** `SourceProvisionedOverlay.vue` covers the
screen for two seconds and draws the chain lighting up; `ProvisionedPipePanel.vue` holds the same
three nodes inline above the install guide, permanently, for whoever blinked or tabbed away. The
overlay is the exception the write key allows, not a licence for a longer one: it leaves on its
own, has **no button** — the timer is the contract, and a click anywhere or Esc skips it — renders
**no `<h1>`** (PageHeader owns the page's, and
`pnpm smoke:dist` asserts on the first one), and is teleported to `body` because `fixed`
resolves against a transformed ancestor and step 3 has several.

**Both open on `state === 'found'`, never on "a source was created".** That is what keeps them
honest and what keeps the overlay off the write key: three of the seven templates provision
nothing, and an overlay keyed to the create call would sit there through
`useSourceProvisioning`'s retry (1.2s) before discovering it had nothing to say — on exactly the
sources with no pipe. Keying both to the lookup settling also means the reveal starts from
nothing lit, rather than the card appearing fully lit. See the provisioning table under Data
architecture for which source types this applies to; the panel, the overlay and the CTA all
follow the lookup rather than the type.

`SourceInstallGuide.vue` renders step 3 _and_ the source detail page's "Setup instructions" tab —
one component, two entry points, because someone who closed the tab mid-setup wants exactly the
same page a week later. Its snippets live in `src/lib/sourceInstallSnippets.js` for the reason
`webSdkSnippet.js` does: an SFC `<script>` block ends at the first literal closing script tag.
Its verification asks the backend whether a real event arrived (`listSourceEvents`); the
proposal's "paste your URL and we'll look for the script" checker was **not** built, because the
CSP blocks that cross-origin fetch and it would only prove the tag is on the page.

**The method tabs are a narrowing, not a re-ordering**, and `methodsForSource()` is the table
that does it: a website gets HTML / React / NPM, a mobile source gets Native apps alone, an HTTP
API source gets HTTP / NPM. It used to show all five to everyone and merely lead with the likely
one, which reads as five equally valid ways to install — a website has no `AppDelegate.swift` to
paste into, so an irrelevant tab is a wrong answer sitting beside the right one. A source
narrowed to one method renders **no `TabNav`**; a one-item tab bar is decoration that looks like
a choice.

The signal is `templateId`, and **only the create flow reliably has it**: `SourceCreate` accepts
a `template_id` but the `Source` record never returns one, so a re-read carries only
`source_type`. `web` and `cloud_app` are exact, but `event_stream` covers `ios-sdk`,
`android-sdk` _and_ `http-api` — indistinguishable — so that branch deliberately keeps all five
tabs rather than guessing. **Returning `template_id` on `Source` is the one-field backend change
that closes it**; do not reconstruct the template from a slug or a local cache.

The product backlog (54 screens, GitHub issues #16–#69) is scaffolded: every screen already
exists as a stub page at its final path. Implementing one means **rewriting that file in place**,
never creating a file and registering a route.

**The sidebar has an ACCOUNT section**, between FANS and ACTIVATE: `/team` (members, roles and
the domain-match approval queue) and `/billing` (plan, usage, add-ons, invoices). It sits above
the four not-yet-built sections rather than below them on purpose — ACTIVATE, ENGAGE, MEASURE
and SYSTEM are the longest part of the rail, and a live row buried under a wall of `Soon` pills
can only be reached by scrolling. `team` and `billing` are two keys rather than one `account`
key because Billing is role-restricted in a way the roster is not.

Neither has a backend: `useTeam()` and `useBilling()` pass no `api` option, so they read the
bundled fixtures in Demo mode and report `apiMissing` in the default real mode, and both pages
say which switch shows the shape. Settings → Members still exists and still reads `users.json`;
`/team` is the fuller surface (approvals, role reference, per-row role changes) and the two
should be merged the day the members endpoint ships — not before, since merging them now would
mean picking which of two fixtures is canonical.

One place the nav deliberately departs from one-row-per-route: **Connectors is a tab on
`/sources`**, not a screen. Browsing connector _types_ is a step in adding a source, so it lives
in `src/components/sources/ConnectorCatalog.vue` behind `/sources?tab=connectors`, and the old
`/connectors` URL redirects there from `routes.js`. Tab state is a query rather than a child route
because both halves are the same screen with the same `<h1>` — a child route would put Connectors
back in the sidebar, which is exactly what this undid.

## Feature activation — most of the sidebar is switched off

`enabled: true` in `features.js` today covers **Dashboard, Live events, Sources, Destinations,
Pipes, Settings, Warehouse, Monitoring, Profiles, Secrets, Authorizations, Team** and
**Billing** — thirteen top-level keys, not six. Two of those are partly on: Warehouse and Profiles each gate their own
children by a separate key (`dwh-syncs`, `warehouse-models`, `identity-resolution`, `attributes`,
`profile-api`, `live-profile-syncs`, `profile-dwh-syncs`), so switching the parent on only exposes
the child screens whose own key is _also_ `true` — right now that's just Warehouse connections and
Profile search, everything else under those two stays a `Soon` row. Audiences, Campaigns, Engage,
Reporting and Demo lab remain fully dark and get switched on one at a time as they become real.

`src/config/features.js` is the registry — pure data, one entry per module, `enabled` being the
shipped default. `src/composables/useFeatures.js` layers per-browser overrides from
`localStorage` (`sfere_feature_activation`) on top, and **Settings → Feature activation** is the
UI for those overrides. That panel (`SettingsFeaturePanel.vue`) splits the registry into two
cards — "CDP core" and "Backlog modules" — by a hardcoded `CORE_KEYS` list, not by each feature's
`active` state, so toggling a core module off locally doesn't bounce it into the backlog card.
**`CORE_KEYS` has to be kept manually in step with the shipped-active top-level keys** — flipping
a module's `enabled` default in `features.js` and forgetting the matching edit in `CORE_KEYS`
leaves a live module stranded under "Backlog modules".

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

## Onboarding — one question, asked once

First sign-in asks **"Before we start — what do you do?"** and offers three personas:
engineer ("I build the pipes"), marketer ("I run the campaigns"), analyst ("I answer for the
numbers"). `src/config/personas.js` is the registry — pure data, no imports, same idiom as
`features.js` and `screens.js`.

**The question is an overlay over a fully-rendered Home, never a route.** A `/welcome` route
would replace `MainLayout`, so `[data-smoke="nav"]` would never appear and `pnpm smoke:dist`
would fail at sign-in for all 54 routes rather than on one screen. Three consequences that any
change here has to preserve: the page beneath stays mounted and visible, the overlay renders
**no `<h1>`** (smoke asserts on the first one, which belongs to the page), and it opens **only on
`/`** — a deep link to `/errors` from Slack must not be met by a modal demanding a role.
`MainLayout` binds it to `route.path`, not to a one-shot flag, which is also what closes it on
navigation.

State is `src/composables/useOnboarding.js` — module singleton, `localStorage` key
`sfere_onboarding`, the shape `{ v, uid, persona, askedAt, skipped, completedAt, chapters, runs }`:

- **`uid` is what makes it "first login" rather than "once per browser".** A record whose uid is
  not the signed-in user's reads as unanswered, so a shared machine asks the second person instead
  of handing them the first person's answer. Nothing is persisted while signed out.
- A `persona` that is not a key in `personas.js` reads as unanswered too — a renamed key or a
  hand-edited store must not resolve to a truthy persona nothing can render.
- Skipping is a real answer (`skipped: true`), not a deferral. The way back is Settings.
- `chapters` and `runs` are written empty on purpose. The tour itself — stepper, progress strip,
  completion card — is a later phase (`todos/site-overhaul-plan.md` §5.3–5.8), and it should find
  a record it can extend rather than inventing a second key.

**The persona picks emphasis, never contents.** It is allowed to choose which onboarding script
runs, what Home leads with, and which nav section starts expanded. It must never remove a sidebar
row: support and handover docs have to be able to say "click Pipes" and be right. Removal is
entitlements' job, and that mechanism stays separate — as does feature activation, which answers
"is it built yet?".

### Two other first-run surfaces

**The setup tracker** (`useSetupProgress.js` + `components/shell/SetupProgressPanel.vue`) answers
"source → destination → pipe, how far am I?" It is **derived, never stored**: three list reads,
no `setupComplete` flag anywhere, because a flag can disagree with reality the moment someone
deletes their only pipe. All three domains have live endpoints, so unlike most of the app it is
accurate in the default real mode. It lives on the Dashboard **and nowhere else** — Sources,
Destinations and Pipes each render the one-line `SetupReminderStrip` pointing back at it, because
four copies of the same three steps is four things to keep in agreement. The strip shows the step
the _workspace_ is on, not the step the screen is; it hides itself once all three exist. The
panel is dismissible only after that, and the dismissal is `localStorage`.

**The post-registration interstitial** (`components/onboarding/AccountSetupOverlay.vue`) covers
the gap between a created account and the dashboard, when the session settles, `/v1/me` is read
and the acting account resolves. It runs for a fixed **2.5s** (`TOTAL_MS`), long enough that its
four step labels can be read rather than flashed — it used to be a random 1.1–2s, which made the
same sign-in feel different each time. Still a courtesy transition, not a fake loading screen, so
the number is a deliberate ceiling and not somewhere to hide slow work. Like the persona question
it is an overlay, not a route — a `/setting-up` route would need a guard exception and would be a
second place the auth redirect has to agree with. It mounts only _after_ auth succeeds, so it can
never stand between a bad password and its error message.

**It is sign-up only**, and that is the fix to a QA finding rather than an optimisation. It used
to run on sign-in too, so a returning user was told "Setting up your account" and "Opening your
workspace" on their hundredth visit, and waited 2.5s for a sentence that was not true of them.
`LoginPage` mounts it on the sign-up branch and sends a sign-in straight to its destination. If a
returning-user transition is ever wanted it needs its own copy; do not soften this one to cover
both.

**Sign-in and sign-up are two routes over one component.** `/login` and `/signup` are separate
entries in `routes.js` both pointing at `LoginPage.vue`, which reads `route.name` to decide which
form it is. They used to be one route and a client-side toggle, so sign-up had no address: not
linkable from a marketing CTA, invisible to the back button, and every page-view landing on
`/login` whichever form the person saw. Both carry `redirect` across the switch, so someone
bounced off a deep link who decides to register still lands where they were going. Neither
belongs in `screens.js` — that would nest them under `MainLayout`, behind the auth guard.

**Both forms validate on submit and say what is wrong.** `src/lib/authValidation.js` holds the
rules; `FormField`'s `error` and `SfereInput`'s `invalid` render them, and the first failing
field takes focus. The submit button is enabled unless a request is in flight — it used to be
disabled until both fields passed, which is what QA filed as "invalid input is rejected
completely silently": a control that does nothing and explains nothing leaves no way to find out
what is wrong with what you typed. Two things there are worth not undoing. `FormField`'s
`required` prop is **decorative** — it draws an asterisk and never reaches the input, and
`SfereInput` declares its props rather than falling through, so a `required` attribute would land
on the wrapper `<div>`; the JS check is the only check. And the form is `novalidate`, because a
native bubble vanishes on the next keystroke and cannot say the sign-up-specific things about
passwords.

**The sign-up password rule is a UX guardrail, not a security control.** Minimum 8 characters, at
least three of {lower case, upper case, digit, symbol}, and a short in-repo denylist of the
passwords that top every breach corpus, plus a live strength meter. All of it runs in the
browser: `POST /v1/register` still accepts `12345678`, and anything posting there directly
bypasses the lot. Real enforcement is a backend ask, written up with the other three in
`todos/backend-ask-auth-onboarding.md`. Sign-in checks only that a password was typed — applying
the new rule there would lock out every account that predates it while telling people their own
password is invalid.

**A personal email warns, it does not block.** A consumer domain (`gmail.com` and friends) gets a
non-blocking amber note saying teammates on that domain will not be matched into the workspace.
This is not a reversal of the dropped work-email _validation_ — rejecting those addresses blocks
contractors and agencies for a benefit the backend gets from the address either way, and that
stays dropped. The warning states the one real consequence instead.

**There is no "Forgot password?" link, deliberately.** No `/v1/auth/password-reset` exists, so
there is nothing to link to and a control that opens an apology is worse than an absence. Same
reasoning for email verification and domain-matched workspaces: both are in the QA report, both
need endpoints, and neither has a placeholder in the UI.

**Three selectors on `/login` are load-bearing**: `scripts/smoke.mjs` drives
`input[type=email]`, `input[type=password]` and `button[type=submit]` with Playwright's strict
matching. Keep exactly one of each — that is why sign-up has no confirm-password field, and why
the password show/hide toggle is `type="button"` and the input starts as `type="password"`. A
bare `<button>` inside a `<form>` submits by default, so an unmarked toggle would give the gate
two matches for `button[type=submit]` and fail sign-in for all 54 routes before a single screen
rendered.

**Settings → Your role** (`SettingsPersonaPanel.vue`) is the other surface, so changing the answer
never means re-running a tour, and `Ask me again` clears it. Both surfaces render the same three
cards and the same marks from `PersonaIcon.vue` — drawn there rather than reused from
`src/assets/dashboard/`, because those are `<img>` with brand purple baked into a `stroke`
attribute and cannot take the colour of the chip they sit in.

## Empty values have four words, and none of them is `0`

`src/lib/emptyValue.js` is the vocabulary a screen prints where a value is missing, and it is
the whole of it: **`NEVER`**, **`NOT_SET`**, **`NOT_KNOWN`**, **`NONE`**. Every one of them
used to be a bare em dash, in ~145 places, and the same glyph also appeared mid-sentence as
punctuation — so a `—` in a table cell could not be told apart from a truncated label. QA
raised the dashes as visual noise; the ambiguity underneath is why this is a module rather
than a search-and-replace.

Pick by what is true of the data, not by what reads shortest:

| Word        | Means                                                | Example                |
| ----------- | ---------------------------------------------------- | ---------------------- |
| `NEVER`     | a dated event that has not happened                  | `Last run: Never`      |
| `NOT_SET`   | an optional field nobody filled in — user-fixable    | `Next run: Not set`    |
| `NOT_KNOWN` | nothing measures it: no endpoint, or the read failed | `Events/hr: Not known` |
| `NONE`      | a collection that is genuinely empty                 | `Tags: None`           |

**A count the backend never sent is `NOT_KNOWN`, never `0`.** That is the same warning the
fixture-wider-than-the-endpoint note above gives: a formatter printing a confident `0` for
`undefined` asserts a measurement nobody took, and unlike a visible gap nobody reports it.
`0` is for a number that was counted and came back zero — `PipelineFlowPanel` prints it.

The date formatters (`formatDate`, `formatDateTime`, `formatAgo`, and friends across the
`use*` composables) take a **`fallback` second argument defaulting to `NOT_KNOWN`**, because
one formatter serves both a `createdAt` column and a `lastRunAt` one and only the second can
honestly say "Never". Pass the word at the call site: `formatDateTime(s.lastRunAt, NEVER)`,
`formatDate(row.nextRunAt, NOT_SET)`. A date that IS present but will not parse always
reports `NOT_KNOWN` regardless of the fallback — that is a different failure.

The wider copy rule that goes with it: **an em dash is punctuation, and the UI keeps very few
of them.** Page subtitles, banners, toasts, validation messages and status lines were
rewritten to sentences, colons or parentheses across all 54 screens, `public/data/*.json` and
the screen manifest — `screens.js` titles used to read `Warehouse Models — list view` and now
read `Warehouse models`, which matters because that string is the real `<h1>`
`ComingSoonPanel` renders. `src/components/sfere-docs/**` (the `/design-system` reference
page) is the deliberate exception: it is long-form editorial prose, not product chrome.

## UI primitives

`src/components/ui/` is **the** component kit — 42 components, all built on the Sfere token
layer. **Use them; do not re-implement their markup and do not copy their class strings into a
page.** Read `docs/ui-conventions.md` before writing any new screen.

Two naming schemes live in the folder, for a reason worth knowing:

- **17 screen primitives carry plain, unprefixed names** — `PageHeader`,
  `DataTable`, `EmptyState`, `ErrorState`, `LoadingState`, `StatusBadge`, `CardPanel`,
  `NoticeBanner`, `StatCard`, `TabNav`, `FormField`, `FormSection`, `ConfirmDialog`,
  `DefinitionList`, `SelectableCard`, `ToolbarSearch` and `StickyActionBar`. Sixteen of them
  keep the names the screens already imported, which is what let the Sfere implementations
  replace the originals across 104 files without rewriting 571 imports; `StickyActionBar` is
  newer and simply describes what it does. A few of the older names are now worse than what
  they hold (`CardPanel` is a card, `NoticeBanner` is an alert); that was the price of the swap.
- **25 keep their `Sfere*` names** — `SfereButton`, `SfereInput`, `SfereTable`, `SfereSection`,
  `SfereFeatureCard` and friends. These have no pre-Sfere counterpart, and the prefix keeps
  `SfereTable` distinguishable from a bare `<table>` and from `QTable`.

This is not only about consistency: `scripts/smoke.mjs` detects a broken screen by looking for
the single `[data-smoke="error"]` selector that `ErrorState` renders. Hand-rolled error blocks
would leave the only behavioural gate in the repo with nothing to assert on.

**Icon-only actions go through `SfereIconButton`, and its glyph comes from `SfereIcon`.** Every
list screen's toolbar pairs a Trash and a New button whose noun is already the `<h1>` beside
them, so those two are drawn rather than spelled — ten screens' worth, previously ten
hand-rolled `<button>` elements with the palette pasted in. Two rules the component enforces
rather than documents: `label` is required and feeds **both** the `aria-label` and the tooltip,
because a CSS-only hover bubble reaches neither a screen reader nor a touch user; and the
tooltip defaults to `bottom`, since `SfereTooltip` has no positioning engine and a `PageHeader`
sits at the top of the viewport. The glyphs live in `src/components/ui/sfereIcons.js` as path
data on one 256 grid — inline, because `img-src 'self'` and `assetsInlineLimit: 0` rule out both
a remote file and a data URI, and because `currentColor` is what lets one entry serve a
brand-filled button and a white one. The button palette itself is `sfereButtonVariants.js`,
shared with `SfereButton` so a labelled and an unlabelled action can never drift apart.

**The three detail screens' headers are the other case**: Source, Destination and Pipe each pair
a `pause`/`play` toggle with a `trash`, both icon-only, because the record's name is the `<h1>`
they sit beside. Those two carry a rule the list toolbars do not — **every one of them opens a
`ConfirmDialog` first, and that dialog is where the sentence lives.** An icon states no
consequence, so "Pause" that acts on the click asks someone to guess whether events are dropped
or queued; the dialog says so, names the record, and says it is reversible. Pausing is therefore
**not** `destructive` — only delete is — and it confirms in **both** directions, because a
control that asks on the way down and not on the way back up is worse than one that always asks.
Anything else that turns an action into a glyph inherits both halves: the tooltip/`aria-label`
and the confirm-with-a-description, unless there is a stated reason not to.

An icon-only control is the **exception**, not the house style: it is right where the page
already names the noun, and wrong anywhere the action is not guessable from its shape. Empty
states, form submits and destructive confirmations keep their words — and so do row-level
actions in a `DataTable`, where the noun that matters is _which row_, not the `<h1>`.

**But the confirm rule is not tied to the icons: every state change asks first, everywhere.**
The row-level Pause/Enable on the **twelve** list screens that have one — Sources,
Destinations, Pipes, Profile API, Profile DWH syncs, Live profile syncs, Warehouse models, DWH
syncs, and the four dark Engage screens (Goals, Catalogs, Email campaigns, Audiences) — opens
the same `ConfirmDialog` its Delete already did. Email campaigns is the one keyed on
`row.status === 'sending'` rather than `isEnabled`, so a new screen should check which of the
two it holds rather than assuming. Three things each of those screens does that a
new one has to copy: the dialog holds **its own `toggleTarget` ref** rather than sharing the
delete flow's `target` — two dialogs reading one row is how a confirm acts on the wrong record;
the row is **left in place after the confirm** rather than nulled, so the message does not blank
out while the dialog fades; and the copy is **written for that screen**, naming what stops and
where ("stops copying events from `raw_web_events` into Snowflake Production"), because a
generic "Are you sure?" is the thing this replaced. Only Delete is `destructive`.

One caution on that copy: several of these screens have no backend, so a sentence about what
happens to data _while_ something is paused — queued, replayed, backfilled — is a claim nothing
measured. Say what stops and what is left alone; do not promise a resume behaviour.

## The Sfere design system

`src/css/sfere.css` holds the token layer, measured off the live marketing site
(<https://sfere.io>) rather than eyeballed, and `src/components/ui/` holds the 42-component kit
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

## Mock data still stands in for most of the backlog

Every backlog issue says _"fetch through the generated orval client in `src/api/`"_. That is now
right for a few screens and still wrong for most of them. Sources, Destinations and Pipes have
real account-scoped endpoints and do use the generated client; **every other screen has no
backend behind it**, reads mock JSON from `public/data/` through `useMockResource()`, and
reports `apiMissing` ("No API yet") in the default real mode. Before wiring a screen to
`src/api/`, check that its endpoint exists in `openapi/fanfinity-api.json` — the shapes in
`openapi/cdp-api-draft.yaml` are a proposal, not a backend, and three of its domains have
already shipped in a different shape (see Data architecture below).

## Files that reach every screen

Nothing in this repo is off-limits to edit. But a handful of files are load-bearing enough that
changing one changes every screen at once, so they are worth a moment's thought and a line in the
commit message rather than a drive-by edit mid-task:

`src/router/**` (the manifest generates all 54 routes) · `src/layouts/MainLayout.vue` (the nav
is the IA, and the feature gate lives in its `q-page-container`) · `src/components/ui/**` (the
kit) · `src/config/features.js` + `src/composables/useFeatures.js` (which modules are switched
on at all) · `src/composables/{useMockResource,useEntitlements,useDiagram,useTemplates}.js` (the
`{ data, loading, error, apiMissing, load() }` contract every page is written against —
`apiMissing` is real-mode-only, see Data architecture below) · `quasar.config.js`
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

**The dashboard is connected to the Fanfinity backend and to nothing else.** Every live call
this app makes goes to that API — sign-in included, so not even Identity Platform is a host
the browser talks to. There are no direct connections to event collectors, vendor consoles or
third-party catalogs, and no dev-only proxy standing in for one. Anything that has to talk to an outside system is the backend's
job; hitting the backend is what moves everything else.

Not all of that API is built yet, so pages get data from three places, and the composables
all follow the same `{ data, loading, error, load() }` contract (`src/composables/`):

1. **The backend, or the static mock JSON standing in for it.** Live reads go through
   `useMockResource()`; the fallback fixtures are `public/data/*.json`, fetched via
   `import.meta.env.BASE_URL` (e.g. `ContactDetailPage.vue` loads `data/contacts.json` +
   `data/contact-details.json`). Most pages also define inline mock arrays for demo content.

   The fixtures are cross-referentially consistent — `pipes[].sourceId` resolves in
   `sources.json`, and so on. Adding fields and records is fine; **renaming or renumbering an
   existing `id` is not.** `screens.js`'s `smokeParams` point at those ids by value, and a
   broken lookup renders `undefined` silently rather than failing.

   **Settings → Data source is a global two-way switch** (`useDataSource.js`, `localStorage`
   key `sfere_data_source_mode`, values `real` / `mock`, **default `real`**), and a
   `DemoModeBanner` `q-footer` goes up in `MainLayout.vue` only while it is `mock`. Only an
   explicit stored `mock` opts out — unset, garbage, or a stale `mockApi` from before that
   mode was removed all resolve to `real`.

   **There used to be a third mode**, `mockApi`, pointing at a local Scalar mock server
   (`pnpm mock:cdp`) generated from `openapi/cdp-api-draft.yaml`. It was scaffolding for a
   backend that did not exist: sources, destinations and pipelines now have real endpoints, so
   mocking a draft of them was cost without benefit, and it went along with `MOCK_API_BASE`,
   `VITE_CDP_MOCK_API_BASE`, `customFetch`'s base-URL override, the `localhost:3000` CSP entry
   and the "Mock CDP server" VS Code task. **`pnpm docs:cdp` survives** (port 3001,
   `scalar document serve`, `@scalar/cli` still a devDependency): the draft spec is now a
   contract document for what is still unbuilt, and that is how you show it to the backend team.

   **Flipping the switch does not, by itself, change what a screen shows.**
   `useMockResource()` only calls a live endpoint for a resource whose composable passes an
   `options.api = { path, select? }`; a resource with no `api` reports `apiMissing: true` with
   **no network attempt**, and `DataTable`'s `api-missing` prop renders that as "No API yet"
   rather than as an empty list. A 404, a CORS block and a connection refused (no local backend
   running) all read the same as "not built yet"; only a real non-404 response escalates to
   `ErrorState`.

   **`api.path` takes a string or a function**, and the function form is the normal one,
   because almost every real endpoint is account-scoped:
   `() => currentAccount.value && \`/v1/accounts/${currentAccount.value.id}/sources\``.
`useMockResource`awaits`waitForAccount()`(which subsumes`waitForAuthReady()`and settles`currentAccount`from`GET /v1/me`) *before* evaluating it, so the first load already has
the id; a function returning null reads as `apiMissing`with no request. A static string
built at composable-definition time would capture`null`— that is the failure this shape
exists to prevent.`sendMutation()`and`fetchCollection()`resolve`path` the same way.

   **The backend answers snake_case inside a page envelope**, the screens are written in
   camelCase against bare arrays, and `src/lib/apiShape.js` bridges the two: `pageItems`
   unwraps `{items, total, page, size, pages}` and camelizes each row (use it as `api.select`),
   `camelizeKeys` does one record (use it on a write's response). Both are deliberately
   shallow, so a destination's `config` blob and a sync run's `counts` pass through unmangled.
   `options.mockOnly: true` is the opposite case — a static catalog with no backend equivalent
   (the source/destination template lists) always reads the bundled JSON, or real mode would
   leave a create form with nothing to pick.

   **Wired to a real endpoint today**: `useSources()`, `useDestinations()` and `usePipes()`
   (`/v1/accounts/{account_id}/sources|destinations|pipelines`) — **`usePipes()` is how any
   screen reads pipelines, not just the Pipes ones.** The Destination detail page used to call a
   `useDestinationPipes()` wrapper that passed no `api`, so in real mode it answered `apiMissing`
   with an empty array and the screen reported "No pipes deliver here yet" plus a count of 0 on a
   destination that may have had several. That export is deleted; a screen wanting a subset
   filters `usePipes()`, which also joins each pipe's two ends so `sourceName` resolves. Plus the
   per-source panels
   PR-side (`useSourceSyncAPI`, `useSourceDataAPI`, `usePipelineFunctions`),
   `useLiveEvents()` (`/v1/accounts/{account_id}/events/live`, with the same account's
   `/sources` behind the stream selector) and `useDashboardHome()`
   (`/v1/accounts/{account_id}/dashboard` — one aggregate call that feeds the whole home
   screen, adapted into the three mock payload shapes rather than read through
   `useMockResource`). **Wired to a drafted endpoint that does not exist yet**:
   `useConnectorCatalog()` (`/v1/connectors`). Everything else has no `api` at all.

   **The fixture is wider than the endpoint, and that is the bug class to look for
   on the three live domains.** `pipes.json` carries `version`, `sourceName`,
   `eventDestinationName`, `hasFunctionCode` and `deliveryCountLastHour`; the backend's
   `Pipeline` is nine fields and has none of them. `sources.json` and `destinations.json`
   invent the same `version`, plus `pipeCount` and the per-hour counters. Wiring a screen to
   a real endpoint therefore does not finish at `api: { path }` — **every field the page
   reads has to exist in the `200` schema**, or it renders a value nobody measured.
   How it fails is what makes it expensive: `` `v${x}` `` prints the literal `vundefined`
   and gets reported, while `formatCount(undefined)` prints a confident `0` and a falsy
   `hasFunctionCode` prints "Pass-through — events are delivered unchanged", both as
   assertions of fact. Silence is the worse failure. Where the ids are on the record the
   labels are recoverable — `usePipes()`'s `joinEnds()` resolves a pipe's two ends out of
   the live Sources and Destinations collections and skips both reads in Demo mode, which
   is the pattern to copy. Where nothing backs the field, say so (`'—'`, "Not known") or
   drop the control; do not let `formatCount` decide.

   Grep the merged `openapi/fanfinity-api.json` before adding an `api` path — `/v1/dashboard`
   and `/v1/errors` were drafted flat and shipped account-scoped and merged, which is exactly
   the drift the check catches.

   **There is no fallback from real to mock, and that is deliberate.** `loadReal()` sets
   `apiMissing` and blanks `data`; it does not quietly read the fixture instead, because a
   screen that looks populated when its backend is missing is worse than one that says so. The
   consequence is that in the default mode only Sources, Destinations and Pipes have content —
   **to demo the product, or to hand a preview link to a tester, switch to Demo data first.** Rolling one out is the same small change (`api: { path }`, forward
   `apiMissing`, pass `:api-missing` to `DataTable`) but must be done **per domain against the
   real `200` schema** — a mock file's `select` does not carry over automatically, several are
   wrapped (`trash.json`'s `payload.pipes`, `error-logs.json`'s `payload.errors`) in a way the
   endpoint is not.

   **Writes split by kind, on purpose.** A _create_ is typed and does more than write a row —
   the backend provisions a Jitsu site and write key for a source, a per-account ClickHouse
   database for a destination, the delivery link for a pipeline — so creates go through the
   orval-generated client in `useSourcesAPI` / `useDestinationsAPI` / `usePipelinesAPI`, and
   the create pages gate on `isReal` and say plainly that mock mode saves nothing.

   **`POST .../sources` builds a whole pipeline, but only for two of the four source types.**
   Measured against staging on 2026-08-27, not inferred — one source created per type, both
   collections read immediately after:

   | `source_type`  | templates                            | destination                                              | pipeline                |
   | -------------- | ------------------------------------ | -------------------------------------------------------- | ----------------------- |
   | `web`          | `web-sdk`                            | `"{name} — ClickHouse"`, db `web_{source8}_{account8}`   | `"{name} → ClickHouse"` |
   | `zid`          | `zid`                                | `"{name} — ClickHouse"`, db `store_{storeId}_{account8}` | `"{name} → ClickHouse"` |
   | `event_stream` | `ios-sdk`, `android-sdk`, `http-api` | none                                                     | none                    |
   | `cloud_app`    | `shopify`, `stripe`                  | none                                                     | none                    |

   All of it is **synchronous** — both records are present on the very next read, so nothing
   needs polling. Two consequences. First, a `web` or `zid` user finishes all three setup steps
   by doing one, so any screen telling them to "add a destination" next is wrong; `/sources/new`
   step 3 renders `ProvisionedPipePanel.vue` instead and re-points its primary action.
   Second — and this is the part to preserve — **that panel is driven by
   `useSourceProvisioning()`, which finds the pipe rather than deriving it from the type.**
   `Source` carries no `destination_id` or `pipeline_id` and `listPipelines` takes no
   `source_id` filter, so the lookup is: list pipelines, match `source_id`, resolve the
   destination. Three of the seven templates provision nothing, so a hardcoded "we connected
   your warehouse" would be a confident lie on an iOS SDK source and would contradict the
   install guide's own "Nothing to install" on a Shopify one. `state` distinguishes `none`
   ("the backend built none") from `unavailable` ("the read failed") for the same reason.

   One rough edge worth knowing: `DELETE` on a source cascades its pipeline away but **leaves
   the auto-provisioned destination behind**, so deleting and recreating a source accumulates
   orphaned ClickHouse destinations. That is backend behaviour, not something the dashboard
   works around. Everything
   flatter — enable/pause, soft-delete — goes through **`sendMutation()`** (`useMockResource.js`),
   the write-side counterpart to the reads: a no-op in `mock` mode (the caller applies its own
   local mutation), the account-scoped `PATCH`/`DELETE` in `real` mode. It returns a
   discriminated result (`{ok:true,skipped,data}` / `{ok:false,apiMissing:true}` /
   `{ok:false,error}`) rather than throwing, because a page that fires a success toast
   unconditionally after a write would lie on a 404 — `notifyMutationResult()`
   (`useMutationFeedback.js`) is the one shared toast for all three outcomes. Callers apply
   their local mutation only after `ok: true`. `PATCH`/`DELETE` bodies and responses are
   snake_case (`{ is_enabled }`), hence `camelizeKeys` on the way back in. Trash restore/purge
   stays local-only everywhere — the trash has no endpoint at all yet.

   **That last sentence is why Sources says "Delete", not "Move to trash".**
   `DELETE /v1/accounts/{account}/sources/{id}` is a hard `204`: no soft delete, no trash
   listing, no restore. The confirm dialogs used to open as "Move source to trash?" and promise
   30 days of recovery, then send the user to a Trash screen that could not have the record —
   which is the failure this file warns about elsewhere, in its most expensive form. The
   Sources list, the detail header and the Settings danger zone now share one verb and one
   sentence, and each says restoring is not available yet. **Flip all of them back the day the
   backend soft-deletes** — the wording is the product direction, it is just ahead of the API.
   The nine `use*Trash.js` composables all read `trash.json` with no `api`, so they must
   forward `apiMissing` and the screen must pass it to `DataTable`; `useSourcesTrash` swallowed
   it, and the screen answered "Trash is empty — no source has been deleted in the last 30
   days", which is a measured-sounding claim about a collection nobody asked for. The other
   eight still swallow it.

   **A source's Settings tab is read-only except Delete**, and says so in a banner rather than
   in a toast. `SourceUpdate` carries `is_enabled` and nothing else, and `Source` has no
   `description`, no strict-mode flag and no server-key list — so renaming, rotating a write
   key, revoking one, issuing a server-to-server key and Strict mode are all disabled controls.
   They used to fire a "would be saved" toast, which is indistinguishable from one describing a
   save. Rotation's helper text also described an impossible order ("update your snippet first,
   then rotate" — the new key does not exist until the rotation issues it); it now states the
   real sequence and that there is no endpoint behind it.

   **`pnpm smoke:dist` now walks all 54 routes against whatever `VITE_API_BASE` points at**,
   because that is what the default mode does. It used to be hermetic. If you need the old
   behaviour, set `sfere_data_source_mode` to `mock` in the browser profile the run uses, or
   flip the default — do not add a smoke-only branch to `useDataSource`, which would mean the
   gate stops testing what users get.

2. **Events, connectors and everything else — through the backend, never direct.**
   `useLiveEvents.js` reads `GET /v1/accounts/{account}/events/live`, and lists that
   account's sources for the stream selector — "stream" being the screen's word for a source,
   which is why the selector's value goes out as the endpoint's `source_id`. Sources with no
   provisioned site are left out: they have no event log, so offering one would select a
   stream that can only ever come back empty. `useConnectorCatalog.js` reads
   `GET /v1/connectors`, which is still drafted. Both go through the same data-source gate as
   every other screen, with `public/data/live-events.json`, `event-streams.json` and
   `connectors.json` as their mock fixtures.

   **This is a hard rule, not a preference: the dashboard connects to the Fanfinity backend
   and to nothing else.** Where events are actually collected — Jitsu today — is the backend's
   business. It is not a host this app knows, and adding one back is not a config detail.
   Three things enforce it rather than merely describing it:

   - **The CSP.** `index.html` is `default-src 'self'` with `img-src 'self'` and a
     `connect-src` naming only the Sfere API hosts — Identity Platform included in that "no",
     since sign-in is a backend call now. A direct call to any other origin is blocked by the
     browser, not caught in review.
   - **No dev proxy.** `quasar.config.js` has no `devServer.proxy`. There used to be a
     `/japi/*` → events-console forward that injected a server-side API key, which meant
     `/live-events` worked in `pnpm dev` and nowhere else. Nothing is dev-only now.
   - **No ingestion path.** The dashboard cannot send an event. The browser SDK, its consent
     banner and the `/events-demo` page that drove them were deleted, not rewired — writing
     to a collector is something the backend does. (`useDemoEvents.js` is a local simulator
     for the demo screens and reaches nothing; it is not an exception to this.)

   The live-events endpoint returns an **already-flattened, vendor-neutral** record
   (`LiveEvent` in `openapi/fanfinity-api.json`): unwrapping ingest envelopes, redacting
   credential headers and masking write keys are the backend's job. `useLiveEvents.js`
   maps its snake_case fields onto the camelCase shape the fixture carries, so the page is
   written once against one record shape. That shape is what keeps
   the rule true over time — a passthrough of some upstream's wire format would put the
   dashboard back in the business of knowing who that upstream is. `LiveEventsPage.vue` used
   to scrub the vendor's name out of every string it rendered; there is nothing to scrub now.

3. **The Fanfinity backend** (`https://api-staging.sfere.io` on staging,
   `https://api.sfere.io` in production, local `../backend` via `make run` in dev). It
   started as accounts/RBAC only; it now also serves the CDP domains that have shipped —
   account-scoped sources, destinations and pipelines, plus the Zid connect/sync and
   pipeline-function routes:
   - Client is **generated by orval** from the backend's OpenAPI spec: `pnpm openapi`
     re-pulls `openapi/fanfinity-api.json` from staging and regenerates `src/api/`
     (typed fetchers like `getMe()` plus `@tanstack/vue-query` composables like
     `useGetMe()`; vue-query is registered in `src/boot/vue-query.js`). Never edit
     `src/api/fanfinity.ts` or `src/api/model/` by hand.
   - Auth lives in `src/api/mutator.js` (`customFetch`): prefixes `VITE_API_BASE`
     (fallback `http://localhost:8080`), attaches the access token from `useSession`
     as a Bearer header, refreshes once via `POST /v1/auth/refresh` on 401, and throws
     `ApiError` (status + RFC 9457 problem+json body) on non-2xx. See "Authentication".
   - `useMe.js` bootstraps the session: `useAuth.js` calls `loadMe()` after sign-in and
     `clearMe()` on sign-out (the router also calls `loadMe()` on cold load into an authed
     route), populating `me` + `memberships` from `GET /v1/me` (best-effort — errors never
     block routing).
   - The backend **requires a verified email** (`401 Email is not verified`), and its
     `CORS_ALLOW_ORIGINS` must include the dashboard origin. A PR preview channel gets a
     different, unguessable origin every time, so it cannot be listed — staging admits it by
     pattern instead (`CORS_ALLOW_ORIGIN_REGEX` in the backend's
     `k8s/overlays/staging/patch-env.yaml`, anchored to the `sfere-stg` site id). Production
     sets no regex at all, by design, so no preview channel can reach the production API.
     `localhost:9000` is not covered by either, so browser calls from a dev server to staging
     are still CORS-blocked — run `../backend` locally instead.

4. **Derived / client-only state.** `useProfilesIdentityResolution.js` does probabilistic
   identity stitching over contact records — rarity-weighted, Fellegi–Sunter-style scoring;
   read the file's header comment before touching the scoring. It is the only survivor of a
   trio this section used to list: `useJitsuContacts.js`, `useIdentityResolution.js` and
   `useSegments.js` were all deleted in the legacy-screen consolidation. If you are looking
   for one of those, it is gone, not moved.

## Content-Security-Policy constraints

`index.html` sets a strict CSP: `default-src 'self'`, `script-src 'self'`, `img-src 'self'`,
and a `connect-src` naming only the Sfere API hosts (`api.sfere.io`, `api-staging.sfere.io`,
and the `*.fanfinity.io` pair still standing while the rename finishes) plus Identity
Platform — with `ws://localhost:*` and `http://localhost:8080` added in dev only.

**That allowlist is how "the backend and nothing else" is enforced rather than merely
documented.** `img-src` is `'self'` with no exceptions: connector logos come from our own API,
so a card pointing at a vendor's logo endpoint is blocked by the browser. Adding a host back
is a product decision about what this app connects to, not a config tweak — if a screen needs
data from an outside system, the backend fetches it.

This shapes several decisions and will break new code that ignores it:

- **Any new external host** (API, image CDN, font, analytics) must be added to the CSP meta
  tag — and almost always shouldn't be. Route it through the backend instead.
- `assetsInlineLimit` is forced to `0` in `quasar.config.js` so no asset is inlined as a `data:`
  URI (which the CSP would block). Prefer real asset files / SVG endpoints over data URIs.
- Third-party JS must be bundled via npm (first-party `script-src 'self'`), not loaded from a CDN.

## Authentication

Sign-in goes through the **Fanfinity backend**, not the Firebase SDK. The browser no longer
talks to Identity Platform directly (there is no `firebase` dependency and no `src/firebase.js`).
This was a deliberate switch: `/v1/register` creates users at the Identity Platform **project**
level (`koratona-9791a`), but the old client-side Firebase sign-in was **tenant**-scoped
(`fanfinity-app-fcsgt`), so it couldn't find those users and failed with `EMAIL_NOT_FOUND`.
Routing sign-in through the backend (which authenticates at project level, matching register)
removes the mismatch and makes the backend the single source of truth for the Firebase project.

- `src/composables/useSession.js` is the token store (leaf module): `accessToken`/`refreshToken`
  refs hydrated **synchronously** from `localStorage` (`sfere_access_token` /
  `sfere_refresh_token`) at import, plus `setTokens`/`clearTokens`/`isAuthenticated`. This
  replaces Firebase's IndexedDB session persistence.
- `src/composables/useAuth.js` (module-singleton, like `useFeatures.js`) exposes
  `{ isAuthenticated, loading, error, signUp, signIn, logOut }`. `signIn` calls the generated
  `login()` (`POST /v1/auth/token`, OAuth2 password grant), stores the returned tokens, then
  `loadMe()`. `signUp` registers via `POST /v1/register` then signs in. `waitForAuthReady()` is
  kept but now resolves immediately (token hydration is synchronous — no async first callback to
  await like `onAuthStateChanged` had). The signed-in user's identity comes from `useMe`'s `me`
  (backend `/v1/me`), not a Firebase user object.
- `src/api/mutator.js` attaches `accessToken` as the Bearer header when present. On a `401` with
  a refresh token it trades it at `POST /v1/auth/refresh` (via a plain fetch, not the generated
  `refresh()`, to avoid recursing through `customFetch`), stores the new tokens, and retries once;
  a failed refresh clears the session so the guard bounces to `/login`.
- `src/router/index.js`'s `beforeEach` gates `requiresAuth` routes on `isAuthenticated`
  (token presence), then confirms a backend account via `waitForAccount()`; a missing account
  clears tokens and redirects to `/login`. neither `/login` nor `/signup` carries `requiresAuth` meta.

The access token is a short-lived (~1h) Firebase ID token; the backend also returns a refresh
token so sessions survive past that. **Multi-tenancy is now a backend concern** — the dashboard
sends no `tenantId` and needs no `VITE_FIREBASE_*` config.

## Environment / secrets

Config lives in a gitignored `.env` at the project root, and it is short on purpose:
`VITE_API_BASE`, the two smoke credentials, and the two build-identity stamps. See
`.env.example`.

**A var naming a non-Sfere host does not belong here.** The three `VITE_FIREBASE_*` values are
gone with client-side sign-in, and `EVENTS_API_KEY`, `VITE_JITSU_HOST`, `VITE_JITSU_WRITE_KEY`,
`VITE_EVENTS_API_BASE`, `VITE_EVENTS_BASE`, `VITE_EVENTS_WORKSPACE_ID`, `VITE_EVENTS_ACTOR_ID`
and `VITE_CDP_MOCK_API_BASE` went with the direct event connections; the deploy workflows no
longer pass any of them either. If a feature seems to
need a credential for an outside system, that credential lives in the backend — the browser
should never hold one.

`quasar.config.js` still calls `process.loadEnvFile('.env')`, but no longer for a dev proxy:
Quasar reads client-exposed `VITE_*` vars off `process.env`, so without it `VITE_API_BASE`
comes through empty, every call falls back to `http://localhost:8080`, and a deployed build
fails every request while looking like a backend outage.

There is also no consent banner any more. It gated a browser ingestion SDK that only ever
mounted on the deleted `/events-demo` page, so despite what this file used to claim, the app
never ingested anything. Consent for collection now belongs wherever collection happens,
which is not here.

## Done-features log

`done-features-tasks.md` (repo root, tracked in git) is a running log of work as it happens —
not a changelog derived after the fact. Whenever a feature or task is **added, finished, or
stopped** (including "started but paused"), append one line:

```
- YYYY-MM-DD: <concise, plain-English description>
```

Newest entry on top. Keep it to one line and one sentence — this is a heads-up for teammates,
not a commit message or a design doc. Do this as part of the same change, the same way a stale
CLAUDE.md is treated as a bug elsewhere in this file.

**Weekly cleanup is opportunistic, not scheduled** (no cron job runs this yet — pending GitHub
App authorization from the company owner; switch to a scheduled agent once that lands). Whenever
you are working in this repo and notice the oldest entry in `done-features-tasks.md` is 7+ days
old, show the user the accumulated entries as a digest, ask them to share it on the team Slack,
and once they confirm, clear the file back to just its header. Don't clear it any other way, and
don't clear it just because it's non-empty — only once that 7-day threshold is hit.
