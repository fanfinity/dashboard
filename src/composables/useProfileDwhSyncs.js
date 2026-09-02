import { NOT_KNOWN } from '@/lib/emptyValue'
import { useQuasar } from 'quasar'
import { useMockResource } from '@/composables/useMockResource'

/**
 * Profile DWH syncs — scheduled batch writes of resolved fan profiles into a
 * data warehouse.
 *
 * The batch counterpart to the live profile syncs (`useLiveProfileSyncs`):
 * a live sync pushes a profile the moment it changes, a DWH sync writes the
 * whole selected profile set on a cron. Both read the same attribute and
 * identifier-type catalogs, which is why the column-mapping helpers below are
 * shared by the list and the create screen.
 *
 * NOT the warehouse-to-warehouse syncs at `/dwh-syncs` (a different packet) —
 * those move data between models, these write profiles out.
 *
 * Data is mock JSON (`public/data/profile-dwh-syncs.json`) read through
 * `useMockResource`, so this file inherits the repo-wide
 * `{ data, loading, error, load() }` contract and never throws.
 *
 * Writes have no backend. `setEnabled` / `remove` mutate the loaded array and
 * nothing else — a reload re-reads the JSON and the change is gone. Pages own
 * the user feedback (`useProfileDwhSyncToasts`), so these stay side-effect free.
 */

// Fixed locale and time zone: sync screens are the most date-dense in the app
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
 * `'2026-07-31T04:00:44.100Z'` -> `'31 Jul 2026'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string} `NOT_KNOWN` when absent or unparseable.
 */
export function formatDate(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? NOT_KNOWN : DATE.format(d)
}

/**
 * `'2026-07-31T04:00:44.100Z'` -> `'31 Jul 2026 · 04:00 UTC'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string} `NOT_KNOWN` when absent or unparseable.
 */
export function formatDateTime(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NOT_KNOWN
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
 * formatCount(412880) // '412,880'
 */
export function formatCount(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return NOT_KNOWN
  return Number(n).toLocaleString('en-GB')
}

/**
 * Run duration in the largest unit that stays readable.
 *
 * @param {number|null|undefined} ms
 * @returns {string}
 *
 * @example
 * formatDuration(184000) // '3m 4s'
 * formatDuration(9100)   // '9.1s'
 */
export function formatDuration(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value < 0) return NOT_KNOWN
  if (value < 1000) return `${Math.round(value)}ms`
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`
  const minutes = Math.floor(value / 60000)
  const seconds = Math.round((value % 60000) / 1000)
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

const RUN_STATUS = {
  success: { label: 'Succeeded', variant: 'success' },
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

const WRITE_MODE_LABELS = {
  upsert: 'Upsert',
  append: 'Append',
  replace: 'Replace'
}

/**
 * Human label for a sync's `writeMode`.
 *
 * @param {string|null|undefined} mode
 * @returns {string}
 */
export function writeModeLabel(mode) {
  return WRITE_MODE_LABELS[mode] ?? 'Upsert'
}

/**
 * The write modes offered by the create screen, with the one-line explanation
 * each needs — the difference between them is destructive, so the copy is part
 * of the control rather than a tooltip.
 */
export const WRITE_MODES = [
  {
    value: 'upsert',
    label: 'Upsert',
    description:
      'Match on the identifier columns and update the row in place, inserting the ones that are new.'
  },
  {
    value: 'append',
    label: 'Append',
    description:
      'Add every run as new rows and keep the history. The table grows on every run.'
  },
  {
    value: 'replace',
    label: 'Replace',
    description:
      'Truncate the target table and write the current profile set. Anything already there is lost.'
  }
]

/**
 * Cron expressions the schedule picker offers by name. Anything else is a
 * custom expression the user types, which is why `scheduleLabel` falls through
 * rather than failing.
 */
export const SCHEDULE_PRESETS = [
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '0 * * * *', label: 'Hourly' },
  { value: '0 */4 * * *', label: 'Every 4 hours' },
  { value: '0 2 * * *', label: 'Daily at 02:00' },
  { value: '0 6 * * 1', label: 'Weekly on Monday at 06:00' }
]

/**
 * Human label for a cron expression, falling back to the expression itself.
 *
 * @param {string|null|undefined} cron
 * @returns {string}
 *
 * @example
 * scheduleLabel('0 2 * * *')   // 'Daily at 02:00'
 * scheduleLabel('5 4 * * 3')   // 'Custom · 5 4 * * 3'
 */
export function scheduleLabel(cron) {
  if (!cron) return 'Not scheduled'
  const preset = SCHEDULE_PRESETS.find(p => p.value === cron)
  return preset ? preset.label : `Custom · ${cron}`
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
 * A warehouse-safe column name derived from an attribute or identifier type.
 *
 * @param {string} value
 * @returns {string} e.g. `'Season ticket tier'` -> `'season_ticket_tier'`
 */
export function columnName(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * `'FAN_PROD'`, `'PUBLIC'`, `'Profiles to Snowflake'` ->
 * `'FAN_PROD.PUBLIC.profiles_to_snowflake'`.
 *
 * Used to pre-fill the target table on the create screen so the common case is
 * one less thing to type. The field stays editable.
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
 * A toast that never implies persistence. Every mutation on these screens is
 * local to the session, and the caption says so.
 *
 * @returns {{ toast: (message: string) => void }}
 *
 * @example
 * const { toast } = useProfileDwhSyncToasts()
 * toast('“Profiles to Snowflake” paused')
 */
export function useProfileDwhSyncToasts() {
  const $q = useQuasar()

  function toast(message) {
    $q.notify({
      message,
      caption: 'Local preview only. No backend is connected yet.',
      color: 'dark',
      timeout: 2500
    })
  }

  return { toast }
}

/**
 * The configured profile DWH syncs, plus local-only mutations.
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
 * const { syncs, loading, error, load } = useProfileDwhSyncs()
 * onMounted(load)
 */
export function useProfileDwhSyncs() {
  const {
    data: syncs,
    loading,
    error,
    load
  } = useMockResource('profile-dwh-syncs')

  function findById(id) {
    return syncs.value.find(s => s.id === id) ?? null
  }

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
 * The warehouse connections a sync can write into.
 *
 * Read-only here: connections are created and repaired on `/dwh-connections`,
 * which another packet owns. This screen only needs to name one and know
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
export function useProfileDwhSyncConnections() {
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
 * The profile attributes a sync can write as columns.
 *
 * A secondary resource on the create screen: if it fails, the section says so
 * and offers its own retry while the rest of the form keeps working.
 *
 * @returns {{
 *   attributes: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 */
export function useProfileDwhSyncAttributes() {
  const {
    data: attributes,
    loading,
    error,
    load
  } = useMockResource('attributes')

  return { attributes, loading, error, load }
}

/**
 * The identifier types a sync can write as key columns.
 *
 * Soft-deleted identifier types carry a `deletedAt` and must not be offered as
 * a sync key, so they are filtered out here rather than in every caller.
 *
 * @returns {{
 *   identifierTypes: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 */
export function useProfileDwhSyncIdentifierTypes() {
  const {
    data: identifierTypes,
    loading,
    error,
    load
  } = useMockResource('identifier-types', {
    select: payload =>
      Array.isArray(payload) ? payload.filter(t => !t.deletedAt) : payload
  })

  return { identifierTypes, loading, error, load }
}
