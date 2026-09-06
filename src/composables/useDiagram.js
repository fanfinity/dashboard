import { computed } from 'vue'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource } from '@/composables/useMockResource'

const EMPTY = {
  sources: [],
  eventDestinations: [],
  pipes: [],
  countsMeasured: true
}

/**
 * Loads `data/pipes-diagram.json` — the flow view of the pipeline: every source,
 * every event destination, and the pipes that connect them.
 *
 * Data comes through `useMockResource`, so this inherits the repo-wide
 * `{ data, loading, error, load() }` semantics (never throws, resets to `EMPTY`
 * on failure). `select` normalises the three arrays defensively, since a
 * malformed payload must still land on `EMPTY`'s shape rather than undefined.
 *
 * ## The live endpoint, and the one field it cannot fill
 *
 * `GET /v1/accounts/{account}/pipelines/diagram` went live in backend PR #16
 * and returns `PipelineDiagram` — `{nodes[], edges[], window_minutes,
 * generated_at}`, where a node is a source or a destination and an edge is a
 * pipeline. `adaptPipelineDiagram()` folds that into the three arrays below, so
 * `nodes` and every consumer are written once against one shape.
 *
 * **The per-window counters are not mapped, on purpose.** `events_in_window`
 * and `errors_in_window` are on the wire and are `0` on every response:
 * `app/services/account_insights.py` says "per-window event/error counts
 * require ClickHouse and are reported as `0`". Copying them onto
 * `eventCountLastHour` / `deliveryCountLastHour` would put a measured-looking
 * "0 events / hr" under every live source — the same confident zero the pipes
 * work already removed once. The keys are therefore left absent, which is what
 * every consumer's `!= null` guard is written for, and `countsMeasured` says
 * which mode you are in. The Pipes screen now draws this through
 * `src/components/flow/FlowTopology.vue`, which omits a count it was not given
 * rather than printing one; the older `PipeTopology.vue` is unreferenced.
 *
 * `function_count` on an edge IS real (it counts the pipeline's attached
 * functions) and is carried through as `functionCount`.
 *
 * `nodes` is the adjacency helper. Every pipe in `pipes-diagram.json` is
 * guaranteed by the data contract to reference a source id and a destination id
 * that exist in the same file, but this resolves defensively anyway: a pipe
 * whose endpoints cannot be resolved is dropped from `links` rather than
 * rendered with an undefined label.
 *
 * @returns {{
 *   diagram: import('vue').Ref<{sources: any[], eventDestinations: any[], pipes: any[]}>,
 *   nodes: import('vue').ComputedRef<{sources: any[], destinations: any[], links: any[]}>,
 *   countsMeasured: import('vue').ComputedRef<boolean>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>
 * }}
 *
 * @example
 * const { diagram, nodes, loading, error, load } = useDiagram()
 * onMounted(load)
 * // nodes.value.sources[0].pipes    -> pipes leaving that source
 * // nodes.value.links[0].source     -> the resolved source record
 * // nodes.value.links[0].destination-> the resolved destination record
 */
/**
 * A wire `PipelineDiagram` as the three arrays this file's consumers read.
 *
 * Nodes split on `kind`; edges become pipes. `subtype` carries the source type
 * (or destination type) the backend already knows, so the flow columns keep
 * their type label without a second read.
 *
 * @param {object} payload  A snake_case `PipelineDiagram`.
 * @returns {{sources: object[], eventDestinations: object[], pipes: object[], countsMeasured: boolean, windowMinutes: number|null, generatedAt: string}}
 */
export function adaptPipelineDiagram(payload) {
  const d = camelizeKeys(payload) ?? {}
  const nodes = Array.isArray(d.nodes) ? d.nodes.map(camelizeKeys) : []
  const edges = Array.isArray(d.edges) ? d.edges.map(camelizeKeys) : []
  return {
    sources: nodes
      .filter(n => n.kind === 'source')
      .map(n => ({
        id: n.id,
        name: n.name,
        sourceType: n.subtype ?? null,
        isEnabled: Boolean(n.isEnabled),
        status: n.status ?? null
      })),
    eventDestinations: nodes
      .filter(n => n.kind === 'destination')
      .map(n => ({
        id: n.id,
        name: n.name,
        destinationType: n.subtype ?? null,
        isEnabled: Boolean(n.isEnabled),
        status: n.status ?? null
      })),
    pipes: edges.map(e => ({
      id: e.id,
      name: e.name,
      sourceId: e.sourceId,
      eventDestinationId: e.destinationId,
      isEnabled: Boolean(e.isEnabled),
      status: e.status ?? null,
      functionCount: e.functionCount ?? null
    })),
    // False in real mode until ClickHouse is wired behind the counters. The
    // count keys are absent rather than zero; this is the flag that lets a
    // screen say why instead of rendering a bare dash.
    countsMeasured: false,
    windowMinutes: Number.isFinite(Number(d.windowMinutes))
      ? Number(d.windowMinutes)
      : null,
    generatedAt: d.generatedAt ?? ''
  }
}

export function useDiagram() {
  const {
    data: diagram,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('pipes-diagram', {
    initial: EMPTY,
    select: payload => ({
      sources: Array.isArray(payload?.sources) ? payload.sources : [],
      eventDestinations: Array.isArray(payload?.eventDestinations)
        ? payload.eventDestinations
        : [],
      pipes: Array.isArray(payload?.pipes) ? payload.pipes : [],
      countsMeasured: true
    }),
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/pipelines/diagram`,
      select: adaptPipelineDiagram
    }
  })

  /** Whether the per-window event counters mean anything on this payload. */
  const countsMeasured = computed(() => diagram.value.countsMeasured !== false)

  const nodes = computed(() => {
    const { sources, eventDestinations, pipes } = diagram.value
    const sourceById = new Map(sources.map(s => [s.id, s]))
    const destinationById = new Map(eventDestinations.map(d => [d.id, d]))

    const links = pipes
      .map(pipe => {
        const source = sourceById.get(pipe.sourceId)
        const destination = destinationById.get(pipe.eventDestinationId)
        if (!source || !destination) return null
        return { pipe, source, destination }
      })
      .filter(Boolean)

    return {
      sources: sources.map(source => ({
        ...source,
        pipes: links.filter(l => l.source.id === source.id).map(l => l.pipe),
        destinations: links
          .filter(l => l.source.id === source.id)
          .map(l => l.destination)
      })),
      destinations: eventDestinations.map(destination => ({
        ...destination,
        pipes: links
          .filter(l => l.destination.id === destination.id)
          .map(l => l.pipe),
        sources: links
          .filter(l => l.destination.id === destination.id)
          .map(l => l.source)
      })),
      links
    }
  })

  return { diagram, nodes, countsMeasured, loading, error, apiMissing, load }
}
