import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'
import { formatCount, formatDateTime } from '@/composables/useMonitoringErrors'

/**
 * The health screen (`/health`) — "is the pipeline keeping up?".
 *
 * One payload, `data/health-queues.json`, object-shaped so it loads with
 * `initial: {}`: four queue depths plus the recent worker heartbeat runs.
 *
 * Two deliberate choices about honesty:
 *
 * 1. **Ages are measured against the payload's own `updatedAt`, not the wall
 *    clock.** The mock data is fixed in time; `Date.now()` would drift away
 *    from it and render "waiting 4 days", which is nonsense and makes every
 *    screenshot different.
 * 2. **`processedLastMinute` is reported as-is and never extrapolated.** It is
 *    a per-queue worker throughput, not pipeline volume, and multiplying it out
 *    to an hourly figure would put a number on screen that disagrees with the
 *    dashboard's `totalEventsLastHour`.
 *
 * A degraded queue or a failed check is information, not a fetch failure — it
 * renders as a `NoticeBanner` and a `StatusBadge`. Only the fetch itself
 * failing reaches `ErrorState`.
 */

// Pipeline order, which is also reading order on the page: an event is resolved
// onto a profile, delivered to its destinations, then the profile it touched is
// recomputed and pushed to the activation targets.
const STAGES = [
  {
    key: 'identityResolution',
    title: 'Identity resolution',
    description:
      'Incoming events wait here while their identifiers are stitched onto the right fan profile.'
  },
  {
    key: 'eventDeliveries',
    title: 'Event delivery',
    description:
      'Resolved events queue for delivery to every destination their pipe routes them to.'
  },
  {
    key: 'profileRefresh',
    title: 'Profile refresh',
    description:
      'Profiles whose attributes moved are recomputed before they can be activated again.'
  },
  {
    key: 'profileDeliveries',
    title: 'Profile delivery',
    description:
      'Refreshed profiles wait to be pushed to live syncs and audience destinations.'
  }
]

const RUN_STATUS = {
  success: { label: 'Passed', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'warn' },
  failed: { label: 'Failed', variant: 'danger' }
}

/**
 * A duration in seconds as a short human string.
 *
 * @param {number|null} seconds
 * @returns {string}
 *
 * @example
 * formatDuration(19)  // '19s'
 * formatDuration(178) // '2m 58s'
 */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '—'
  }
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

/**
 * Milliseconds as `'1.99s'` / `'420ms'`, for a heartbeat run's duration.
 *
 * @param {number|null|undefined} ms
 * @returns {string}
 */
export function formatMillis(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value)) return '—'
  return value < 1000
    ? `${Math.round(value)}ms`
    : `${(value / 1000).toFixed(1)}s`
}

/**
 * Heartbeat `content` arrives as a small markdown blob whose first line is
 * always a `###` heading repeating the screen's own title. The heading is
 * dropped and the rest split into paragraphs — enough structure for a read-out
 * without pulling in a markdown renderer for four strings.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function summaryParagraphs(content) {
  return String(content ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
}

/**
 * Where a queue sits: clear, keeping up, falling behind, backed up, or stalled.
 * Thresholds are in "minutes to drain at the current rate", which is the thing
 * an operator actually wants to know.
 */
function queueStatus(count, processedLastMinute, drainMinutes) {
  if (!count) {
    return {
      variant: 'success',
      label: 'Clear',
      note: 'Nothing is waiting. The stage is caught up.'
    }
  }
  if (!processedLastMinute) {
    return {
      variant: 'danger',
      label: 'Stalled',
      note: 'Items are waiting but nothing was processed in the last minute.'
    }
  }
  if (drainMinutes < 1) {
    return {
      variant: 'success',
      label: 'Keeping up',
      note: 'The backlog clears in under a minute at the current rate.'
    }
  }
  if (drainMinutes < 5) {
    return {
      variant: 'warn',
      label: 'Falling behind',
      note: `The backlog needs about ${formatDuration(drainMinutes * 60)} to clear at the current rate.`
    }
  }
  return {
    variant: 'danger',
    label: 'Backed up',
    note: `The backlog needs about ${formatDuration(drainMinutes * 60)} to clear at the current rate.`
  }
}

/**
 * Queue depths and worker heartbeats for the health screen.
 *
 * @returns {object} `{ loading, error, load }` plus the derived read-outs.
 *
 * @example
 * const { stages, loading, error, load } = useMonitoringHealth()
 * onMounted(load)
 */
export function useMonitoringHealth() {
  const { data, loading, error, load } = useMockResource('health-queues', {
    initial: {}
  })

  const updatedAt = computed(() => data.value.updatedAt ?? '')
  const updatedAtLabel = computed(() => formatDateTime(updatedAt.value))

  /** The payload's own clock, so ages do not drift with the wall clock. */
  const referenceTime = computed(() => {
    const t = new Date(updatedAt.value).getTime()
    return Number.isNaN(t) ? null : t
  })

  function ageSeconds(iso) {
    if (!iso || referenceTime.value === null) return null
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return null
    return Math.max(0, (referenceTime.value - t) / 1000)
  }

  const stages = computed(() => {
    const queues = data.value.queues ?? {}
    return STAGES.filter(stage => queues[stage.key]).map((stage, index) => {
      const queue = queues[stage.key]
      const count = Number(queue.count) || 0
      const processed = Number(queue.processedLastMinute) || 0
      const drainMinutes = processed ? count / processed : Infinity
      const waiting = ageSeconds(queue.oldestAt)
      const status = queueStatus(count, processed, drainMinutes)
      return {
        id: stage.key,
        step: index + 1,
        title: stage.title,
        description: stage.description,
        count,
        countLabel: formatCount(count),
        processed,
        processedLabel: formatCount(processed),
        oldestAt: queue.oldestAt ?? null,
        waitingSeconds: waiting,
        waitingLabel: count ? formatDuration(waiting) : 'No backlog',
        statusVariant: status.variant,
        statusLabel: status.label,
        note: status.note
      }
    })
  })

  const runs = computed(() =>
    (data.value.heartbeat?.runs ?? []).map(run => {
      const status = RUN_STATUS[run.status] ?? {
        label: 'Unknown',
        variant: 'neutral'
      }
      return {
        id: run.id,
        status: run.status,
        statusLabel: status.label,
        statusVariant: status.variant,
        model: run.model ?? '',
        startedAt: run.startedAt ?? '',
        startedAtLabel: formatDateTime(run.startedAt),
        durationLabel: formatMillis(run.durationMs),
        paragraphs: summaryParagraphs(run.content),
        errorMessage: run.error ?? ''
      }
    })
  )

  const hasMoreRuns = computed(() => Boolean(data.value.heartbeat?.hasMore))

  const latestRun = computed(() => runs.value[0] ?? null)

  const totalWaiting = computed(() =>
    stages.value.reduce((sum, stage) => sum + stage.count, 0)
  )
  const totalProcessed = computed(() =>
    stages.value.reduce((sum, stage) => sum + stage.processed, 0)
  )

  /** The stage whose oldest item has been waiting longest. */
  const oldestStage = computed(() =>
    stages.value.reduce(
      (worst, stage) =>
        stage.waitingSeconds !== null &&
        (!worst || stage.waitingSeconds > worst.waitingSeconds)
          ? stage
          : worst,
      null
    )
  )

  const statCards = computed(() => {
    const oldest = oldestStage.value
    const latest = latestRun.value
    return [
      {
        label: 'Waiting across all stages',
        value: formatCount(totalWaiting.value),
        hint: `${formatCount(stages.value.length)} stages reporting`
      },
      {
        label: 'Processed in the last minute',
        value: formatCount(totalProcessed.value),
        hint: 'Worker throughput, summed across stages'
      },
      {
        label: 'Oldest item waiting',
        value: oldest ? formatDuration(oldest.waitingSeconds) : 'No backlog',
        hint: oldest ? oldest.title : 'Every stage is caught up'
      },
      {
        label: 'Latest worker check',
        value: latest ? latest.statusLabel : '—',
        hint: latest ? latest.startedAtLabel : 'No checks recorded'
      }
    ]
  })

  /**
   * The one-line verdict, and whether it is worth interrupting for. `null` when
   * everything is clean — a banner that always shows says nothing.
   */
  const notice = computed(() => {
    const struggling = stages.value.filter(s => s.statusVariant !== 'success')
    const unclean = runs.value.filter(r => r.status !== 'success')

    if (struggling.length) {
      return {
        variant: struggling.some(s => s.statusVariant === 'danger')
          ? 'danger'
          : 'warn',
        title: 'The pipeline is not keeping up',
        message: `${struggling.map(s => s.title).join(', ')} ${struggling.length === 1 ? 'has' : 'have'} a backlog growing faster than it is being drained.`
      }
    }
    if (unclean.length) {
      return {
        variant: 'warn',
        title: 'Recent worker checks did not all pass',
        message: `${unclean.length} of the last ${runs.value.length} checks came back ${[...new Set(unclean.map(r => r.statusLabel.toLowerCase()))].join(' or ')}. Queues are clear, so this affects reporting rather than delivery.`
      }
    }
    return null
  })

  /** Nothing configured at all — a first run, not a fault. */
  const isEmpty = computed(
    () => !loading.value && !stages.value.length && !runs.value.length
  )

  return {
    loading,
    error,
    load,
    stages,
    runs,
    hasMoreRuns,
    latestRun,
    statCards,
    notice,
    updatedAt,
    updatedAtLabel,
    isEmpty
  }
}
