/**
 * The kit's glyph registry — one entry per icon, drawn as SVG path data.
 *
 * Inline path data rather than files under `src/assets/`: the kit does not
 * reach into app assets, `img-src 'self'` plus `assetsInlineLimit: 0` rule out
 * a data: URI, and an `<svg>` inherits `currentColor` so one glyph works on a
 * brand-filled button and a white one without a second copy. Same reasoning
 * SfereSpinner draws its own circle on.
 *
 * Every glyph is on a 256×256 grid (Phosphor's), which is what ToolbarSearch's
 * hand-inlined magnifier already used — a mixed grid would make `size-4` mean
 * two different optical sizes. `back` is the optional duotone wash drawn at 20%
 * behind `path`; icons whose shape is already a stroke (plus, arrows) have none.
 */
export const SFERE_ICONS = {
  trash: {
    back: 'M200 56v152a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8V56Z',
    path: 'M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16M96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96Zm96 168H64V64h128Zm-80-104v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0m48 0v64a8 8 0 0 1-16 0v-64a8 8 0 0 1 16 0'
  },
  plus: {
    path: 'M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8'
  },
  search: {
    back: 'M192 112a80 80 0 1 1-80-80a80 80 0 0 1 80 80',
    path: 'm229.66 218.34l-50.07-50.06a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.32M40 112a72 72 0 1 1 72 72a72.08 72.08 0 0 1-72-72'
  },
  pause: {
    back: 'M96 64v128a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V64a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8m120-8h-48a8 8 0 0 0-8 8v128a8 8 0 0 0 8 8h48a8 8 0 0 0 8-8V64a8 8 0 0 0-8-8',
    path: 'M216 48h-40a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h40a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16m0 144h-40V64h40zM80 48H40a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h40a16 16 0 0 0 16-16V64a16 16 0 0 0-16-16m0 144H40V64h40z'
  },
  play: {
    back: 'M224 128a7.9 7.9 0 0 1-3.8 6.83l-144.06 88.19A8 8 0 0 1 64 216.18V39.82a8 8 0 0 1 12.14-6.84L220.2 121.17A7.9 7.9 0 0 1 224 128',
    path: 'M232.4 114.49L88.32 26.35a16 16 0 0 0-16.2-.3A15.86 15.86 0 0 0 64 39.87v176.26A15.94 15.94 0 0 0 80 232a16.07 16.07 0 0 0 8.36-2.35l144.04-88.14a15.81 15.81 0 0 0 0-27.02M80 215.94V40l143.83 88Z'
  },
  'arrow-left': {
    path: 'M224 128a8 8 0 0 1-8 8H59.31l58.35 58.34a8 8 0 0 1-11.32 11.32l-72-72a8 8 0 0 1 0-11.32l72-72a8 8 0 0 1 11.32 11.32L59.31 120H216a8 8 0 0 1 8 8'
  },
  // The app-bar nav toggle. Drawn here rather than left as Quasar's
  // `icon="menu"`: that renders a Material Icons ligature inside a `.q-btn`,
  // whose unlayered `color: inherit` picks up `.q-header`'s unlayered
  // `color: #fff` — a white glyph on a white bar, which is how the only way
  // into the sidebar below 1024px came to be invisible. An SfereIcon takes the
  // colour of the control it sits in and answers to no font.
  menu: {
    path: 'M224 128a8 8 0 0 1-8 8H40a8 8 0 0 1 0-16h176a8 8 0 0 1 8 8M40 72h176a8 8 0 0 0 0-16H40a8 8 0 0 0 0 16m176 112H40a8 8 0 0 0 0 16h176a8 8 0 0 0 0-16'
  },
  // The row-action kebab (RowActionsMenu). Vertical, not horizontal: it sits in
  // a table's right-hand actions column, where three dots on a row would read
  // as an ellipsis truncating the cell beside it. Phosphor's geometry — three
  // r13 circles at 64/128/192 — rather than a heavier dot, because the whole
  // set is regular weight and a bolder glyph here would look like a different
  // family. If it reads small, the lever is the button size, not the radius.
  'dots-vertical': {
    path: 'M128 51a13 13 0 1 0 13 13a13 13 0 0 0-13-13m0 64a13 13 0 1 0 13 13a13 13 0 0 0-13-13m0 64a13 13 0 1 0 13 13a13 13 0 0 0-13-13'
  },
  // The password show/hide pair. Two glyphs rather than one rotated or
  // struck-through icon: the slash is part of the outline, so a CSS overlay
  // would not follow `currentColor` on a dark form.
  eye: {
    back: 'M128 56c-80 0-112 72-112 72s32 72 112 72s112-72 112-72s-32-72-112-72m0 112a40 40 0 1 1 40-40a40 40 0 0 1-40 40',
    path: 'M247.31 124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57 61.26 162.88 48 128 48S61.43 61.26 36.34 86.35C17.51 105.18 9 124 8.69 124.76a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 194.74 93.12 208 128 208s66.57-13.26 91.66-38.34c18.83-18.83 27.3-37.61 27.65-38.4a8 8 0 0 0 0-6.5M128 192c-30.78 0-57.67-11.19-79.93-33.25A133.5 133.5 0 0 1 25 128a133.3 133.3 0 0 1 23.07-30.75C70.33 75.19 97.22 64 128 64s57.67 11.19 79.93 33.25A133.5 133.5 0 0 1 231.05 128c-7.21 13.46-38.62 64-103.05 64m0-112a48 48 0 1 0 48 48a48.05 48.05 0 0 0-48-48m0 80a32 32 0 1 1 32-32a32 32 0 0 1-32 32'
  },
  'eye-slash': {
    path: 'M53.92 34.62a8 8 0 1 0-11.84 10.76l19.24 21.17C25 88.84 9.38 123.2 8.69 124.76a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 194.74 93.12 208 128 208a127.1 127.1 0 0 0 52.07-10.83l22 24.21a8 8 0 1 0 11.84-10.76ZM128 192c-30.78 0-57.67-11.19-79.93-33.25A133.5 133.5 0 0 1 25 128c4.69-8.79 19.66-33.39 47.35-49.38l18.66 20.52a48 48 0 0 0 63.85 70.22l14.71 16.18A112 112 0 0 1 128 192m3.29-45.28a32 32 0 0 1-30-33a32 32 0 0 1 1.61-8.66ZM247.31 131.26c-.42.94-10.55 23.37-33.36 43.8a8 8 0 0 1-10.67-11.92A132.4 132.4 0 0 0 231 128c-7.2-13.46-38.62-64-103-64a118 118 0 0 0-19.36 1.57A8 8 0 1 1 106 49.79A134 134 0 0 1 128 48c34.88 0 66.57 13.26 91.66 38.35c18.83 18.83 27.3 37.62 27.65 38.41a8 8 0 0 1 0 6.5'
  }
}

export const SFERE_ICON_NAMES = Object.keys(SFERE_ICONS)
