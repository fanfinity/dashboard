// Formatting shared by the two profile-core screens (identity resolution and
// profile search).
//
// Formatting lives in the composable layer, never in a component: `StatCard`,
// `DefinitionList` and `DataTable` all render whatever string they are handed.
//
// Every formatter pins BOTH the locale and the time zone. `toLocaleDateString()`
// with no arguments renders differently on the smoke runner, in CI and on a dev
// box in another region — and these strings land in screenshots and in the
// smoke run's DOM, so they have to be byte-stable.

const INTEGER = new Intl.NumberFormat('en-GB')

const DECIMAL = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })

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

const MINUTE = 60000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Milliseconds for an ISO string, or `null` when it cannot be parsed. */
export function timeOf(iso) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * `12345` -> `'12,345'`. Non-numeric input becomes an em dash rather than
 * `NaN` — a fan profile must never render `NaN` next to a real number.
 *
 * @param {*} value
 * @returns {string}
 */
export function formatNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? INTEGER.format(n) : '—'
}

/**
 * `2026-02-14T18:22:41.000Z` -> `'14 Feb 2026'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  const t = timeOf(iso)
  return t === null ? '—' : DATE.format(t)
}

/**
 * `2026-02-14T18:22:41.000Z` -> `'14 Feb 2026, 18:22 UTC'`. The zone is spelled
 * out because these screens are read as evidence — a timestamp whose zone is
 * ambiguous is not evidence.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  const t = timeOf(iso)
  return t === null ? '—' : `${DATE_TIME.format(t)} UTC`
}

/**
 * `'4m ago'`. Future timestamps clamp to `'just now'` so a machine clock behind
 * the mock data cannot render `-3m ago`.
 *
 * @param {string|null|undefined} iso
 * @param {number} [now]
 * @returns {string}
 */
export function formatAgo(iso, now = Date.now()) {
  const t = timeOf(iso)
  if (t === null) return '—'
  const seconds = Math.floor((now - t) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * How far apart two timestamps are, as a phrase that reads inside a sentence:
 * `'within the same minute'`, `'6 minutes'`, `'20 days'`.
 *
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {string}
 */
export function formatGap(fromIso, toIso) {
  const from = timeOf(fromIso)
  const to = timeOf(toIso)
  if (from === null || to === null) return 'an unknown interval'
  const ms = Math.max(0, to - from)
  if (ms < MINUTE) return 'within the same minute'
  if (ms < HOUR) return plural(Math.round(ms / MINUTE), 'minute')
  if (ms < 2 * DAY) return plural(Math.round(ms / HOUR), 'hour')
  return plural(Math.round(ms / DAY), 'day')
}

/**
 * A profile attribute value as a string. Booleans read as Yes/No rather than
 * `true`, and blanks come back as `null` so `DefinitionList` renders its own
 * "not set" em dash instead of an empty row.
 *
 * @param {*} value
 * @returns {string|null}
 */
export function formatAttributeValue(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return DECIMAL.format(value)
  return String(value)
}

/**
 * Up to two initials for an avatar chip. Falls back to `'?'` so the circle is
 * never empty for an anonymous fan with no display name.
 *
 * @param {string} name
 * @returns {string}
 */
export function initialsOf(name) {
  const parts = String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
  return parts.join('') || '?'
}

/** `1 day` / `3 days`, without a `1 days` anywhere on a screen. */
function plural(n, unit) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}
