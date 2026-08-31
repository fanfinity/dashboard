/**
 * Formatting shared by the three settings screens (`/authorizations`,
 * `/secrets`, `/settings`).
 *
 * Locale and time zone are pinned on every formatter — `toLocaleDateString()`
 * with no arguments renders different characters on a dev box, in CI and on the
 * smoke runner, and an expiry date that reads differently per machine is worse
 * than no expiry date at all.
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
import { NOT_KNOWN, NOT_SET } from '@/lib/emptyValue'
export function formatCount(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return NOT_KNOWN
  return value.toLocaleString('en-GB')
}

/**
 * `2026-06-20T09:00:00.000Z` -> `20 Jun 2026`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
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
 * `2026-06-20T09:00:00.000Z` -> `20 Jun 2026, 09:00`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  })
  return `${formatDate(iso)}, ${time}`
}

/**
 * `90` -> `90 days`. Retention windows are always spoken about in days here, so
 * the unit belongs next to the number rather than in a column header.
 *
 * @param {number|null|undefined} days
 * @returns {string}
 */
export function formatDays(days) {
  const value = Number(days)
  if (!Number.isFinite(value)) return NOT_KNOWN
  return `${formatCount(value)} day${value === 1 ? '' : 's'}`
}

/** What a hidden value looks like. Never derived from the real length. */
const MASK = '•'.repeat(12)

/**
 * Whether a stored preview has a revealable tail at all.
 *
 * Two shapes exist in the data: a partial preview (`EAAG…9f2c` — the first few
 * and last four characters, which is everything that is stored) and a value
 * that was never previewed (`••••••••`). Only the first has anything to reveal,
 * so a screen must not offer a Reveal control for the second.
 *
 * @param {string|null|undefined} preview
 * @returns {boolean}
 */
export function hasRevealablePreview(preview) {
  return Boolean(preview) && String(preview).includes('…')
}

/**
 * Masked rendering of a stored preview — the same contract
 * `ProfileApiTokensPanel` uses for account tokens: masked by default, and the
 * most a Reveal can ever show is the stored preview, because the full value is
 * shown once at creation and never persisted.
 *
 * @param {string|null|undefined} preview
 * @param {boolean} revealed
 * @returns {string}
 */
export function maskSecret(preview, revealed) {
  if (!preview) return NOT_SET
  const value = String(preview)
  if (!hasRevealablePreview(value)) return MASK
  if (revealed) return value
  const [prefix] = value.split('…')
  return `${prefix}${MASK}`
}
