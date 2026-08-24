import { computed } from 'vue'
import { useDiagram } from '@/composables/useDiagram'
import { useMockResource } from '@/composables/useMockResource'

const INTEGER = new Intl.NumberFormat('en-US')

/**
 * `12345` -> `'12,345'`. Anything non-numeric becomes an em dash rather than
 * `NaN`, because several mock payloads ship counts as strings
 * (`error-stats.json` does) and a home screen must never render `NaN`.
 *
 * @param {*} value
 * @returns {string}
 */
export function formatNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? INTEGER.format(n) : '—'
}

/**
 * ISO timestamp -> `'05:48'`. Empty string when unparseable.
 *
 * @param {string} iso
 * @returns {string}
 */
export function formatClock(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * ISO timestamp -> `'4m ago'`. Future timestamps clamp to `'just now'` so a
 * machine clock behind the mock data cannot render `-3m ago`.
 *
 * @param {string} iso
 * @param {number} [now]
 * @returns {string}
 */
export function formatAgo(iso, now = Date.now()) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const seconds = Math.floor((now - t) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * The series keys for one of `dashboard.json`'s bucket arrays. Each array has a
 * sibling `*Config` listing `{ key, label, color }`; when that is missing we
 * fall back to every key on the first bucket except `bucket` itself.
 */
function seriesKeys(series, config) {
  if (Array.isArray(config) && config.length) return config.map(c => c.key)
  const first = series[0]
  return first ? Object.keys(first).filter(k => k !== 'bucket') : []
}

/** Collapses a multi-series bucket array into one total per bucket. */
function totalPerBucket(series, config) {
  const keys = seriesKeys(series, config)
  return series.map(bucket =>
    keys.reduce((total, key) => total + (Number(bucket[key]) || 0), 0)
  )
}

/**
 * Second half of the window vs. the first half, as a StatCard delta. This is
 * the only trend the mock data supports honestly — there is no prior-period
 * payload, so we compare within the 60 buckets we have.
 */
function trend(values) {
  if (values.length < 4) return { delta: '', direction: 'flat' }
  const half = Math.floor(values.length / 2)
  const before = values.slice(0, half).reduce((a, b) => a + b, 0)
  const after = values.slice(half).reduce((a, b) => a + b, 0)
  if (!before) return { delta: '', direction: 'flat' }
  const pct = ((after - before) / before) * 100
  if (Math.abs(pct) < 0.5) return { delta: '0%', direction: 'flat' }
  return {
    delta: `${Math.abs(pct).toFixed(1)}%`,
    direction: pct > 0 ? 'up' : 'down'
  }
}

/** Flow-column node tone: green flowing, amber configured-but-idle, grey off. */
function tone(enabled, volume) {
  if (!enabled) return 'off'
  return volume > 0 ? 'flowing' : 'idle'
}

/**
 * Everything the dashboard home screen needs, from three mock payloads:
 *
 * - `data/dashboard.json`      headline counters + the 60 one-minute buckets
 * - `data/pipes-diagram.json`  sources / pipes / destinations, already resolved
 * - `data/error-logs.json`     the most recent failures
 *
 * Follows the repo composable contract: `{ loading, error, load() }` plus the
 * derived reads. `load()` never throws — each underlying composable normalises
 * its own failure — and `error` surfaces the first one so the page can render a
 * single `ErrorState` with a working retry.
 *
 * @example
 * const home = useDashboardHome()
 * onMounted(home.load)
 */
export function useDashboardHome() {
  const {
    data: dashboard,
    loading: dashboardLoading,
    error: dashboardError,
    load: loadDashboard
  } = useMockResource('dashboard', {
    initial: {},
    api: { path: '/v1/dashboard' }
  })

  const {
    nodes,
    loading: diagramLoading,
    error: diagramError,
    load: loadDiagram
  } = useDiagram()

  const {
    data: recentErrors,
    loading: errorsLoading,
    error: errorsError,
    load: loadErrors
  } = useMockResource('error-logs', {
    select: payload => payload.errors,
    api: { path: '/v1/errors', select: payload => payload.items }
  })

  const loading = computed(
    () => dashboardLoading.value || diagramLoading.value || errorsLoading.value
  )

  const error = computed(
    () =>
      dashboardError.value || diagramError.value || errorsError.value || null
  )

  async function load() {
    await Promise.all([loadDashboard(), loadDiagram(), loadErrors()])
  }

  // ---------------------------------------------------------------- throughput

  const throughput = computed(() => {
    const received = totalPerBucket(
      dashboard.value.sourceSeries ?? [],
      dashboard.value.sourceConfig
    )
    const delivered = totalPerBucket(
      dashboard.value.routedSeries ?? [],
      dashboard.value.routedConfig
    )
    const labels = (dashboard.value.sourceSeries ?? []).map(b =>
      formatClock(b.bucket)
    )
    return { labels, received, delivered }
  })

  // ---------------------------------------------------------------------- flow

  function column(title, routeName, items) {
    return {
      title,
      routeName,
      total: items.length,
      enabled: items.filter(i => i.enabled).length,
      flowing: items.filter(i => i.tone === 'flowing').length,
      items
    }
  }

  const flow = computed(() => {
    const { sources, destinations, links } = nodes.value

    const sourceItems = sources.map(s => ({
      id: s.id,
      name: s.name,
      enabled: s.isEnabled,
      volume: Number(s.eventCountLastHour) || 0,
      meta: `${s.pipes.length} pipe${s.pipes.length === 1 ? '' : 's'}`,
      tone: tone(s.isEnabled, Number(s.eventCountLastHour) || 0)
    }))

    const pipeItems = links.map(({ pipe, source, destination }) => ({
      id: pipe.id,
      name: pipe.name || `${source.name} → ${destination.name}`,
      enabled: pipe.isEnabled,
      volume: Number(pipe.deliveryCountLastHour) || 0,
      meta: `${source.name} → ${destination.name}`,
      tone: tone(pipe.isEnabled, Number(pipe.deliveryCountLastHour) || 0)
    }))

    const destinationItems = destinations.map(d => ({
      id: d.id,
      name: d.name,
      enabled: d.isEnabled,
      volume: Number(d.deliveryCountLastHour) || 0,
      meta: `${d.pipes.length} pipe${d.pipes.length === 1 ? '' : 's'}`,
      tone: tone(d.isEnabled, Number(d.deliveryCountLastHour) || 0)
    }))

    return {
      sources: column('Sources', 'sources', sourceItems),
      pipes: column('Pipes', 'pipes', pipeItems),
      destinations: column('Destinations', 'destinations', destinationItems)
    }
  })

  const columns = computed(() => [
    flow.value.sources,
    flow.value.pipes,
    flow.value.destinations
  ])

  // --------------------------------------------------------------------- stats

  const stats = computed(() => {
    const d = dashboard.value
    const receivedTrend = trend(throughput.value.received)
    const deliveredTrend = trend(throughput.value.delivered)

    const events = Number(d.totalEventsLastHour) || 0
    const errors = Number(d.errorsLastHour) || 0
    const errorRate = events ? (errors / events) * 100 : 0

    return [
      {
        label: 'Events received (last hour)',
        value: formatNumber(d.totalEventsLastHour),
        delta: receivedTrend.delta,
        deltaDirection: receivedTrend.direction
      },
      {
        label: 'Events delivered (last hour)',
        value: formatNumber(d.routedEventsLastHour),
        delta: deliveredTrend.delta,
        deltaDirection: deliveredTrend.direction
      },
      {
        label: 'Active pipes',
        value: `${flow.value.pipes.enabled} of ${flow.value.pipes.total}`,
        delta: '',
        deltaDirection: 'flat'
      },
      // The error count is a caption, not a trend: `delta` would draw a red
      // down-arrow in front of it, claiming a movement nothing here measures.
      {
        label: 'Error rate (last hour)',
        value: `${errorRate.toFixed(2)}%`,
        delta: '',
        deltaDirection: 'flat',
        hint: errors ? `${formatNumber(errors)} errors` : ''
      }
    ]
  })

  /**
   * Enabled-but-not-moving. Disabled things are deliberately off and are shown
   * greyed in the flow columns instead — nagging about them would train people
   * to ignore this list.
   */
  const attention = computed(() => {
    const { sources, destinations } = nodes.value
    const items = []

    for (const s of sources) {
      if (s.isEnabled && !s.pipes.length) {
        items.push({
          id: `src-orphan-${s.id}`,
          title: s.name,
          detail: 'Enabled, but not connected to any pipe.',
          severity: 'warning'
        })
      } else if (s.isEnabled && !(Number(s.eventCountLastHour) > 0)) {
        items.push({
          id: `src-idle-${s.id}`,
          title: s.name,
          detail: 'Enabled, but no events received in the last hour.',
          severity: 'warning'
        })
      }
    }

    for (const d of destinations) {
      if (d.isEnabled && !d.pipes.length) {
        items.push({
          id: `dst-orphan-${d.id}`,
          title: d.name,
          detail: 'Enabled, but no pipe delivers to it.',
          severity: 'warning'
        })
      } else if (d.isEnabled && !(Number(d.deliveryCountLastHour) > 0)) {
        items.push({
          id: `dst-idle-${d.id}`,
          title: d.name,
          detail: 'Enabled, but nothing delivered in the last hour.',
          severity: 'warning'
        })
      }
    }

    return items
  })

  // -------------------------------------------------------------- side panels

  const recentEvents = computed(() => dashboard.value.lastEvents ?? [])
  const recentProfiles = computed(() => dashboard.value.lastProfiles ?? [])

  const topErrors = computed(() =>
    [...recentErrors.value]
      .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
      .slice(0, 5)
  )

  const profileStats = computed(() => ({
    refreshed: Number(dashboard.value.profilesRefreshedLastHour) || 0,
    routed: Number(dashboard.value.profilesRoutedLastHour) || 0,
    liveSyncs: Number(dashboard.value.activeLiveProfileSyncsLastHour) || 0,
    failedDeliveries:
      Number(dashboard.value.failedProfileDeliveriesLastHour) || 0
  }))

  const routingRate = computed(() => Number(dashboard.value.routingRate) || 0)
  const updatedAt = computed(() => dashboard.value.updatedAt ?? '')

  /** First run: nothing configured at all. Not the same as "nothing flowing". */
  const isEmpty = computed(
    () =>
      !flow.value.sources.total &&
      !flow.value.pipes.total &&
      !flow.value.destinations.total
  )

  return {
    loading,
    error,
    load,
    stats,
    throughput,
    flow,
    columns,
    attention,
    recentEvents,
    recentProfiles,
    recentErrors,
    topErrors,
    profileStats,
    routingRate,
    updatedAt,
    isEmpty
  }
}
