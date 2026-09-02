# The Sfere design system

The design system for the Sfere product UI: tokens, components and the rules for
using them, all derived from the live marketing site at <https://sfere.io>.

**Open it at `#/design-system`.** The router runs in hash mode, so the real URL
is `http://localhost:9000/#/design-system` — not `/design-system`. It needs no
sign-in.

The page is the reference; this file is the part you can grep.

---

## How it reaches the app

Two layers, and both are now applied everywhere.

**The tokens.** `src/css/tailwind.css` declares the app-side names screens are
written against — `--color-brand`, `--color-muted`, `--color-line`,
`--font-sans` — as aliases pointing at the `sfere-*` values in
`src/css/sfere.css`. A screen written against `text-muted` resolves to Sfere
without knowing it. `src/css/quasar.variables.scss` sets `$primary` to the same
purple so Quasar's own controls match.

**The components.** `src/components/ui/` **is** the Sfere kit. The pre-Sfere
primitives were replaced in place rather than deprecated alongside it, so there
is one kit, one import path, and no question about which one a screen should
use.

The replacement kept the sixteen original filenames — `PageHeader.vue`,
`DataTable.vue`, `StatusBadge.vue` and the rest — which is what let 104 screen
files pick up Sfere implementations without rewriting 571 imports. Twenty-five
components have no pre-Sfere counterpart and keep their `Sfere*` names. The
remaining two, `StickyActionBar` and `SecretRevealDialog`, are newer than the
swap and simply describe what they do: 16 + 25 + 2 = 43.

---

## Where things live

| Path                         | What                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `src/css/sfere.css`          | The token layer: `@theme` tokens + seven `@utility` treatments |
| `src/components/ui/`         | 43 components. The kit every screen is built from              |
| `src/components/sfere-docs/` | Doc-page scaffolding. **Not** part of the kit                  |
| `src/pages/design-system/`   | The showcase page itself                                       |
| `public/brand/`              | Logo lockups and the mark, as real SVG files                   |

### Shared files the brand work changed

Each of these reaches every screen, so each is recorded rather than left to be
rediscovered in a diff:

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
stylesheet; `sfere.css` is pulled in from `src/css/tailwind.css` instead, which
keeps the whole token layer reachable from one file. Same result either way.

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

43, in `src/components/ui/`, imported by path:

```js
import SfereButton from '@/components/ui/SfereButton.vue'
import DataTable from '@/components/ui/DataTable.vue'
```

Props in, slots out. No `useRouter`, no `fetch`, no formatting — the page owns
the data and hands down strings. The one carve-out is a declarative
`<router-link :to>` driven entirely by a prop.

**Screen primitives** — `PageHeader` `DataTable` `ErrorState` `LoadingState`
`EmptyState` `FormSection` `FormField` `ConfirmDialog` `DefinitionList`
`SelectableCard` `ToolbarSearch` `CardPanel` `NoticeBanner` `StatCard`
`StatusBadge` `TabNav` `StickyActionBar` `SecretRevealDialog`
**Actions & markers** — `SfereButton` `SfereIconButton` `SfereIcon`
`SfereLinkArrow` `SferePill` `SfereEyebrow` `SfereIconChip` `SfereAvatar`
`SfereKbd` `SfereTooltip`
**Forms** — `SfereInput` `SfereSelect` `SfereTextarea` `SfereToggle`
`SfereCheckbox`
**Surfaces & data** — `SfereSection` `SfereSectionHeading` `SfereFeatureCard`
`SfereTable` `SfereCode`
**Feedback** — `SfereBreadcrumbs` `SfereProgress` `SfereSkeleton`
`SfereSpinner`
**Brand** — `SfereLogo`

The first group is the one every screen is built from; the rest came from the
marketing site and are what the first group is composed out of.

### Icon-only actions

`SfereIconButton` is `SfereButton` with the label moved off the surface, for the
one case that earns it: a toolbar action whose noun is already the page title.
Every list screen pairs a Trash and a New button under an `<h1>` that names what
they act on, so the words were restating the heading beside them.

Five things it does that a hand-rolled icon button will not:

- **`label` is required**, and it is both the `aria-label` and the tooltip text.
  A CSS-only hover bubble reaches neither a screen reader nor a touch user, so
  the tooltip is never the only carrier — which is what `SfereTooltip`'s own
  header comment asks of anything that wraps it.
- **The tooltip defaults to `bottom`.** There is no positioning engine in
  `SfereTooltip`; the usual home for this button is a `PageHeader` at the very
  top of the page, where a bubble placed above renders off the viewport.
- **The tooltip also defaults to `align="end"`**, and that default is a fix, not
  a taste. A bubble centred on a 40px button hangs roughly half its own width off
  either side, and the rightmost action in a `PageHeader` sits against the window
  — so "Delete this pipe" was cut off at the right edge on all three detail
  screens, and "New source" on ten list screens. `end` pins the bubble's right
  edge to the button's, `start` pins its left (for the one control at the LEFT
  edge of the viewport, `MainLayout`'s nav toggle), and `center` is still there
  where there is room either side. All three are plain CSS — `right-0`,
  `left-0`, `left-1/2 -translate-x-1/2` — so nothing measures anything on hover
  and `SfereTooltip` still has no positioning engine.
- **`grid place-items-center`, not `flex`.** Quasar's unlayered `.flex` forces
  `flex-wrap: wrap` and the layered `flex-nowrap` utility loses to it —
  `docs/ui-conventions.md` rule 10. `SfereIconChip` centres its glyph the same
  way for the same reason.
- **`md` is 40px square**, matching `SfereInput`, so it sits on the same
  baseline as the `ToolbarSearch` box it shares a header row with.

The variants come from `sfereButtonVariants.js`, which `SfereButton` reads too.
One palette, two components: a labelled and an unlabelled action in the same
toolbar cannot drift apart.

Reach for it only where the icon is guessable from the page it is on. Empty-state
calls to action, form submits and destructive confirmations keep their words.

### The glyph registry

`SfereIcon` draws one entry from `src/components/ui/sfereIcons.js`, which is path
data and nothing else — every glyph on Phosphor's 256 grid, so `size-4` means one
optical size across the kit, and an optional 20% wash behind the solid path for
the duotone treatment. Icons whose shape is already a stroke (plus, arrows) carry
no wash.

Inline path data rather than files: `img-src 'self'` blocks a remote asset and
`assetsInlineLimit: 0` blocks a data URI, and an `<svg>` inherits `currentColor`
so one entry serves a brand-filled button and a white one without a second copy.
This is the same reasoning `SfereSpinner` draws its own circle on, and
`ToolbarSearch` now takes its magnifier from here instead of holding a
hand-inlined duplicate.

Every icon is `aria-hidden` with `focusable="false"` and takes no `title` prop —
it is decorative beside a label, or the whole content of a control that carries
its own. Adding a glyph means one entry in that file; nothing else changes.

### Screen primitives

Sixteen of the 43 carry the filenames of the components they replaced, so that
every screen picked up a Sfere implementation without an import changing. What
each one is underneath:

| File                 | What it is        | Notes                                                     |
| -------------------- | ----------------- | --------------------------------------------------------- |
| `PageHeader.vue`     | Sfere page header | Adds `eyebrow`. Renders the literal `<h1>` smoke requires |
| `DataTable.vue`      | Sfere data table  | Same props and slots as before. `error` is a **string**   |
| `ErrorState.vue`     | Sfere error state | Adds `retryLabel`                                         |
| `LoadingState.vue`   | Sfere skeletons   | Three variants — `table`, `grid`, `form`                  |
| `EmptyState.vue`     | Sfere empty state | Carries `data-smoke="empty"` in both variants             |
| `FormSection.vue`    | Sfere form group  | Adds an `actions` footer slot                             |
| `DefinitionList.vue` | Sfere read-out    | Same `value-<slug>` slots                                 |
| `SelectableCard.vue` | Sfere picker card | Same `selected` / `disabled` / `@select`                  |
| `ToolbarSearch.vue`  | Sfere search box  | 40px, not the old 36px. Adds `block`                      |
| `ConfirmDialog.vue`  | Sfere dialog      | Adds `loading`. Wraps `q-dialog` — see above              |
| `CardPanel.vue`      | `SfereCard`       | A card. The name is inherited, not descriptive            |
| `NoticeBanner.vue`   | `SfereAlert`      | An alert. Same                                            |
| `StatCard.vue`       | `SfereStat`       | `direction`, not `delta-direction`                        |
| `TabNav.vue`         | `SfereTabs`       | Keeps the old bar's `mb-4` on the underline variant       |
| `FormField.vue`      | `SfereField`      | **`for-id`, not `for`.** Adds `optional`                  |
| `StatusBadge.vue`    | `SfereBadge`      | **`tone`, not `variant`. No `enabled`** — see below       |

**The two API changes the swap could not avoid.** Everything else kept its
props; these two did not, and both were rewritten across the repo in the same
change:

- **`StatusBadge`** takes `tone`, not `variant`. The five palette strings
  carried over exactly (`success` `warn` `neutral` `danger` `brand`), but there
  is no `enabled` shorthand — write `:tone="x ? 'success' : 'neutral'"`. That is
  deliberate: `enabled` reads as on/off next to a prop called `variant`, but next
  to `tone` it looks like it might tint rather than switch. The default is also
  `brand` where the old badge defaulted to `neutral`; all 171 call sites pass a
  tone, but a new bare `<StatusBadge>` comes out purple.
- **`FormField`** takes `for-id`, not `for`. `for` is a JS keyword, which is why
  the original had to read it off `props` explicitly in its own template.

`DataTable` sorts, pages and renders all four list states; a sortable column
header is a real `<button>`, and the `aria-sort` it drives is set on the `<th>` —
where the ARIA spec puts it, on the columnheader rather than on a control inside
it. That is why `SfereTable` columns accept an `ariaSort` field it never sets
itself.

**`DataTable` composes on `SfereTable`, it does not replace it.** `SfereTable`
carries two slots for that — `head-<key>` (where the sort button goes) and
`footer` (where pagination goes) — so there is one set of table styles and two
entry points. Reach for `SfereTable` when the page owns all four states itself;
reach for `DataTable` on a list screen, which is almost always.

**`PageHeader`, not `SfereSectionHeading`, at the top of a screen.**
`SfereSectionHeading`'s `level` prop only picks the size ramp — the tag is a
hard-coded `<h2>`, so `level="h1"` does not satisfy the smoke gate. Its ramp also
starts at 36px, where a page title wants 24px.

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
- **Exactly two `data-smoke` attributes, and they are named.** `ErrorState`
  carries `data-smoke="error"` and `EmptyState` carries `data-smoke="empty"` —
  nothing else in the kit carries either, ever.

  This rule used to read "no `data-smoke` attributes", which was right while the
  kit was a showroom and wrong the moment it had to build a screen:
  `scripts/smoke.mjs` detects a broken route by looking for exactly one
  selector, so a kit with no failure surface would have left the only
  behavioural gate in the repo with nothing to assert on.

- **Two Quasar dependencies, and they are both named.** `ConfirmDialog` and
  `SecretRevealDialog` each wrap `q-dialog`. A modal owes the user a focus trap,
  Escape, scroll lock, a backdrop and a teleport out of any `overflow: hidden`
  ancestor; all five are invisible when they work and all five are subtle to
  hand-roll. Only the shell is borrowed — the card, the buttons and the type are
  Sfere. **No other component in the kit may reach for a `q-*` element**, and the
  carve-out is for `q-dialog` specifically rather than for Quasar generally.

  It read "one dependency" until `SecretRevealDialog` arrived, and the honest
  version of that rule is a list rather than a number: the second entry is a
  second modal, which is the one thing the first entry already licensed. A third
  entry that is not a modal is the change worth arguing about.

  `SecretRevealDialog` also inverts the dismissal contract, which is why it is a
  separate component rather than a `ConfirmDialog` prop. It is `persistent` with
  **no Cancel and no `v-close-popup`**, because it shows a write-once secret —
  `ApiTokenCreated.plaintext` and `WriteKeyCreated.plaintext` come back on the
  create response and never again — so a stray backdrop click is an
  unrecoverable loss the person had no way to see coming. Its width also needs
  the **literal** pair `w-[min(620px,92vw)]! max-w-[min(620px,92vw)]!`: Tailwind
  v4 extracts class names from source text, so a runtime-built
  `` `w-[${n}]!` `` is never generated and Quasar's unlayered 560px cap stays in
  charge.

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

### How the kit migration was done

Worth recording, because the shape of it is why no screen needed rewriting.

The Sfere implementations replaced the originals **in place**, keeping the
sixteen filenames the screens already imported. Only two components' props had
changed (`StatusBadge`'s `variant`/`enabled`, `FormField`'s `for`), so the whole
migration was those renames across 104 files plus the file swap — not 54 screen
rewrites. The alternative, running both kits side by side and moving screens one
at a time, would have meant every screen carrying an "which kit is this?"
question for as long as the migration took.

What it did not do is re-examine each screen's layout. A screen that looked
right against 36px controls and rounded rectangles now renders 40px controls and
pills; that is the intended look, but it means per-screen polish is still owed
in places.

---

## Gates

```bash
pnpm build        # hard-fails on unresolved @/ imports and malformed templates
pnpm lint:check   # oxfmt --check then oxlint
```

`pnpm smoke:dist` does not cover this route (it walks `screens.js`) and needs
`.env` credentials. `pnpm build` is the gate that matters here.

---

## Publishing to claude.ai/design

The token layer is published as an organisation-wide design system at
<https://claude.ai/design/p/51046f6e-0f11-47c7-9d1e-66a183ec2ac7>, so anyone at
the company prompting Claude Design gets the Sfere palette and typefaces by
default.

**Only the tokens cross over — the component kit does not.** Claude Design's
agent builds in React; `src/components/ui/` is 43 Vue SFCs and cannot be
imported there. The uploaded `_ds_bundle.js` is an empty namespace and says so.
Anyone using it composes their own components from the tokens.

```bash
node tools/build-design-sync-bundle.mjs      # emit ds-bundle/
node .ds-sync/package-validate.mjs ./ds-bundle
```

The builder lives in `tools/`, where one-off maintenance goes, and it exists
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
