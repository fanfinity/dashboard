import { useMockResource } from '@/composables/useMockResource'

/**
 * Soft-deleted DWH syncs.
 *
 * `public/data/trash.json` is one file keyed by resource, so this reads only
 * its `dwh-syncs` slice — the same `select` idiom every other trash screen
 * uses. Records carry `deletedAt` / `deletedBy` / `deletedByName` on top of the
 * normal sync shape, but not the run fields: a deleted sync has stopped
 * running, so there is no last run to report.
 *
 * A deleted sync can also outlive the warehouse connection it pointed at — the
 * trash keeps `dwhConnectionId` and `dwhConnectionName` so the screen can still
 * name it, but the lookup in `dwh-connections.json` may miss. The page treats
 * that as "cannot resume on its own" rather than as an error.
 *
 * Restore and purge have no backend: they drop the record from the loaded array
 * and nothing more. Reloading brings it back, which is the honest behaviour for
 * a mock — the page shows a toast so the user knows the action was received.
 *
 * @returns {{
 *   items: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   restore: (row: object) => void,
 *   purge: (row: object) => void,
 *   purgeAll: () => void
 * }}
 *
 * @example
 * const { items, loading, error, load, restore } = useDwhSyncsTrash()
 * onMounted(load)
 */
export function useDwhSyncsTrash() {
  const {
    data: items,
    loading,
    error,
    load
  } = useMockResource('trash', {
    select: payload => payload['dwh-syncs']
  })

  function drop(row) {
    if (!row) return
    items.value = items.value.filter(i => i.id !== row.id)
  }

  function restore(row) {
    drop(row)
  }

  function purge(row) {
    drop(row)
  }

  function purgeAll() {
    items.value = []
  }

  return { items, loading, error, load, restore, purge, purgeAll }
}
