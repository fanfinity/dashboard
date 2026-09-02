import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, ref } from 'vue'
import { useMockResource } from '@/composables/useMockResource'
import {
  formatCount,
  formatDateTime,
  formatDay
} from '@/composables/useMonitoringErrors'

/**
 * The reporting screen (`/reporting`) — volume over time, rolled up by source,
 * destination and pipe.
 *
 * - `data/reporting.json` is the **primary** resource: a 30-day window with
 *   totals, 30 daily buckets and the three rollups. Object-shaped, so it loads
 *   with `initial: {}`.
 * - `data/dashboard.json` is **secondary**, and only for the last-hour strip.
 *   Reporting and the dashboard home screen must agree, and the cheapest way to
 *   guarantee that is to read the same field rather than re-derive it: the
 *   strip prints `totalEventsLastHour`, `routedEventsLastHour` and
 *   `routingRate` verbatim. If it fails to load, the strip degrades in place
 *   with its own retry and the 30-day report is unaffected.
 *
 * Every figure on the screen is labelled with the window it belongs to. The
 * 30-day fan-out (1.64×) and the last-hour fan-out (1.71×) are different
 * numbers because they are different windows, not because one of them is wrong.
 */

const PERCENT = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

/**
 * A 0–1 ratio as `'98.64%'`. Em dash for a missing rate, which is what a
 * destination that has never been delivered to reports.
 *
 * @param {number|null|undefined} ratio
 * @returns {string}
 */
export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined) return NOT_KNOWN
  const value = Number(ratio)
  return Number.isFinite(value) ? PERCENT.format(value) : NOT_KNOWN
}

/**
 * A ratio as a fan-out multiple, `'1.64×'`.
 *
 * @param {number|null|undefined} ratio
 * @returns {string}
 */
export function formatMultiple(ratio) {
  const value = Number(ratio)
  return Number.isFinite(value) && value > 0
    ? `${value.toFixed(2)}×`
    : NOT_KNOWN
}

const RANGE_LABELS = {
  last_30_days: 'Last 30 days'
}

/**
 * Volume reporting for `/reporting`.
 *
 * @returns {object} `{ loading, error, load }` plus the derived reads and the
 *   `breakdown` tab ref the page binds to.
 *
 * @example
 * const { totals, rollupRows, loading, error, load } = useMonitoringReporting()
 * onMounted(load)
 */
export function useMonitoringReporting() {
  const {
    data,
    loading,
    error,
    load: loadReport
  } = useMockResource('reporting', { initial: {} })

  const {
    data: dashboard,
    loading: liveLoading,
    error: liveError,
    load: loadDashboard
  } = useMockResource('dashboard', { initial: {} })

  async function load() {
    await Promise.all([loadReport(), loadDashboard()])
  }

  const totals = computed(() => data.value.totals ?? {})
  const updatedAtLabel = computed(() => formatDateTime(data.value.updatedAt))

  const rangeLabel = computed(() => {
    const range = data.value.range ?? {}
    const preset = RANGE_LABELS[range.preset]
    const from = formatDay(range.from)
    const to = formatDay(range.to)
    if (from === NOT_KNOWN || to === NOT_KNOWN) return preset ?? ''
    return preset ? `${preset} · ${from} – ${to}` : `${from} – ${to}`
  })

  // ------------------------------------------------------------------ totals

  const fanOut = computed(() => {
    const ingested = Number(totals.value.eventsIngested) || 0
    const routed = Number(totals.value.eventsRouted) || 0
    return ingested ? routed / ingested : 0
  })

  const activeSources = computed(
    () => (data.value.bySource ?? []).filter(s => Number(s.events) > 0).length
  )

  const statCards = computed(() => {
    const t = totals.value
    return [
      {
        label: 'Events ingested',
        value: formatCount(t.eventsIngested),
        hint: `${formatCount(activeSources.value)} sources sent data in this window`
      },
      {
        label: 'Events routed',
        value: formatCount(t.eventsRouted),
        hint: `${formatMultiple(fanOut.value)} fan-out over the window`
      },
      {
        label: 'Profiles resolved',
        value: formatCount(t.profilesResolved),
        hint: `${formatCount(t.profilesDelivered)} delivered to activation targets`
      },
      {
        label: 'Delivery success rate',
        value: formatPercent(t.deliverySuccessRate),
        hint: `${formatCount(t.deliveryFailures)} failed deliveries`
      }
    ]
  })

  // ------------------------------------------------------------ volume series

  /** The 30 daily buckets, ready for an ApexCharts area pair. */
  const volume = computed(() => {
    const buckets = data.value.ingestionSeries ?? []
    return {
      categories: buckets.map(b => formatDay(b.bucket)),
      ingested: buckets.map(b => Number(b.ingested) || 0),
      routed: buckets.map(b => Number(b.routed) || 0)
    }
  })

  const peakDay = computed(() => {
    const buckets = data.value.ingestionSeries ?? []
    const top = buckets.reduce(
      (best, b) =>
        !best || Number(b.ingested) > Number(best.ingested) ? b : best,
      null
    )
    return top
      ? { label: formatDay(top.bucket), value: formatCount(top.ingested) }
      : null
  })

  // ---------------------------------------------------------------- rollups

  const breakdown = ref('source')

  const breakdownTabs = computed(() => [
    {
      key: 'source',
      label: 'By source',
      count: (data.value.bySource ?? []).length
    },
    {
      key: 'destination',
      label: 'By destination',
      count: (data.value.byDestination ?? []).length
    },
    { key: 'pipe', label: 'By pipe', count: (data.value.byPipe ?? []).length }
  ])

  /**
   * One row shape for all three rollups, so the table and the bar chart do not
   * each need a per-tab branch. `volume` stays numeric because `DataTable`
   * sorts on the raw cell value.
   */
  const rollupRows = computed(() => {
    if (breakdown.value === 'source') {
      return (data.value.bySource ?? []).map(row => ({
        id: row.id,
        name: row.name,
        volume: Number(row.events) || 0,
        volumeLabel: formatCount(row.events),
        shareLabel: formatPercent(row.share),
        failures: null,
        failuresLabel: '',
        rateLabel: ''
      }))
    }
    const rows =
      breakdown.value === 'destination'
        ? (data.value.byDestination ?? [])
        : (data.value.byPipe ?? [])

    return rows.map(row => {
      const deliveries = Number(row.deliveries) || 0
      const failures = Number(row.failures) || 0
      // `byPipe` ships no `successRate`; derive it so both tabs read the same.
      const rate =
        row.successRate ??
        (deliveries ? (deliveries - failures) / deliveries : null)
      return {
        id: row.id,
        name: row.name,
        volume: deliveries,
        volumeLabel: formatCount(deliveries),
        shareLabel: '',
        failures,
        failuresLabel: formatCount(failures),
        rateLabel: deliveries ? formatPercent(rate) : NOT_KNOWN
      }
    })
  })

  const rollupColumns = computed(() => {
    const name = { key: 'name', label: 'Name', sortable: true }
    const volume = {
      key: 'volume',
      label: breakdown.value === 'source' ? 'Events' : 'Deliveries',
      sortable: true,
      align: 'right',
      width: '160px'
    }
    if (breakdown.value === 'source') {
      return [
        name,
        volume,
        {
          key: 'shareLabel',
          label: 'Share of ingest',
          align: 'right',
          width: '160px'
        }
      ]
    }
    return [
      name,
      volume,
      {
        key: 'failures',
        label: 'Failed',
        sortable: true,
        align: 'right',
        width: '120px'
      },
      {
        key: 'rateLabel',
        label: 'Success rate',
        align: 'right',
        width: '150px'
      }
    ]
  })

  /** Only the rows with volume get a bar — six empty bars read as a fault. */
  const rollupChart = computed(() => {
    const active = rollupRows.value.filter(r => r.volume > 0)
    return {
      categories: active.map(r => r.name),
      data: active.map(r => r.volume),
      label: breakdown.value === 'source' ? 'Events' : 'Deliveries'
    }
  })

  const idleCount = computed(
    () => rollupRows.value.filter(r => !r.volume).length
  )

  // -------------------------------------------------------- last-hour strip

  /**
   * Read straight off `dashboard.json` so the two screens cannot drift. Nothing
   * here is recomputed.
   */
  const lastHour = computed(() => [
    {
      label: 'Events received',
      value: formatCount(dashboard.value.totalEventsLastHour)
    },
    {
      label: 'Events delivered',
      value: formatCount(dashboard.value.routedEventsLastHour)
    },
    {
      label: 'Fan-out',
      value: formatMultiple(dashboard.value.routingRate)
    }
  ])

  /** No volume at all in the window — a quiet month, not a fault. */
  const isEmpty = computed(
    () =>
      !loading.value &&
      !Number(totals.value.eventsIngested) &&
      !Number(totals.value.eventsRouted) &&
      !(data.value.bySource ?? []).length
  )

  return {
    loading,
    error,
    load,
    liveLoading,
    liveError,
    loadDashboard,
    totals,
    statCards,
    volume,
    peakDay,
    breakdown,
    breakdownTabs,
    rollupRows,
    rollupColumns,
    rollupChart,
    idleCount,
    lastHour,
    rangeLabel,
    updatedAtLabel,
    isEmpty
  }
}
