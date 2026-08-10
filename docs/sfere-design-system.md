# The Sfere design system

The design system for the Sfere product UI: tokens, components and the rules for
using them, all derived from the live marketing site at <https://sfere.io>.

**Open it at `#/design-system`.** The router runs in hash mode, so the real URL
is `http://localhost:9000/#/design-system` — not `/design-system`. It needs no
sign-in.

The page is the reference; this file is the part you can grep.

---

## How it reaches the app

Two layers, and the distinction matters when you are reading a screen.

**The tokens are applied everywhere.** `src/css/tailwind.css` declares the
app-side names screens are written against — `--color-brand`, `--color-muted`,
`--color-line`, `--font-sans` — as aliases pointing at the `sfere-*` values in
`src/css/sfere.css`. All 54 screens inherit the palette and the typefaces with
no markup change. `src/css/quasar.variables.scss` sets `$primary` to the same
purple so Quasar's own controls match.

**The component kit is not.** Screens still use `src/components/ui/`;
`src/components/sfere/` is the kit for new work. Moving a screen from one to the
other is a per-screen rewrite, tracked in `todos/brand-rename-todo.md`
(gitignored working notes).

So: a screen looks like Sfere today because of the tokens, not because it was
rewritten.

---

## Where things live

| Path                         | What                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `src/css/sfere.css`          | The token layer: `@theme` tokens + seven `@utility` treatments |
| `src/components/sfere/`      | 30 components. The shipped kit                                 |
| `src/components/sfere-docs/` | Doc-page scaffolding. **Not** part of the kit                  |
| `src/pages/design-system/`   | The showcase page itself                                       |
| `public/brand/`              | Logo lockups and the mark, as real SVG files                   |

`src/components/ui/` — the primitives every current screen is built from — takes
its colour and type from the same tokens, so it renders on-brand without being
rewritten. It stays the house style until a screen is migrated.

### Frozen files edited for the brand

All deliberate, all foundation-phase changes rather than story work (see
`docs/agent-workflow.md`):

- **`src/router/routes.js`** — one top-level route for this page. A `screens.js`
  entry would nest it under `MainLayout` and put it behind the auth guard.
  Consequence: `scripts/smoke.mjs` walks `screens.js`, so this route is
  invisible to the smoke gate. `pnpm build` still covers it.
- **`package.json`** — three `@fontsource` packages, plus `name`, `description`,
  `keywords` and `productName`. The CSP is `default-src 'self'`, which blocks
  the Google Fonts CDN the marketing site uses, so all three faces must be
  self-hosted. `productName` is what `index.html` interpolates into `<title>`,
  so the browser tab reads "Sfere" because of that field.
- **`src/layouts/MainLayout.vue`** — the sidebar logo, now served from
  `public/brand/sfere-logo.svg`.
- **`quasar.config.js`** — `appId` only.
- **`CLAUDE.md`** — the design-system section, which described the token layer
  as unapplied.
- **`.gitignore`** — two changes. First, one entry, `todos/`: the rebrand's
  tracker and the infrastructure handover note are working documents, not shared
  history; they live there and stay out of git. `tools/brand-rename.mjs` skips
  the directory for the same reason, so `--verify` does not report the old brand
  names those documents necessarily contain. Second, the build output and staged
  scripts of the claude.ai/design sync (`ds-bundle/`, `.ds-sync/`,
  `.design-sync/.cache/`) — see "Publishing to claude.ai/design" below.

`index.html` was **not** edited: its `<title>` comes from `productName`, and the
only brand strings left in it are live CSP hosts.

`quasar.config.js`'s `css: [...]` array is the normal place to register a
stylesheet, and it is frozen, so `sfere.css` is still pulled in from
`src/css/tailwind.css` instead. Same result.

---

## Tokens

All in `src/css/sfere.css`. Full swatches, hex values and usage notes are on the
page; this is the shape of it.

### Colour

One saturated purple against a strictly neutral ramp. The neutrals are
deliberately colourless — that restraint is what lets a single accent carry the
whole interface.

```
sfere-50  #F5F0FF   sfere-500 #9969FF  ← identity, logo, focus ring
sfere-100 #EDE5FF   sfere-600 #854DFF  ← primary button fill
sfere-200 #DCCFFF   sfere-700 #7C4DFF  ← brand text, links, button hover
sfere-300 #C4AAFF   sfere-800 #582EB7  ← derived; not on sfere.io
sfere-400 #AA80FF   sfere-900 #351070  ← plum
```

The 600/700 split is inherited from the site, not an accident: 600 fills a
primary button, 700 is both its hover state and every piece of brand-coloured
text. Prefer the aliases — `sfere-brand`, `sfere-brand-fill`, `sfere-brand-text`,
`sfere-plum` — over the numbers.

Surfaces: `sfere-bg` (page), `sfere-surface` (cards), `sfere-fill` (hover),
`sfere-line` (hairlines), `sfere-fg` / `sfere-fg-muted` (text).

Ink: `sfere-ink` `#0B0712` (dark section canvas), `sfere-ink-raised` `#17151D`
(cards on it), plus `sfere-hairline` / `sfere-wash` for white-alpha edges. The
`sfere-dark-*` set is the site's full dark theme, kept for later.

Status — `success`, `warn`, `danger`, each with a `-soft` fill — is an extension.
sfere.io only ever needed one status colour. **Do not introduce a fifth.**

### Type

Three faces, no overlap:

| Token                | Face                         | Job                             |
| -------------------- | ---------------------------- | ------------------------------- |
| `font-sfere-display` | Bricolage Grotesque Variable | Headings, and nothing else      |
| `font-sfere-sans`    | Inter                        | Everything else                 |
| `font-sfere-mono`    | Geist Mono                   | Eyebrows, labels, metrics, code |

Scale: `text-sfere-display` (72px) · `h1` (48) · `h2` (36) · `h3` (24) ·
`h4` (18) · `lead` (18) · `body` (16) · `sm` (14) · `xs` (12), plus
`text-sfere-eyebrow` (12px mono, 0.18em) and `text-sfere-label` (11px mono,
0.14em).

Each token carries its own leading, tracking and weight, so one class sets all
four — which matters for the next section.

### Shape, elevation, motion

- Radii: `rounded-sfere-sm` 6px · `rounded-sfere` 8px · `-lg` 12 · `-xl` 16 ·
  `-2xl` 24. Full pills are spent on buttons and status chips; using one
  elsewhere makes those stop reading as actionable.
- Shadows are **plum-tinted** (`rgb(53 16 112)`), never neutral black. That one
  choice is most of what separates a Sfere surface from a default Tailwind card.
  Cards carry no shadow at rest — elevation is for things that float.
- Two curves: `ease-sfere-ui` for feedback, `ease-sfere` for anything that moves
  or resizes. Durations 150 / 200 / 500 / 700ms.
- Seven surface treatments as `@utility`: `sfere-glow-top`, `sfere-dot-grid`,
  `sfere-gradient-border`, `sfere-fade-b`, `sfere-fade-x`, `sfere-flow-line` and
  its vertical cut `sfere-flow-line-y`. All decorative; all disabled under
  `prefers-reduced-motion`. Note that the four `animate-sfere-*` classes are
  generated from the `--animate-sfere-*` theme vars, not from `@utility` — the
  reduced-motion guard targets the class names, so both must ship together.

---

## Two Quasar collisions you will hit

Tailwind v4 emits utilities into `@layer utilities`. Quasar's base stylesheet is
**unlayered**, and unlayered CSS beats layered CSS regardless of specificity. Two
consequences, and both have already cost time:

### 1. Headings need the important **suffix**

```html
<!-- WRONG — renders at Quasar's heading scale, not yours -->
<h2 class="text-sfere-h2 font-sfere-display">Section</h2>

<!-- RIGHT — suffix, never the v3 prefix form -->
<h2 class="text-sfere-h2! font-sfere-display!">Section</h2>

<!-- BETTER — the component already does it -->
<SfereSectionHeading title="Section" />
```

Because the type tokens bundle size + leading + tracking + weight into one
utility, a single `!` covers all four properties Quasar sets on bare headings.
This is rules 2–3 of `docs/ui-conventions.md`, restated because a design-system
page is nothing but headings.

The showcase renders **outside** `MainLayout`, so it is fair to ask whether the
same pattern holds on a product screen inside `q-layout`/`q-page`. It does:
Quasar's heading typography exists only as bare `h1`–`h6` element selectors plus
the unrelated `.text-h1`–`.text-h6` classes — there is no `.q-page h2`, and
nothing in the built stylesheet scopes heading size to a layout container. The
collision is layer-vs-unlayered, which is global, so the suffix behaves
identically in both places.

### 2. `hidden` can never be turned back on

Quasar ships `.hidden { display: none !important }`. Tailwind's `.hidden` is
`display: none` in a layer. So `class="hidden lg:block"` is **permanently
hidden** — `lg:block` cannot beat an unlayered `!important`.

Use the inverse variant, which generates a class name Quasar does not define:

```html
<!-- WRONG: never visible, at any width -->
<aside class="hidden lg:block">
  <!-- RIGHT -->
  <aside class="max-lg:hidden"></aside
></aside>
```

This bit the design-system page's own table of contents. If something is
inexplicably invisible, check for a bare `hidden`.

---

## Components

30, in `src/components/sfere/`, imported by path:

```js
import SfereButton from '@/components/sfere/SfereButton.vue'
```

They follow the same contract as `src/components/ui/`: props in, slots out, no
`useRouter`, no `fetch`, no formatting. The one carve-out is a declarative
`<router-link :to>` driven entirely by a prop.

**Actions & markers** — `SfereButton` `SfereLinkArrow` `SfereBadge` `SferePill`
`SfereEyebrow` `SfereIconChip` `SfereAvatar` `SfereKbd` `SfereTooltip`
**Forms** — `SfereField` `SfereInput` `SfereSelect` `SfereTextarea`
`SfereToggle` `SfereCheckbox`
**Surfaces & data** — `SfereSection` `SfereSectionHeading` `SfereCard`
`SfereFeatureCard` `SfereStat` `SfereTable` `SfereCode`
**Feedback** — `SfereAlert` `SfereEmptyState` `SfereTabs` `SfereBreadcrumbs`
`SfereProgress` `SfereSkeleton` `SfereSpinner`
**Brand** — `SfereLogo`

### The `onDark` prop

Dark is a **section treatment on this system, not a theme**. Most components take
`on-dark`; set it on everything inside a `SfereSection tone="ink"`, including the
`SfereField` wrapper — not just the control, or the label stays black on black.

Using a light-surface button variant on ink (or `variant="white"` on light) is
the single most common way to get this kit wrong.

### Rules carried over from `ui-conventions.md`

They were right the first time and they still apply:

- **A missing record is empty, not an error.** The fetch succeeded; the answer
  was "no such record". `SfereEmptyState`, never an error surface.
- **Two empty states per list.** Filters matched nothing → "No X match your
  search" + Clear filters. Nothing exists → "No X yet" + the create action.
- **`delta` is a trend.** `SfereStat`'s `delta` always draws an arrow in a trend
  colour. "37 errors" is a `hint`.
- **No `<style>` blocks in components.** Tailwind utilities only. Custom CSS goes
  in `src/css/sfere.css` as an `@utility`.
- **No `data-smoke` attributes.** Nothing in this kit is an error surface, and
  the smoke gate keys off exactly one selector.

---

## The alias layer

`src/css/tailwind.css` is where the app's semantic names resolve to Sfere
values. It is the one file to edit to change the brand, and reverting it alone
undoes the whole visual change:

```
--color-brand   #854dff   sfere-600 / brand-fill
--color-ink     #0a0a0a   sfere-fg
--color-muted   #737373   sfere-fg-muted
--color-subtle  #737373   sfere-fg-muted — same value as muted, see below
--color-line    #e5e5e5   sfere-line (--color-line2 resolves to the same value)
--font-sans     Inter, + Bricolage Grotesque on h1–h6
```

**Two pairs of tokens now collapse.** `line`/`line2` and `muted`/`subtle` each
resolve to one value. Both names in each pair survive so no markup changes, but
there is no longer any visual difference between them.

The `muted`/`subtle` collapse is forced by contrast. `subtle` carries column
headers and hints — content, so it has to clear AA. On this neutral ramp
grey-on-white reaches 4.5:1 at roughly `#767676`, which leaves no value that
both separates from `muted` (`#737373`, 4.7:1) and stays legible; `#a1a1a1` is
2.6:1. A third level of text hierarchy has to come from weight or size now.

`--color-brand` at `#854dff` passes AA against white. The neutral ramp also lost
its blue cast, so any screen that leaned on the old `subtle`/`muted` split is
worth a look.

### Migrating a screen onto the component kit

Separate from the tokens, and per-screen. Rewrite one page at a time against
`src/components/sfere/`, leaving the rest alone; every step is a small
reviewable diff and both kits coexist while it happens. The screen manifest
makes this cheap — implementing a screen means rewriting its file in place,
never adding a route.

---

## Gates

```bash
pnpm build        # hard-fails on unresolved @/ imports and malformed templates
pnpm lint:check   # oxfmt --check then oxlint
```

`pnpm smoke:dist` does not cover this route (it walks `screens.js`) and needs
`.env` credentials. `pnpm build` is the gate that matters here.

Note for worktrees: `.env` is gitignored, so `git worktree add` does not carry it
across and the app will fail to boot with `auth/invalid-api-key`. Use
`pnpm worktree`, which copies it in.

---

## Publishing to claude.ai/design

The token layer is published as an organisation-wide design system at
<https://claude.ai/design/p/51046f6e-0f11-47c7-9d1e-66a183ec2ac7>, so anyone at
the company prompting Claude Design gets the Sfere palette and typefaces by
default.

**Only the tokens cross over — the component kit does not.** Claude Design's
agent builds in React; `src/components/sfere/` is 30 Vue SFCs and cannot be
imported there. The uploaded `_ds_bundle.js` is an empty namespace and says so.
Anyone using it composes their own components from the tokens.

```bash
node tools/build-design-sync-bundle.mjs      # emit ds-bundle/
node .ds-sync/package-validate.mjs ./ds-bundle
```

The builder lives in `tools/` because `scripts/**` is frozen, and it exists
because the bundled `/design-sync` converter only handles React design systems.
It emits the same output contract by hand: `styles.css` and its `@import`
closure (tokens, fonts, the seven `.sfere-*` treatments) plus four foundation
specimen cards.

The one trap it exists to avoid: `src/css/sfere.css` is Tailwind v4 _source_
(`@theme`, `@utility`, bare `@fontsource` imports). Shipping it raw would render
every design with no tokens and no fonts, silently — so tokens are parsed out of
the `@theme` block (a compile would tree-shake unreferenced ones) and the
utilities come from a real Tailwind compile (their nesting and masks must not be
hand-copied).

Sync inputs live in `.design-sync/`: `config.json` (the project pin),
`conventions.md` (prepended to the uploaded README and inlined into the design
agent's prompt — it enumerates 54 token names, so **re-check it against the
built CSS whenever a token is renamed**) and `NOTES.md` (the full gotcha list and
re-sync risks). Read `NOTES.md` before re-running.
