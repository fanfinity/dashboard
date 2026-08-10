/**
 * Chart colour plumbing for the monitoring screens.
 *
 * The mock payloads colour their series with design tokens rather than hex:
 * `error-stats.json`'s `errorConfig[].color` is `'var(--color-chart-4)'`, and
 * the nine `--color-chart-*` tokens are declared in `src/css/tailwind.css`.
 * Those strings are valid CSS, but ApexCharts does arithmetic on the colours it
 * is handed (gradient stops, hover shades), and that arithmetic only works on a
 * literal value. Feeding it `var(...)` gives a flat, sometimes black, series.
 *
 * So the tokens stay the source of truth and are resolved here, once, off the
 * computed style of `:root`. Nothing in this folder hardcodes a hex value.
 */

/**
 * Reads one CSS custom property off `:root`.
 *
 * @param {string} name Custom property name, e.g. `'--color-line'`.
 * @param {string} [fallback=''] Returned when the token is undefined or the
 *   document is unavailable.
 * @returns {string}
 *
 * @example
 * resolveToken('--color-subtle') // '#6a7282'
 */
export function resolveToken(name, fallback = '') {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}

/**
 * Resolves an array of `*Config[].color` values. Anything that is not a bare
 * `var(--token)` reference is passed through untouched, and an unresolvable
 * token falls back to its own `var(...)` string so a mistake shows up as a
 * wrong colour rather than as a crash.
 *
 * @param {string[]} colors
 * @returns {string[]}
 *
 * @example
 * resolvePalette(['var(--color-chart-1)']) // ['#854dff']
 */
export function resolvePalette(colors) {
  return (colors ?? []).map(color => {
    const match = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(String(color).trim())
    if (!match) return color
    return resolveToken(match[1], color)
  })
}

/**
 * The chart chrome every monitoring chart shares: no toolbar, no zoom, no
 * animation. Animations are off on purpose — the smoke run waits for
 * `networkidle` and then screenshots, and an in-flight tween makes that
 * non-deterministic (wave 1 learned this the hard way).
 *
 * @param {object} [overrides] Merged into the returned `chart` block.
 * @returns {object}
 */
export function baseChart(overrides = {}) {
  return {
    toolbar: { show: false },
    zoom: { enabled: false },
    fontFamily: 'inherit',
    animations: { enabled: false },
    ...overrides
  }
}

/** Axis label colour — the `subtle` token. */
export function axisLabelStyle() {
  return { colors: resolveToken('--color-subtle', '#6a7282') }
}

/** Dashed grid in the `line` token, matching the table dividers. */
export function gridStyle() {
  return {
    borderColor: resolveToken('--color-line', '#e7e9ed'),
    strokeDashArray: 4
  }
}
