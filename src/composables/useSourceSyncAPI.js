import { ref } from 'vue'
import { customFetch } from '@/api/mutator'
import { useMe } from '@/composables/useMe'

/**
 * Convert snake_case keys to camelCase (shallow, for a flat object).
 * Mirrors useSourcesAPI's camelize so sync payloads match the rest of the UI.
 */
function camelize(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[key] = v
  }
  return out
}

/**
 * API-backed composable for source sync controls.
 *
 * Wraps the backend sync trigger + history endpoints:
 *   POST /v1/accounts/{account}/sources/{source}/sync
 *   GET  /v1/accounts/{account}/sources/{source}/sync-runs
 */
export function useSourceSyncAPI() {
  const { currentAccount } = useMe()

  const runs = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function triggerSync(sourceId, { mode, dateFrom, dateTo } = {}) {
    const accountId = currentAccount.value?.id
    if (!accountId) throw new Error('No account selected')
    const body = { mode }
    if (dateFrom) body.date_from = dateFrom
    if (dateTo) body.date_to = dateTo
    const res = await customFetch(
      `/v1/accounts/${accountId}/sources/${sourceId}/sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    )
    const run = camelize(res.data)
    runs.value = [run, ...runs.value]
    return run
  }

  async function listSyncRuns(sourceId) {
    const accountId = currentAccount.value?.id
    if (!accountId) {
      runs.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      const res = await customFetch(
        `/v1/accounts/${accountId}/sources/${sourceId}/sync-runs?size=100`
      )
      // Most-recent first: the backend orders by (created_at, id) ascending.
      runs.value = (res.data.items ?? []).map(camelize).reverse()
    } catch (e) {
      error.value = e.message || 'Failed to load sync history'
      runs.value = []
    } finally {
      loading.value = false
    }
  }

  return {
    runs,
    loading,
    error,
    triggerSync,
    listSyncRuns
  }
}
