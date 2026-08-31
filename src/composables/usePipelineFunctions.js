import { ref } from 'vue'
import { customFetch } from '@/api/mutator'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount, waitForAccount } from '@/composables/useMe'

/**
 * API-backed composable for the Jitsu functions attached to a pipeline.
 *
 * Wraps:
 *   GET /v1/accounts/{account}/pipelines/{pipeline}/functions
 *   PUT /v1/accounts/{account}/pipelines/{pipeline}/functions/{function}
 *   POST /v1/accounts/{account}/pipelines/{pipeline}/functions/{function}/reset
 *
 * The backend seeds the default templates on first read, so `load()` is also
 * what provisions functions for pipelines created before this feature.
 */
export function usePipelineFunctions() {
  const functions = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Settle the acting account before building an account-scoped URL, so a load
  // triggered right after navigation doesn't race `me` loading.
  async function baseUrl(pipelineId) {
    await waitForAccount()
    const accountId = currentAccount.value?.id
    if (!accountId) throw new Error('No account selected')
    return `/v1/accounts/${accountId}/pipelines/${pipelineId}/functions`
  }

  async function load(pipelineId) {
    loading.value = true
    error.value = null
    try {
      const res = await customFetch(await baseUrl(pipelineId))
      functions.value = (res.data.items ?? []).map(camelizeKeys)
    } catch (e) {
      error.value = e.message || 'Failed to load functions'
      functions.value = []
    } finally {
      loading.value = false
    }
  }

  async function save(pipelineId, functionId, code) {
    const base = await baseUrl(pipelineId)
    const res = await customFetch(`${base}/${functionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    const updated = camelizeKeys(res.data)
    const idx = functions.value.findIndex(f => f.functionId === functionId)
    if (idx !== -1) functions.value[idx] = updated
    return updated
  }

  async function reset(pipelineId, functionId) {
    const base = await baseUrl(pipelineId)
    const res = await customFetch(`${base}/${functionId}/reset`, {
      method: 'POST'
    })
    const updated = camelizeKeys(res.data)
    const idx = functions.value.findIndex(f => f.functionId === functionId)
    if (idx !== -1) functions.value[idx] = updated
    return updated
  }

  return { functions, loading, error, load, save, reset }
}
