import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, ref } from 'vue'
import { getDashboardOverview } from '@/api/fanfinity'
import { ApiError } from '@/api/mutator'
import { useDataSource } from '@/composables/useDataSource'
import { useDiagram } from '@/composables/useDiagram'
import { currentAccount, waitForAccount } from '@/composables/useMe'
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
  return Number.isFinite(n) ? INTEGER.format(n) : NOT_KNOWN
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

/** track events are named by their payload; page/identify by their kind. */
function liveEventName(ev) {
  if (ev.type === 'track') return ev.event?.event || ev.type
  return ev.type || 'event'
}

/**
 * `GET /v1/accounts/{id}/dashboard` → the `data/dashboard.json` shape the
 * derived computeds below read, so `totalPerBucket`/`trend`/`stats` need no
 * real-mode variant. The backend's per-minute buckets become one-key series
 * arrays, and its recent LiveEvents become the activity-list entries.
 */
function overviewToDashboard(o) {
  const received = Number(o.totals?.events_received) || 0
  // Delivered stays null when ClickHouse was unavailable — the stat card
  // then renders an em dash instead of a fake zero.
  const delivered = o.totals?.events_delivered ?? null
  const sourceNames = new Map((o.sources ?? []).map(s => [s.id, s.name]))
  return {
    updatedAt: o.updated_at,
    totalEventsLastHour: received,
    routedEventsLastHour: delivered,
    errorsLastHour: Number(o.totals?.errors) || 0,
    routingRate: received ? (delivered ?? 0) / received : 0,
    sourceSeries: (o.buckets ?? []).map(b => ({
      bucket: b.bucket,
      received: b.received
    })),
    routedSeries: (o.buckets ?? []).map(b => ({
      bucket: b.bucket,
      delivered: b.delivered ?? 0
    })),
    lastEvents: (o.recent_events ?? []).map(ev => ({
      id: ev.id,
      eventName: liveEventName(ev),
      sourceName: sourceNames.get(ev.source_id) || ev.site_id || '',
      occurredAt: ev.date
    })),
    // The backend has no profile pipeline yet — honest zeros, not mock numbers.
    lastProfiles: [],
    profilesRefreshedLastHour: 0,
    profilesRoutedLastHour: 0,
    activeLiveProfileSyncsLastHour: 0,
    failedProfileDeliveriesLastHour: 0
  }
}

/**
 * Overview → the `useDiagram().nodes` adjacency shape the flow columns and
 * the needs-attention list read. Per-pipe delivery counts don't exist on the
 * backend (several pipes can feed one destination), so a pipe borrows its
 * destination's count — tone then reads "this pipe's destination is moving".
 */
function overviewToNodes(o) {
  const pipes = o.pipes ?? []
  const sources = (o.sources ?? []).map(s => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    sourceType: s.source_type,
    isEnabled: s.is_enabled,
    eventCountLastHour: s.events_received,
    pipes: pipes.filter(p => p.source_id === s.id)
  }))
  const destinations = (o.destinations ?? []).map(d => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    // Carried through for the topology's glyph. `DashboardDestinationStat` has
    // it and the flow columns never needed it, which is why it was dropped here
    // originally — a node with no type draws the generic mark.
    destinationType: d.destination_type,
    isEnabled: d.is_enabled,
    deliveryCountLastHour: d.events_delivered ?? 0,
    pipes: pipes.filter(p => p.destination_id === d.id)
  }))
  const sourceById = new Map(sources.map(s => [s.id, s]))
  const destinationById = new Map(destinations.map(d => [d.id, d]))
  const links = pipes
    .map(p => {
      const source = sourceById.get(p.source_id)
      const destination = destinationById.get(p.destination_id)
      if (!source || !destination) return null
      return {
        pipe: {
          id: p.id,
          name: p.name,
          isEnabled: p.is_enabled,
          deliveryCountLastHour: destination.deliveryCountLastHour
        },
        source,
        destination
      }
    })
    .filter(Boolean)
  return { sources, destinations, links }
}

/** Overview errors (LiveEvent records) → the `error-logs.json` entry shape. */
function overviewToErrors(o) {
  const sourceNames = new Map((o.sources ?? []).map(s => [s.id, s.name]))
  return (o.recent_errors ?? []).map(ev => ({
    id: ev.id,
    occurredAt: ev.date,
    severity: 'error',
    code: ev.status || 'ingest_error',
    message: ev.error || 'Event was not ingested cleanly.',
    entityName: sourceNames.get(ev.source_id) || ev.site_id || ''
  }))
}

/**
 * Everything the dashboard home screen needs.
 *
 * In real mode (Settings → Data source) one aggregate endpoint feeds the whole
 * screen — `GET /v1/accounts/{id}/dashboard` via the generated client — and
 * the adapters above reshape it into the mock payloads' shapes. In mock mode
 * the three bundled files are read as before:
 *
 * - `data/dashboard.json`      headline counters + the 60 one-minute buckets
 * - `data/pipes-diagram.json`  sources / pipes / destinations, already resolved
 * - `data/error-logs.json`     the most recent failures
 *
 * Follows the repo composable contract: `{ loading, error, apiMissing, load() }`
 * plus the derived reads. `load()` never throws, and — same reading as
 * `useMockResource` — a 404 or a request that never reached the backend sets
 * `apiMissing` (the screen shows its empty state) rather than `error`.
 *
 * @example
 * const home = useDashboardHome()
 * onMounted(home.load)
 */
export function useDashboardHome() {
  const { isReal } = useDataSource()

  const {
    data: mockDashboard,
    loading: dashboardLoading,
    error: dashboardError,
    load: loadDashboard
    // No `api` here on purpose. This resource is read in mock mode only: real
    // mode is served by loadReal() below, which calls the one aggregate
    // endpoint that actually exists (GET /v1/accounts/{id}/dashboard) and
    // adapts it into this same shape. Wiring a second path here would declare
    // an endpoint nothing calls.
  } = useMockResource('dashboard', { initial: {} })

  const {
    nodes: mockNodes,
    loading: diagramLoading,
    error: diagramError,
    load: loadDiagram
  } = useDiagram()

  const {
    data: mockErrors,
    loading: errorsLoading,
    error: errorsError,
    load: loadErrors
    // Mock mode only, same reason as `dashboard` above — in real mode the
    // recent failures come out of the dashboard overview's own error rows.
  } = useMockResource('error-logs', { select: payload => payload.errors })

  // ---------------------------------------------------------------- real mode

  const overview = ref(null)
  const realLoading = ref(false)
  const realError = ref(null)
  const apiMissing = ref(false)

  async function loadReal() {
    realLoading.value = true
    realError.value = null
    try {
      await waitForAccount()
      const id = currentAccount.value?.id
      if (!id) {
        apiMissing.value = true
        overview.value = null
        return
      }
      const { data } = await getDashboardOverview(id, { minutes: 60 })
      overview.value = data
    } catch (e) {
      // Same reading as useMockResource: a 404 or a request that never
      // reached the backend means "not deployed here yet", not a fault —
      // only a real non-404 response earns the ErrorState.
      if (e instanceof ApiError && e.status !== 404) {
        realError.value = e.message
      } else {
        apiMissing.value = true
      }
      overview.value = null
    } finally {
      realLoading.value = false
    }
  }

  // The derived computeds below all read these three — in real mode they are
  // the adapted overview, in mock mode the bundled files, so everything
  // downstream is mode-agnostic.
  const dashboard = computed(() => {
    if (!isReal.value) return mockDashboard.value
    return overview.value ? overviewToDashboard(overview.value) : {}
  })

  const nodes = computed(() => {
    if (!isReal.value) return mockNodes.value
    return overview.value
      ? overviewToNodes(overview.value)
      : { sources: [], destinations: [], links: [] }
  })

  const recentErrors = computed(() => {
    if (!isReal.value) return mockErrors.value
    return overview.value ? overviewToErrors(overview.value) : []
  })

  const loading = computed(() =>
    isReal.value
      ? realLoading.value
      : dashboardLoading.value || diagramLoading.value || errorsLoading.value
  )

  const error = computed(() =>
    isReal.value
      ? realError.value
      : dashboardError.value || diagramError.value || errorsError.value || null
  )

  async function load() {
    apiMissing.value = false
    if (isReal.value) {
      await loadReal()
    } else {
      await Promise.all([loadDashboard(), loadDiagram(), loadErrors()])
    }
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

  /**
   * Delivered ÷ received as a PERCENTAGE, or null when the question cannot be
   * answered.
   *
   * SEPARATE FROM `routingRate` ABOVE, and both are correct for their own
   * caller. `routingRate` is a 0..1 fraction that coerces a missing numerator to
   * zero, which is right for the throughput chart's fan-out line — a chart with
   * a hole in it is worse than a chart reading zero, and the series beside it
   * already shows there was no delivery data.
   *
   * A STAT CARD CANNOT DO THAT. `DashboardTotals.events_delivered` is explicitly
   * nullable — "null when the analytics store is unavailable" — so the same
   * coercion would print a confident `0.0%` on a healthy account whose
   * ClickHouse read failed, i.e. "your delivery is completely broken" as a
   * measured-sounding fact. Null here means the caller prints NOT_KNOWN.
   *
   * Zero received also returns null rather than 100% or 0%: a success rate over
   * no attempts is not a number.
   */
  const deliverySuccess = computed(() => {
    const received = Number(dashboard.value.totalEventsLastHour) || 0
    const delivered = dashboard.value.routedEventsLastHour
    if (!received || delivered == null) return null
    return (Number(delivered) / received) * 100
  })
  const updatedAt = computed(() => dashboard.value.updatedAt ?? '')

  /** First run: nothing configured at all. Not the same as "nothing flowing". */
  const isEmpty = computed(
    () =>
      !flow.value.sources.total &&
      !flow.value.pipes.total &&
      !flow.value.destinations.total
  )

  /**
   * The three arrays the Dashboard's topology draws, in FlowTopology's prop
   * shape.
   *
   * DERIVED HERE RATHER THAN IN THE PAGE so it reads the `nodes` this composable
   * has already loaded. The alternative — a second `useDiagram()` in
   * DashboardHomePage — would fetch the same endpoint twice on every visit to
   * Home, and in real mode would fetch a DIFFERENT one: this composable answers
   * `nodes` out of the dashboard aggregate in real mode and out of the diagram
   * fixture in Demo, and a page-side `useDiagram()` would always read the
   * diagram, so the picture and the stat cards beside it could disagree.
   *
   * `status` IS DERIVED FROM WHAT IS MEASURED, and only that. The dashboard
   * aggregate carries no `Status5` field, but it does carry per-source
   * `events_received` and per-destination `events_delivered`, which is enough
   * for the only distinction the picture makes: switched off, receiving, or on
   * and silent. A node whose count is genuinely absent reports `idle` — "nothing
   * is moving" — rather than `healthy`, because claiming health from a
   * measurement nobody took is exactly the confident-zero this repo keeps
   * removing.
   */
  const topology = computed(() => {
    const { sources, destinations, links } = nodes.value

    const nodeStatus = (isEnabled, volume) => {
      if (!isEnabled) return 'idle'
      return Number(volume) > 0 ? 'healthy' : 'idle'
    }

    return {
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        subtype: s.sourceType ?? '',
        hint: `${s.pipes.length} pipe${s.pipes.length === 1 ? '' : 's'}`,
        isEnabled: s.isEnabled !== false,
        status: nodeStatus(s.isEnabled, s.eventCountLastHour),
        to: { name: 'sources-detail', params: { id: s.id } }
      })),
      destinations: destinations.map(d => ({
        id: d.id,
        name: d.name,
        subtype: d.destinationType ?? '',
        hint: `${d.pipes.length} pipe${d.pipes.length === 1 ? '' : 's'}`,
        isEnabled: d.isEnabled !== false,
        status: nodeStatus(d.isEnabled, d.deliveryCountLastHour),
        to: { name: 'destinations-detail', params: { id: d.id } }
      })),
      links: links.map(({ pipe, source, destination }) => ({
        id: pipe.id,
        sourceId: source.id,
        destinationId: destination.id,
        isEnabled: pipe.isEnabled !== false,
        status: nodeStatus(pipe.isEnabled, pipe.deliveryCountLastHour)
      }))
    }
  })

  return {
    loading,
    error,
    apiMissing,
    load,
    stats,
    throughput,
    flow,
    columns,
    topology,
    deliverySuccess,
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
