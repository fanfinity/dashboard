import { ref } from 'vue'
import { customFetch } from '@/api/mutator'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount, waitForAccount } from '@/composables/useMe'

/**
 * API-backed composable for the functions attached to one pipeline — what runs
 * on this pipe's events, in what order.
 *
 * NOT `useFunctions`, which is the account-level library. The same function can
 * be attached to several pipes; this is the attachment list.
 *
 * Wraps:
 *   GET    …/pipelines/{pipeline}/functions
 *   PUT    …/pipelines/{pipeline}/functions/{function}     (save code)
 *   POST   …/pipelines/{pipeline}/functions/{function}/reset
 *   POST   …/pipelines/{pipeline}/functions                (attach)   ← PR #16
 *   DELETE …/pipelines/{pipeline}/functions/{function}     (detach)   ← PR #16
 *   PUT    …/pipelines/{pipeline}/functions                (reorder)  ← PR #16
 *
 * The backend seeds the default templates on first read, so `load()` is also
 * what provisions functions for pipelines created before this feature.
 *
 * ## `reorder()` sends EVERY attached id, and that is not a convention
 *
 * `PipelineFunctionOrder` is `{function_ids: string[]}` and the backend treats
 * it as the complete order. Omitting one is a `422`, **not** a detach — so a
 * caller that sends only the two ids it moved gets a rejection, and a caller
 * that assumes the omission detaches is wrong about what would have happened.
 * `reorder()` therefore takes the whole list and `move()` builds it, rather than
 * exposing a swap. Detaching is `DELETE`, and only `DELETE`.
 *
 * ## The attach/detach pair is where the account library meets the pipe
 *
 * `attach()` takes an optional `position`; omitted, the function goes last,
 * which is what someone adding a step to an existing chain almost always means.
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

  /**
   * Attach an account function to this pipeline.
   *
   * @param {string} pipelineId
   * @param {string} functionId
   * @param {number|null} [position]  Omitted means last.
   */
  async function attach(pipelineId, functionId, position = null) {
    const base = await baseUrl(pipelineId)
    const res = await customFetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify({
        function_id: functionId,
        ...(position != null ? { position } : {})
      })
    })
    const attached = camelizeKeys(res.data)
    functions.value = [...functions.value, attached]
    return attached
  }

  /**
   * Detach a function from this pipeline. The function itself is untouched — it
   * stays in the account library and on any other pipe that holds it.
   *
   * @param {string} pipelineId
   * @param {string} functionId
   */
  async function detach(pipelineId, functionId) {
    const base = await baseUrl(pipelineId)
    await customFetch(`${base}/${functionId}`, { method: 'DELETE' })
    functions.value = functions.value.filter(f => f.functionId !== functionId)
  }

  /**
   * Set the order. Takes the COMPLETE list of attached function ids — see the
   * note at the top of this file; a partial list is a 422, not a detach.
   *
   * @param {string} pipelineId
   * @param {string[]} functionIds
   */
  async function reorder(pipelineId, functionIds) {
    const base = await baseUrl(pipelineId)
    const res = await customFetch(base, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ function_ids: functionIds })
    })
    functions.value = (res.data.items ?? []).map(camelizeKeys)
    return functions.value
  }

  /**
   * Move one function up or down by one place, then send the whole order.
   *
   * The full-list rule is why this is a helper rather than something each caller
   * builds: a drag handler assembling its own array is a 422 waiting to happen
   * the first time it forgets an untouched entry.
   *
   * @param {string} pipelineId
   * @param {string} functionId
   * @param {-1|1} delta
   */
  async function move(pipelineId, functionId, delta) {
    const ids = functions.value.map(f => f.functionId)
    const from = ids.indexOf(functionId)
    const to = from + delta
    if (from === -1 || to < 0 || to >= ids.length) return functions.value
    ids.splice(to, 0, ids.splice(from, 1)[0])
    return reorder(pipelineId, ids)
  }

  return {
    functions,
    loading,
    error,
    load,
    save,
    reset,
    attach,
    detach,
    reorder,
    move
  }
}
