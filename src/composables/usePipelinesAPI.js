import { ref } from 'vue'
import { createPipeline } from '@/api/fanfinity'
import { currentAccount, waitForAccount } from '@/composables/useMe'

/**
 * Write access to the Pipelines domain on the real accounts backend.
 *
 * Wraps POST /v1/accounts/{account}/pipelines (createPipeline). A pipeline is
 * the "connection" joining a source to a destination; the backend creates the
 * Jitsu link between the source's site and the destination. Callers gate on
 * `useDataSource().isReal` — a create has no mock equivalent.
 */
export function usePipelinesAPI() {
  const saving = ref(false)
  const error = ref(null)

  async function create({ name, sourceId, destinationId }) {
    saving.value = true
    error.value = null
    try {
      await waitForAccount()
      const accountId = currentAccount.value?.id
      if (!accountId) throw new Error('No account selected')
      const { data } = await createPipeline(accountId, {
        name,
        source_id: sourceId,
        destination_id: destinationId
      })
      return data
    } catch (e) {
      error.value = e.message || 'Failed to create pipeline'
      throw e
    } finally {
      saving.value = false
    }
  }

  return { saving, error, create }
}
