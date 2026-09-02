import { ref } from 'vue'
import { ApiError, customFetch } from '@/api/mutator'
import { camelizeKeys } from '@/lib/apiShape'
import { useMe } from '@/composables/useMe'

/**
 * API-backed composable for source sync controls.
 *
 * Wraps the backend sync trigger + history endpoints:
 *   POST /v1/accounts/{account}/sources/{source}/sync
 *   GET  /v1/accounts/{account}/sources/{source}/sync-runs
 *
 * Backend PR #16 added the three per-run routes this now also covers, which is
 * what turns the history table from a log into something you can act on:
 *   GET  …/sync-runs/{id}            one run, re-read for its final status
 *   GET  …/sync-runs/{id}/logs       the run's log lines, paginated
 *   POST …/sync-runs/{id}/cancel     stop a run that is still going
 *
 * `listSyncRuns` still throws nothing and reports through `error`; the three new
 * calls return the repo's discriminated `{ok}` result instead, because each is
 * driven by a click that has to be able to say "not available yet" without
 * blanking the table behind it.
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
    const run = camelizeKeys(res.data)
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
      runs.value = (res.data.items ?? []).map(camelizeKeys).reverse()
    } catch (e) {
      error.value = e.message || 'Failed to load sync history'
      runs.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * One run's log lines. `SyncRunLogEntry` is
   * `{timestamp, level: info|warn|error, message, entity?}`, in a standard page
   * envelope.
   *
   * @param {string} sourceId
   * @param {string} syncRunId
   * @returns {Promise<{ok: true, data: object[]} | {ok: false, apiMissing?: true, error?: string}>}
   */
  async function listSyncRunLogs(sourceId, syncRunId) {
    const accountId = currentAccount.value?.id
    if (!accountId) return { ok: false, apiMissing: true }
    try {
      const res = await customFetch(
        `/v1/accounts/${accountId}/sources/${sourceId}/sync-runs/${syncRunId}/logs?size=200`
      )
      return { ok: true, data: (res.data?.items ?? []).map(camelizeKeys) }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    }
  }

  /**
   * Re-read one run. Used after a cancel, and to settle a run the list caught
   * mid-flight — polling the whole collection to watch one row change status is
   * a lot of rows for one answer.
   *
   * @param {string} sourceId
   * @param {string} syncRunId
   */
  async function getSyncRun(sourceId, syncRunId) {
    const accountId = currentAccount.value?.id
    if (!accountId) return { ok: false, apiMissing: true }
    try {
      const res = await customFetch(
        `/v1/accounts/${accountId}/sources/${sourceId}/sync-runs/${syncRunId}`
      )
      const run = camelizeKeys(res.data)
      // Replace in place so the table does not reorder under the reader.
      runs.value = runs.value.map(r => (r.id === run.id ? run : r))
      return { ok: true, data: run }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    }
  }

  /**
   * Ask a running sync to stop.
   *
   * Deliberately re-reads rather than assuming: cancelling is a request, and a
   * run that finished a second earlier is not going to become cancelled because
   * we asked. The row shows whatever the backend says it is afterwards.
   *
   * @param {string} sourceId
   * @param {string} syncRunId
   */
  async function cancelSyncRun(sourceId, syncRunId) {
    const accountId = currentAccount.value?.id
    if (!accountId) return { ok: false, apiMissing: true }
    try {
      await customFetch(
        `/v1/accounts/${accountId}/sources/${sourceId}/sync-runs/${syncRunId}/cancel`,
        { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } }
      )
      await getSyncRun(sourceId, syncRunId)
      return { ok: true }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    }
  }

  return {
    runs,
    loading,
    error,
    triggerSync,
    listSyncRuns,
    listSyncRunLogs,
    getSyncRun,
    cancelSyncRun
  }
}
