# Building with Sfere

**This design system ships tokens, not components.** There is nothing on
`window.Sfere` — the namespace is deliberately empty. The Sfere component kit is
30 Vue single-file components built on Quasar, which cannot be imported from
React. Do not write `import { Button } from 'sfere'` or reach for
`window.Sfere.*`; neither exists.

What you get instead is the whole brand as CSS: the colour ramp, the three
typefaces (already loaded), the type scale, radii, plum-tinted shadows and seven
signature surface treatments. **Build your own components and style them with the
tokens below.** Everything here is loaded automatically — no provider, no
wrapper, no setup.

## The styling idiom: `var(--*)`, always

Never hardcode a hex, a font stack, a radius or a shadow. Every brand value has a
token, and naming one directly is what keeps a design on-brand when the brand
moves.

### Colour

The brand ramp runs `--color-sfere-50` … `--color-sfere-900`. Prefer the semantic
names; reach for a number only when you genuinely mean "one step lighter":

| Token                      | Use                                              |
| -------------------------- | ------------------------------------------------ |
| `--color-sfere-brand`      | identity, logo, focus ring (ramp 500, `#9969ff`) |
| `--color-sfere-brand-fill` | primary button background (600)                  |
| `--color-sfere-brand-text` | brand text, links, hover fill (700)              |
| `--color-sfere-plum`       | text on white-on-dark buttons (900)              |

Surfaces — `--color-sfere-bg` (page), `--color-sfere-surface` (cards, panels,
nav), `--color-sfere-fill` (hover/inset), `--color-sfere-line` (hairlines),
`--color-sfere-fg` (primary text), `--color-sfere-fg-muted` (secondary text).
The page background is the _only_ tinted neutral; everything else is a plain
neutral ramp, which is what makes the purple read as loud as it does.

Status — `--color-sfere-success`, `--color-sfere-warn`, `--color-sfere-danger`,
each with a `-soft` companion for backgrounds.

Dark is a **section treatment, not a theme**: put a hero, a stats band or a
footer on `--color-sfere-ink` (with `--color-sfere-ink-raised` for cards on it)
while the rest of the page stays light. On ink, draw hairlines with
`--color-sfere-hairline` / `--color-sfere-hairline-strong` and washes with
`--color-sfere-wash` — white-alpha, so the plum canvas shows through. A full dark
mode is available via the `--color-sfere-dark-*` tokens.

Charts have a fixed categorical order: `--color-chart-1` … `--color-chart-9`.
Series 1 is the brand purple by design — a chart's primary series and the app's
accent must be the same colour or the two read as different meanings.

### Type

Three faces, three jobs, no overlap:

- `--font-sfere-display` — **headings only.** Bricolage Grotesque is the whole
  reason the brand reads as confident rather than generic-SaaS. Use it.
- `--font-sfere-sans` — everything else (Inter).
- `--font-sfere-mono` — eyebrows, micro-labels, metrics, code (Geist Mono).
  Never body copy.

Each size token bundles its own leading, tracking and weight in sibling
properties, so a heading takes four declarations that all come from one name:

```css
font-size: var(--text-sfere-h2);
line-height: var(--text-sfere-h2--line-height);
letter-spacing: var(--text-sfere-h2--letter-spacing);
font-weight: var(--text-sfere-h2--font-weight);
```

The scale: `display` (72px hero, one per page), `h1` (48), `h2` (36), `h3` (24),
`h4` (18, card titles), `lead` (18 deck), `body` (16), `sm` (14 — the UI
default), `xs` (12 captions). Plus two mono labels: `eyebrow` (12, uppercase) and
`label` (11, nav section labels). `lead`, `body`, `sm` and `xs` carry only
`--line-height`; the rest carry all four.

The eyebrow's `0.18em` tracking is the single most recognisable typographic move
in the system — don't tighten it.

### Shape, depth, motion

Radii: `--radius-sfere-sm` (6px badges), `--radius-sfere` (8px controls and rows
— the workhorse), `--radius-sfere-lg` (12px list items), `--radius-sfere-xl`
(16px cards and panels), `--radius-sfere-2xl` (24px feature blocks). Pills are
for buttons and status only.

Shadows are **plum-tinted, never neutral black** — that tint is what stops the
system looking like a default Tailwind template. On light:
`--shadow-sfere-btn`, `--shadow-sfere-glow`, `--shadow-sfere-card`,
`--shadow-sfere-soft`, `--shadow-sfere-pop`. On ink: `--shadow-sfere-ink`,
`--shadow-sfere-ink-deep`.

Two curves: `--ease-sfere` is the branded one (slow out, hard settle) for reveals
and panels; `--ease-sfere-ui` is the standard curve for hovers, so controls stay
snappy. Page shell width is `--container-sfere-page` (80rem).

### The seven surface treatments — real classes

These are gradients, masks and pseudo-elements that can't be expressed as a
token, so they ship as classes in `_ds_bundle.css`. Apply by class name:

| Class                                     | What it does                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `.sfere-glow-top`                         | purple bloom behind a light section — pair with the page background                  |
| `.sfere-dot-grid`                         | faint dot lattice for dark sections (22px pitch)                                     |
| `.sfere-gradient-border`                  | 1px border fading from brand purple across the corner; inherits the element's radius |
| `.sfere-fade-b` / `.sfere-fade-x`         | bleed a block into its background instead of cutting it off                          |
| `.sfere-flow-line` / `.sfere-flow-line-y` | travelling highlight along a hairline — the "data is moving" cue                     |

Four animation classes pair with them: `.animate-sfere-flow`,
`.animate-sfere-flow-y`, `.animate-sfere-blink`, `.animate-sfere-breathe`. All
four are decorative and already honour `prefers-reduced-motion`.

## Where the truth lives

Read the real files rather than trusting this summary — they carry the reasoning
behind each value:

- `styles.css` — the entry point; everything below is reachable from it.
- `tokens/sfere-tokens.css` — every brand token, with the source comments intact
  (which step is interpolated, which hex an `oklch()` approximates).
- `tokens/app-aliases.css` — product-side aliases (`--color-brand`,
  `--color-muted`, `--color-line`, `--font-sans`, the chart series).
- `_ds_bundle.css` — the seven treatments and the animation classes.
- `components/Foundations/*/` — specimen cards showing each group rendered.

## An idiomatic build

```jsx
function StatCard({ label, value, delta }) {
  return (
    <div
      style={{
        background: 'var(--color-sfere-surface)',
        border: '1px solid var(--color-sfere-line)',
        borderRadius: 'var(--radius-sfere-xl)',
        boxShadow: 'var(--shadow-sfere-card)',
        padding: '20px 22px'
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-sfere-mono)',
          fontSize: 'var(--text-sfere-eyebrow)',
          letterSpacing: 'var(--text-sfere-eyebrow--letter-spacing)',
          textTransform: 'uppercase',
          color: 'var(--color-sfere-fg-muted)'
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-sfere-display)',
          fontSize: 'var(--text-sfere-h2)',
          lineHeight: 'var(--text-sfere-h2--line-height)',
          letterSpacing: 'var(--text-sfere-h2--letter-spacing)',
          fontWeight: 'var(--text-sfere-h2--font-weight)',
          marginTop: 6
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: 'var(--color-sfere-success)',
          fontSize: 'var(--text-sfere-sm)'
        }}
      >
        {delta}
      </div>
    </div>
  )
}
```

Headings (`h1`–`h6`) already take `--font-sfere-display` automatically — the rule
ships in `_ds_bundle.css`. Everything else you style yourself, with the names
above.
