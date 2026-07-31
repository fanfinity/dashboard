import { useQuasar } from 'quasar'

/**
 * Formatting and toasts shared by the four Engage audience screens —
 * `/audiences`, `/journeys`, `/goals` and `/surveys`.
 *
 * Formatting lives in the composable layer, never in a component: `StatCard`,
 * `DefinitionList` and `DataTable` all render whatever string they are handed.
 *
 * Every formatter pins BOTH the locale and the time zone. `toLocaleDateString()`
 * with no arguments renders differently on the smoke runner, in CI and on a dev
 * box in another region, and these strings land in screenshots.
 */

const INTEGER = new Intl.NumberFormat('en-GB')

const PERCENT = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  maximumFractionDigits: 1
})

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC'
})

// Codes that read before the number ("SAR 188,420") rather than after it
// ("1,842 renewals"). Everything else is a unit noun and trails.
const CURRENCIES = new Set(['SAR', 'USD', 'EUR', 'GBP', 'AED'])

/** Milliseconds for an ISO string, or `null` when it cannot be parsed. */
export function timeOf(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * `8412` -> `'8,412'`. A missing value is an em dash rather than `0`, because a
 * cell reading "0" when the truth is "not known" is a lie a table tells well.
 *
 * @param {*} value
 * @returns {string}
 */
export function formatCount(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return Number.isFinite(n) ? INTEGER.format(n) : '—'
}

/**
 * A ratio as a percentage: `0.754` -> `'75.4%'`, `1.02` -> `'102%'`.
 *
 * @param {*} ratio
 * @returns {string}
 */
export function formatPercent(ratio) {
  const n = Number(ratio)
  return Number.isFinite(n) ? PERCENT.format(n) : '—'
}

/**
 * The size of a change, without its sign — `StatCard` draws the arrow itself,
 * so `delta="4.2%"` plus `deltaDirection="up"` must not also read `+4.2%`.
 *
 * @param {*} ratio
 * @returns {string} `''` when there is no movement to report.
 */
export function formatChange(ratio) {
  const n = Number(ratio)
  if (!Number.isFinite(n) || n === 0) return ''
  return PERCENT.format(Math.abs(n))
}

/**
 * Which way a change points, in `StatCard`'s vocabulary.
 *
 * @param {*} ratio
 * @returns {'up'|'down'|'flat'}
 */
export function trendDirection(ratio) {
  const n = Number(ratio)
  if (!Number.isFinite(n) || n === 0) return 'flat'
  return n > 0 ? 'up' : 'down'
}

/**
 * A measured value with its unit: `(188420, 'SAR')` -> `'SAR 188,420'`,
 * `(1842, 'renewals')` -> `'1,842 renewals'`.
 *
 * @param {*} value
 * @param {string} [unit]
 * @returns {string}
 */
export function formatAmount(value, unit) {
  const n = formatCount(value)
  if (n === '—' || !unit) return n
  return CURRENCIES.has(unit) ? `${unit} ${n}` : `${n} ${unit}`
}

/**
 * `'2026-07-31T05:55:00.000Z'` -> `'31 Jul 2026'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  const t = timeOf(iso)
  return t === null ? '—' : DATE.format(t)
}

/**
 * `'2026-07-31T05:55:00.000Z'` -> `'31 Jul 2026, 05:55 UTC'`. The zone is
 * spelled out: a timestamp whose zone is ambiguous is not evidence.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  const t = timeOf(iso)
  return t === null ? '—' : `${DATE_TIME.format(t)} UTC`
}

/**
 * `1 step` / `3 steps`, so no screen ever reads "1 steps".
 *
 * @param {number} n
 * @param {string} word
 * @param {string} [plural]
 * @returns {string}
 */
export function pluralize(n, word, plural = `${word}s`) {
  return `${formatCount(n)} ${Number(n) === 1 ? word : plural}`
}

/**
 * One-line toast in the house style, carrying the caption every mutating screen
 * in the rebuild uses: nothing here reaches a backend. Must be called from
 * `setup()` — it reaches for the Quasar instance.
 *
 * @returns {{ toast: (message: string) => void }}
 *
 * @example
 * const { toast } = useEngageAudienceToasts()
 * toast('High-value fans paused')
 */
export function useEngageAudienceToasts() {
  const $q = useQuasar()

  function toast(message) {
    $q.notify({
      message,
      caption: 'Local preview only — no backend is connected yet.',
      color: 'dark',
      position: 'bottom',
      timeout: 2500
    })
  }

  return { toast }
}
