import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

const EMPTY = { sources: [], eventDestinations: [], pipes: [] }

/**
 * Loads `data/pipes-diagram.json` — the flow view of the pipeline: every source,
 * every event destination, and the pipes that connect them.
 *
 * Data comes through `useMockResource`, so this inherits the repo-wide
 * `{ data, loading, error, load() }` semantics (never throws, resets to `EMPTY`
 * on failure). `select` normalises the three arrays defensively, since a
 * malformed payload must still land on `EMPTY`'s shape rather than undefined.
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
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
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
export function useDiagram() {
  const {
    data: diagram,
    loading,
    error,
    load
  } = useMockResource('pipes-diagram', {
    initial: EMPTY,
    select: payload => ({
      sources: Array.isArray(payload?.sources) ? payload.sources : [],
      eventDestinations: Array.isArray(payload?.eventDestinations)
        ? payload.eventDestinations
        : [],
      pipes: Array.isArray(payload?.pipes) ? payload.pipes : []
    })
  })

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

  return { diagram, nodes, loading, error, load }
}
