import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useMockResource } from '@/composables/useMockResource'

/**
 * The errors screen (`/errors`) — a log of delivery and transform failures.
 *
 * Two payloads, and the distinction matters for how failure is rendered:
 *
 * - `data/error-logs.json` is the **primary** resource. It is object-shaped
 *   (`{ errors, hasMore, nextCursor }`), so it loads with `initial: {}`.
 *   Without it the route has nothing to say, and its failure is the only one
 *   that escalates to a page-level `ErrorState`.
 * - `data/error-stats.json` is **secondary**: 24 hourly buckets by entity kind
 *   plus the two headline totals. If it fails the log still reads fine, so the
 *   chart panel degrades in place with its own retry.
 *
 * Note what is *not* an error here: eight logged failures is this screen
 * working. `ErrorState` renders `data-smoke="error"`, which is how the smoke
 * gate spots a broken route — so a populated error log must never reach for it.
 * "Nothing is failing" is an `EmptyState`, and a good outcome.
 *
 * Nothing is persisted. `acknowledge()` marks a row in local state and the page
 * toasts; a reload re-reads the JSON and the acknowledgement is gone.
 */

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
 * Thousands-separated integer, em dash for anything unparseable.
 *
 * @param {number|string|null|undefined} n
 * @returns {string}
 *
 * @example
 * formatCount(1204) // '1,204'
 * formatCount(null) // NOT_KNOWN
 */
export function formatCount(n) {
  if (n === null || n === undefined || n === '') return NOT_KNOWN
  const value = Number(n)
  return Number.isFinite(value) ? value.toLocaleString('en-GB') : NOT_KNOWN
}

/**
 * `'2026-07-31T05:48:31.900Z'` -> `'31 Jul 2026 · 05:48 UTC'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NOT_KNOWN
  return `${DATE.format(d)} · ${TIME.format(d)} UTC`
}

/**
 * `'2026-07-31T05:48:31.900Z'` -> `'05:48'`. Used for chart bucket labels.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : TIME.format(d)
}

/**
 * `'2026-07-31T05:48:31.900Z'` -> `'31 Jul'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDay(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? NOT_KNOWN : DATE.format(d)
}

// The nine entity kinds `error-stats.json` buckets by. Kept here rather than
// read off `errorConfig` so a row still labels itself when the stats payload —
// the secondary resource — did not load.
const CATEGORY_LABELS = {
  event_stream: 'Event stream',
  cloud_app: 'Cloud app',
  reverse_etl: 'Reverse ETL',
  pipe: 'Pipe',
  event_destination: 'Event destination',
  profile_destination: 'Profile destination',
  secrets: 'Secrets',
  profile_refresh: 'Profile refresh',
  dwh_sync: 'DWH sync'
}

const ENTITY_TYPE_LABELS = {
  source: 'Source',
  pipe: 'Pipe',
  event_destination: 'Destination',
  live_profile_sync: 'Live profile sync',
  profile_dwh_sync: 'Profile DWH sync',
  dwh_sync: 'DWH sync'
}

/** `'dwh_sync'` -> `'DWH sync'`, falling back to a de-underscored string. */
function labelFor(map, key) {
  if (!key) return NOT_KNOWN
  if (map[key]) return map[key]
  const words = String(key).replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const SEVERITY = {
  error: { label: 'Error', variant: 'danger' },
  warning: { label: 'Warning', variant: 'warn' }
}

/**
 * Badge shape for a row's severity. Unknown severities read as neutral rather
 * than as an error, so a new value from the backend cannot invent an incident.
 *
 * @param {string} severity
 * @returns {{ label: string, variant: string }}
 */
export function severityBadge(severity) {
  return (
    SEVERITY[severity] ?? { label: labelFor({}, severity), variant: 'neutral' }
  )
}

/**
 * One-line toast in the house style, carrying the caption every mutating screen
 * in the rebuild uses. Retrying a delivery and acknowledging an error both
 * change local state only, and the caption is what keeps that honest.
 * Must be called from `setup()` — it reaches for the Quasar instance.
 *
 * @returns {{ toast: (message: string) => void }}
 *
 * @example
 * const { toast } = useMonitoringToasts()
 * toast('Retry queued for Meta Conversions API')
 */
export function useMonitoringToasts() {
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
 * The errors screen's data, filters and local-only row actions.
 *
 * @returns {object} `{ loading, error, load }` plus the derived reads and the
 *   filter refs the page binds to.
 *
 * @example
 * const { rows, loading, error, load } = useMonitoringErrors()
 * onMounted(load)
 */
export function useMonitoringErrors() {
  const {
    data: log,
    loading,
    error,
    load: loadLog
  } = useMockResource('error-logs', { initial: {} })

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    load: loadStats
  } = useMockResource('error-stats', { initial: {} })

  async function load() {
    await Promise.all([loadLog(), loadStats()])
  }

  // ------------------------------------------------------------ local actions

  const acknowledged = ref(new Set())

  /** @param {string} id */
  function isAcknowledged(id) {
    return acknowledged.value.has(id)
  }

  /**
   * Marks one row as seen. Local only — there is no backend behind this screen,
   * so the page's toast says "in this session" and never claims a write.
   *
   * @param {string} id
   */
  function acknowledge(id) {
    const next = new Set(acknowledged.value)
    next.add(id)
    acknowledged.value = next
  }

  function clearAcknowledged() {
    acknowledged.value = new Set()
  }

  // ------------------------------------------------------------------ the log

  const hasMore = computed(() => Boolean(log.value.hasMore))
  const updatedAt = computed(() => stats.value.updatedAt ?? '')

  /**
   * One row per logged failure, pre-formatted. `occurredAt` stays an ISO string
   * because `DataTable` sorts on the raw cell value and ISO sorts
   * chronologically; the human string rides alongside as `occurredAtLabel`.
   */
  const rows = computed(() =>
    (log.value.errors ?? []).map(e => {
      const badge = severityBadge(e.severity)
      return {
        id: e.id,
        occurredAt: e.occurredAt ?? '',
        occurredAtLabel: formatDateTime(e.occurredAt),
        severity: e.severity ?? 'error',
        severityLabel: badge.label,
        severityVariant: badge.variant,
        category: e.category ?? '',
        categoryLabel: labelFor(CATEGORY_LABELS, e.category),
        code: e.code ?? '',
        message: e.message ?? '',
        entityId: e.entityId ?? '',
        entityName: e.entityName || e.entityId || 'Unknown entity',
        entityType: e.entityType ?? '',
        entityTypeLabel: labelFor(ENTITY_TYPE_LABELS, e.entityType),
        count: Number(e.count) || 0,
        countLabel: formatCount(e.count),
        // `context` is a free-form bag; flattened to label/value pairs so the
        // expanded row can hand it straight to DefinitionList.
        context: Object.entries(e.context ?? {}).map(([key, value]) => ({
          label: labelFor({}, key),
          value:
            typeof value === 'object' ? JSON.stringify(value) : String(value)
        })),
        // Only a hard failure offers a retry. A warning already resolved itself
        // — 44 skipped rows are not going to be re-delivered by a button.
        canRetry: e.severity === 'error'
      }
    })
  )

  // ------------------------------------------------------------------ filters

  const query = ref('')
  const severity = ref('all')
  const category = ref('all')
  const entityId = ref('')

  const hasFilters = computed(
    () =>
      Boolean(query.value.trim()) ||
      severity.value !== 'all' ||
      category.value !== 'all' ||
      Boolean(entityId.value)
  )

  function clearFilters() {
    query.value = ''
    severity.value = 'all'
    category.value = 'all'
    entityId.value = ''
  }

  const severityTabs = computed(() => [
    { key: 'all', label: 'All', count: rows.value.length },
    {
      key: 'error',
      label: 'Errors',
      count: rows.value.filter(r => r.severity === 'error').length
    },
    {
      key: 'warning',
      label: 'Warnings',
      count: rows.value.filter(r => r.severity === 'warning').length
    }
  ])

  /** `q-select` options for the entity-kind filter, built from what is logged. */
  const categoryOptions = computed(() => {
    const seen = new Map()
    for (const row of rows.value) {
      if (row.category && !seen.has(row.category)) {
        seen.set(row.category, row.categoryLabel)
      }
    }
    return [
      { label: 'All entity kinds', value: 'all' },
      ...[...seen].map(([value, label]) => ({ label, value }))
    ]
  })

  const filteredRows = computed(() => {
    const q = query.value.trim().toLowerCase()
    return rows.value.filter(row => {
      if (severity.value !== 'all' && row.severity !== severity.value) {
        return false
      }
      if (category.value !== 'all' && row.category !== category.value) {
        return false
      }
      if (entityId.value && row.entityId !== entityId.value) return false
      if (!q) return true
      return [row.message, row.code, row.entityName, row.categoryLabel].some(
        field => field.toLowerCase().includes(q)
      )
    })
  })

  /** Label for the "filtered to one entity" chip, or `''` when unset. */
  const entityFilterLabel = computed(() => {
    if (!entityId.value) return ''
    const match = rows.value.find(r => r.entityId === entityId.value)
    return match ? match.entityName : entityId.value
  })

  // ------------------------------------------------------- grouped by entity

  /**
   * One row per failing entity: the "which thing is broken" read of the same
   * log. Clicking one filters the flat list back down to it.
   */
  const entityRows = computed(() => {
    const groups = new Map()
    for (const row of rows.value) {
      const existing = groups.get(row.entityId)
      if (existing) {
        existing.errors += row.severity === 'error' ? 1 : 0
        existing.warnings += row.severity === 'warning' ? 1 : 0
        existing.occurrences += row.count
        if (row.occurredAt > existing.lastSeen) {
          existing.lastSeen = row.occurredAt
          existing.lastSeenLabel = row.occurredAtLabel
          existing.lastCode = row.code
        }
      } else {
        groups.set(row.entityId, {
          id: row.entityId,
          entityName: row.entityName,
          entityTypeLabel: row.entityTypeLabel,
          categoryLabel: row.categoryLabel,
          errors: row.severity === 'error' ? 1 : 0,
          warnings: row.severity === 'warning' ? 1 : 0,
          occurrences: row.count,
          lastSeen: row.occurredAt,
          lastSeenLabel: row.occurredAtLabel,
          lastCode: row.code
        })
      }
    }
    return [...groups.values()]
      .map(g => ({ ...g, occurrencesLabel: formatCount(g.occurrences) }))
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
  })

  // -------------------------------------------------------------------- stats

  const totalLastHour = computed(() => Number(stats.value.totalErrorsLastHour))
  const totalLast24Hours = computed(() =>
    Number(stats.value.totalErrorsLast24Hours)
  )

  /** The single loudest row — the one issue worth opening first. */
  const loudest = computed(() =>
    rows.value.reduce(
      (worst, row) => (!worst || row.count > worst.count ? row : worst),
      null
    )
  )

  const statCards = computed(() => {
    const entities = entityRows.value.length
    const kinds = new Set(rows.value.map(r => r.category)).size
    const top = loudest.value
    return [
      {
        label: 'Errors in the last hour',
        value: Number.isFinite(totalLastHour.value)
          ? formatCount(totalLastHour.value)
          : NOT_KNOWN,
        hint: 'Across every entity kind'
      },
      {
        label: 'Errors in the last 24 hours',
        value: Number.isFinite(totalLast24Hours.value)
          ? formatCount(totalLast24Hours.value)
          : NOT_KNOWN,
        hint: 'Hourly breakdown below'
      },
      {
        label: 'Entities affected',
        value: formatCount(entities),
        hint: `${formatCount(rows.value.length)} failures logged · ${formatCount(kinds)} kinds`
      },
      {
        label: 'Loudest issue',
        value: top ? top.countLabel : NOT_KNOWN,
        hint: top ? `${top.code} on ${top.entityName}` : 'Nothing logged'
      }
    ]
  })

  // -------------------------------------------------------------------- trend

  /**
   * The 24 hourly buckets as an ApexCharts-ready stack: one series per entity
   * kind, coloured by the `errorConfig` tokens. Falls back to the keys on the
   * first bucket when the config is absent.
   */
  const trend = computed(() => {
    const buckets = stats.value.errorSeries ?? []
    const config =
      stats.value.errorConfig ??
      Object.keys(buckets[0] ?? {})
        .filter(k => k !== 'bucket')
        .map(key => ({ key, label: labelFor(CATEGORY_LABELS, key), color: '' }))

    return {
      categories: buckets.map(b => formatTime(b.bucket)),
      series: config.map(c => ({
        name: c.label,
        data: buckets.map(b => Number(b[c.key]) || 0)
      })),
      colors: config.map(c => c.color)
    }
  })

  /** True once the log has loaded and holds nothing. Good news, not a fault. */
  const isEmpty = computed(() => !loading.value && !rows.value.length)

  return {
    loading,
    error,
    load,
    statsLoading,
    statsError,
    loadStats,
    rows,
    filteredRows,
    entityRows,
    statCards,
    trend,
    hasMore,
    updatedAt,
    totalLastHour,
    totalLast24Hours,
    isEmpty,
    query,
    severity,
    category,
    entityId,
    entityFilterLabel,
    severityTabs,
    categoryOptions,
    hasFilters,
    clearFilters,
    acknowledge,
    isAcknowledged,
    clearAcknowledged
  }
}
