import { useMockResource } from '@/composables/useMockResource'

/**
 * Soft-deleted warehouse connections.
 *
 * `public/data/trash.json` is one file keyed by resource, so this reads only its
 * `dwh-connections` slice — the same `select` idiom every other trash screen
 * uses. Records carry `deletedAt` / `deletedBy` / `deletedByName` on top of the
 * normal connection shape, but no credentials: a deleted connection keeps its
 * host and database and loses its secret, which is why a restored one comes back
 * `disconnected` and has to be re-tested.
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
 * const { items, loading, error, load, restore } = useDwhConnectionsTrash()
 * onMounted(load)
 */
export function useDwhConnectionsTrash() {
  const {
    data: items,
    loading,
    error,
    load
  } = useMockResource('trash', {
    select: payload => payload['dwh-connections']
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

/**
 * The syncs that were deleted alongside a connection.
 *
 * Deleting a connection cascades: everything reading from it is soft-deleted in
 * the same sweep, and restoring the connection does **not** bring those back.
 * The trash screen says so per row, which needs the other two slices of the same
 * trash file.
 *
 * A **secondary** resource: if it fails, the trash still lists, restores and
 * purges, and the check renders its own retry rather than a page-level error.
 *
 * @returns {{
 *   items: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   countFor: (connectionId: string) => number
 * }}
 *
 * @example
 * const { countFor, load } = useDeletedDwhConnectionDependants()
 * countFor('dwh_staging_postgres') // 1
 */
export function useDeletedDwhConnectionDependants() {
  const {
    data: items,
    loading,
    error,
    load
  } = useMockResource('trash', {
    // Both kinds of sync read a connection and both are keyed the same way, so
    // they are folded into one list with the noun kept for the copy.
    select: payload => [
      ...(payload['dwh-syncs'] ?? []).map(r => ({ ...r, kind: 'sync' })),
      ...(payload['profile-dwh-syncs'] ?? []).map(r => ({
        ...r,
        kind: 'profile sync'
      }))
    ]
  })

  function countFor(connectionId) {
    if (!connectionId) return 0
    return items.value.filter(i => i.dwhConnectionId === connectionId).length
  }

  return { items, loading, error, load, countFor }
}
