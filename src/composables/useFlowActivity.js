import { computed, ref } from 'vue'
import { getDashboardOverview } from '@/api/fanfinity'
import { ApiError } from '@/api/mutator'
import { useDataSource } from '@/composables/useDataSource'
import { useDiagram } from '@/composables/useDiagram'
import { currentAccount, waitForAccount } from '@/composables/useMe'

/**
 * Per-source and per-destination pipes and counters, for the two-line cells the
 * Sources and Destinations list rows are built out of.
 *
 * ## Why this exists at all
 *
 * The backend's `Source` is eleven fields and its `Destination` is ten, and
 * neither carries a pipe count, the record at the other end of the pipe, or a
 * per-window counter. `sources.json`'s and `destinations.json`'s `pipeCount`,
 * `eventCountLastHour` and `deliveryCountLastHour` are fixture inventions —
 * which is exactly why the Pipes column was deleted from both list screens
 * once already, and why `formatCount` still refuses to print a `0` for
 * `undefined`.
 *
 * All of it IS measured, in one place: `GET /v1/accounts/{id}/dashboard`
 * answers `sources[]` with `pipe_count` + `events_received`, `destinations[]`
 * with `pipe_count` + `events_delivered`, and `pipes[]` with
 * `destination_id`/`destination_name`. One aggregate call, so a row costs a
 * single request rather than `usePipes()`'s two `size=100` reads plus a
 * per-row events call.
 *
 * ONE COMPOSABLE FOR BOTH SCREENS, because it is one payload and one adapter.
 * Two files would mean two copies of the snake_case reshaping below and two
 * chances for the Sources row and the Destinations row to disagree about what
 * `pipe_count` means.
 *
 * ## Deliberately NOT `useDiagram()`
 *
 * The diagram endpoint has the same three arrays and looks like the cheaper
 * answer, but its `events_in_window` is hard-coded `0` on every real response
 * (`account_insights.py`: per-window counts require ClickHouse) — which is why
 * `adaptPipelineDiagram` sets `countsMeasured: false` and drops the keys. Rows
 * built on it would mark every live source "No recent activity". It IS the
 * mock-mode reader here, because `pipes-diagram.json` carries real numbers.
 *
 * ## Absence means "not known", and that is the whole contract
 *
 * A map has an entry only for a record the read actually described, so a caller
 * never has to ask whether a value was measured: a missing entry prints
 * `NOT_KNOWN`, and an entry with a counted `0` is the one state that honestly
 * reads as "nothing arrived in the window".
 *
 * `eventsDelivered` is the exception and is `null`-able INSIDE an entry:
 * `DashboardDestinationStat.events_delivered` is explicitly "null when the
 * analytics store is unavailable", which is a different fact from "zero rows
 * were written" and must not collapse into it. That distinction is the same one
 * `deliverySuccess` exists for on the Dashboard — coercing it prints "your
 * delivery is completely broken" as a measured-sounding claim.
 *
 * There is no `error` in the returned shape on purpose. This is the secondary
 * layer on screens whose subject is a list of records, so a failed aggregate
 * must degrade a few cells to "Not known" rather than take the table down —
 * the same rule `PipeFunctionChips` follows for its library read.
 *
 * @returns {{
 *   bySourceId: import('vue').ComputedRef<Map<string, {
 *     pipeCount: number,
 *     destinationNames: string[],
 *     eventCount: number
 *   }>>,
 *   byDestinationId: import('vue').ComputedRef<Map<string, {
 *     pipeCount: number,
 *     eventsDelivered: number|null
 *   }>>,
 *   windowMinutes: number,
 *   load: () => Promise<void>
 * }}
 *
 * @example
 * const activity = useFlowActivity()
 * onMounted(activity.load)
 * activity.bySourceId.value.get(source.id)?.eventCount
 */

/**
 * The window every count below covers. Matches the `minutes` the real call
 * sends AND the hour `pipes-diagram.json`'s `*LastHour` fields describe, so one
 * sub-label ("Last 60 min") is true in both modes.
 */
export const ACTIVITY_WINDOW_MINUTES = 60

export function useFlowActivity() {
  const { isReal } = useDataSource()
  const { nodes, load: loadDiagram } = useDiagram()

  const overview = ref(null)

  async function loadReal() {
    try {
      await waitForAccount()
      const id = currentAccount.value?.id
      if (!id) {
        overview.value = null
        return
      }
      const { data } = await getDashboardOverview(id, {
        minutes: ACTIVITY_WINDOW_MINUTES
      })
      overview.value = data
    } catch (e) {
      // Swallowed by design — see the header comment. A 404 (not deployed
      // here) and a 502 (ClickHouse down) both mean the same thing to these
      // screens: some cells cannot be filled in, and the list is unaffected.
      // `ApiError` is checked so a genuine bug still reaches the console
      // rather than vanishing silently.
      if (!(e instanceof ApiError)) console.warn('[useFlowActivity]', e)
      overview.value = null
    }
  }

  async function load() {
    if (isReal.value) await loadReal()
    else await loadDiagram()
  }

  /** Mock mode: `pipes-diagram.json`, already resolved into adjacency. */
  const diagramSources = computed(() => {
    const map = new Map()
    for (const source of nodes.value.sources) {
      map.set(source.id, {
        pipeCount: source.pipes.length,
        destinationNames: source.destinations.map(d => d.name),
        eventCount: Number(source.eventCountLastHour) || 0
      })
    }
    return map
  })

  const diagramDestinations = computed(() => {
    const map = new Map()
    for (const destination of nodes.value.destinations) {
      map.set(destination.id, {
        pipeCount: destination.pipes.length,
        eventsDelivered: Number(destination.deliveryCountLastHour) || 0
      })
    }
    return map
  })

  /** Real mode: the dashboard aggregate, still snake_case off the wire. */
  const overviewSources = computed(() => {
    const map = new Map()
    const o = overview.value
    if (!o) return map
    // `DashboardPipeStat.destination_name` is nullable, so the destination
    // rollup is the primary lookup and the name on the pipe is the fallback.
    const destinationNames = new Map(
      (o.destinations ?? []).map(d => [d.id, d.name])
    )
    const pipes = o.pipes ?? []
    for (const source of o.sources ?? []) {
      const mine = pipes.filter(p => p.source_id === source.id)
      map.set(source.id, {
        // `pipe_count` rather than `mine.length`: the backend counts every
        // pipeline reading from the source, and `pipes[]` is a rollup that
        // could be narrowed later.
        pipeCount: Number(source.pipe_count) || 0,
        destinationNames: mine
          .map(
            p => destinationNames.get(p.destination_id) ?? p.destination_name
          )
          .filter(Boolean),
        eventCount: Number(source.events_received) || 0
      })
    }
    return map
  })

  const overviewDestinations = computed(() => {
    const map = new Map()
    const o = overview.value
    if (!o) return map
    for (const destination of o.destinations ?? []) {
      const delivered = destination.events_delivered
      map.set(destination.id, {
        pipeCount: Number(destination.pipe_count) || 0,
        // `?? null`, never `|| 0`: null is "the analytics store did not
        // answer", which is not the same fact as "nothing was delivered".
        eventsDelivered: delivered == null ? null : Number(delivered)
      })
    }
    return map
  })

  const bySourceId = computed(() =>
    isReal.value ? overviewSources.value : diagramSources.value
  )

  const byDestinationId = computed(() =>
    isReal.value ? overviewDestinations.value : diagramDestinations.value
  )

  return {
    bySourceId,
    byDestinationId,
    windowMinutes: ACTIVITY_WINDOW_MINUTES,
    load
  }
}
