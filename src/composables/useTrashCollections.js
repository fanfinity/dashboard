import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

/**
 * Everything the one Trash screen reads: deleted sources, deleted destinations,
 * and the pipes left with an end that no longer exists.
 *
 * ONE COMPOSABLE FOR THREE TABS, on purpose. `public/data/trash.json` is a
 * single file keyed by resource, so three separate readers would fetch and parse
 * the same document three times and give the screen three `loading` flags, three
 * `error` strings and three Retry buttons for one failure. It also lets the Pipes
 * tab resolve its ends against the same load rather than a fourth.
 *
 * IT DOES NOT REUSE `useSourcesTrash` / `useDestinationsTrash` / `usePipesTrash`.
 * Those back the ten per-module trash screens this replaced; eight of the nine
 * swallow `apiMissing`, which is the bug CLAUDE.md calls out by name — the screen
 * then prints "no source has been deleted in the last 30 days", a measured claim
 * about a collection nobody asked for. Forwarding it is the whole point of this
 * file, so it reads the fixture directly rather than through a wrapper that drops
 * the flag.
 *
 * THERE IS NO TRASH ENDPOINT ANYWHERE. `DELETE /v1/accounts/{account}/sources/{id}`
 * is a hard 204: no soft delete, no trash listing, no restore, and the pipeline is
 * cascaded away rather than parked. So in the default real mode all three tabs
 * report `apiMissing` and every write below is local state the next reload undoes.
 *
 * @returns {{
 *   sources: import('vue').ComputedRef<object[]>,
 *   destinations: import('vue').ComputedRef<object[]>,
 *   pipes: import('vue').ComputedRef<object[]>,
 *   loading: import('vue').ComputedRef<boolean>,
 *   error: import('vue').ComputedRef<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>,
 *   restore: (kind: 'sources'|'destinations', row: object) => void,
 *   purge: (kind: 'sources'|'destinations', row: object) => void,
 *   purgeAll: (kind: 'sources'|'destinations') => void
 * }}
 *
 * @example
 * const { sources, pipes, apiMissing, load } = useTrashCollections()
 * onMounted(load)
 * // pipes[0].waitingFor -> [{ kind: 'destination', name: 'GA4 (retired)' }]
 */
export function useTrashCollections() {
  // `initial` is the shaped object rather than the default `[]`, and that is a
  // real-mode crash otherwise: `loadReal()` resets `data` to `initial` when a
  // resource has no `api`, so an array blank would leave `data.value.sources`
  // undefined and every `.length` in the template a render error — in the one
  // mode `pnpm smoke:dist` walks.
  const trash = useMockResource('trash', {
    initial: { sources: [], destinations: [], pipes: [] },
    select: payload => ({
      sources: Array.isArray(payload?.sources) ? payload.sources : [],
      destinations: Array.isArray(payload?.destinations)
        ? payload.destinations
        : [],
      pipes: Array.isArray(payload?.pipes) ? payload.pipes : []
    })
  })

  // The two live collections exist only to tell a pipe's surviving end from a
  // vanished one. Deliberately BARE `useMockResource` — no `api` — so real mode
  // makes no request for them: the trash read is already `apiMissing` there, so
  // the Pipes tab has no rows to resolve and two account-scoped fetches would be
  // work done for a list that cannot render.
  const liveSources = useMockResource('sources')
  const liveDestinations = useMockResource('destinations')

  const loading = computed(
    () =>
      trash.loading.value ||
      liveSources.loading.value ||
      liveDestinations.loading.value
  )

  // Three fetches, one surface: they share an origin, so they fail together and
  // a single ErrorState with a single Retry is the honest presentation.
  const error = computed(
    () =>
      trash.error.value ||
      liveSources.error.value ||
      liveDestinations.error.value
  )

  // `apiMissing` comes from the trash read ALONE. The other two are lookups, not
  // the collection any tab is about, and one of them being unwired would
  // otherwise make the Sources tab claim it had no endpoint for a reason that
  // has nothing to do with it.
  const apiMissing = trash.apiMissing

  async function load() {
    await Promise.all([
      trash.load(),
      liveSources.load(),
      liveDestinations.load()
    ])
  }

  const sources = computed(() => trash.data.value?.sources ?? [])
  const destinations = computed(() => trash.data.value?.destinations ?? [])

  /**
   * Where one end of a pipe ended up.
   *
   * - `live`    still in the working collection
   * - `trashed` deleted, and sitting in this very trash
   * - `missing` nowhere: purged, or never in the fixture at all
   *
   * The pipe is dormant either way; the two gone states are carried on
   * `waitingFor` so a screen CAN tell "deleted, still listed above" from
   * "gone for good" once there is a reconnect flow that cares. Today's screen
   * only needs to know that an end is missing, and which one.
   */
  function resolveEnd(id, live, deleted) {
    if (live.some(r => r.id === id)) return 'live'
    if (deleted.some(r => r.id === id)) return 'trashed'
    return 'missing'
  }

  /**
   * Pipes with an end that no longer exists.
   *
   * THE PRODUCT MODEL IS AHEAD OF THE API HERE, deliberately, and this is where
   * that shows. A pipe is not deleted: it goes dormant when the source or the
   * destination at one of its ends is deleted, and waits for something to be
   * connected in that end's place. The backend does none of this — deleting a
   * source cascades its pipeline away outright and there is no dormant state and
   * no reconnect call — so the fixture's deleted pipes are what stands in for it
   * and the screen says plainly that reconnecting is not wired yet.
   *
   * What it must NOT do is dress the gap up: no countdown, no "restorable until",
   * no throughput. `deliveryCountLastHour` on the fixture rows is a 0 nobody
   * measured, and printing it would assert a reading over a period this pipe
   * spent switched off.
   */
  const pipes = computed(() =>
    (trash.data.value?.pipes ?? [])
      .map(pipe => {
        const sourceState = resolveEnd(
          pipe.sourceId,
          liveSources.data.value,
          sources.value
        )
        const destinationState = resolveEnd(
          pipe.eventDestinationId,
          liveDestinations.data.value,
          destinations.value
        )

        // Named, not counted: "waiting for its destination" is actionable, "1 end
        // missing" is a number the reader has to go and decode.
        const waitingFor = []
        if (sourceState !== 'live') {
          waitingFor.push({
            kind: 'source',
            state: sourceState,
            name: pipe.sourceName || pipe.sourceId
          })
        }
        if (destinationState !== 'live') {
          waitingFor.push({
            kind: 'destination',
            state: destinationState,
            name: pipe.eventDestinationName || pipe.eventDestinationId
          })
        }

        return {
          ...pipe,
          sourceState,
          destinationState,
          waitingFor,
          // The fixture's `deletedAt` is the moment the END was deleted, which is
          // the moment this pipe stopped carrying anything. Renamed rather than
          // rendered under a "Deleted" header, which would say the pipe was
          // deleted — the one thing this screen exists to deny.
          dormantSince: pipe.deletedAt ?? null
        }
      })
      // THE PREDICATE IS THE DEFINITION OF THE LIST, so it is applied here rather
      // than trusted. A record with both ends alive is not waiting for anything,
      // and the tab's badge says "Waiting to reconnect" about every row it is
      // handed — one such record and the screen asserts a state its own
      // 'Waiting for' cell contradicts. Today's fixture gives each pipe exactly
      // one gone end, so the badge is true by luck; this makes it true by
      // construction, and makes the empty copy ("every pipe still has a source
      // and a destination") accurate rather than approximate.
      //
      // Not the "never filter" case navOrder.js warns about: that rule protects
      // nav rows a typo must not be able to delete. Here the filter IS what the
      // collection means.
      .filter(pipe => pipe.waitingFor.length)
  )

  // Local state only, in every mode: nothing here reaches a backend, and the
  // page's toast says so rather than implying a save.
  function drop(kind, id) {
    const current = trash.data.value
    trash.data.value = {
      ...current,
      [kind]: current[kind].filter(r => r.id !== id)
    }
  }

  function restore(kind, row) {
    if (row) drop(kind, row.id)
  }

  function purge(kind, row) {
    if (row) drop(kind, row.id)
  }

  function purgeAll(kind) {
    trash.data.value = { ...trash.data.value, [kind]: [] }
  }

  return {
    sources,
    destinations,
    pipes,
    loading,
    error,
    apiMissing,
    load,
    restore,
    purge,
    purgeAll
  }
}
