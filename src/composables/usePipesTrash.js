import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

/**
 * Deleted pipes, resolved against the records they point at.
 *
 * `trash.json` is one file keyed by resource, so a deleted pipe can reference a
 * source or destination that is itself deleted — `pipe_legacy_gtm_to_snowflake`
 * points at `src_legacy_gtm`, which sits in `trash.sources`. Restoring the pipe
 * on its own would leave a dangling reference, so this composable resolves both
 * endpoints of every deleted pipe up front and labels them:
 *
 * - `live`    — the record is in `sources.json` / `destinations.json`
 * - `trashed` — the record is in the trash too; restoring must cascade
 * - `missing` — the record is nowhere; the pipe cannot be restored
 *
 * That is why the live collections are loaded here rather than in the page: the
 * three fetches only mean something together.
 *
 * Restore, purge and empty are local-state only — there is no backend.
 *
 * @returns {{
 *   items: import('vue').ComputedRef<any[]>,
 *   loading: import('vue').ComputedRef<boolean>,
 *   error: import('vue').ComputedRef<string|null>,
 *   load: () => Promise<void>,
 *   restore: (item: any) => void,
 *   purge: (item: any) => void,
 *   purgeAll: () => void
 * }}
 *
 * @example
 * const { items, loading, error, load, restore } = usePipesTrash()
 * onMounted(load)
 * // items[0].cascade -> [{ kind: 'source', id, name }]
 */
export function usePipesTrash() {
  const trash = useMockResource('trash', {
    initial: { pipes: [], sources: [], destinations: [] },
    select: payload => ({
      pipes: Array.isArray(payload?.pipes) ? payload.pipes : [],
      sources: Array.isArray(payload?.sources) ? payload.sources : [],
      destinations: Array.isArray(payload?.destinations)
        ? payload.destinations
        : []
    })
  })
  const liveSources = useMockResource('sources')
  const liveDestinations = useMockResource('destinations')

  const loading = computed(
    () =>
      trash.loading.value ||
      liveSources.loading.value ||
      liveDestinations.loading.value
  )

  // One surface for three fetches: they share an origin, so they fail together
  // and a single ErrorState with a single Retry is the honest presentation.
  const error = computed(
    () =>
      trash.error.value ||
      liveSources.error.value ||
      liveDestinations.error.value
  )

  async function load() {
    await Promise.all([
      trash.load(),
      liveSources.load(),
      liveDestinations.load()
    ])
  }

  function resolve(id, live, deleted) {
    const alive = live.find(r => r.id === id)
    if (alive) return { state: 'live', record: alive }
    const gone = deleted.find(r => r.id === id)
    if (gone) return { state: 'trashed', record: gone }
    return { state: 'missing', record: null }
  }

  const items = computed(() => {
    const { pipes, sources, destinations } = trash.data.value
    return pipes.map(pipe => {
      const source = resolve(pipe.sourceId, liveSources.data.value, sources)
      const destination = resolve(
        pipe.eventDestinationId,
        liveDestinations.data.value,
        destinations
      )

      // Everything the restore has to bring back alongside the pipe itself.
      const cascade = []
      if (source.state === 'trashed') {
        cascade.push({
          kind: 'source',
          id: pipe.sourceId,
          name: source.record?.name || pipe.sourceName || pipe.sourceId
        })
      }
      if (destination.state === 'trashed') {
        cascade.push({
          kind: 'destination',
          id: pipe.eventDestinationId,
          name:
            destination.record?.name ||
            pipe.eventDestinationName ||
            pipe.eventDestinationId
        })
      }

      return {
        ...pipe,
        sourceState: source.state,
        destinationState: destination.state,
        cascade,
        // A reference to a record that is neither live nor recoverable would be
        // restored broken, so the action is refused rather than half-done.
        blocked: source.state === 'missing' || destination.state === 'missing'
      }
    })
  })

  function restore(item) {
    const current = trash.data.value
    const restoringSource = item.cascade.some(c => c.kind === 'source')
    const restoringDestination = item.cascade.some(
      c => c.kind === 'destination'
    )
    trash.data.value = {
      pipes: current.pipes.filter(p => p.id !== item.id),
      sources: restoringSource
        ? current.sources.filter(s => s.id !== item.sourceId)
        : current.sources,
      destinations: restoringDestination
        ? current.destinations.filter(d => d.id !== item.eventDestinationId)
        : current.destinations
    }
  }

  function purge(item) {
    const current = trash.data.value
    trash.data.value = {
      ...current,
      pipes: current.pipes.filter(p => p.id !== item.id)
    }
  }

  function purgeAll() {
    trash.data.value = { ...trash.data.value, pipes: [] }
  }

  return { items, loading, error, load, restore, purge, purgeAll }
}
