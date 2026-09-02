import { useMockResource } from '@/composables/useMockResource'

/**
 * Soft-deleted sources.
 *
 * `public/data/trash.json` is one file keyed by resource, so this reads only
 * its `sources` slice — the same `select` idiom every other trash screen uses.
 * Records carry `deletedAt` / `deletedBy` / `deletedByName` on top of the
 * normal source shape.
 *
 * THERE IS NO TRASH ENDPOINT, and `apiMissing` is forwarded because of it. The
 * backend's `DELETE /v1/accounts/{account}/sources/{id}` is a hard 204 — no
 * soft delete, nothing to list, nothing to restore — so in the default real
 * mode this collection can only ever come back blank. Swallowing `apiMissing`
 * (which this did) let the screen render its own "Trash is empty — no source
 * has been deleted in the last 30 days", which is a measured-sounding claim
 * about a collection nobody asked for. The page passes it to `DataTable` so
 * the answer is "No API yet" instead.
 *
 * Restore and purge have no backend either: they drop the record from the
 * loaded array and nothing more. Reloading brings it back, which is the honest
 * behaviour for a mock — the page shows a toast so the user knows the action
 * was received.
 *
 * @returns {{
 *   items: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>,
 *   restore: (row: object) => void,
 *   purge: (row: object) => void,
 *   purgeAll: () => void
 * }}
 *
 * @example
 * const { items, loading, error, load, restore } = useSourcesTrash()
 * onMounted(load)
 */
export function useSourcesTrash() {
  const {
    data: items,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('trash', { select: payload => payload.sources })

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

  return { items, loading, error, apiMissing, load, restore, purge, purgeAll }
}
