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
  }
}

export const SFERE_ICON_NAMES = Object.keys(SFERE_ICONS)
