import { useMockResource } from '@/composables/useMockResource'

/**
 * Soft-deleted attributes.
 *
 * `public/data/trash.json` is one file keyed by resource, so this reads only its
 * `attributes` slice — the same `select` idiom every other trash screen uses.
 * Records carry `deletedAt` / `deletedBy` / `deletedByName` on top of a trimmed
 * attribute shape (no `dimensions`, no query — the trash lists them, it does not
 * inspect them).
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
 * const { items, loading, error, load, restore } = useAttributesTrash()
 * onMounted(load)
 */
export function useAttributesTrash() {
  const {
    data: items,
    loading,
    error,
    load
  } = useMockResource('trash', { select: payload => payload.attributes })

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
