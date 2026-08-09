# The Sfere design system

Fanfinity is being renamed to Sfere. This is the design system for that rebrand:
tokens, components and the rules for using them, all derived from the live
marketing site at <https://sfere.io>.

**Open it at `#/design-system`.** The router runs in hash mode, so the real URL
is `http://localhost:9000/#/design-system` — not `/design-system`. It needs no
sign-in.

The page is the reference; this file is the part you can grep.

---

## What this branch does and does not do

It **adds** a system. It does **not** apply one.

Every token is namespaced `sfere-*` and nothing redefines an existing token, so
the 54 product screens still render in Fanfinity purple (`#3800c1`) with Plus
Jakarta Sans, pixel for pixel. Rebranding the app is a separate, deliberate
decision — see [Adopting it](#adopting-it) below.

That is why the design-system page reports **0 screens rebranded**. It is not an
oversight.

---

## Where things live

| Path                         | What                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `src/css/sfere.css`          | The token layer: `@theme` tokens + six `@utility` treatments |
| `src/components/sfere/`      | 30 components. The shipped kit                               |
| `src/components/sfere-docs/` | Doc-page scaffolding. **Not** part of the kit                |
| `src/pages/design-system/`   | The showcase page itself                                     |
| `public/brand/`              | Logo lockups and the mark, as real SVG files                 |

`src/components/ui/` — the existing Fanfinity primitives — is untouched and stays
the house style for every current screen.

### Two frozen files were edited

Both deliberately, both foundation-phase changes made for this branch rather than
story work (see `docs/agent-workflow.md`):

- **`src/router/routes.js`** — one top-level route. A `screens.js` entry would
  nest the page under `MainLayout`, wrapping a Sfere-branded reference in the
  Fanfinity sidebar and putting it behind the auth guard. Consequence:
  `scripts/smoke.mjs` walks `screens.js`, so this route is invisible to the
  smoke gate. `pnpm build` still covers it.
- **`package.json`** — three `@fontsource` packages. The CSP is
  `default-src 'self'`, which blocks the Google Fonts CDN the marketing site
  uses, so all three faces must be self-hosted.

`quasar.config.js` was **not** edited. Its `css: [...]` array is the normal place
to register a stylesheet, and it is frozen, so `sfere.css` is pulled in from
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
- Six surface treatments as `@utility`: `sfere-glow-top`, `sfere-dot-grid`,
  `sfere-gradient-border`, `sfere-fade-b`, `sfere-fade-x`, `sfere-flow-line`.
  All decorative; all disabled under `prefers-reduced-motion`.

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

## Adopting it

Two routes, and the choice is about appetite for a single large visual diff.

**A · Repoint the existing tokens.** Change the values in
`src/css/tailwind.css` to the Sfere ones. Every screen rebrands at once, no
component markup changes, and reverting one file undoes it. The mapping table is
on the page under **Adoption**; the headline rows:

```
--color-brand   #3800c1 → #854dff   (sfere-brand-fill)
--color-ink     #030712 → #0a0a0a   (sfere-fg)
--color-muted   #4a5565 → #737373   (sfere-fg-muted; absorbs --color-subtle)
--color-line    #e7e9ed → #e5e5e5   (sfere-line; absorbs --color-line2)
--font-sans     Plus Jakarta Sans → Inter, + Bricolage for headings
```

**B · Migrate screen by screen.** Rewrite one page at a time against
`src/components/sfere/`, leaving the rest alone. Slower, but every step is a
small reviewable diff and both systems coexist while it happens. The screen
manifest makes this cheap — implementing a screen means rewriting its file in
place, never adding a route.

Whichever route: `--color-brand` at `#854dff` still passes AA against white, and
the neutral ramp loses its blue cast. Check any screen that leans on
`text-subtle` for hierarchy, since `subtle` and `muted` merge into one value.

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
