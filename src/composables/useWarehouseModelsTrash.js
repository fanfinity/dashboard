import { useMockResource } from '@/composables/useMockResource'

/**
 * Soft-deleted warehouse models.
 *
 * `public/data/trash.json` is one file keyed by resource, so this reads only its
 * `warehouse-models` slice — the same `select` idiom every other trash screen
 * uses. That slice is intentionally empty: nothing has been deleted, which makes
 * the empty state the normal case rather than an edge case.
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
 * const { items, loading, error, load, restore } = useWarehouseModelsTrash()
 * onMounted(load)
 */
export function useWarehouseModelsTrash() {
  const {
    data: items,
    loading,
    error,
    load
  } = useMockResource('trash', {
    select: payload => payload['warehouse-models']
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
