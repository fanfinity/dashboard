import { ref } from 'vue'
import { createDestination } from '@/api/fanfinity'
import { currentAccount, waitForAccount } from '@/composables/useMe'

/**
 * Write access to the Destinations domain on the real accounts backend.
 *
 * Wraps POST /v1/accounts/{account}/destinations (createDestination). Callers
 * gate on `useDataSource().isReal` — a create has no mock equivalent.
 *
 * For a ClickHouse destination `config` is optional: the backend provisions a
 * fresh per-account database and uses the shared Jitsu ClickHouse credentials
 * (see the backend's create_destination route), so name + slug are enough.
 */
export function useDestinationsAPI() {
  const saving = ref(false)
  const error = ref(null)

  async function create({
    name,
    slug,
    destinationType = 'clickhouse',
    config = null
  }) {
    saving.value = true
    error.value = null
    try {
      await waitForAccount()
      const accountId = currentAccount.value?.id
      if (!accountId) throw new Error('No account selected')
      const { data } = await createDestination(accountId, {
        name,
        slug,
        destination_type: destinationType,
        config
      })
      return data
    } catch (e) {
      error.value = e.message || 'Failed to create destination'
      throw e
    } finally {
      saving.value = false
    }
  }

  return { saving, error, create }
}
