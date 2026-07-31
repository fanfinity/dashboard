/**
 * Formatting shared by the four Engage channel screens (`/channels/email`,
 * `/channels/settings`, `/engage-settings`, `/engage-operator/work-log`).
 *
 * Locale and time zone are pinned on every formatter. `toLocaleDateString()`
 * with no arguments renders different characters on a dev box, in CI and on the
 * smoke runner, and the work log is nothing but timestamps — a row that reads
 * differently per machine is worse than no timestamp at all.
 *
 * Formatting lives here rather than in a component because `StatCard`,
 * `DefinitionList` and `DataTable` all render whatever string they are handed.
 */

/**
 * Thousands-separated count, with a dash for nothing at all.
 *
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function formatCount(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-GB')
}

/**
 * `2026-07-31T05:00:00.000Z` -> `31 Jul 2026`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/**
 * `2026-07-31T05:00:00.000Z` -> `31 Jul 2026, 05:00 UTC`.
 *
 * The zone is spelled out because the work log is read after the fact, often by
 * someone in a different one, and "05:00" alone invites the wrong conclusion.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${formatDate(iso)}, ${formatClock(iso)} UTC`
}

/**
 * Just the time of day of an ISO timestamp: `05:00`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatClock(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  })
}

/**
 * The UTC calendar day of an ISO timestamp, as a stable grouping key.
 * `2026-07-31T05:20:11.000Z` -> `2026-07-31`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function dayKey(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/**
 * A ratio as a percentage: `0.4823` -> `48.2%`.
 *
 * @param {number|null|undefined} ratio
 * @param {number} [digits=1]
 * @returns {string}
 */
export function formatPercent(ratio, digits = 1) {
  const value = Number(ratio)
  if (!Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

/**
 * `part / total`, or `null` when the denominator is missing or zero.
 *
 * Returned as a number rather than a formatted string so `DataTable` can sort a
 * rate column numerically — it sorts on the raw cell value, and '9.8%' sorts
 * after '48.2%' as text.
 *
 * @param {number|null|undefined} part
 * @param {number|null|undefined} total
 * @returns {number|null}
 */
export function rate(part, total) {
  const numerator = Number(part)
  const denominator = Number(total)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  if (denominator <= 0) return null
  return numerator / denominator
}

/**
 * `08:00` + `21:00` -> `08:00 – 21:00 (Asia/Riyadh)`.
 *
 * @param {{ start?: string, end?: string, timezone?: string }|null|undefined} window
 * @returns {string}
 */
export function formatWindow(window) {
  if (!window?.start || !window?.end) return '—'
  const zone = window.timezone ? ` (${window.timezone})` : ''
  return `${window.start} – ${window.end}${zone}`
}

/** What a hidden value looks like. Never derived from the real length. */
const MASK = '•'.repeat(10)

/**
 * Whether a stored value has a tail worth revealing.
 *
 * A short value has nothing to show behind a Reveal, and offering a control
 * that changes nothing is a lie about what is held.
 *
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
export function hasRevealableSecret(value) {
  return Boolean(value) && String(value).length > 4
}

/**
 * Masked rendering of a credential-shaped value — the contract
 * `SettingsSecretValue` established for the settings screens: masked by
 * default, full value only behind an explicit per-row Reveal, so a screenshot
 * of the screen leaks nothing.
 *
 * @param {string|null|undefined} value
 * @param {boolean} revealed
 * @returns {string}
 */
export function maskSecret(value, revealed) {
  if (!value) return '—'
  const text = String(value)
  if (revealed) return text
  if (!hasRevealableSecret(text)) return MASK
  return `${MASK}${text.slice(-4)}`
}
