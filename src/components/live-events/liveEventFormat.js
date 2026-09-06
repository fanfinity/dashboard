import { NOT_KNOWN } from '@/lib/emptyValue'

/**
 * Render helpers shared by the Live Events table and its detail drawer.
 *
 * They live here rather than in either component because both need the same
 * answers — the row shows a status dot and a type label, the drawer shows the
 * same status as a badge and the same date in the same UTC format — and two
 * copies of "what colour is SKIPPED?" is how the two surfaces drift apart.
 *
 * Every one of them reads a field the backend's `LiveEvent` actually carries
 * (see `openapi/fanfinity-api.json`), and every one is written to survive the
 * field being absent: this route is in `legacyScreens`, so `pnpm smoke:dist`
 * does not walk it and a `TypeError` here would reach a user before it reached
 * the gate.
 */

/**
 * The event's timestamp, in UTC, to the second.
 *
 * UTC and not local time on purpose: the column header says so, and a feed
 * that has to be compared against a server log is unreadable in whichever
 * timezone the reader's laptop happens to be in.
 *
 * @param {string|number|Date} date
 * @returns {string}
 */
export function formatUTC(date) {
  if (!date) return NOT_KNOWN
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return NOT_KNOWN
  const p = n => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  )
}

/**
 * What the Type column prints. A `track` event's own name (`AddToCart`) says
 * far more than the word "track" does, so it wins where there is one.
 *
 * @param {object} ev
 * @returns {string}
 */
export function typeLabel(ev) {
  if (!ev) return NOT_KNOWN
  const name = ev.type === 'track' ? ev.payload?.event || ev.type : ev.type
  return name || NOT_KNOWN
}

/** The track event's own name, or '' where the event is not a track. */
export function trackEventName(ev) {
  return (ev?.type === 'track' && ev?.payload?.event) || ''
}

/**
 * A `LiveEvent.status` mapped onto a `StatusBadge` tone.
 *
 * SKIPPED is `warn` rather than `danger` deliberately: a skipped event was a
 * decision (a filter dropped it), not a failure, and colouring the two the same
 * would make the error count on this screen unreadable.
 *
 * @param {string} status
 * @returns {'success'|'danger'|'warn'|'neutral'}
 */
export function statusTone(status) {
  switch (status) {
    case 'SUCCESS':
      return 'success'
    case 'FAILED':
      return 'danger'
    case 'SKIPPED':
      return 'warn'
    default:
      return 'neutral'
  }
}

/** The same four states as a bare dot, for the table's first column. */
export function statusDotClass(status) {
  return {
    success: 'bg-sfere-success',
    danger: 'bg-sfere-danger',
    warn: 'bg-sfere-warn',
    neutral: 'bg-sfere-fg-muted'
  }[statusTone(status)]
}

/**
 * Who the event is about, as one chip: the strongest identifier present.
 *
 * Returns `null` rather than a placeholder when the event carries none — an
 * anonymous event with no anonymous id is a real state, and a chip reading
 * "Not known" in a summary cell is noise rather than information.
 *
 * @param {object} ev
 * @returns {{ label: string, tone: 'brand'|'neutral' }|null}
 */
export function identityOf(ev) {
  if (!ev) return null
  if (ev.email) return { label: ev.email, tone: 'brand' }
  if (ev.userId) return { label: ev.userId, tone: 'brand' }
  if (ev.anonymousId) return { label: ev.anonymousId, tone: 'neutral' }
  return null
}

/**
 * `AE · Dubai` where the backend resolved a location, '' where it did not.
 * Geo is on `context`, which is a free-form blob, so every hop is optional.
 */
export function geoLabel(ev) {
  const geo = ev?.context?.geo
  const code = geo?.country?.code
  if (!code) return ''
  return [code, geo?.city?.name].filter(Boolean).join(' · ')
}
