import { useQuasar } from 'quasar'
import { useMockResource } from '@/composables/useMockResource'

/**
 * DWH syncs — scheduled copies of collected *events* between a source and a
 * data warehouse table.
 *
 * NOT the profile DWH syncs at `/profile-dwh-syncs` (`useProfileDwhSyncs`),
 * which write the resolved profile set out as one row per fan. These move the
 * raw event stream: `direction: 'outbound'` writes collected events into a
 * warehouse table, `direction: 'inbound'` reads a warehouse table back into the
 * fan graph. Same shape, different payload — the helpers below deliberately
 * mirror the profile packet's so the two screens read alike.
 *
 * Data is mock JSON (`public/data/dwh-syncs.json`) read through
 * `useMockResource`, so this file inherits the repo-wide
 * `{ data, loading, error, load() }` contract and never throws.
 *
 * Writes have no backend. `setEnabled` / `remove` mutate the loaded array and
 * nothing else — a reload re-reads the JSON and the change is gone. Pages own
 * the user feedback (`useDwhSyncToasts`), so these stay side-effect free.
 */

// Fixed locale and time zone: these are the most date-dense screens in the app
// (last run, next run, deleted at), and `toLocaleDateString()` with no
// arguments renders differently on the smoke runner, in CI and on a dev box.
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC'
})

/**
 * `'2026-07-31T04:00:11.320Z'` -> `'31 Jul 2026'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string} `'—'` when absent or unparseable.
 */
export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d)
}

/**
 * `'2026-07-31T04:00:11.320Z'` -> `'31 Jul 2026 · 04:00 UTC'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string} `'—'` when absent or unparseable.
 */
export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${DATE.format(d)} · ${TIME.format(d)} UTC`
}

/**
 * Thousands-separated integer, em dash for a missing value so a cell never
 * reads "0" when the truth is "unknown".
 *
 * @param {number|null|undefined} n
 * @returns {string}
 *
 * @example
 * formatCount(45600) // '45,600'
 */
export function formatCount(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-GB')
}

/**
 * Run duration in the largest unit that stays readable.
 *
 * @param {number|null|undefined} ms
 * @returns {string}
 *
 * @example
 * formatDuration(41200) // '41.2s'
 * formatDuration(72400) // '1m 12s'
 */
export function formatDuration(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value < 0) return '—'
  if (value < 1000) return `${Math.round(value)}ms`
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`
  const minutes = Math.floor(value / 60000)
  const seconds = Math.round((value % 60000) / 1000)
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

const RUN_STATUS = {
  success: { label: 'Succeeded', variant: 'success' },
  warning: { label: 'Completed with warnings', variant: 'warn' },
  failed: { label: 'Failed', variant: 'danger' },
  running: { label: 'Running', variant: 'brand' },
  skipped: { label: 'Skipped', variant: 'warn' }
}

/**
 * Badge label + `StatusBadge` variant for a sync's `lastRunStatus`.
 *
 * A sync that has never run is neutral, not a failure — the run simply has not
 * happened yet.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, variant: string }}
 */
export function runStatusMeta(status) {
  return RUN_STATUS[status] ?? { label: 'Never run', variant: 'neutral' }
}

/**
 * A run that finished with warnings still moved rows, so it is not "failing" —
 * but it is the other thing worth surfacing on the list. Both land in the same
 * tab and the same counter.
 *
 * @param {object} sync
 * @returns {boolean}
 */
export function needsAttention(sync) {
  return sync?.lastRunStatus === 'failed' || sync?.lastRunStatus === 'warning'
}

const DIRECTIONS = {
  outbound: {
    label: 'Events → warehouse',
    description: 'Collected events are written into a warehouse table.'
  },
  inbound: {
    label: 'Warehouse → events',
    description: 'Rows from a warehouse table are read back into the fan graph.'
  }
}

/**
 * Short label for a sync's `direction`.
 *
 * @param {string|null|undefined} direction
 * @returns {string}
 */
export function directionLabel(direction) {
  return DIRECTIONS[direction]?.label ?? 'Events → warehouse'
}

/**
 * One-line explanation of a sync's `direction`, for the places a label alone
 * is too terse (the detail dialog, the create summary).
 *
 * @param {string|null|undefined} direction
 * @returns {string}
 */
export function directionDescription(direction) {
  return DIRECTIONS[direction]?.description ?? DIRECTIONS.outbound.description
}

/**
 * The event-envelope columns a sync can write.
 *
 * Events have a fixed envelope rather than a per-workspace catalog, so this is
 * a constant here instead of another mock file — the equivalent of the profile
 * packet's attribute catalog, minus the fetch. `locked` columns are the natural
 * key of a row and cannot be deselected.
 */
export const EVENT_COLUMNS = [
  {
    id: 'event_id',
    label: 'Event ID',
    locked: true,
    description: 'Unique id for the event — the primary key of the row.'
  },
  {
    id: 'event_type',
    label: 'Event type',
    locked: true,
    description: 'What happened: page view, track, identify, and so on.'
  },
  {
    id: 'timestamp',
    label: 'Timestamp',
    locked: true,
    description: 'When the event was collected, in UTC.'
  },
  {
    id: 'anonymous_id',
    label: 'Anonymous ID',
    description: 'Device-scoped id, set before the fan is known.'
  },
  {
    id: 'user_id',
    label: 'User ID',
    description: 'Resolved fan id, present once the event is identified.'
  },
  {
    id: 'source_id',
    label: 'Source ID',
    description: 'Which source the event arrived on.'
  },
  {
    id: 'context',
    label: 'Context',
    description: 'Page, campaign, device and consent envelope, as JSON.'
  },
  {
    id: 'properties',
    label: 'Properties',
    description: 'The event-specific payload, as JSON.'
  }
]

/**
 * The columns a new sync starts with: the locked key columns plus the two that
 * carry the fan identity, which is what almost every warehouse query joins on.
 *
 * @returns {string[]} a fresh array, safe to hand to a `reactive` form.
 */
export function defaultEventColumns() {
  return EVENT_COLUMNS.filter(
    c => c.locked || c.id === 'anonymous_id' || c.id === 'user_id'
  ).map(c => c.id)
}

/**
 * Cron expressions the schedule picker offers by name. Every schedule in
 * `dwh-syncs.json` is one of these, so the label a row carries and the label
 * this derives always agree.
 */
export const SCHEDULE_PRESETS = [
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '*/30 * * * *', label: 'Every 30 minutes' },
  { value: '0 * * * *', label: 'Hourly' },
  { value: '0 */2 * * *', label: 'Every 2 hours' },
  { value: '0 3 * * *', label: 'Daily at 03:00' },
  { value: '0 1 * * 0', label: 'Weekly on Sunday at 01:00' }
]

/**
 * Human label for a cron expression, falling back to the expression itself.
 *
 * @param {string|null|undefined} cron
 * @returns {string}
 *
 * @example
 * scheduleLabel('0 * * * *') // 'Hourly'
 * scheduleLabel('5 4 * * 3') // 'Custom · 5 4 * * 3'
 */
export function scheduleLabel(cron) {
  if (!cron) return 'Not scheduled'
  const preset = SCHEDULE_PRESETS.find(p => p.value === cron)
  return preset ? preset.label : `Custom · ${cron}`
}

/**
 * The schedule label for a whole row, preferring the one the record ships.
 *
 * A stored `scheduleLabel` is what the backend chose to call this schedule, so
 * it wins over anything derived here; the derivation is the fallback for a
 * record that has none (a form the user just filled in).
 *
 * @param {object|null|undefined} sync
 * @returns {string}
 */
export function syncScheduleLabel(sync) {
  return sync?.scheduleLabel || scheduleLabel(sync?.schedule)
}

/**
 * A five-field cron expression, loosely checked. This is a client-side sanity
 * check on a form with no backend behind it, not a cron parser — it rejects the
 * obvious typos (three fields, a stray word) and lets everything else through.
 *
 * @param {string} cron
 * @returns {boolean}
 */
export function isCronLike(cron) {
  const fields = String(cron ?? '')
    .trim()
    .split(/\s+/)
  if (fields.length !== 5) return false
  return fields.every(f => /^[0-9*/,-]+$/.test(f))
}

/**
 * A warehouse-safe identifier derived from free text.
 *
 * @param {string} value
 * @returns {string} e.g. `'Merch orders to Snowflake'` -> `'merch_orders'`-ish
 */
export function columnName(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * `'FAN_PROD'`, `'PUBLIC'`, `'Matchday events'` ->
 * `'FAN_PROD.PUBLIC.matchday_events'`.
 *
 * Pre-fills the target table on the create screen so the common case is one
 * less thing to type. The field stays editable.
 *
 * @param {object|null} connection
 * @param {string} name
 * @returns {string}
 */
export function suggestTargetTable(connection, name) {
  const table = columnName(name)
  if (!connection || !table) return ''
  return [connection.database, connection.schema, table]
    .filter(Boolean)
    .join('.')
}

/**
 * Whether a warehouse connection is accepting writes.
 *
 * A connection that is absent cannot be judged, so it is not reported as
 * unhealthy — callers that care about "deleted along with the sync" check for
 * absence separately.
 *
 * @param {object|null|undefined} connection
 * @returns {boolean}
 */
export function isConnectionHealthy(connection) {
  return Boolean(connection) && connection.status === 'connected'
}

/**
 * A toast that never implies persistence. Every mutation on these screens is
 * local to the session, and the caption says so.
 *
 * @returns {{ toast: (message: string) => void }}
 *
 * @example
 * const { toast } = useDwhSyncToasts()
 * toast('“Merch orders to Snowflake” paused')
 */
export function useDwhSyncToasts() {
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

/**
 * The configured DWH syncs, plus local-only mutations.
 *
 * @returns {{
 *   syncs: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   setEnabled: (id: string, isEnabled: boolean) => void,
 *   remove: (id: string) => void
 * }}
 *
 * @example
 * const { syncs, loading, error, load } = useDwhSyncs()
 * onMounted(load)
 */
export function useDwhSyncs() {
  const { data: syncs, loading, error, load } = useMockResource('dwh-syncs')

  function findById(id) {
    return syncs.value.find(s => s.id === id) ?? null
  }

  // Pausing clears the next run: a paused sync has nothing scheduled, and
  // leaving a stale date on the row reads as "it will still run".
  function setEnabled(id, isEnabled) {
    syncs.value = syncs.value.map(s =>
      s.id === id
        ? { ...s, isEnabled, nextRunAt: isEnabled ? s.nextRunAt : null }
        : s
    )
  }

  function remove(id) {
    syncs.value = syncs.value.filter(s => s.id !== id)
  }

  return { syncs, loading, error, load, findById, setEnabled, remove }
}

/**
 * The warehouse connections a sync reads from or writes into.
 *
 * Read-only here: connections are created and repaired on `/dwh-connections`,
 * which another packet owns. These screens only need to name one and know
 * whether it is healthy.
 *
 * @returns {{
 *   connections: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null
 * }}
 */
export function useDwhSyncConnections() {
  const {
    data: connections,
    loading,
    error,
    load
  } = useMockResource('dwh-connections')

  function findById(id) {
    return connections.value.find(c => c.id === id) ?? null
  }

  return { connections, loading, error, load, findById }
}

/**
 * The sources whose collected events a sync can copy.
 *
 * A secondary resource on the create screen: if it fails, the section says so
 * and offers its own retry while the rest of the form keeps working.
 *
 * @returns {{
 *   sources: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null
 * }}
 */
export function useDwhSyncSources() {
  const { data: sources, loading, error, load } = useMockResource('sources')

  function findById(id) {
    return sources.value.find(s => s.id === id) ?? null
  }

  return { sources, loading, error, load, findById }
}
