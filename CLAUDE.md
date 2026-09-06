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

**It asserts a route only after the network has gone quiet twice**, and that is not belt and
braces. Almost every composable awaits `waitForAccount()` before it can build an account-scoped
URL, so its fetch is issued only once `GET /v1/me` has settled — and a single
`waitForLoadState('networkidle')` resolves _inside_ that gap, so the route gets asserted before
the request that would have failed it was even sent. Measured: in real mode the same nine-route
run reported between one and seven console-error failures on identical code. `settle()` idles,
pauses 400ms, then idles again; the same run is now byte-identical across repeats. **Do not
collapse it back to one wait** — a gate that fails a random subset also passes a random subset,
and the second half is the one that hurts.

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

### Eight Quasar/Tailwind cascade collisions

Tailwind v4 emits utilities into `@layer utilities`; Quasar's base stylesheet is **unlayered**,
and unlayered CSS beats layered CSS regardless of specificity. All eight of these have cost real
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
   `w-[820px]!`, `mt-auto!`. **`w-[Npx]!` alone is not
   enough** — the Quasar rule is a `max-width`, so the override has to be one too:
   `w-[min(720px,92vw)]! max-w-[min(720px,92vw)]!`, as on `/team` and `/billing`. A flat pixel
   max-width would stop the dialog shrinking on a narrow window, hence the `min()`.
4. **`class="flex"` wraps, and plain `flex-nowrap` cannot stop it.** Quasar's `.flex` is
   `display:flex; flex-wrap:wrap`, unlayered, so _every_ flex container in this repo wraps and
   the layered `flex-nowrap` utility loses to it. The symptom is a `justify-between` row whose
   label jumps **above** its control once the text gets long — which means it ships looking fine
   and breaks on the copy edit. Fix: `min-w-0 flex-1` on the child that should give way (that
   sets `flex-basis: 0` and removes the wrap decision), `shrink-0` on the one that must not.
   Full worked example in `docs/ui-conventions.md` rule 10.
   **In a column it fails differently, and worse**: `flex flex-col` under a height cap does not
   scroll when it overflows, it wraps into a **second column**. A dialog card
   (`flex max-h-[85vh] … flex-col overflow-hidden`) put its header in column one and its whole
   scrollable form in column two, off the card's right edge and clipped — which reads as "the
   dialog is cut in half", not as a wrap. The tell is a `border-b` that stops mid-card instead of
   spanning it. Here the child-side fix does not apply (the body already had `min-h-0 flex-1`),
   so use the **important suffix**: `flex-nowrap!` beats the unlayered rule, because layered
   `!important` outranks unlayered non-important. It is on every viewport-capped dialog and
   overlay card — `SettingsNotificationChannelDialog`, `ProfileBuilderEditDialog` and
   `SourceSyncRunLogsDialog` — and a new one needs it too. Height-capped
   columns whose children are auto-sized (`SelectableCard`, `MainLayout`'s rail,
   `LoginPage`'s panel) deliberately do not carry it: nothing there overflows into a
   second column.
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
   change to all 51 screens at once.
6. **`auto-fit` grid tracks measure a card at min-content and keep the answer.** An
   `auto-fit` track is min-content-sized in the first pass, and the min-content height of a
   `SelectableCard` — a #4 wrapping flex — at that width is enormous, so the row keeps it:
   `grid-cols-[repeat(auto-fit,minmax(260px,1fr))]` turned 219px cards into **637px at every
   viewport** on `/sources/new`, with columns still resolving to a normal 328px. Stay on
   `repeat(N,minmax(0,1fr))`, which is what `sm:grid-cols-2` expands to. Where the viewport is
   the wrong question — the sidebar collapses without changing it, so one 1024px window has two
   content widths — put a container query in front of those tracks (`@container` +
   `@min-[52rem]:grid-cols-3`). `docs/ui-conventions.md` rule 12.

   **`minmax(0,1fr)` sizes the track, not the item, and a native date input is the case where
   that shows.** A grid item still has `min-width: auto`, so it cannot be squeezed below its own
   min-content — and Chrome's `input[type=datetime-local]` measures **~222px** at Inter 14px
   (`dd/mm/yyyy, --:-- --`; measured, not guessed). Six equal tracks under ~1600px of container
   therefore did not shrink the two date fields on `/live-events`, they pushed each one over the
   control to its right until the picker icon sat inside the next field. Both halves are needed:
   `min-w-0` on the cells stops the overlap, and a track pinned at the control's real width
   (`16rem` there) stops that from becoming a clipped picker icon instead — which is the same bug,
   quieter. Any row mixing a native date, time or number input with `1fr` peers needs the same
   treatment.

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

8. **A dialog's corner radius is pinned at 4px, and every `rounded-*` on a dialog card is a dead
   class.** Quasar ships unlayered `.q-dialog__inner > div { border-radius: 4px }` — the same
   selector as the 560px `max-width` in #3 — so a layered radius utility of any value loses to it.
   That is not a wrong number, it is a class that does nothing: all seven Sfere-era dialogs
   declared `rounded-sfere-xl` (16px) and all seven rendered at 4px, which reads as a panel whose
   corners are visibly squarer than the `SelectableCard`s nested inside it. `rounded-sfere-xl!`
   (important **suffix**) is what beats it, for the reason `flex-nowrap!` does in #4. It is on
   `ConfirmDialog`, `SecretRevealDialog`, `SettingsNotificationChannelDialog`,
   `SettingsApiTokenCreateDialog`, `ProfileBuilderEditDialog` and `SourceSyncRunLogsDialog`, and
   a new dialog needs it too.
   **Radius has no alias layer, unlike colour**: `src/css/tailwind.css` aliases `--color-*` onto
   the `sfere-*` values but says nothing about `--radius-*`, so `rounded-lg` and `rounded-xl`
   resolve to Tailwind's own 8px and 12px rather than to `--radius-sfere-*`. Reach for
   `rounded-sfere`, `rounded-sfere-lg` or `rounded-sfere-xl` by name. The fourteen pre-Sfere
   dialogs still carry a bare `rounded-lg` and still render at 4px; they are a known issue, not a
   pattern to copy.

The house dialog surface is one string — `rounded-sfere-xl! border border-sfere-line
bg-sfere-surface shadow-sfere-pop` — and a new dialog copies it rather than improvising.
The overlay once had `rounded-xl border-line2 bg-white shadow-lg`, of which two were visibly
wrong (the 12px radius above, and a tight neutral `shadow-lg` where every other dialog sits on the
wide plum-tinted `shadow-sfere-pop`) and two resolved to the right values by luck.

**`FirstRunOverlay` used to be the one dark exception, and it no longer is.** It shipped for a
while as an 860px card on `bg-sfere-ink` with an on-ink swap of all four slots, defended here as
the single screen whose job was to feel like an arrival. It is now a **full-viewport light
surface** on `bg-sfere-bg`, which is what the prototype does and is the better reading for the
same reason the exception was argued for: a dark card floating over a dimmed Dashboard says "a
modal is interrupting your work", and on a first sign-in there is no work behind it to interrupt.
Taking the whole viewport makes it a place rather than an interruption. **There is no dark dialog
anywhere in the app now**; a first one is a change worth arguing about rather than a precedent
already set.

**It is `maximized`, and that is what takes it out of three of the collisions above.** Quasar's
unlayered `.q-dialog__inner--maximized > div` sets width, height and both maxima to 100% and
zeroes the radius, so the 560px cap in #3, the `flex-nowrap!` case in #4 and the 4px radius in #8
all have nothing to fight over — which is why the file appears in none of those three lists any
more. Checked against `quasar.css` rather than assumed. What the `q-dialog` still buys, and the
reason this is not a hand-rolled `fixed inset-0`, is the focus trap, the scroll lock and the
teleport to `<body>`.

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
`← <label>` above the `<h1>` — so all 15 sub-screens (`/x/new` and `/x/:id`) get one
control in one place, and a page never hand-rolls a header nav button. It was 23 until the ten
`/x/trash` screens — every one of which declared a parent — collapsed into one `/trash`, which is
a top-level screen and has none. That replaced seven hand-rolled buttons on the detail and trash
screens, plus a header `Cancel` or `All models` on every create page,
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

**The back control is bordered and filled at rest**, `variant="secondary"` rather than the
`variant="ghost"` it shipped as. As a ghost it was bare text on the page background that only grew
a surface on hover, so on all 15 sub-screens the one way back out of a drill-down did not look
like anything you could press until the pointer happened to be over it — and on touch there is no
"happened to be over it". Do not quieten it back down. The `-ml-4` went with the ghost and must
not come back: that negative margin existed to pull ghost _padding_ off the left so the link's
text lined up with the `<h1>`, and on a bordered pill it hangs the border into the gutter instead;
it is `mb-2` now and nothing else. No instance class softens the weight or colour either —
`font-medium` against the variant's own `font-semibold` is two layered utilities in one layer, so
which wins is Tailwind's ordering rather than the order written in the template.

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

**Steps 1 and 2 now survive a reload, and that is a reversal.** This file and
`SourceCreatePage.vue`'s own header comment used to defend the opposite — "a reload restarts the
flow cleanly, which is the honest behaviour" — and it lost on what is actually being discarded.
By the middle of step 2 someone has picked a platform, named the source, chosen a slug they had
to think about, and possibly walked off to Zid's site and back; losing all of that to a refresh,
or to a link opened in the same tab, is not clean, it is an unannounced undo.
`src/composables/useSourceDraft.js` persists it: module singleton, `localStorage` key
`sfere_source_draft`, shape `{ v, uid, intent, templateId, form, savedAt }`, following
`useOnboarding.js` field for field — version mismatch discards rather than migrates, the record is
uid-scoped so a shared machine does not hand the second person the first person's half-form, and
nothing is written while signed out. `form` goes through a field whitelist rather than a spread,
so a field added to the form later cannot leak into `localStorage` by accident. A restored
`intent` is validated against the registry and a restored **coming-soon `templateId` is rejected**,
or a draft taken before those templates were greyed out would rehydrate as a submittable Shopify
form.

**What the old argument was right about is step 3, and that exception survives intact: step 3 is
never written.** `created.id` and the write key come out of the create response and exist exactly
once — every later read of a key is masked, which is why `SecretRevealDialog` exists at all. A
persisted step 3 would rehydrate as an install guide with no key to show, beside a "your pipeline
is live" panel for a source the reader may not still own. Restore therefore runs after
`await load()` (the template list has to exist before a template id means anything), the deep
watcher writes only on steps 1–2, and the one-way `finished` flag is set **before** `clearDraft()`
so a queued flush cannot resurrect the record it just cleared.

**Shopify and Stripe are greyed out and unpickable, and "Taking payments" with them.**
`COMING_SOON_TEMPLATE_IDS` in `src/config/sourceIntents.js` is the list, `isTemplateComingSoon()`
and `isIntentComingSoon()` read it, and the intent flag is **derived from its templates** rather
than authored twice — with a `length > 0` guard, since `connector` has an empty `templates` array
and `[].every` would otherwise report it coming-soon. Neither has OAuth or connector wiring behind
it, so a source created against either could never receive an event: the create would succeed, the
install guide would have nothing to install, and the failure would be silent for as long as the
person waited for data. Both render `:disabled` on a real `<button>` — out of the tab order, Enter
and Space dead — marked by colour and a dashed border plus a `Coming soon` `StatusBadge`, **not**
by `disabled:opacity-*`, which is a dead class everywhere in this repo (collision #2). Deleting
the two entries from that array is the whole of switching them back on; there is no second list.

**The "Change" affordance moved onto the stepper.** Step 2 used to carry a grey "Setting up X …
[Change]" banner above the form, which is a second back button for a flow that has one.
`SetupStepper` gained `navigableSteps` (default `[]`) and a `navigate` emit: a completed rung
named in that list renders as a real `<button>`. `SourceCreatePage` passes `[0]` on step 2 and
`[]` on step 3 — by step 3 a row exists in the backend, so walking back to the intent picker would
offer to re-answer a question that has already been committed. The connector between rungs is a
track plus an absolutely-positioned fill keyed on `current` so it replays per advance, with
`motion-reduce:transition-none` and a scoped reduced-motion rule that hides the travelling dot
outright, and an `animate` flag set after a double rAF so first paint is static rather than
animating on arrival.

**One debt marker on that page, and it is the only kit-class override in the flow.** Step 2's
`StickyActionBar` Back button carries `class="bg-sfere-fill!"`, because `secondary` draws
`#e5e5e5` on `#ffffff` and the bar it sits in is already `bg-sfere-surface`, so the button
disappeared into it. **Delete that class the day a button variant ships with its own rest fill** —
it is a stopgap on one instance, not a pattern, and there is a comment on the line saying so.

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

**A Zid source starts with an authorization, and it is the first thing on the create form.**
`ZidAuthorizePanel.vue` sits above Details on step 2, in the same numbered-step grammar as
`ZidSetupWizard` so the merchant reads one continuous 1-2-3, and it **gates the submit**: Create
is disabled until the store has granted access, because an unauthorised store gives a source
that can read nothing. It is the only disabled submit in the flow, and it is disabled because
the click could not succeed — the backend answers `400 store_id is required for Zid sources`.
Every other problem on this form is a validation message on submit, which is the house rule, so
the sentence beside the button names the missing step rather than leaving a dead control.

**It asks for a grant, not for a store id.** The id is still required by the backend, but it is
read off `…/zid-connections` rather than typed — an empty `store_id` is therefore exactly "not
authorised yet", which is the single signal `canSubmit` reads. The free-text "Zid store ID" box
this replaced asked for an id nothing checked, so a source could be built against a store that
had never heard of us and only say so three screens later. One authorised store is used
silently; two or more render as name pills, since picking between real stores is a genuine
question and typing an id was never the way to answer it. **`apiMissing` is the one branch that
still asks**: with no `…/zid-connections` there is nothing to read the id off and no way to
confirm the grant, and the backend still refuses a Zid source without one.

**It is a field, not a fourth step, and that was a considered reversal.** Making it a step
looked tidier and behaved worse: the "An online store" intent carries Zid _and_ Shopify, so the
template is settled halfway down step 2 — and a stepper that grows a rung and walks you
backwards the moment you pick Zid is a wizard changing shape under you. The stepper stays three
rungs for every template.

**The authorization URL is fetched, never built.** Both `…/zid-authorize` and `zid-status`'s
`authorize_url` return the same start hop, `/api/zid/start?start={code}`: it consumes a
single-use code and sets an HMAC-signed first-party cookie carrying the `account_id`. That
cookie is load-bearing — Zid drops the URL `state` for a merchant who is not already signed in,
so it is the only thing telling the callback which account finished — and the backend trusts no
client-supplied account id, so a URL assembled in the browser cannot be account-linked. Each is
spent once opened. `src/lib/zidAuthorize.js` holds this, plus the pre-PR-#16
`{VITE_ZID_APP_URL}/redirect-url?store_id=…` fallback: measured against `api-staging`,
`/redirect-url` answers 302 there today while all three PR #16 routes answer 404, so preferring
the backend's URL means the signed flow switches itself on when the PR deploys. The fallback is
a real downgrade, not a synonym — it stores tokens against the store but links it to no account,
so it never appears in `zid-connections`. Always `window.open`, never a fetch: `connect-src`
names the Sfere hosts only, and the whole point is that the merchant signs in on Zid's domain.

**`ZidSetupWizard.vue` owns what is left, and on step 3 it sits _above_ `ProvisionedPipePanel`**
— the one deliberate exception to "lead with what the backend already did", and an exception
about truth rather than taste. Its remaining steps are register webhooks → run first sync, and
the provisioned chain is **dry** until both have run, so showing the pipe first would say
"you're live" to someone whose store has delivered nothing. For the same reason
`SourceProvisionedOverlay` is **suppressed for Zid**: two seconds of the chain lighting up would
be the loudest claim on the screen and the least true. A store authorized on the form renders
the wizard's step 1 already ticked, so the merchant lands on the two genuinely left. It is the
same component the source detail page renders, for the reason `SourceInstallGuide` is shared.

**Neither surface can observe the grant, which is why "I've authorized" exists.** Zid's callback
returns the merchant to _Zid's_ dashboard, not to this tab, so nothing here sees the handshake
complete — every authorize button is paired with a control that re-reads the backend.

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
never creating a file and registering a route. The manifest itself is **51 screens** now — the
backlog count is the issue count, not the route count, and the two stopped matching in both
directions: `/team`, `/billing` and the Functions screens were added outside the issue list, and
then two consolidations took routes back out and one addition put two back. It went 60 → 58 when
Secrets and Authorizations became tabs on `/settings`, **58 → 49 when the ten per-module
`/x/trash` screens became one `/trash`**, and 49 → 51 when `/profiles` and `/profiles/:id` landed
with the Salla connector. Every one of those old URLs still resolves, as **named** redirects in `routes.js` —
`{ name: 'secrets' }`, `{ name: 'sources-trash' }` and the other ten — because a named link
elsewhere in the app still points at them and an unresolved name logs the console warning smoke
fails on. Ten of the redirects are new and the names are the reason they exist: the targets are
plain `/trash`, `/trash?tab=destinations` and `/trash?tab=pipes`, which any of the old callers
could have written as a path.

**`/sources/trash` still wins over the `/sources/:id` child, and that was measured rather than
assumed.** A throwaway vue-router 4 matcher with the exact pair resolved `/sources/trash` to the
redirect even though the redirect is declared after the layout route — a static segment outranks
a param regardless of order. There is a comment saying so in `routes.js`, so nobody moves the
block "to be safe" and quietly changes something else.

**Functions is the newest top-level section** (`/functions`, `/functions/new`, `/functions/:id`),
sitting under Pipes because a function is what runs _on_ a pipe's events. Two things about it
worth knowing before touching either: `usePipelineFunctions()` is the per-pipe **attachment**
list and `useFunctions()` is the account **library**, and the same function can be attached to
several pipes — so they are not two names for one thing. And `reorder()` takes the **complete**
list of attached ids; omitting one is a `422`, not a detach, which is why `move()` exists rather
than a swap helper. `/profile-builders` is the fourth new screen, a child under Profiles gated by
its own `profile-builders` key.

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

**Secrets and Authorizations went the same way**, and they are the reason `/settings` now carries
`?tab=` too. Both used to be permanent rows in the sidebar's bottom menu, above Settings, on a rail
where every other row is a place you work; each is configuration you set up once and then leave
alone, so a row that is always visible costs more attention than it returns.
`SettingsSecretsPanel.vue` and `SettingsAuthorizationsPanel.vue` are the old pages with their
`q-page`/`PageHeader` shell traded for a toolbar row — the `<h1>` belongs to Settings now, so each
page's subtitle became a line beside its search box and primary button. Their two `screens.js`
entries are gone (60 → 58) and `routes.js` redirects both old URLs, keeping their `name` so
`{ name: 'secrets' }` still resolves. Each tab is still gated on its own `features.js` key — the
same switch that used to decide whether its route rendered `ComingSoonPanel` now removes a tab.

**Trash went the same way, and it is the larger of the two collapses**: ten `/x/trash` screens
became one `/trash` with three tabs. Recovering something you deleted is an occasional errand, not
a place you work, so ten rows' worth of route surface — one per module, each with its own
`<h1>`, its own empty state and its own retention promise — cost ten screens of maintenance to
answer a question asked once a month. `/trash` is a **bottom-menu row directly above Settings**,
the same slot and the same reasoning that took Secrets and Authorizations off the rail. Its tabs
are Sources, Destinations and Pipes, in `?tab=` exactly as `/sources` and `/settings` carry theirs
— Sources is the default and writes no query, which is the choice `SettingsPage` already makes for
General. `TabNav` navigates with `replace`, so tabbing does not stack history entries between the
screen you came from and the back button. `trash` is a new `enabled: true` key in `features.js`
and is in `SettingsFeaturePanel.vue`'s `CORE_KEYS`, which is the manual step that section warns
about and this is a worked instance of it.

`src/composables/useTrashCollections.js` is the one reader for all three tabs, and it exists
rather than reusing `useSourcesTrash`/`useDestinationsTrash`/`usePipesTrash` for a stated reason:
eight of those nine swallow `apiMissing`, so a screen built on them answers "Trash is empty — no
source has been deleted in the last 30 days", which is a measured-sounding claim about a
collection nobody asked for. It forwards `apiMissing` from the trash read alone and every tab
passes it to `DataTable`. It also reads `trash.json` once instead of three times, so one failure
produces one `error` and one Retry rather than three. Its `initial` is the shaped object
`{ sources: [], destinations: [], pipes: [] }` and not the default `[]`: `loadReal()` resets
`data` to `initial` for a resource with no `api`, and an array blank would leave
`data.value.sources` undefined and every `.length` in the template a render error — in the one
mode `pnpm smoke:dist` walks. Restore, purge and purge-all are local state in every mode, which
the next reload undoes; there is no trash endpoint anywhere.

**The Pipes tab claims something the backend does not do, and that is deliberate — read this
before you change it or cite it.** The tab lists pipes whose source or destination no longer
exists, marks each `Waiting to reconnect`, names the missing end under `Waiting for`, and dates it
`Waiting since`. **No such state exists in the API.**
`DELETE /v1/accounts/{account}/sources/{id}` is a hard `204`: no soft delete, no trash listing, no
restore call, and the pipeline is **cascaded away** rather than parked — so on a real account the
pipe the tab describes has already stopped existing, and nothing measures how long it has been
waiting. In the default real mode all three tabs report `apiMissing` and show nothing at all; the
tab has content only against `trash.json` in Demo mode. This is the same deliberate gap the
"Delete", not "Move to trash" note below records, taken one step further, and it was accepted the
same way: the reconnect story is the product direction and the wording is ahead of the API. **The
trigger to revisit is backend soft-delete.** The day `DELETE` parks a record instead of dropping
it, this tab becomes a description of real behaviour and the two banners saying "Restoring is not
available yet" and "Reconnecting is not available yet" come off. Until then, do not read this
paragraph — or the screen — as a statement about what the backend does.

Three details on that tab are there to keep it from claiming more than it can. It has **no
Restore, no Delete forever and no Empty trash**, because a pipe on this screen was not deleted and
there is nothing to purge. The date column is headed `Waiting since` rather than `Deleted`, since
a `Deleted` header over `deletedAt` would assert the pipe itself was deleted. And
`useTrashCollections` **filters to rows with at least one missing end**, so "Waiting to reconnect"
is true by construction rather than by whichever rows the fixture happens to carry. There is no
countdown and no "restorable until" anywhere on the screen: the "kept for 30 days" line every
replaced screen printed was a promise about a collection that does not exist.

**Four screens still promise a trash that cannot hold their record.** `/profiles/api`,
`/profiles/dwh-syncs`, `/profiles/live-syncs` and `/attributes` all still say on delete that the
record "moves to the trash, where it can be restored for 30 days" and toast "moved to trash", and
`/trash` has only the three tabs above. Before this change their own trash screens at least
existed to show it; now the sentence points at a screen the reader can reach in one click and
will find empty of their record. It is the identical failure the Sources paragraph below
documents, and the fix is the same: say what the delete actually does and that restoring is not
available yet. `/profile-builders` is the one that was already honest — its copy says there is no
trash for a builder.

**`public/data/trash.json`'s unused slices are not all unused.** The `attributes`, `dwh-*`,
`profile-*` and `warehouse-models` slices lost their only readers with the ten screens. The
`audiences` slice did **not**: `src/composables/useEngageAudiences.js` still reads
`useMockResource('trash', { select: payload => payload.audiences })` for the Audiences screen's
own in-page Trash tab, which survived. `audiences` is dark in `features.js` so nothing renders
today, but deleting that slice as dead breaks `/audiences` the day the module switches on.

**A bottom-menu row may declare a `glyph` instead of an `icon`, and Trash is the first one.**
`MainLayout`'s `bottomMenu` rows used to be `icon` only — a bundled SVG with its colour baked into
the file — and the template now branches on which field a row carries: `glyph` is a name in
`sfereIcons.js`, drawn by `SfereIcon` with `fill="currentColor"`, so it inherits the row's colour
and tints to `text-brand!` when the row is active, which an `<img>` cannot. The row also carries
`:aria-label="mini ? item.label : undefined"`, because `SfereIcon` is `aria-hidden` and rail mode
renders no label — without it the glyph row would be the one bottom-menu item with no accessible
name, where an `<img alt>` row still has one. A new row copies both halves.

**The Settings tab bar itself is mode-dependent, and only in one direction.** Members, API tokens,
Ingest domains, Notifications, Connector images and Danger zone are all workspace records, and
nothing behind them has a workspace endpoint: in the default real mode all six opened on the same
"No workspace settings — ask an admin to add you to one", which is six tabs sharing one answer that
blames the reader for a missing backend. They are offered in **Demo data** mode, where they have
something to show. The condition is written as "demo mode **or** a workspace actually loaded", so
the day a real endpoint ships they come back on their own rather than staying hidden behind a mode
switch nobody remembers to remove.

**General survived that cut because it stopped being workspace-only**: it leads with the role
picker, which used to be a `Your role` tab of its own. That put the most personal setting on the
screen one click further away than the workspace's data-retention windows, and it would have been
unreachable in real mode once the workspace tabs went. The workspace form and the Error alerts card
below it are still gated on `workspace`.

**One ordering constraint in `SettingsPage.vue`, and it is a real crash rather than a style
point.** The `tabs` computed reads the ingest-domain, notification and connector-image state, and
`watch(tabs, …)` evaluates its source once to capture an initial value — so `tabs` and its watchers
are declared **below** those resources. Move them back up next to the other computeds and setup
throws a temporal-dead-zone `ReferenceError` and the screen does not render at all. A plain
computed got away with it because only the template ever read it, and the template runs after
setup.

## Feature activation — most of the sidebar is switched off

`enabled: true` in `features.js` today covers **Dashboard, Live events, Sources, Destinations,
Pipes, Functions, Settings, Warehouse, Monitoring, Profiles, Secrets, Authorizations, Team,
Billing** and **Trash** — fifteen top-level keys, not six. Profiles is partly on: it gates its own
children by a separate key (`identity-resolution`, `attributes`, `profile-builders`,
`profile-api`, `live-profile-syncs`, `profile-dwh-syncs`), so switching the parent on only exposes
the child screens whose own key is _also_ `true` — right now that's Profile search and Profile
builders, and every other child is **absent from the rail**. Audiences, Campaigns, Engage,
Reporting and Demo lab remain fully dark and get switched on one at a time as they become real.

**Warehouse is active and has no sidebar row at all, which is a third state worth naming.** Its
three screens still render their real pages and its own two children (`dwh-syncs`,
`warehouse-models`) are still switched off — but the rail row that pointed at them is gone from
`MainLayout`, because the warehouse **is** a destination: the backend provisions a ClickHouse
destination per `web`/`zid` source, and browsing its tables or running SQL against it are tabs on
`/destinations/:id`. A Warehouse row sitting beside Destinations said the warehouse lived
somewhere else. This is the Connectors and Secrets move — a row comes off the rail, the key stays
`enabled: true` and stays in `CORE_KEYS` — minus the redirect: there is no tab to redirect to,
since an external Snowflake connection is not the provisioned ClickHouse destination. **Do not
tidy this up by switching the key off.** That would assert the module is not built yet and would
put `ComingSoonPanel` on three working screens.

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
row, while an inactive module is simply not in the sidebar. **That second half is a reversal**:
switched-off modules used to render an inert row with a `Soon` pill on the grounds that the
sidebar is the product roadmap and "not yet" beats "does not exist". With twenty-odd keys off,
that made a rail which was mostly unclickable and pushed the live rows below the fold, so the
roadmap now lives in **Settings → Feature activation** — the one surface that can still switch a
module on — and the rail holds only rows you can use. `BADGES.soon` and the two inert `q-item`
branches are gone with it. Engage is subject to both gates, and the entitlement runs first.

Two details the hiding pass has to keep getting right, because both were bugs the first time:
a **caption is a field on the first group of its section**, so filtering the flat `navGroups`
array strands one — drop `audiences` and `ACTIVATE` goes with it and Campaigns is absorbed into
`ACCOUNT`; `MainLayout`'s `activeGroups` sections first, filters inside each section, then
flattens through `navSections.js`'s `toFlat`, which re-attaches each caption to whichever group now
leads. And a **group whose children are all switched off is dropped too**, or the rail grows a
chevron that expands into nothing.

The gate is in `MainLayout.vue`'s `q-page-container`, which renders `ComingSoonPanel` **instead
of** `<router-view>` when `route.meta.group` is inactive. Deliberately not a `beforeEach` guard: a
guard can only redirect, which throws away the URL you asked for. This way the address survives,
the real page component never mounts (so nothing it fetches on mount runs), and
`ComingSoonPanel` renders the screen's own title as a real `<h1>` — which is what lets
`pnpm smoke:dist` keep walking **all 51 routes** instead of being narrowed to the active few.
Any new gating must preserve that; a redirect would silently drop the gate to ~6 routes.
**Hiding the sidebar rows did not touch this**: `/audiences` still renders `ComingSoonPanel` with
its own `<h1>`, it just has no row pointing at it. Hide the rows, keep the gate.

## Onboarding — seven beats, end to end

**REGISTRATION** opens a **full-page, light** arrival whose first three beats are: **"Bring your customer data
into one place without building the plumbing yourself."**, then **"Where does your customer
activity happen?"** with Website / Online store / Mobile app / Something else, then — for the two
categories that cover several platforms — **"Which online store do you use?"** or **"Which mobile
platform are you using?"**. The answers then drive four more beats inside the same surface — the store grant where one is
needed, the install, the confirmation and the summary — so the arrival ends on a working source
rather than on another screen.

**IT IS THE PROTOTYPE'S WHOLE FLOW NOW, AND THAT REVERSES WHAT THIS SECTION USED TO SAY.** It used
to stop after three beats and hand off to `/sources/new`, arguing that steps 4-8 already existed
there and that rebuilding them would mean a second install guide and a second event checker to keep
in agreement with the first. That argument was right about the components and wrong about the
conclusion: the hand-off dropped a reader who had answered two questions onto a create form with a
stepper of its own and a details form nobody had prepared them for, so the arrival stopped
mid-sentence.

**The beats moved and the components did not.** The flow is welcome → category → platform →
(authorize) → connect → verify → setup → ready, and there is still exactly one install guide and
one event check in the repo: `FirstRunConnect` renders `SourceInstallGuide` itself,
`FirstRunVerify` calls the same `listSourceEvents` with the same `total > 0` test, and
`FirstRunSetup` reads the real `useSourceProvisioning`. `src/composables/useFirstRunSetup.js` is
the glue — it creates the source, runs the checks and holds the result — and it is a module
singleton for the reason `useOnboarding` is.

**The prototype's eighth beat is deliberately not ported.** "Waiting for your first event" is a
whole screen doing the job of one clause: the verify beat is where an event is actually checked
for, so a screen afterwards waiting for one either waits for something that has happened or
repeats a question already answered. The ready beat states it in a sentence instead, and only
claims arrival when an event was really seen.

**`SourceInstallGuide` gained a `verify` prop, default `true`.** The arrival passes `false`,
because confirmation is its own beat; without it the install beat would carry a second identical
check — including the guide's own confetti and success banner — one beat before the screen whose
entire job is that check. Neither existing call site changes.

**THE GATE IS "YOU HAVE TO LOOK", NOT "AN EVENT MUST HAVE ARRIVED", and that distinction is
load-bearing.** The prototype's checker reports success unconditionally after 1100ms, so its gate
never has to answer this; ours asks the backend, and the honest answer on a brand-new account is
usually "nothing yet" — the snippet has been copied but not deployed, or deployed to a site with
no traffic this second, or (the case the install beat's own dev-note names) the reader cannot
deploy it at all. Requiring a real event would strand every one of those readers one beat away
from the warehouse and pipe the create call **had already built**. So one completed check unlocks
the rest whatever it found, the banner keeps saying what was actually found, and `verified`
travels to the last beat so nothing downstream claims traffic nobody saw.

**A `400` from the events endpoint is an ordinary state, not a failure.** It is what an
`event_stream` source answers until its SDK has initialised, so it reads as "no events to read
yet" rather than a red "couldn't run the check" — the same line `useSourceWriteKeys()` already
draws between a `400` ("no Jitsu site yet") and a `404` ("no endpoint").

**WHAT IS CREATED, AND WHEN.** The source is created on the way into the connect beat, because the
beat needs a real write key to put in a snippet. `ensureSource()` is **idempotent** — a reader
walking Back and forward again must not create a second source, which on a `web` template would
orphan a ClickHouse destination too (the backend's `DELETE` does not clean those up). Name and slug
are **derived, never asked**: the prototype asks for neither and the backend requires both, so
`SOURCE_NAMING` in `src/config/firstRun.js` maps the template to a name and a create that collides
retries with a numeric suffix. The `source_type` posted is the backend's, not the fixture's —
`web-sdk` goes out as `web`, `zid`/`salla` as themselves — the same three overrides
`SourceCreatePage` makes, for the same reason.

**Only `web` and `zid` provision anything, so the setup beat has two shapes.** The prototype ticks
"Preparing your included storage" off two `setTimeout`s; on an iOS source that would be a green
tick over a warehouse that was never built. `state === 'none'` renders an honest "no destination
yet" row and the ready beat's summary says `Not set up yet` rather than naming ClickHouse, and
`state === 'unavailable'` is kept distinct from it with a Retry — one is a fact about the account,
the other about the request.

**"Send a test event" is not built, and that is the one control the prototype has that we refuse.**
The dashboard cannot send an event: writing to a collector is the backend's job and the CSP names
no collector host (see "Data architecture" — a hard rule). A button reporting a test it never sent
is the worst possible thing on the one screen whose job is trust. A **store** source gets the
honest version instead, `POST …/sources/{id}/test` ("can the backend reach your store?"), which
appears only where it does something and never sets `verified` — "we can reach your store" and "an
event arrived" are different claims.

**"Something else" still leaves the arrival**, because there is nothing here for it to do: it
resolves to the connector catalog rather than a template, so there is no source to create and the
four beats after the question would each have nothing to say. It records the category, **settles**
the record and navigates — parking it would reopen the arrival over the catalog the reader is now
reading.

**NOTHING ARMS THE SPOTLIGHT WALKTHROUGH ANY MORE**, and that is a consequence rather than an
oversight. `startTour('source-setup')` fired on the hand-off, so its coachmarks explained a create
form the reader no longer sees. `SpotlightTour`, `useGuidedTour` and `src/config/tours.js` are all
still wired and `SourceCreatePage` still calls `show()` on its own steps, so arming it again is one
line the day something hands off to that page.

**IT IS SIGN-UP-ONLY, AND THAT WAS A BUG BEFORE IT WAS A RULE.** `useOnboarding` used to treat an
absent `localStorage` record as "has not been asked", which made the arrival a property of the
BROWSER rather than of the account: an existing user signing in on a second machine, in a private
window, or after clearing storage was met by a full-page welcome covering the workspace they had
been using for months. `LoginPage`'s sign-up branch now calls `beginFirstRun()` — the writer of
`awaitingFirstRun`, which `needsFirstRun` reads — so a sign-in cannot reach it by any path. It is
armed after `signUp()` resolves, which is after `loadMe()`, so the record gets a real uid to be
scoped to.

**The invariant is "nothing re-arms it implicitly", not "only registration ever does", and there
is now a second, explicit writer.** `askAgain()` — `Restart onboarding` on **Settings → General** —
calls the same `beginFirstRun()`, and it is the only other caller. It re-arms rather than resumes:
the recorded category and platform go and the replay starts at the welcome, which is what separates
it from the Dashboard's `SetupResumeBand` (keyed on `paused`, resumes the parked beat, absent for
everybody else). Two halves are needed and a change here has to keep both. Re-arming on `/settings`
opens nothing, because `MainLayout` binds the surface to `route.path` — so
`SettingsOnboardingPanel` navigates to `/`. And `arrivalFinished` is **session state that nothing
flips back**: the route watcher sets it the moment you leave `/`, so the restart worked on a cold
load into `/settings` and silently did nothing when the reader had clicked through from Home. Same
code, two behaviours. `MainLayout` therefore watches `needsFirstRun` for the flip **to** true and
clears `arrivalFinished`, `arrivalStep` and `arrivalIntent`. Not routed through `resumeStep`:
`ARRIVAL_STEPS` (v5's rename of `RESUMABLE_STEPS`) excludes `'welcome'` on purpose, and a restart
replays from it.

**The skip control is on every beat, including the welcome, and that is the one place this departs
from the prototype.** The prototype offers it from the category beat onward, which is right there
and wrong here for a structural reason: its welcome has no application behind it, and ours covers a
working Dashboard. The surface is `persistent` (no Esc, no backdrop dismiss) and Back from the
category beat lands on the welcome — so under the prototype's rule the welcome held exactly one
control and it pointed forwards. That is a trap, and it was reported as one.

**NO BEAT MAY RENDER NOTHING, and that is an invariant rather than a nicety.** The platform beat
shipped briefly with a `v-else` in the overlay and an empty-object fallback in the component, so a
'platform' step with a category that has no `PLATFORM_CHOICES` entry rendered an empty headline, an
empty lede and no cards — a blank full-screen surface carrying only the wordmark and Skip, which is
indistinguishable from the app having crashed, and there is no Back on it because the footer lives
inside the same panel. Two guards now: the overlay mounts the platform beat only on
`step === 'platform' && needsPlatformStep(intent)` and falls back to the **category question**, and
the component itself warns and emits `back` if it is mounted without a group. A beat that cannot
answer its own question falls back to the question that produces the answer, never to nothing.

**A category with one template skips the third beat.** "A website" resolves to `web-sdk` alone and
"Something else" is not a template at all, so both go straight to the create flow; only `store` and
`app` have an entry in `PLATFORM_CHOICES`. A beat asking a question with one answer is a click that
teaches the reader their answers do not matter.

**THIS REPLACED THE PERSONA QUESTION, and the persona system is gone with it.** First sign-in used
to ask "what do you do?" — engineer, marketer, analyst — and the answer ordered the sidebar and
the Dashboard's blocks. That is deleted: `src/config/personas.js`, `src/lib/navOrder.js`'s
`orderNavGroups()`, `PersonaQuestion.vue`, `PersonaIcon.vue` and `SettingsPersonaPanel.vue` are
all removed, and `DashboardHomePage.vue` and `MainLayout.vue` no longer read a role. **The rail is
the authored order for everybody**, and the only two things that change it are the entitlement
gate and feature activation. The reasoning: a role picked in the first ten seconds moved rows
around on a rail where every row stayed anyway, so nobody could see what the answer had bought,
support could not say "it's the fourth row down" to anyone, and the ordering had to be re-derived
every time the nav changed. What a new account can actually tell us in ten seconds is not a role,
it is where their customer activity lives — which is the first field of the create form.

**`src/lib/navSections.js` is what survived `navOrder.js`.** `toSections`/`toFlat` are still
needed, because a section caption ('COLLECT', 'FANS', 'ACCOUNT') is a **field on the first group of
its section** rather than a wrapper, so any pass that removes rows can strand one — drop
`audiences` and 'ACTIVATE' goes with it, leaving Campaigns absorbed into the section above.
`orderFront()` survived too, unused, with its "front-load, never filter" rule intact: if an
ordering ever comes back it belongs on top of that function rather than beside it.

**`pnpm smoke:dist` cannot cover this flow, and that is structural rather than an oversight.** The
gate signs in as an EXISTING account and walks 51 routes — which is exactly the path that must
never see the arrival, so a green run says nothing about whether the beats work. Verifying a
change here means registering a NEW account and driving all seven beats, plus a sign-in and a
wiped-storage sign-in to confirm neither reopens it. **A reload mid-flow is now part of that
check**: it must resume, not restart, or the run creates a second source. Note that walking the
flow for real **creates real records** on whatever `VITE_API_BASE` points at — a source, and for a
`web` or `zid` template a ClickHouse destination and a pipeline — so use a throwaway account on a
domain that is not a real workspace's. Staging accepts `POST /v1/register` from `localhost:9000` and does not
gate sign-in on email verification, so a throwaway account is a working way to check it.

**The arrival is over a fully-rendered Home, never a route — full-page or not.** A `/welcome`
route would replace `MainLayout`, so `[data-smoke="nav"]` would never appear and
`pnpm smoke:dist` would fail at sign-in for all 51 routes rather than on one screen. Three
consequences any change here has to preserve: the page beneath stays mounted, the arrival renders
**no `<h1>`** (smoke asserts on the first one, which belongs to the page — the beats' headlines
are `<h2>` carrying `text-sfere-h1!`/`text-sfere-h2!`, because the size is the point and the size
is a token), and it opens **only on `/`** — a deep link to `/errors` from Slack must not be met by
it. `MainLayout` binds it to `route.path`, which is also what closes it on navigation.

It is a `maximized persistent q-dialog` rather than a hand-rolled `fixed inset-0`, for the focus
trap, the scroll lock and the teleport; see the dialog-collisions section above for why
`maximized` takes it out of collisions #3, #4 and #8.

State is `src/composables/useOnboarding.js` — module singleton, `localStorage` key
`sfere_onboarding`, shape
`{ v, uid, seenAt, awaitingFirstRun, skipped, paused, step, intent, platform, sourceId,
completedAt, tour, chapters, runs }`:

- **`STATE_VERSION` is 5, and every bump was load-bearing.** v5 is the seven-beat arrival:
  `pausedStep` became **`step`** and is written on **every advance** rather than only when the
  reader parks, `sourceId` is new, and `hasOnboarded` is keyed on **`completedAt`** rather than on
  `intent`. All three follow from the same fact — the arrival now creates a real source part-way
  through, so a reload has to put somebody back where they were instead of restarting a flow that
  would create a **second** source, and recording the category can no longer be allowed to settle
  the arrival and close the surface under a reader who is still working through it. A v4 record
  cannot answer any of that, so it is discarded. v1 carried `persona`; v2's `skipped`
  meant "dismissed for good", which under the resumable rule below would read as "parked and
  unresumable" and strand every existing record on a path it can never leave. Discarding is the
  right outcome in both cases, not merely the cheap one — the whole record is one question and
  some progress, so re-asking costs two seconds where a migration path costs more than that
  forever. v4 added `awaitingFirstRun`, and a v3 record cannot say whether a registration opened
  it, so it is discarded too: the failure mode of discarding is that one genuinely new account
  misses the welcome, and the failure mode of keeping is every returning user being shown it.
- **`uid` is what makes it "first login" rather than "once per browser".** A record whose uid is
  not the signed-in user's reads as un-onboarded, so a shared machine asks the second person
  instead of handing them the first person's answer. Nothing is persisted while signed out.
- **`intent` is validated against `SOURCE_INTENTS` and `platform` against `PLATFORM_CHOICES`**, so
  a renamed key or a hand-edited store reads as "nothing chosen" rather than as a truthy value
  nothing resolves.
- **`intent` is now written when the card is clicked, and that is the v5 reversal.** It used to be
  written only on the way out, because `setIntent` settled the arrival and `arrivalOpen` read that
  — recording on the click closed the whole surface underneath the reader. Settling is
  `completedAt`'s job now, so progress is recorded as it happens: the category on its click, the
  platform on its click, the beat on every advance and the source id the moment it exists. Only
  `complete()` and `pause()` settle anything.
- **`sourceId` is recorded; the write key is deliberately NOT.** The backend issues that key
  exactly once and every later read is masked, so persisting it would put a live credential in
  `localStorage` to save a click. What that costs is one thing: a reader who parked on the
  **install** beat and comes back after a reload resumes on **verify** (which needs only the id)
  rather than on an install guide that would render its `provisioning…` placeholder over a key
  that had in fact been issued. Within one session the source is still in memory, so they land
  exactly where they left. The snippet is always reachable from the source's own Setup
  instructions tab — the same component, which is the point of it being the same component.
- `chapters` and `runs` are written empty on purpose, for the scripted tour that is a later phase.

**There is ONE category taxonomy, not two.** The overlay's four cards are keys into
`SOURCE_INTENTS` in `src/config/sourceIntents.js` — the same six intents `/sources/new` step 1
renders — and `src/config/firstRun.js` holds only the copy plus `PICKER_INTENTS`, the subset shown.
Two lists would drift the first time a connector shipped, and the overlay would offer a category
the create flow could not receive. It shows **four of the six**: "Payments" and "My own backend" are
the long tail, and six equal cards on an arrival screen asserts something untrue about the product.
Both stay one click away behind "Something else". A coming-soon intent is dropped from the picker
entirely, for the same reason the create flow greys it out.

**THE `?intent=`/`?template=` HAND-OFF IS NO LONGER HOW THE ARRIVAL ENDS**, since the arrival now
owns the create. `applyIntentParam()` and `applyTemplateParam()` on `SourceCreatePage` are
**unchanged and still live** — the params are still a valid way to deep-link that page, and every
existing link still works — they are simply not written by the arrival any more. The paragraphs
below describe that page's own contract, which is worth keeping accurate:

**Both answers travel in the URL: `/sources/new?intent=<key>&template=<id>`.** Query params rather
than shared state, so the hand-off survives a reload, a link pasted to a colleague and the back
button — and so the create page stays readable on its own without knowing an arrival exists.
`applyIntentParam()` in `SourceCreatePage.vue` guards the intent the same three ways the draft
restore is guarded (resolves in the registry, not coming-soon, `to`-style intents are followed with
`replace` rather than selected) and **loses to a restored draft**: a half-filled form somebody
walked away from is work, a category clicked two seconds ago is an opening move, and overwriting
the first with the second is an unannounced undo of the thing `useSourceDraft` exists to protect.

**`?template=` is a SECOND param rather than a compound one**, because the two answers are
independent: `?intent=store` alone is a valid hand-off — it is what the create flow's own step 1
produces — and a template alone is meaningless without the intent that says which picker it belongs
to. Splitting them also left every existing `?intent=` link working untouched.
`applyTemplateParam()` guards it **four** ways: a string, one of THIS intent's templates (or
`?intent=website&template=zid` would pre-select a card the picker on screen does not offer),
present in the loaded catalog, and not coming-soon — the same rule that greys the card, applied to
the URL that would otherwise bypass it.

**The click IS the consent, which is the one departure from the surface this replaced.** The
persona overlay recorded a role and then offered a separate button onto the first setup step,
because being thrown onto a form by a click you thought only recorded a preference reads as a
misfire. Here the click is the choice of what to connect — "Website" is not a preference, it is the
first field of the create form — so a second consent step would ask the same question twice.

**The spotlight walkthrough used to be armed here and no longer is** — see the note above. The
arrival now walks the reader through the intent, the create and the event check with a full screen
each, so a coachmark pointing at a create form nobody was sent to would be a tour with nothing to
show.

**SKIPPING IS NOW A PAUSE, AND THAT REVERSES WHAT THIS FILE USED TO SAY.** `Skip setup · Go to
dashboard` writes `paused: true` plus the beat it was pressed on, and the Dashboard grows a
`SetupResumeBand` that reopens the arrival on that beat. **Any of the seven beats can be parked
on now**, not just the two questions — the install beat is the single most likely place in the
whole flow to walk away from, since its own copy invites it ("come back here anytime to confirm
the connection"). The old rule — "nothing brings the overlay
back, because a modal that returns after being dismissed is the thing people learn to click past
without reading" — is true of a modal that **returns by itself**, and nothing here does: the band
is inert until it is pressed, and pressing it is the only thing in the app that sets the in-memory
`resumeStep`. What the old rule actually cost was the person who pressed Skip to look around first
and then had no route back to the three screens that would have connected their data.

**The band is keyed on the record, not on the count — and gated on both.** `resumeVisible` is
`paused && setupLoaded && !setupUnavailable && setupDone === 0`, so somebody who parked the arrival
and then connected a source from the Sources screen an hour later does not keep the band. There is
deliberately **no stored completion flag**: that is the thing `useSetupProgress` exists to avoid,
since it can disagree with reality the moment the only source is deleted. Two states, from the
record alone: a category was chosen (amber, "Finish connecting your online store") or it was not
(purple, "Your workspace is ready"). It is neither a `NoticeBanner` (that reports account state and
must not be dismissible) nor an `IntroBand` (that is editorial and true of everybody).

**The skip control is pinned to the top-right corner and is absent on the welcome beat.** That is
the prototype's rule and the right one: nothing has been asked on the welcome, so the only thing a
skip could mean there is "close the page I have read one sentence of". Pinning rather than footering
it is what stops it reading as a different control on each beat.

**Parking is acknowledged**, for the same reason choosing is: it used to make the overlay simply
vanish, which is indistinguishable from having dismissed it by accident, and it is the one branch
where nothing else on the screen changes to confirm the click landed. The toast now names the band
rather than the Sources screen, because the band is what it is actually promising.

**Ten files, and the shell still owns nothing but appearance.** `FirstRunOverlay.vue` is the
surface (the wordmark, the pinned skip, the beat swap and focus); the beats are
`FirstRunWelcome.vue`, `FirstRunCategory.vue`, `FirstRunPlatform.vue`, `FirstRunAuthorize.vue`,
`FirstRunConnect.vue`, `FirstRunVerify.vue`, `FirstRunSetup.vue` and `FirstRunReady.vue`, with
`FirstRunBeatHeader.vue` holding the eyebrow/headline/lede every one of them opens with — and the
two `aria` ids the dialog's `aria-labelledby`/`aria-describedby` point at, so a new beat cannot
forget them. `OnboardingFlowDiagram.vue` (plus `OnboardingFlowWire.vue`) is the picture on the
welcome.

**Every DECISION is still an emit**, and `MainLayout` owns all of them: which beat follows which
(one `onAdvance`, so the order lives in one file), what a category means, when the source gets
created, and what settles the record. What the overlay reads directly is `useFirstRunSetup` for
what the later beats **display** — a dozen values that would otherwise be threaded
`MainLayout` → overlay → beat as props, where a renamed field fails silently in the middle file.

**The skip is on every beat except `ready`.** It is on the **welcome**, where the prototype hides
it, because ours covers a working Dashboard and the surface is `persistent` — under the
prototype's rule the welcome held exactly one control and it pointed forwards, which was reported
as the trap it is. It is **not** on `ready`, where the prototype also hides it, for the
prototype's own reason: the source exists by then and the beat's own control already says "Go to
dashboard".

**EVERY BEAT IS WRAPPED IN A PLAIN `<div>` INSIDE THE `<transition>`, AND THAT IS LOAD-BEARING.**
A `<Transition>` child has to be a single ELEMENT vnode for the leave to run, and an SFC whose
template opens with a comment does not render one: in dev the compiler keeps comments, so the
component's root is a fragment (comment + div), and unmounting a fragment root removes its nodes
directly without ever running the element's leave hooks. Under `mode="out-in"` that is fatal rather
than merely unanimated — `afterLeave` is what clears `isLeaving` and re-renders — so the surface
rendered its empty placeholder and **nothing else**. It shipped that way: pressing
`Start connecting my data →` gave a blank full-page surface carrying only the wordmark and Skip,
which are outside the transition. It is **dev-only**, which is why `pnpm build` and
`pnpm smoke:dist` are both blind to it: a production build strips comments and each beat compiles
to the single root it appears to have. The wrapper is in `FirstRunOverlay` rather than fixed by
moving the three comments inside the three roots, because every SFC in this repo opens its template
with a comment — the next beat added, or anyone tidying one back to the house style, would
reinstate a blank screen with no error and no warning. Comments **between** the `v-if` branches are
safe and stay; `v-else`/`v-else-if` resolution removes comment siblings.

**The rule is not specific to these three beats.** Any `<Transition>` in this repo whose child is a
**component** inherits it, because every SFC here opens its template with a comment. Give the
transition an element of its own to hold. `SourceProvisionedOverlay` is safe for two reasons rather
than one — its child is a plain `<div v-if>`, and it has no `out-in` mode, so a skipped leave would
cost an animation rather than the whole render.

**Focus moves on the transition's `@enter`, not on a tick count**, and that is the same bug's other
half. `mode="out-in"` holds the incoming beat back until the outgoing one has finished leaving —
140ms and many ticks — so the two `nextTick`s the overlay used to await ran while `beatRef` was
still null, the optional chain swallowed it, and focus sat on `<body>` inside a modal: exactly the
failure the hand-rolled focus exists to prevent, failing silently. The watcher survives for the
FIRST beat only, because the dialog is not `appear`, so opening it mounts the welcome with no enter
transition and no hook to fire.

**The diagram is deliberately NOT a `FlowTopology`**, and that is not an oversight of the "one
diagram implementation" rule under `src/components/flow/**`. That family exists so the Dashboard,
the Pipes visual view and the route previews draw the same thing: real records, wires measured off
real bounding boxes, a per-node status out of `flowStatus.js`. Every one of those inputs is absent
here — this runs before the account has a single source, so there are no records to measure, no ids
to link to, and a status would be a claim about nothing. What it shares it shares through the same
tokens, the same `animate-sfere-travel` keyframe and the same `FlowNodeIcon`, which is where the
duplication would actually have cost something.

`FlowNodeIcon`'s `MARKS` map gained **identity entries** for the mark names themselves (`store`,
`app`, `api`, `warehouse`, `analytics`, joining the `web` and `webhook` that already doubled as
both), so a caller with no record to key off can ask for a glyph by name. The first-run screens are
exactly that case: their touchpoints and numbered steps illustrate categories rather than rendering
a source that exists.

Four layout details on these screens are collision fixes rather than taste, and a change here has
to keep all four:

- **`grid gap-*` for every vertical rhythm, never `flex flex-col` and never `mt-*` on a `<p>`.**
  Collisions #4 and #5. `sfere-flush` goes on the element whose **direct** children are the
  paragraphs — putting it on the `<ol>` rather than the `<li>` does nothing, which is how the
  numbered cards first shipped reading loose.
- **A row that must not wrap needs `flex-nowrap!` OR `min-w-0 flex-1` on the child that gives
  way** — `min-w-0` alone is not enough, and the warehouse band wrapped its icon onto its own line
  until it got both.
- **Container queries (`@min-[46rem]`, `@min-[38rem]`), never `sm:`/`lg:`**, and never `auto-fit`
  tracks. Collision #6.
- **`@max-[46rem]:hidden`, never `hidden @min-[46rem]:block`.** Collision #2: a bare `hidden` can
  never be turned back on.

**`SfereLogo` is sized by an `h-*` class and never by its `height` prop**, app-wide: that prop is
inert because Tailwind preflight ships `img, video { height: auto }` in `@layer base` and the
component only sets a `height` attribute, which any author rule beats. It stays for the intrinsic
ratio.

**Focus has to be moved by hand when the beat swaps**, and it is a correctness fix rather than
polish: the surface is `role="dialog" aria-modal="true"`, and Quasar focus-manages a `q-dialog` when
it OPENS, not when its contents change — so the control someone just activated unmounts under their
cursor and focus falls back to `<body>`. Two details: each beat names its own first control through
a `focusFirst` expose (the welcome wants its CTA, the two question beats deliberately want **Back**,
so an Enter held down from the previous beat cannot answer the next one), and every call passes
`{ preventScroll: true }` — without it, focusing the welcome's CTA scrolled the surface past its own
headline on arrival.

### Three other first-run surfaces

**The setup tracker** (`useSetupProgress.js` + `components/shell/SetupProgressPanel.vue`) answers
"source → destination → pipe, how far am I?" It is **derived, never stored**: three list reads,
no `setupComplete` flag anywhere, because a flag can disagree with reality the moment someone
deletes their only pipe. All three domains have live endpoints, so unlike most of the app it is
accurate in the default real mode. It lives on the Dashboard **and nowhere else** — Sources,
Destinations and Pipes each render the one-line `SetupReminderStrip` pointing back at it, because
four copies of the same three steps is four things to keep in agreement. The strip shows the step
the _workspace_ is on, not the step the screen is; it hides itself once all three exist. The
panel is dismissible only after that, and the dismissal is `localStorage`.

**At zero of three the Dashboard leads with the setup diagram, and that is a reversal of what
this file used to say.** It previously said one sentence and one button, with the tracker gated
off; the duplication that argued for was real, but hiding the tracker was the wrong half to drop.
What a brand-new account needs first is the **shape** of the work — three steps, in a fixed order,
each gated by the one before it — and a sentence plus a `Connect your first source` button states
the goal while hiding all of it, then swaps in a different-looking surface the moment step one
lands. So `SetupProgressPanel` is no longer three cards but a **node-and-wire diagram**, and
`setupVisible` no longer excludes `firstRun`: one surface answers "how far am I?" at 0, 1, 2 and 3.

`DashboardHomePage`'s `firstRun` is still `setupLoaded && !setupUnavailable && setupDone === 0`,
still a branch in the existing chain (skeleton → error → firstRun → empty → populated), and that
branch now renders **nothing** — the diagram above it is the screen. The `<h1>` swap to "Let's get
your activity data flowing" and the suppressed header actions and subtitle both stay, and the
diagram's own single CTA is the one button. **The headline is the `<h1>` and not an `EmptyState`
title** on purpose: `EmptyState` renders its title at 14px semibold, so a welcome put there would
be a label above a button while the word "Dashboard" stayed the largest text on a screen with
nothing to dashboard — and `EmptyState` reaches every screen, so it is not the thing to restyle
for one. Smoke is unaffected: still exactly one `<h1>`, still rendered by `PageHeader`, still
non-empty, and losing `data-smoke="empty"` on that branch is safe because it is not a failure
condition. Do **not** invent a third `data-smoke` attribute to compensate. The skeleton and error
branches deliberately still win over `firstRun`: the setup reads are three different endpoints, so
their success is no evidence about the dashboard aggregate, and a failed aggregate has to say so.

Four things about the diagram are load-bearing. **`locked` and `blockedBy` are derived in the
panel**, not added to `useSetupProgress` — a step that is neither `done` nor `current` is one the
chain has not reached, and what blocks it is the step in front of it, so the shared composable
gains no second consumer contract. **The wires animate only at three of three**, never at "both
ends of this wire are done": with a source and a destination but no pipe, both ends of the first
wire are green and nothing whatsoever is moving between them. Even at three the claim stays "the
path is built" — nothing there measures throughput. **The rail spans the panel's full width.** It
shipped briefly capped at `max-w-[46rem]`, because across the card's 1400px each wire stretches to
~430px and three markers that far apart start reading as separate dots rather than one chain; that
was reversed on review, since a capped rail left the right half of the card empty while the
header, blurb and footer all span it, which read as a figure dropped into a panel rather than the
panel's subject. Do not re-cap it without narrowing the footer row too. And the locked state is a
**dashed border plus a drawn padlock**, so it
survives being read without colour; it is deliberately not `disabled:opacity-*`, which Quasar's
unlayered `[disabled]` rule makes a dead class everywhere in this repo.

`SetupReminderStrip` still renders on Sources, Destinations and Pipes at zero of three: there it is
the only thing saying "connect a source comes first, but you can set this up now".

**The resume band** (`components/shell/SetupResumeBand.vue`) is the door back into a parked
arrival, and it is documented in full under Onboarding above. The one thing to know here is why it
is not a third setup tracker: `SetupProgressPanel` answers "how far is this workspace?" for
everybody at 0 of 3 out of three live list reads, while this answers "you left the arrival
part-way" for the one reader who did — so it is keyed on the onboarding record and is absent for
everybody else. It sits **above** the panel, because it is the more specific of the two.

**The post-registration interstitial** (`components/onboarding/AccountSetupOverlay.vue`) covers
the gap between a created account and the dashboard, when the session settles, `/v1/me` is read
and the acting account resolves. It runs for a fixed **2.5s** (`TOTAL_MS`), long enough that its
four step labels can be read rather than flashed — it used to be a random 1.1–2s, which made the
same sign-in feel different each time. Still a courtesy transition, not a fake loading screen, so
the number is a deliberate ceiling and not somewhere to hide slow work. Like the arrival overlay
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
two matches for `button[type=submit]` and fail sign-in for all 51 routes before a single screen
rendered.

**Settings → General used to carry a role picker** — the second surface for the persona
question, so changing the answer never meant re-running a tour. It went with the role: with no
sidebar ordering and no dashboard ordering behind it, the control was a question with no
consequence. `SettingsPersonaPanel.vue` and `PersonaIcon.vue` are deleted; the workspace form and
the Error alerts card that replaced it are both gated on a workspace loading, like every tab below.

**`SettingsOnboardingPanel.vue` is the one thing on that tab that is not**, and that is why it is
there rather than under Feature activation: the onboarding record is a per-account preference, so
in the default real mode — where `settings` has no endpoint and both gated blocks render nothing —
it is the tab's only content. It sits **last**, because restarting the welcome is an occasional
errand rather than what the tab is about, and it confirms first through its **own**
non-destructive `ConfirmDialog` rather than `SettingsPage`'s shared one, which is hardcoded
`destructive` and nothing here is deleted. The confirm copy names **both** consequences, and the
second is the load-bearing one: this leaves Settings and opens a full-page `persistent` surface
whose welcome beat carries no skip control, so a reader expecting a preference toggle would land
somewhere they cannot dismiss. There is deliberately **no success toast** — the overlay appearing
on another route is the acknowledgement, unlike the pause branch, where nothing else on screen
changes.

## The Dashboard is one picture and four numbers

Home is a **topology** — sources on the left, the Sfere mark in the middle, destinations on the
right, a curve per pipe — then the needs-attention banner, then four counts. That is the whole
screen.

**It replaced a stack of six panels**, and the persona ordering was the smaller half of the reason.
The larger half: a throughput chart, a three-column flow summary, Recent errors, Latest events, a
profiles panel and a warehouse signpost each answer a narrower question, and none of them answers
the one somebody opens a CDP dashboard to ask — _is my data getting from where it comes from to
where it goes?_ Six panels answering around it read as a report rather than as an answer.

**The retired blocks are not deleted.** `ThroughputPanel`, `ActivityPanel`, `ProfilesPanel`,
`PipelineFlowPanel` and `WarehouseHandoffStrip` are still in `src/components/shell/` and still
render correctly; they have no call site on Home any more. Monitoring and Live events are where a
throughput chart and an error list belong next, and that is a move, not a rebuild.

**Every one of the four counts is measured.** `DashboardTotals` carries sources, destinations,
pipes/`pipes_enabled` and `events_received`; delivery success is a ratio of two of those. The
fourth card **swaps** to a `tone="warn"` "Needs attention" count when there is something to act on,
because a delivery percentage and an outstanding problem are not both worth the same slot.

**`deliverySuccess` is a separate computed from `routingRate`, and both are right for their own
caller.** `routingRate` is a 0..1 fraction that coerces a missing numerator to zero, which is
correct for a chart — a line with a hole in it is worse than one reading zero, and the series
beside it already shows there was no delivery data. A stat card cannot do that:
`DashboardTotals.events_delivered` is explicitly nullable ("null when the analytics store is
unavailable"), so the same coercion prints a confident `0.0%` on a healthy account whose ClickHouse
read failed — "your delivery is completely broken", as a measured-sounding fact. `deliverySuccess`
returns null there and the card prints `NOT_KNOWN`. Zero received also returns null: a success rate
over no attempts is not a number.

**`useDashboardHome().topology` exists so the page does not fetch the diagram twice.** In real mode
this composable answers `nodes` out of the dashboard aggregate and in Demo mode out of the diagram
fixture; a page-side `useDiagram()` would always read the diagram, so the picture and the stat cards
beside it could disagree about the same account. Node `status` is derived from what is actually
measured — `events_received` per source, `events_delivered` per destination — and a node whose
count is absent reports `idle` ("nothing is moving"), never `healthy`.

**At zero of three the setup diagram is still the screen** and the topology does not render: a
topology of an empty workspace is two column headings and a blank. `SetupProgressPanel` is
unchanged and still sits above every other state, including loading and error, because it reads
three list endpoints of its own and can be useful precisely when the aggregate is not.

**Neither empty column carries a button, and that is a rule rather than an oversight.** The
topology renders only in the populated branch, reached on `setupLoaded && !firstRun` — which is
the same condition `PageHeader`'s `#actions` are gated on, so a `Connect a source` inside the
empty sources column would sit a few hundred pixels under an identical one in the top right. Every
add affordance in this app is a header action; a second copy in the content is the duplicate row
that was explicitly designed out. The empty column still names the next step in words. An
`EmptyState` `#cta` on a list screen is a **different** case and stays: it renders only when the
table has no rows at all, which is the one moment the header button is not the obvious thing on
screen, and it is the convention on all 51 screens.

**The page stacks with `grid gap-4`, not `flex flex-col gap-4`, and that is a bug fix rather than a
preference.** Quasar's unlayered `.flex { display:flex; flex-wrap: wrap }` makes every flex
container in this repo a wrapping one, and a wrapping column stretched the topology card to the
height of the whole stack — roughly 700px of white inside a card whose content was 528px tall.
`grid` has no Quasar counterpart, so `gap` and auto rows both apply. Collision #4, in a form the
existing note did not cover: it is not only height-capped columns that break, it is any column
whose child is a plain block. **Prefer `grid gap-*` for a vertical stack anywhere in this repo.**

### `src/components/flow/**` — one diagram, five call sites

There were already three hand-rolled flow pictures in the app (`SetupProgressPanel`'s node rail,
`ProvisionedPipePanel`'s three-node chain, `PipeTopology`'s grouped cards) and this port would have
added two more. It adds one component family instead:

- **`FlowTopology.vue`** — the two columns and the hub, with the connectors drawn in SVG. Used by
  the Dashboard and by the Pipes screen's Visual view.
- **`FlowChain.vue`** — one pipe as a row: source → Sfere → destination. Used by pipe detail and
  route previews. A separate component rather than a one-link `FlowTopology`, because the topology
  solves geometry it does not have: a chain is three items in a row at one height, where the
  connector is a rule with a travelling dot.
- **`FlowNode.vue`**, **`FlowHub.vue`**, **`FlowWire.vue`**, **`FlowNodeIcon.vue`**, and
  **`flowStatus.js`** (the `healthy | degraded | failing | idle` vocabulary, which is the backend's
  own `Status5`, mapped to a `StatusBadge` tone and a `flowing` flag).

Five things about it are load-bearing:

- **The wires are measured, not laid out.** Each node registers its element and the curves are
  computed from real bounding boxes on mount, on resize and on data change. Fixed offsets per row
  index break the moment a name wraps to two lines — which is a copy edit, not a code change.
- **Position is not CSS-transitioned.** A transition on `d` on top of per-frame re-measurement is
  the wobbling-line bug every diagram library eventually files. The only motion is one particle per
  connector.
- **Only a `healthy` connector animates.** A degraded pipe is delivering some events and a failing
  one is delivering none, so motion on either is a claim the data does not support.
  `prefers-reduced-motion` stops it dead — and `sfere-travel` animates `left`, so the reduced-motion
  block _hides_ the dot rather than parking it mid-wire, which would read as a stalled delivery.
- **The breakpoint is a container query (`@min-[52rem]`), never `lg:`.** The sidebar collapses
  without changing the viewport, so one 1024px window has two content widths. Note that the
  `@container` element and the element reading the query must be **two different nodes** — a
  container query is answered by a container's descendants, never by the container itself.
- **`isEnabled: false` beats whatever `status` says.** A paused pipe reports `idle`, which is true
  and also indistinguishable from "switched on and receiving nothing" — the one state somebody
  needs to act on. Naming the pause is what separates the two.

### What the ported screens do and do not claim

Four screens were rebuilt against the prototype in the same pass. Each dropped
something the prototype printed, and the reason is the same every time: **the
backend does not measure it, and a confident number is worse than a gap.**

**Pipes.** List gets the intro band, three stat cards (Total / Active /
Destinations in use), a **Visual | List** toggle — Visual is the default and is
`FlowTopology` over `useDiagram()` — and function chips on each row.
`PipeFunctionChips.vue` names them from **one account-level read**:
`FunctionDefinition.attached_pipeline_ids` is a real field, so `useFunctions()` is
inverted into pipe → names rather than firing `…/pipelines/{id}/functions` per
row, and it loads outside the page's `loading`/`error` so a failed library read
cannot take the table down.

- **There is no Edit pipe screen, and there should not be one.** `PipelineUpdate`
  accepts `is_enabled` and nothing else — no rename, no re-route — so the detail
  screen's Settings tab is the entirety of editing a pipe and says so. The
  prototype's destination-parameter JSON, environment-variable rows and
  two-column drag-to-reorder function picker are **not built**: none of the three
  exists in `PipelineCreate` or `PipelineUpdate`.
- **"Default destination" became "Destinations in use".** Every `web`/`zid`
  source create provisions its own `"{name} — ClickHouse"`, so no row is _the_
  default and a `.find()` would label an arbitrary one.
- **"Needs attention" renders only when a diagram edge actually carries a
  `Status5` string**, so Demo mode gets no "0 need attention".
- **The Errors tab has no content and says so**, pointing at Health. There is no
  `/errors` path in `openapi/fanfinity-api.json` — checked, not assumed.
- **The Activity tab is honest but second-best**: it lists events arriving at the
  pipe's _source_, because there is no per-pipeline event endpoint, and it names
  the source so two pipes off one source are not mistaken for one another.
- `PipeFlow.vue`, `PipeTopology.vue` and `PipeParams.vue` are now unreferenced.
  Left in place rather than deleted, the same way the ten `*TrashPage.vue` files
  were.

**Destinations.** The included-warehouse hero is an `IntroBand tone="brand"` with
the ClickHouse card in its `#aside`; the detail screen gains a hero band, four
stat cards and **Overview / Pipes / Configuration / Tables / SQL console**.

- **The hero is present tense and carries no number**, deliberately: the
  prototype's "Your Sfere Data Warehouse is **already set up** for you" is false
  twice over. It is singular, and the backend provisions one ClickHouse
  destination _per source_ — three web sources give three rows. And it is past
  tense, so on a brand-new account it sits above an empty table claiming a
  warehouse that does not exist yet. "Sfere sets up your data warehouse for you"
  is true at zero destinations and at five.
- **The Pipes column is deleted from the list, not rewired.** `pipeCount` is a
  fixture invention; wiring `usePipes()` for a count column would pay for
  `joinEnds()`'s two `size=100` reads and discard the join. The real inbound-pipe
  count lives on the detail screen, where the join is used. This resolves the
  Sources/Destinations inconsistency this file used to record as open.
- **"Delivered (1h)" is gone** from the list and the pipes table —
  `deliveryCountLastHour` is on neither `Destination` nor `Pipeline`, and it went
  through `formatCount`, which prints a confident `0` for `undefined`.
- **The fourth stat card is "Provisioning", not the prototype's "Availability /
  Included".** "Included" is a billing claim and nothing on the record measures
  billing; `clickhouse_database` measures who _built_ the warehouse, which is the
  honest half of the same sentence. The cost promise stays in the band's
  editorial copy, where it is a statement about the product rather than a reading
  of a row.
- **The Template column became Type.** `DestinationTemplateBadge`'s fallback
  asserts "Custom — hand-configured, not created from a template", which is false
  for every ClickHouse destination the backend provisions itself.
- **Delete copy no longer promises a trash.** `DELETE …/destinations/{id}` is a
  hard `204`.

**Functions.** One test surface, `FunctionWorkbench.vue`, on both create and
detail; `FunctionTestPanel.vue` is deleted rather than left unimported. Almost
everything here is genuinely backed — `POST …/functions/{id}/test` returns
`{ok, result, dropped, error, logs, duration_ms}`, and `code` on the request is
what lets the workbench run **unsaved** edits.

- **"Get live event" is not built.** No endpoint hands the editor a recent real
  event. There is `Sample event` and nothing else.
- **The env-vars tab is kept, with copy and no input.** `FunctionTestRequest` is
  `{event, code}`, so a box there would silently discard what was typed into it.
- **The create page cannot run a test**, because `POST …/functions/{id}/test`
  needs an id. The controls are _removed_ rather than dimmed —
  `disabled:opacity-*` is a dead class in this repo — with one sentence saying
  where the run happens instead.
- **Delete confirms name the attached pipes only when every id resolved.** A
  partial list would send someone to detach two of three and hit the same 409.
- The list's actions column is `RowActionsMenu` now; it was one of the few
  screens that never got the kebab.

**Live events.** Rebuilt on the kit — it was the last screen with a raw `<h1>`, a
raw toolbar, a raw `<table>` and a raw drawer. `apiMissing`, `error` and both
empty states now come from `DataTable`, so `data-smoke` comes from the kit rather
than from hand-rolled markup.

- **The three stat cards count the rows actually loaded, and say so** ("Counted
  from the rows below, not an hourly total"). The prototype's "1,284 events
  received · 99.4% processed" describes a window nobody computes; a rate over one
  page of results stays a lie however it is labelled, so there is no percentage.
  The block is hidden entirely until there are rows, so nothing prints `0` beside
  "No API yet".
- **The tab and the Status select are one piece of state**, both bound to the
  endpoint's own `level` parameter. A "Success" option could only ever be a local
  narrowing of one page sitting beside a server-side filter and looking like its
  peer.
- **The drawer keeps `q-dialog`**, claimed under the same _modal_ carve-out
  `ConfirmDialog` and `SecretRevealDialog` sit under — focus trap, Escape, scroll
  lock, backdrop, teleport. It lives outside `src/components/ui/`, so the kit
  itself gains no dependency. Its corner radius is deliberately unset: the
  unlayered `.q-dialog__inner > div` rule pins 4px and `position="right"` zeroes
  the right corners anyway, so a radius utility there would be a dead class.
- **The HTTP-headers block is gone.** `useLiveEvents.js` says the backend
  `LiveEvent` carries no headers, so it rendered `None` on every real event.

**One kit gap is open and deliberately not closed here.** `DataTable`'s
`apiMissing` branch prints "This screen doesn't have a live backend endpoint yet",
which is wrong for `/live-events`: `…/events/live` ships, and the real cause is
almost always "no source with a provisioned stream". The branch sits above the
`empty` slot, so a page cannot override it. **`DataTable` needs an
`api-missing-description` prop or an `api-missing` slot** — a change to a file
every list screen renders, which is worth its own pass rather than a drive-by.

### Teaching bands are dismissible, and that is what lets them exist

`IntroBand.vue` is the explanatory band at the top of Sources, Destinations, Pipes and Functions:
eyebrow, title, a sentence about what the noun is, optional ticked `points`, and an `#aside` slot
for a figure. `useDismissed.js` backs it — **one** `localStorage` key (`sfere_dismissed`) holding a
flat map, rather than one key per band, so there is one thing to reset and one place to look.

**It is not a `NoticeBanner` and the two must not be merged.** A `NoticeBanner` is "this worked, but
you should know" — a state the app is reporting about your account right now, which goes away when
the state does, and which must NOT be dismissible. This is editorial: it says the same thing on
every visit and is true of every account, so it must be dismissible or it taxes the hundredth visit
to pay for the first.

`storageKey` is what makes it dismissible; **omitting it is a real choice** — a band with no key
renders with no close control and stays. `useDismissed` is deliberately not uid-scoped, unlike
`useOnboarding`: that record answers a question about a person, this one records that a browser has
already been shown a paragraph.

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
rewritten to sentences, colons or parentheses across every screen, `public/data/*.json` and
the screen manifest — `screens.js` titles used to read `Warehouse Models — list view` and now
read `Warehouse models`, which matters because that string is the real `<h1>`
`ComingSoonPanel` renders. `src/components/sfere-docs/**` (the `/design-system` reference
page) is the deliberate exception: it is long-form editorial prose, not product chrome.

## UI primitives

`src/components/ui/` is **the** component kit — 47 components, all built on the Sfere token
layer. **Use them; do not re-implement their markup and do not copy their class strings into a
page.** Read `docs/ui-conventions.md` before writing any new screen.

Two naming schemes live in the folder, for a reason worth knowing:

- **20 screen primitives carry plain, unprefixed names** — `PageHeader`,
  `DataTable`, `EmptyState`, `ErrorState`, `LoadingState`, `StatusBadge`, `CardPanel`,
  `NoticeBanner`, `StatCard`, `TabNav`, `FormField`, `FormSection`, `ConfirmDialog`,
  `DefinitionList`, `SelectableCard`, `ToolbarSearch`, `StickyActionBar`,
  `SecretRevealDialog`, `RowActionsMenu` and `IntroBand`. Sixteen of them
  keep the names the screens already imported, which is what let the Sfere implementations
  replace the originals across 104 files without rewriting 571 imports; the other four —
  `StickyActionBar`, `SecretRevealDialog`, `RowActionsMenu` and `IntroBand` — are newer than that
  swap and simply describe what they do. A few of the older names are now worse than what
  they hold (`CardPanel` is a card, `NoticeBanner` is an alert); that was the price of the swap.
- **27 keep their `Sfere*` names** — `SfereButton`, `SfereInput`, `SfereTable`, `SfereSection`,
  `SfereFeatureCard`, `SfereConfetti` and friends. These have no pre-Sfere counterpart, and the
  prefix keeps `SfereTable` distinguishable from a bare `<table>` and from `QTable`.
  `SpotlightTour` is the one unprefixed newcomer, for `RowActionsMenu`'s reason: it is newer than
  the swap and its name already describes what it does.

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
actions in a `DataTable`, where the noun that matters is _which row_, not the `<h1>`. That last
clause is why a row's actions collapsed into a **kebab** rather than into two bare glyphs.

**`RowActionsMenu` is the row-level answer, and it is one control rather than two-or-three.**
A list row used to carry its actions as bordered text buttons in the last cell, which cost a
120–230px column on every screen and put the second-most-important thing on the row (a Delete
nobody clicks) in permanent competition with the data. The kebab spends one 36px cell and shows
its verbs when asked. Props are `actions: [{ key, label, icon?, tone? }]` and a required `label`;
it emits `select` with the key and **opens nothing and confirms nothing** — the page keeps its own
`ConfirmDialog`s, its own `toggleTarget`/`target` refs and every word of its own copy, so the
confirm rules below are unchanged by the swap. It is on the fourteen list screens that had
row-level actions; the actions column is `72px` (or `76px`) there now.

Five things about it a new caller has to know. **`label` is required and is the row's noun**
(`Actions for ${row.name}`), because a teleported menu is the one control where "which row is
this?" cannot be answered by looking. It carries **no tooltip**, deliberately parting company with
`SfereIconButton`: a `SfereTooltip` bubble would be clipped by the same table scroller the menu
teleports out of, and a native `title` on top of an `aria-label` is announced as the description,
i.e. the same sentence twice. **An empty `actions` array is a dead control** — `openMenu()`
returns early on `[]` — so a page whose only action is conditional must render no trigger at all
rather than an empty menu; `/attributes` does exactly that on a managed row. **Icons are per-menu,
not per-app**: items lay out `flex items-center gap-2`, so one icon-less entry beside iconed ones
starts its label a glyph's width to the left, and that raggedness is visible because every item is
on screen at once — either all of a menu's items carry a glyph or none do. Three screens landed on
"none" because `sfereIcons.js` has no honest mark for "Send test", "Sync now" or "Test
connection". And **no page-level `@click.stop` is needed**: the trigger, the menu root and every
item stop their own clicks and the menu is teleported to `<body>`, so it does not bubble through a
`clickable-rows` `<tr>`.

**It is not universal, and two of the departures are deliberate rather than unfinished.**
`/goals` and the Audiences screen's own Trash tab each have a single action and keep a labelled
button — a one-item kebab costs a click and shows no verb. `/destinations` and `/pipes` carry a
one-item kebab anyway, so that the last column means the same thing across the three live domains;
each file says so and says not to simplify it back without changing all three. Neither page grew
a row-level Delete in the process: writing destructive confirm copy for two screens from scratch
is a product decision, not a side effect of a control swap.

**The guided walkthrough is a spotlight, and it is driven by the page rather than by itself.**
`SpotlightTour` is mounted once in `MainLayout`, dims the window with a single `0 0 0 9999px`
box-shadow whose own box is the hole, rings the control someone should use next, and floats a
callout beside it. A page joins in two ways and no others: it calls
`useGuidedTour().show(stepId)` when its own state changes, and it carries a `data-tour="…"`
attribute on the thing to point at. `src/config/tours.js` holds the steps as pure data, the same
idiom as `features.js` and `sourceIntents.js`.

**`show()` from the page, never inference from the route, and that is what keeps a coachmark from
outliving what it points at.** `SourceCreatePage` watches its own three-step flow and names the
step; the tour knows nothing about routes or forms. A tour that guesses is a tour that says
"click Create" on a screen with no Create — and because the page calls `show()` on mount as well
as on change, the coachmark is re-derived from the screen on every load rather than remembered.
Which step is showing is therefore **in memory**, while _whether a walkthrough is running_ is the
`tour` field on the onboarding record: it has to survive the navigation off Home and a plausible
reload, since step 3 is where somebody leaves to paste a snippet on their own site. A persisted
step index would come back pointing at a control the create flow deliberately does not restore.

**Three rules on the spotlight itself.** The layer is `pointer-events-none` apart from the
callout, so **the dim blocks nothing** — step 2 spotlights the action row while its copy says the
details above are still editable, and a blocking scrim would make that false. The anchor is
measured every frame and its position is **not** CSS-transitioned; the travel between steps comes
from the smooth `scrollIntoView` instead, because a transition on top of per-frame updates is the
wobbling spotlight every tour library ends up filing a bug about. And **a missing or unlaid-out
anchor renders nothing at all** rather than a callout pointing at empty space. There is no Next
button: the step advances when the page does, because only the page knows whether the work was
done, and the single control ends the walkthrough.

**One tour today, and all three roles run it** — `source-setup`, three steps: pick an intent,
create the source, check for the first event. The last of those ends the walkthrough in
`SourceInstallGuide` beside the confetti, so finishing and celebrating are the same moment. Step 3
waits for `SourceProvisionedOverlay`'s `close` when a pipe was provisioned, because pointing at a
button under a full-screen curtain scrolls the page behind it and reveals a coachmark nobody saw
arrive; `state` being `none` or `unavailable` means there is no curtain coming and it shows at
once. `MainLayout` arms the tour **on the click** that takes the arrival's CTA, and only when that
CTA leads to `/sources/new` — so a skipped question, which is the path `scripts/smoke.mjs` walks,
never arms it, and no other CTA arms a spotlight with no step to show.

**Celebration is a component, and its gate is never in it.** `SfereConfetti` is the kit's one
canvas component and the one nothing on a screen mounts: a single renderer sits in `MainLayout`,
and any screen anywhere below it says `useConfetti().fire()`. Hand-rolled rather than a dependency
for the reason the glyph registry is inline — `default-src 'self'` blocks a CDN script and
`assetsInlineLimit: 0` blocks the data URI those packages want — and its palette is read off
`:root` with `getComputedStyle` at fire time, since a canvas cannot take a Tailwind class and a
pasted hex is what broke last time the brand changed. Under `prefers-reduced-motion: reduce` it
draws **nothing at all**, not a slower burst; that is only acceptable because every moment that
fires one also states its result in words that stay on screen.

**Two call sites today, and both gates are worth copying rather than loosening.** A burst is the
loudest claim a screen can make, so it goes where the backend has already made something true:
`/sources/new` step 3 fires on `provisioningState === 'found'` beside a shown
`SourceProvisionedOverlay` — never on "a source was created", since three of the seven templates
provision nothing, Zid's chain is dry until webhooks and a first sync have run, and Demo mode
saved nothing — and `SourceInstallGuide` fires when the event check comes back with a real count,
gated on `result.tone === 'success'` rather than on its `verified` emit, because the preview
branch sets that too while reporting that nothing was checked. Each holds a one-way flag: `state`
re-notifies when a late destinations read fills in a name, and `Check again` re-enters the success
branch on every click. The create-page burst carries `delay: 700` so it lands as the overlay's
chain finishes drawing rather than before it starts.

**A secret the backend returns once goes through `SecretRevealDialog`, and its rules are the
opposite of every other dialog's.** `ApiTokenCreated` and `WriteKeyCreated` carry a `plaintext`
alongside the record; every later read carries a masked prefix, so the create response is the
only moment the value exists anywhere. The dialog is therefore `persistent`, has **no Cancel and
no `v-close-popup`**, and its one button says it is the last time — because a stray click on the
backdrop is otherwise an unrecoverable loss the person had no way to see coming. Two
implementation notes it will bite you on: the width has to be a **literal** utility pair
(`w-[min(620px,92vw)]! max-w-[min(620px,92vw)]!`) since Tailwind v4 extracts class names from
source text and a runtime-built `` `w-[${n}]!` `` is never generated, leaving Quasar's unlayered
560px cap in charge (collision #3); and the close glyph is inlined rather than taken from
`sfereIcons.js`, which has no `close` entry.

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

## Page width — every screen caps its own content at 1400px

Screens used to sit in `max-w-3xl` / `4xl` / `5xl`, and `--container-sfere-page` is `80rem`
(1280px) — measured on a wide monitor that left roughly 40% of the window empty beside a table
that had columns to spare. The cap is now **1400px, applied by the page**, and it wraps everything
the reader takes as one column: the `PageHeader` (so the `<h1>` shares the content's left edge),
the toolbar, the tabs, the table, and any sibling branch the tabs swap in — `ConnectorCatalog` on
`/sources`, the topology view on `/pipes` — or the right edge visibly steps in and out as the tab
changes. Dialogs stay outside it; they teleport regardless.

**It is page-level and not a container in `MainLayout`, deliberately.** A shell-level cap would
apply to the demo-mode footer, the header bar and `ComingSoonPanel` as well, and would make the
one screen that genuinely wants the full window (nothing does today, but the topology view is the
candidate) impossible to write without fighting the layout.

**Three shapes of it ship right now, and that is a divergence to reconcile rather than a pattern
to pick from.** Most list screens and the Dashboard use a wrapper `<div class="mx-auto w-full
max-w-[1400px]">` inside the existing `q-page`; the four Engage screens put the same utilities on
the `q-page` itself (verified safe: Quasar ships `.q-mx-auto`, not `.mx-auto`, has no `max-w-*`
rule at all and sets no width on `.q-page`); and `SourceCreatePage` caps **left-aligned**, with no
`mx-auto`, because a three-step flow reading left to right should not shift horizontally between
steps. The first two are the same thing written two ways and should converge.

**The literal is repeated in roughly ten files because it has to be.** Tailwind v4 extracts class
names from source text, so a token-built `` `max-w-[${n}]` `` is never generated. The durable home
is a `--container-sfere-wide: 87.5rem` in `src/css/sfere.css` with a named utility over it; until
that lands, copy the string rather than improvising a nearby number.

**A wide page is not a licence for wide text inputs.** Step 2 of `/sources/new` goes two columns
past a `@min-[64rem]` **container** query rather than spending the extra width on 1300px-wide
fields, and the intent picker's grids are container queries for the reason collision #6 gives: the
sidebar collapses without changing the viewport, so one 1024px window has two content widths and a
`lg:` breakpoint is answering the wrong question. `repeat(N,minmax(0,1fr))` only — never
`auto-fit`.

## The Sfere design system

`src/css/sfere.css` holds the token layer, measured off the live marketing site
(<https://sfere.io>) rather than eyeballed, and `src/components/ui/` holds the 47-component kit
built on it. Browse the whole thing at **`#/design-system`** (hash mode — not `/design-system`);
no sign-in required.

`src/css/tailwind.css` declares `--color-brand`, `--color-muted`, `--color-line`, `--font-sans`
and friends as aliases pointing at the `sfere-*` values, so a screen written against the app-side
names still resolves to Sfere. `src/css/quasar.variables.scss` sets `$primary` to the same purple
so Quasar's own controls match. **Never hardcode a hex in a screen** — that is what broke when the
brand changed, and the alias layer only works if nothing bypasses it.

**There is one kit.** The pre-Sfere primitives were replaced in place, not deprecated alongside
it: all 51 screens now render Sfere components.

Rules for touching it:

- The kit has exactly **two `data-smoke` attributes** — `ErrorState` (`error`) and `EmptyState`
  (`empty`) — and exactly **two Quasar dependencies**, `ConfirmDialog` and `SecretRevealDialog`,
  each wrapping `q-dialog`. Both are named carve-outs in `docs/sfere-design-system.md`, and the
  honest form of the second is a list rather than a number: the carve-out is for a **modal**,
  which owes a focus trap, Escape, scroll lock, a backdrop and a teleport, and the second entry
  is a second modal. A third entry that is not a modal is the change worth arguing about.
  `RowActionsMenu` is what that clause cost and what it bought: a popover is not a modal, so the
  kebab menu is hand-rolled — measure-then-place, flip-above, outside-`pointerdown`, `focusin`,
  scroll and Escape dismissal, roving `menuitem` focus — rather than sat on `q-menu`. Roughly
  ninety lines to avoid a third dependency, paid deliberately. The next popover copies it.
- `sfere.css` is imported from `src/css/tailwind.css` rather than registered in
  `quasar.config.js`'s `css: [...]` array. Either works; the import keeps the whole token layer
  reachable from one stylesheet.
- `StatusBadge` takes `tone`, not `variant`, and there is no `enabled` shorthand — write
  `:tone="x ? 'success' : 'neutral'"`. `FormField` takes `for-id`, not `for`.
- `NoticeBanner` takes an additive, **default-off** `collapsible`: the title becomes a real
  `<button type="button">` with `aria-expanded`/`aria-controls` and the slot hides behind it.
  Default-off is what made it a safe edit to a file every screen renders. It is for a list that
  is a distraction to one reader and the point of the screen to another — not a way to shorten a
  long banner. Its chevron uses a conditional `rotate-90` class rather than a `rotate-0` variant,
  per collision #2.
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

`src/router/**` (the manifest generates all 51 routes) · `src/layouts/MainLayout.vue` (the nav
is the IA, and the feature gate lives in its `q-page-container`) · `src/components/ui/**` (the
kit) · `src/config/features.js` + `src/composables/useFeatures.js` (which modules are switched
on at all) · `src/config/sourceIntents.js` + `src/config/firstRun.js` (the one category
taxonomy, shared by the arrival overlay and `/sources/new`) · `src/components/flow/**` (the one
flow-diagram implementation, rendered by the Dashboard, Pipes and every route
preview) · `src/composables/{useMockResource,useEntitlements,useDiagram,useTemplates}.js` (the
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
   `useMockResource`).

   **Then thirty more, wired against backend PR #16 (`feat: jitsu proxy`) before it merged** —
   see `docs/backend-pr16-implementation.md` for the endpoint-by-endpoint list and
   `docs/backend-pr16-integration.md` for the review it came out of.
   `docs/jitsu-parity.md` is the forward-looking half: what Jitsu's own model has that we do not
   yet, bucketed by who owns each gap (backend proxies it and we have no UI / needs a backend ask
   / deliberate non-parity / we already claim it and it is not true). The readers:
   `useIdentifierTypes()` (`…/identifier-types` — **one** reader, which replaced seven copies of
   `useMockResource('identifier-types')`, so a missing endpoint there reaches eight screens),
   `useMonitoringHealth()` (`…/health`), `useDiagram()` (`…/pipelines/diagram`),
   `useApiTokens()` (`…/api-tokens`), `useFunctions()` (`…/functions`),
   `useProfileBuilders()` (`…/profile-builders`), `useIngestDomains()` (`…/domains`),
   `useNotificationChannels()` (`…/notification-channels`), `useConnectorImages()`
   (`…/connector-images`), `useZidConnections()`, `useSourceWriteKeys()`,
   `useSourceIngestSettings()`, `useSourceCatalogAPI()`, `useDestinationBrowser()`
   (`…/destinations/{id}/tables`, `…/query`, `…/test`), `useTeam()` (`…/members`), and
   `usePipelineFunctions()`'s new attach/detach/reorder half.

   **That is a merge-order constraint, not just a list.** Ten of those endpoints do not exist on
   `api-staging` until PR #16 lands, and a wired-but-missing endpoint answers `404` — which the
   app handles as `apiMissing`, but which Chromium logs as a console error, which
   `scripts/smoke.mjs` fails on. Measured: `SMOKE_DATA_SOURCE=real` is **44/60** today and
   **60/60** in the default local `mock` mode. So the backend PR merges first, staging deploys,
   then this. Do **not** buy a green run by adding a `404` pattern to `IGNORED_CONSOLE`.

   **`useConnectorCatalog()` (`/v1/connectors`, `/v1/connectors/{id}/spec`) is in the
   contract too** — it used to be the one reader wired to a purely drafted endpoint, and PR
   #16's spec carries both. Everything else has no `api` at all.

   **Two write-once plaintexts** live behind these: `ApiTokenCreated.plaintext` and
   `WriteKeyCreated.plaintext`. The create response is the only time the value exists — every
   later read carries a masked prefix — so both render through `SecretRevealDialog`; see the UI
   primitives section.

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

   **`pipeCount` is the second field to lose a column to this**, after "Upgrade available"
   below. Both list screens carried a sortable **Pipes** column reading it, and neither
   `Source` nor `Destination` has such a field, so on a real account the cell was blank on every
   row — a header promising a count nobody took. It is gone from **both**
   `SourcesListPage` and `DestinationsListPage`. The real inbound-pipe count survives only on
   the destination DETAIL screen, where `usePipes()`'s join is already being paid for, and it
   prints `NOT_KNOWN` rather than `0` whenever that read has not succeeded (`pipesCounted`).

   Grep the merged `openapi/fanfinity-api.json` before adding an `api` path — `/v1/dashboard`
   and `/v1/errors` were drafted flat and shipped account-scoped and merged, which is exactly
   the drift the check catches.

   **"Upgrade available" is the worked example, and it is now half removed.**
   `latestTemplateVersion` is a `sources.json` invention with no counterpart in the backend's
   `Source`, so `useTemplates()`'s `hasUpgrade()` can only ever return `false` on a real record:
   the badge never appeared, and the Sources list's **"Upgrade available" filter tab** was a
   control whose count was permanently `0`. Both are gone from `SourcesListPage`, along with its
   `useTemplates` import. The rest of the surface is **not** gone, and that is a product call
   somebody has to make rather than a leftover to tidy: `hasUpgrade`/`upgradeLabel` are still read
   by `DestinationDetailPage.vue` and by `DestinationTemplateBadge.vue`, and the same fixture-only
   field still backs them there. The badge's **only remaining caller is
   `DestinationsTrashPage.vue`** — the Destinations list dropped its Template column for Type, so
   the badge's "Custom — hand-configured, not created from a template" fallback no longer lies on
   every backend-provisioned ClickHouse row of a live screen. So the phrase is inconsistent across the app today, not retired. `useTemplates.js` still
   exports all three helpers and was not touched.

   **`useFunctions.js`'s `hasTemplateUpgrade()` is a different feature that shares the word**, and
   it is live on `/functions` and `/functions/:id`. Do not delete it while cleaning up the other
   one, and do not merge the two: a function template genuinely versions behind a real endpoint,
   where a source template's version was only ever in the fixture.

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

   **That table describes `POST …/sources/provisioned`, not `POST …/sources`.** The agreed
   contract (backend PR #16) splits the two: the plain create makes "the row, its Jitsu site,
   and a first write key" and **no destination, pipeline or ClickHouse database**, while the
   full-stack create moved to `…/sources/provisioned` — which the backend labels **legacy**.
   **`useSourcesAPI().create()` therefore posts to `…/sources/provisioned`, deliberately.** On
   the plain endpoint a `web` or `zid` create yields no pipeline, `useSourceProvisioning()`
   settles on `state: 'none'`, and step 3's `ProvisionedPipePanel` and
   `SourceProvisionedOverlay` render nothing while the primary action reverts to "Add a
   destination" — the hand-build that flow exists to remove. That failure is **silent**: no
   console error, no `ErrorState`, so `pnpm smoke:dist` stays green and only a human reading
   step 3 would catch it. Since the backend calls the endpoint legacy, this buys time rather
   than settling it: if it goes, step 3 needs a real answer (create then provision in two
   calls, or a narrowed reveal) before anything drops back to the plain create. Reasoning and
   exit condition are in `create()`'s doc comment; the full check is
   `docs/contract-check-pr16.md`.

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
   eight still swallow it — and eight of the nine no longer have a screen behind them, since
   `/trash` reads `useTrashCollections()` instead precisely so it does not inherit that bug. Those
   composables and the ten `*TrashPage.vue` files are unreferenced now rather than deleted; the
   day someone prunes them, `useSourcesTrash`/`useDestinationsTrash`/`usePipesTrash` are the three
   the old pages still import and `useEngageAudienceTrash` is the one still live behind the
   Audiences screen's in-page tab.

   **A source's Settings tab is now mostly real, and the banner narrowed with it.** PR #16
   closed three of the five things that used to be disabled controls there: write keys are a
   full CRUD list (`…/sources/{id}/write-keys`, mint / list / revoke), a server-to-server key is
   one of the kinds that endpoint mints, and Strict mode is a field on the real ingest settings
   (`…/sources/{id}/ingest-settings`). What is left disabled is **renaming** — `SourceUpdate`
   still carries `is_enabled` and nothing else — so the banner says "Renaming a source is not
   available yet" rather than the old blanket read-only claim. Nothing there fires a "would be
   saved" toast: a toast indistinguishable from one describing a real save is what this
   replaced, and a control with no endpoint behind it stays disabled and says why.

   **`…/write-keys` answers `400`, not `404`, on a source with no Jitsu site**, which is an
   ordinary state for three of the seven templates. The shared gate reads any non-404 as a real
   failure and would render a red `ErrorState` for it, so `useSourceWriteKeys()` is hand-written
   fetching rather than a `useMockResource` call: it branches `400` to a `noSite` flag the panel
   explains, `404` to `apiMissing`, and everything else to `error`. `hasIngestSettings(source)`
   is the matching narrowing on the other panel — `source_type === 'web'` and nothing else.

   **`pnpm smoke:dist` now walks all 51 routes against whatever `VITE_API_BASE` points at**,
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
`VITE_API_BASE`, `VITE_ZID_APP_URL`, the two smoke credentials, and the two build-identity
stamps. See `.env.example`.

`VITE_ZID_APP_URL` is the host serving `/redirect-url`, the page a merchant lands on to grant
the Sfere app access to their Zid store. It is **the backend** — the same host as
`VITE_API_BASE` on staging, not Zid and not a tunnel; it used to be an ngrok forward to the
old GCF zid-app (client 7241) and is now the staging backend's own route against the new Zid
app (client 7003), so it is not an exception to the rule below. **`src/lib/zidAuthorize.js` is
the one file that reads it**, and it reads it only for the **pre-PR-#16 fallback**: the
authorization URL is fetched from `…/zid-authorize` or `zid-status` where those exist, and the
var is what the fallback needs because a legacy `/redirect-url` hop carries no account context.
Every path **opens** the URL with `window.open` and never fetches it, which is why
`connect-src` does not name it: the whole point is that the merchant signs in on Zid's own
domain. There is **no in-code default for the var** — with no backend URL and no
`VITE_ZID_APP_URL`, `Authorize with Zid` is disabled, because a button that opens
`undefined/redirect-url` is worse than one that visibly cannot run yet. That is exactly how it
shipped for a while: the wizard was built, the var never was, so step 1 was inert in every
environment.

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
