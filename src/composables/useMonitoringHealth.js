import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
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
 *
 * ## The live endpoint is narrower than this screen, and it says so
 *
 * `GET /v1/accounts/{account}/health` went live in backend PR #16 and returns
 * `HealthReport` — `{status, generated_at, queues[]}`. Reading the router
 * source rather than trusting the shape, two thirds of this screen has no
 * measurement behind it yet:
 *
 * - **`queues` is `[]` on every response.** `app/services/account_insights.py`
 *   says so in its own docstring: "queue depth/lag telemetry is not collected
 *   yet, so `queues` is empty". So `stages` is empty in real mode — not because
 *   the pipeline is idle, but because nothing counts it.
 * - **There is no worker-heartbeat endpoint at all.** `heartbeat.runs` is a
 *   fixture-only structure with no counterpart in the spec.
 * - **`status` IS real**, derived from the latest sync run per source:
 *   `failing` if every source's last run failed, `degraded` if some did,
 *   `healthy` otherwise.
 *
 * That split is why this composable now reports `queuesMeasured` and
 * `heartbeatMeasured` alongside the data. An empty `queues` rendered as the
 * existing `isEmpty` state would say "No pipeline stages are reporting", and a
 * summed `statCards` would print a confident `0` waiting — both are claims
 * about a measurement nobody took, which is the failure mode CLAUDE.md calls
 * the expensive one. Every count on this screen falls back to `NOT_KNOWN`
 * instead, and the page states which half is unmeasured.
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
    return NOT_KNOWN
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
  if (!Number.isFinite(value)) return NOT_KNOWN
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
 * The overall verdict the backend derives from the latest sync run per source.
 * Distinct from a queue's status, which is about a backlog — this one is about
 * whether the syncs feeding the pipeline are succeeding.
 */
const OVERALL_STATUS = {
  healthy: { label: 'Healthy', tone: 'success' },
  degraded: { label: 'Degraded', tone: 'warn' },
  failing: { label: 'Failing', tone: 'danger' }
}

/**
 * A wire `HealthReport` in the shape this screen reads.
 *
 * Deliberately keeps `queues` as an array rather than folding it into the
 * fixture's four-key object: the fixture's keys are this app's names for four
 * stages it invented, and the backend names its own queues. Matching a wire
 * name against `STAGES` for the nicer title is a best-effort lookup, not a
 * requirement — an unrecognised queue renders under its own name rather than
 * being dropped.
 *
 * `heartbeatMeasured` is hardcoded false because there is no worker-heartbeat
 * endpoint in the spec at all. It is a field rather than an omission so the
 * page can say "not measured" instead of rendering an empty list that reads as
 * "no checks have run".
 *
 * @param {object} payload  A snake_case `HealthReport`.
 * @returns {object}
 */
export function adaptHealthReport(payload) {
  const report = camelizeKeys(payload) ?? {}
  const queues = Array.isArray(report.queues)
    ? report.queues.map(camelizeKeys)
    : []
  return {
    updatedAt: report.generatedAt ?? '',
    overallStatus: report.status ?? null,
    queueList: queues.map(q => ({
      key: q.name,
      name: q.name,
      count: Number(q.depth) || 0,
      processedLastMinute: Number(q.throughputPerMinute) || 0,
      lagSeconds: Number.isFinite(Number(q.lagSeconds))
        ? Number(q.lagSeconds)
        : null,
      wireStatus: q.status ?? null
    })),
    // `[]` from the backend means "nothing counts this yet", not "no queues".
    queuesMeasured: queues.length > 0,
    heartbeatMeasured: false
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
  const { data, loading, error, apiMissing, load } = useMockResource(
    'health-queues',
    {
      initial: {},
      api: {
        path: () =>
          currentAccount.value &&
          `/v1/accounts/${currentAccount.value.id}/health`,
        select: adaptHealthReport
      }
    }
  )

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

  /**
   * Both payload shapes reduced to one ordered list of queues.
   *
   * The fixture is an object keyed by this app's four stage names and carries
   * an `oldestAt` timestamp; the wire `HealthReport` is an array named by the
   * backend and carries `lag_seconds` instead. Normalising here rather than in
   * `stages` keeps the two shapes out of the render path, and means an
   * unrecognised wire queue name still gets a card.
   */
  const queueList = computed(() => {
    if (Array.isArray(data.value.queueList)) return data.value.queueList
    const queues = data.value.queues ?? {}
    return STAGES.filter(stage => queues[stage.key]).map(stage => {
      const queue = queues[stage.key]
      return {
        key: stage.key,
        name: stage.key,
        count: Number(queue.count) || 0,
        processedLastMinute: Number(queue.processedLastMinute) || 0,
        lagSeconds: ageSeconds(queue.oldestAt),
        oldestAt: queue.oldestAt ?? null,
        wireStatus: null
      }
    })
  })

  const stages = computed(() =>
    queueList.value.map((queue, index) => {
      const stage = STAGES.find(st => st.key === queue.key)
      const count = queue.count
      const processed = queue.processedLastMinute
      const drainMinutes = processed ? count / processed : Infinity
      const waiting = queue.lagSeconds
      // The backend states a verdict of its own on a wire queue. Prefer it: it
      // knows thresholds this screen is only guessing at from depth and rate.
      // The derived one still covers the fixture, which carries no status.
      const derived = queueStatus(count, processed, drainMinutes)
      const wire = queue.wireStatus ? OVERALL_STATUS[queue.wireStatus] : null
      return {
        id: queue.key,
        step: index + 1,
        title: stage?.title ?? queue.name,
        description: stage?.description ?? '',
        count,
        countLabel: formatCount(count),
        processed,
        processedLabel: formatCount(processed),
        oldestAt: queue.oldestAt ?? null,
        waitingSeconds: waiting,
        waitingLabel: count ? formatDuration(waiting) : 'No backlog',
        statusVariant: wire?.tone ?? derived.variant,
        statusLabel: wire?.label ?? derived.label,
        note: derived.note
      }
    })
  )

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

  /**
   * Whether anything actually counted the queues. False in real mode on every
   * response today — see the note at the top of this file. The fixture always
   * counts them, so Demo mode is the only place the stage cards have numbers.
   */
  const queuesMeasured = computed(() =>
    data.value.queuesMeasured === undefined
      ? queueList.value.length > 0
      : Boolean(data.value.queuesMeasured)
  )

  /** Whether the worker heartbeat has a source. Never true in real mode. */
  const heartbeatMeasured = computed(() =>
    data.value.heartbeatMeasured === undefined
      ? Boolean(data.value.heartbeat)
      : Boolean(data.value.heartbeatMeasured)
  )

  /**
   * The backend's own verdict on the account, derived from the latest sync run
   * per source. The one number on this screen that is real in real mode, so it
   * leads the stat row rather than sitting at the end of it.
   */
  const overall = computed(
    () => OVERALL_STATUS[data.value.overallStatus] ?? null
  )

  const statCards = computed(() => {
    const oldest = oldestStage.value
    const latest = latestRun.value
    const measured = queuesMeasured.value
    return [
      // Only present when the backend sent one — the fixture does not, and a
      // card reading "Not known" where Demo mode has real stage numbers would
      // be noise rather than information.
      ...(overall.value
        ? [
            {
              label: 'Overall status',
              value: overall.value.label,
              hint: 'Derived from the latest sync run on each source'
            }
          ]
        : []),
      {
        label: 'Waiting across all stages',
        // NOT a confident 0. Nothing counts queue depth yet, and a summed zero
        // over an empty list asserts a measurement nobody took.
        value: measured ? formatCount(totalWaiting.value) : NOT_KNOWN,
        hint: measured
          ? `${formatCount(stages.value.length)} stages reporting`
          : 'Queue depth is not collected yet'
      },
      {
        label: 'Processed in the last minute',
        value: measured ? formatCount(totalProcessed.value) : NOT_KNOWN,
        hint: measured
          ? 'Worker throughput, summed across stages'
          : 'Queue throughput is not collected yet'
      },
      {
        label: 'Oldest item waiting',
        value: measured
          ? oldest
            ? formatDuration(oldest.waitingSeconds)
            : 'No backlog'
          : NOT_KNOWN,
        hint: measured
          ? oldest
            ? oldest.title
            : 'Every stage is caught up'
          : 'Queue lag is not collected yet'
      },
      {
        label: 'Latest worker check',
        value:
          heartbeatMeasured.value && latest ? latest.statusLabel : NOT_KNOWN,
        hint: heartbeatMeasured.value
          ? latest
            ? latest.startedAtLabel
            : 'No checks recorded'
          : 'The worker heartbeat has no endpoint yet'
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

    // What the backend actually said about the account outranks anything
    // derived, and it is the only finding available while the queues are dark.
    if (overall.value && data.value.overallStatus !== 'healthy') {
      return {
        variant: overall.value.tone,
        title:
          data.value.overallStatus === 'failing'
            ? 'Every source that has run is failing'
            : 'Some sources are failing to sync',
        message:
          'This is the backend\u2019s verdict on the latest sync run for each source. Open a source\u2019s Syncs tab for the run that failed.'
      }
    }
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

  /**
   * Nothing configured at all — a first run, not a fault.
   *
   * Gated on `overallStatus` as well as on the two lists, because in real mode
   * both lists are empty on a perfectly healthy account: the read succeeded and
   * returned a verdict, it just has no telemetry attached. Rendering
   * "No pipeline stages are reporting" there would blame the account for a gap
   * in the backend.
   */
  const isEmpty = computed(
    () =>
      !loading.value &&
      !stages.value.length &&
      !runs.value.length &&
      !overall.value
  )

  /**
   * What this screen cannot tell you, for the page to state once rather than
   * repeating "Not known" without explanation. `null` when everything on screen
   * is measured.
   */
  const unmeasured = computed(() => {
    const gaps = []
    if (!queuesMeasured.value) gaps.push('queue depth, lag and throughput')
    if (!heartbeatMeasured.value) gaps.push('the worker heartbeat')
    if (!gaps.length) return null
    return {
      title: 'Part of this screen is not measured yet',
      message: `The backend does not collect ${gaps.join(' or ')}, so those read “${NOT_KNOWN}” rather than zero. The overall status above is real.`
    }
  })

  return {
    loading,
    error,
    apiMissing,
    load,
    stages,
    runs,
    hasMoreRuns,
    latestRun,
    statCards,
    notice,
    overall,
    queuesMeasured,
    heartbeatMeasured,
    unmeasured,
    updatedAt,
    updatedAtLabel,
    isEmpty
  }
}
