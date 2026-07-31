import { computed, ref } from 'vue'

const EMPTY = { sources: [], eventDestinations: [], pipes: [] }

/**
 * Loads `data/pipes-diagram.json` — the flow view of the pipeline: every source,
 * every event destination, and the pipes that connect them.
 *
 * Same semantics as useConnectorCatalog(): never throws, normalises the error to
 * a string, resets `diagram` to an empty graph on failure, always clears
 * `loading` in `finally`.
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
  const diagram = ref(EMPTY)
  const loading = ref(false)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}data/pipes-diagram.json`,
        {
          headers: { Accept: 'application/json' }
        }
      )
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`)
      }
      const payload = await res.json()
      diagram.value = {
        sources: Array.isArray(payload?.sources) ? payload.sources : [],
        eventDestinations: Array.isArray(payload?.eventDestinations)
          ? payload.eventDestinations
          : [],
        pipes: Array.isArray(payload?.pipes) ? payload.pipes : []
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      diagram.value = EMPTY
    } finally {
      loading.value = false
    }
  }

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
