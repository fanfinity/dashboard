import { useMockResource } from '@/composables/useMockResource'

/**
 * Soft-deleted Profile API endpoints.
 *
 * `public/data/trash.json` is one file keyed by resource, so this reads only
 * its `profile-api-endpoints` slice — the same `select` idiom every other trash
 * screen uses. Records carry `deletedAt` / `deletedBy` / `deletedByName` on top
 * of the normal endpoint shape.
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
 * const { items, loading, error, load, restore } = useProfileApiTrash()
 * onMounted(load)
 */
export function useProfileApiTrash() {
  const {
    data: items,
    loading,
    error,
    load
  } = useMockResource('trash', {
    select: payload => payload['profile-api-endpoints']
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

/** How long a deleted endpoint is kept before it is purged automatically. */
export const RETENTION_DAYS = 30

/**
 * How long a record has left in the trash.
 *
 * @param {object} row
 * @returns {string} e.g. `'20 days left'`
 */
export function retentionLabel(row) {
  const deleted = new Date(row?.deletedAt)
  if (Number.isNaN(deleted.getTime())) return ''
  const elapsed = Math.floor((Date.now() - deleted.getTime()) / 86400000)
  const left = RETENTION_DAYS - elapsed
  if (left <= 0) return 'Past retention. Purged on the next sweep.'
  return `${left} day${left === 1 ? '' : 's'} left`
}
