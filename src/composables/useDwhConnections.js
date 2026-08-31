import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useMockResource } from '@/composables/useMockResource'

/**
 * DWH connections — the credentialled links to a customer's own data
 * warehouses (Snowflake, BigQuery, Databricks, PostgreSQL, Redshift).
 *
 * A connection is the bottom of the warehouse stack: warehouse models
 * (`/warehouse-models`) run their SQL through one, warehouse syncs
 * (`/dwh-syncs`) move tables across one, and profile DWH syncs
 * (`/profile-dwh-syncs`) write the resolved profile set into one. Those three
 * packets read a connection; this packet is the only one that creates,
 * repairs and deletes them.
 *
 * Data is mock JSON (`public/data/dwh-connections.json`) read through
 * `useMockResource`, so this file inherits the repo-wide
 * `{ data, loading, error, load() }` contract and never throws.
 *
 * Writes have no backend. `setPrimary` / `remove` / `applyTestResult` mutate
 * the loaded array and nothing else — a reload re-reads the JSON and the change
 * is gone. Credentials are never stored anywhere: the create form holds a
 * password in component state for the life of the page and drops it. Pages own
 * the user feedback (`useDwhConnectionToasts`), so these stay side-effect free.
 */

// Fixed locale and time zone. A connection screen is date-dense (validated at,
// deleted at) and `toLocaleDateString()` with no arguments renders differently
// on the smoke runner, in CI and on a dev box.
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
 * `'2026-07-31T05:12:44.220Z'` -> `'31 Jul 2026'`.
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
 * `'2026-07-31T05:12:44.220Z'` -> `'31 Jul 2026 · 05:12 UTC'`.
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
 * formatCount(128) // '128'
 */
export function formatCount(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return NOT_KNOWN
  return Number(n).toLocaleString('en-GB')
}

/**
 * The warehouse engines a connection can point at.
 *
 * Every engine needs the same six things — a name, a host, a port, a database,
 * a user and a secret — but calls them different names, so the labels and
 * placeholders travel with the type rather than being hard-coded in the form.
 * The create screen renders one set of fields and re-labels them from here.
 */
export const CONNECTION_TYPES = [
  {
    value: 'snowflake',
    label: 'Snowflake',
    description:
      'Account host plus a service user. Sfere reads modelled tables and writes audience snapshots back.',
    defaultPort: 443,
    hostLabel: 'Account host',
    hostPlaceholder: 'org-account.eu-central-1.snowflakecomputing.com',
    databaseLabel: 'Database',
    databasePlaceholder: 'FAN_PROD',
    usernameLabel: 'Username',
    usernamePlaceholder: 'SFERE_SVC',
    secretLabel: 'Password',
    schemaPlaceholder: 'PUBLIC'
  },
  {
    value: 'bigquery',
    label: 'BigQuery',
    description:
      'A Google Cloud project reached with a service account. Best for archives already sitting in GCS.',
    defaultPort: 443,
    hostLabel: 'API endpoint',
    hostPlaceholder: 'bigquery.googleapis.com',
    databaseLabel: 'Project ID',
    databasePlaceholder: 'sfere-archive',
    usernameLabel: 'Service account',
    usernamePlaceholder: 'writer@project.iam.gserviceaccount.com',
    secretLabel: 'Service account key',
    schemaPlaceholder: 'fan_raw'
  },
  {
    value: 'databricks',
    label: 'Databricks',
    description:
      'A SQL warehouse on a workspace host, authenticated with a personal access token.',
    defaultPort: 443,
    hostLabel: 'Workspace host',
    hostPlaceholder: 'adb-1234567890.7.azuredatabricks.net',
    databaseLabel: 'Catalog',
    databasePlaceholder: 'fan_prod',
    usernameLabel: 'Token principal',
    usernamePlaceholder: 'sfere-svc',
    secretLabel: 'Access token',
    schemaPlaceholder: 'default'
  },
  {
    value: 'postgres',
    label: 'PostgreSQL',
    description:
      'A Postgres database reached directly. The usual choice for a CRM or an operational replica.',
    defaultPort: 5432,
    hostLabel: 'Host',
    hostPlaceholder: 'crm-db.internal.sfere.io',
    databaseLabel: 'Database',
    databasePlaceholder: 'crm',
    usernameLabel: 'Username',
    usernamePlaceholder: 'sfere_ro',
    secretLabel: 'Password',
    schemaPlaceholder: 'public'
  },
  {
    value: 'redshift',
    label: 'Redshift',
    description:
      'An Amazon Redshift cluster. Speaks the Postgres wire protocol on its own port.',
    defaultPort: 5439,
    hostLabel: 'Cluster endpoint',
    hostPlaceholder: 'cluster.abc123.eu-west-1.redshift.amazonaws.com',
    databaseLabel: 'Database',
    databasePlaceholder: 'legacy_fan',
    usernameLabel: 'Username',
    usernamePlaceholder: 'readonly',
    secretLabel: 'Password',
    schemaPlaceholder: 'public'
  }
]

/**
 * The descriptor for a connection type, falling back to PostgreSQL's shape so a
 * record carrying an engine this build does not know about still renders a
 * complete form rather than a page of blank labels.
 *
 * @param {string|null|undefined} type
 * @returns {object}
 */
export function connectionType(type) {
  return CONNECTION_TYPES.find(t => t.value === type) ?? CONNECTION_TYPES[3]
}

/**
 * Human label for a connection's `type`.
 *
 * @param {string|null|undefined} type
 * @returns {string}
 *
 * @example
 * connectionTypeLabel('postgres') // 'PostgreSQL'
 */
export function connectionTypeLabel(type) {
  return CONNECTION_TYPES.find(t => t.value === type)?.label ?? 'Warehouse'
}

// The status vocabulary is shared with `/profile-dwh-syncs`, which already
// treats anything that is not `connected` as "this will not run". Keep the raw
// values identical to the mock data — the wave-2 trash screen reads them too.
const STATUS = {
  connected: { label: 'Connected', variant: 'success' },
  error: { label: 'Failing', variant: 'danger' },
  disconnected: { label: 'Disconnected', variant: 'neutral' },
  testing: { label: 'Testing…', variant: 'brand' }
}

/**
 * Badge label + `StatusBadge` variant for a connection's `status`.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, variant: string }}
 */
export function statusMeta(status) {
  return STATUS[status] ?? { label: 'Unknown', variant: 'neutral' }
}

const ERROR_LABELS = {
  connection_failed: 'Connection failed',
  auth_failed: 'Authentication rejected',
  permission_denied: 'Permission denied',
  tls_error: 'TLS handshake failed'
}

/**
 * `'connection_failed: timeout after 30s'` ->
 * `'Connection failed — timeout after 30s'`.
 *
 * The stored code is the vocabulary the rest of the warehouse screens match on,
 * so it is translated for display rather than rewritten in the data.
 *
 * @param {string|null|undefined} lastError
 * @returns {string} `''` when there is no error to describe.
 */
export function formatConnectionError(lastError) {
  if (!lastError) return ''
  const [code, ...rest] = String(lastError).split(':')
  const detail = rest.join(':').trim()
  const label = ERROR_LABELS[code.trim()] ?? code.trim().replace(/_/g, ' ')
  return detail ? `${label}: ${detail}` : label
}

/**
 * A **simulated** connection test.
 *
 * There is no backend and no socket: this inspects what it was handed and
 * reports what a real probe would have found. A record that is already failing
 * reports its recorded error, so the button agrees with the badge next to it
 * instead of cheerfully passing. Every caller must say the result is simulated.
 *
 * @param {object} input
 *   Either a stored connection or the create form's state; needs `host`,
 *   `database` and `username`, and reads `status` / `lastError` when present.
 * @returns {{ ok: boolean, title: string, message: string }}
 *
 * @example
 * const result = simulateConnectionTest(connection)
 * // { ok: false, title: 'Test failed', message: 'Connection failed — …' }
 */
export function simulateConnectionTest(input) {
  const missing = ['host', 'database', 'username'].filter(
    k => !String(input?.[k] ?? '').trim()
  )

  if (missing.length) {
    return {
      ok: false,
      title: 'Nothing to test yet',
      message: `Fill in ${missing.join(', ')} first.`
    }
  }

  if (input.status === 'error') {
    return {
      ok: false,
      title: 'Test failed',
      message: `${formatConnectionError(input.lastError) || 'The last probe did not reach the warehouse.'} Simulated locally. No connection was opened.`
    }
  }

  return {
    ok: true,
    title: 'Test passed',
    message: `${input.host} looks reachable and the credentials are complete. Simulated locally. No connection was opened.`
  }
}

/**
 * A toast that never implies persistence. Every mutation on these screens is
 * local to the session, and the caption says so.
 *
 * @returns {{ toast: (message: string, caption?: string) => void }}
 *
 * @example
 * const { toast } = useDwhConnectionToasts()
 * toast('“CRM Postgres” moved to trash')
 */
export function useDwhConnectionToasts() {
  const $q = useQuasar()

  function toast(
    message,
    caption = 'Local preview only. No backend is connected yet.'
  ) {
    $q.notify({
      message,
      caption,
      color: 'dark',
      timeout: 2500
    })
  }

  return { toast }
}

/**
 * The configured warehouse connections, plus local-only mutations.
 *
 * @returns {{
 *   connections: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   setPrimary: (id: string) => void,
 *   applyTestResult: (id: string, ok: boolean) => void,
 *   remove: (id: string) => void
 * }}
 *
 * @example
 * const { connections, loading, error, apiMissing, load } = useDwhConnections()
 * onMounted(load)
 */
export function useDwhConnections() {
  const {
    data: connections,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('dwh-connections')

  function findById(id) {
    return connections.value.find(c => c.id === id) ?? null
  }

  // Exactly one connection is primary: the one modelling defaults to. Promoting
  // one demotes the rest in the same pass.
  function setPrimary(id) {
    connections.value = connections.value.map(c => ({
      ...c,
      isPrimary: c.id === id
    }))
  }

  // A simulated test still moves the record, so the badge and the last-validated
  // stamp agree with the result the user was just shown.
  function applyTestResult(id, ok) {
    connections.value = connections.value.map(c =>
      c.id === id
        ? {
            ...c,
            status: ok ? 'connected' : 'error',
            lastValidatedAt: new Date().toISOString()
          }
        : c
    )
  }

  function remove(id) {
    connections.value = connections.value.filter(c => c.id !== id)
  }

  return {
    connections,
    loading,
    error,
    apiMissing,
    load,
    findById,
    setPrimary,
    applyTestResult,
    remove
  }
}

/**
 * What reads from a connection: warehouse syncs, warehouse models and profile
 * DWH syncs, each owned by another packet and each read-only here.
 *
 * This is a **secondary** resource everywhere it is used — a list still lists
 * and a delete still deletes when it fails — so callers render its `error` as a
 * notice with its own retry rather than escalating to a page-level `ErrorState`.
 *
 * @returns {{
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   usageFor: (id: string) => { syncs: number, models: number, profileSyncs: number, total: number },
 *   usageParts: (id: string) => string[],
 *   totalDependants: import('vue').Ref<number>
 * }}
 *
 * @example
 * const { usageParts, load } = useDwhConnectionUsage()
 * usageParts('dwh_snowflake_prod') // ['2 syncs', '3 models', '2 profile syncs']
 */
export function useDwhConnectionUsage() {
  const syncs = useMockResource('dwh-syncs')
  const models = useMockResource('warehouse-models')
  const profileSyncs = useMockResource('profile-dwh-syncs')

  const loading = computed(
    () =>
      syncs.loading.value || models.loading.value || profileSyncs.loading.value
  )

  // One failure is enough to make the counts wrong, so the first one is
  // reported rather than three separate notices.
  const error = computed(
    () => syncs.error.value ?? models.error.value ?? profileSyncs.error.value
  )

  async function load() {
    await Promise.all([syncs.load(), models.load(), profileSyncs.load()])
  }

  function countIn(collection, id) {
    return collection.value.filter(r => r.dwhConnectionId === id).length
  }

  function usageFor(id) {
    const s = countIn(syncs.data, id)
    const m = countIn(models.data, id)
    const p = countIn(profileSyncs.data, id)
    return { syncs: s, models: m, profileSyncs: p, total: s + m + p }
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`
  }

  // Only the non-zero parts, so a connection nothing reads from renders as an
  // empty array and the caller can say "Not in use" in its own words.
  function usageParts(id) {
    const usage = usageFor(id)
    const parts = []
    if (usage.syncs) parts.push(plural(usage.syncs, 'sync'))
    if (usage.models) parts.push(plural(usage.models, 'model'))
    if (usage.profileSyncs)
      parts.push(plural(usage.profileSyncs, 'profile sync'))
    return parts
  }

  const totalDependants = computed(
    () =>
      syncs.data.value.length +
      models.data.value.length +
      profileSyncs.data.value.length
  )

  return { loading, error, load, usageFor, usageParts, totalDependants }
}
