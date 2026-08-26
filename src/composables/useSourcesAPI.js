import { ref } from 'vue'
import { createSource, connectZidSource } from '@/api/fanfinity'
import { customFetch } from '@/api/mutator'
import { currentAccount, waitForAccount } from '@/composables/useMe'

/**
 * Write access to the Sources domain on the real accounts backend.
 *
 * Unlike useSources() (which reads the list through useMockResource and only
 * hits the backend in real mode), this always talks to the generated client —
 * a create/connect is inherently a real operation with no mock equivalent, so
 * callers gate it on `useDataSource().isReal` themselves before invoking.
 *
 * Wraps the generated fetchers so the account id and error normalisation live
 * in one place:
 *   POST /v1/accounts/{account}/sources                    (createSource)
 *   POST /v1/accounts/{account}/sources/{source}/connect-zid (connectZidSource)
 */
export function useSourcesAPI() {
  const saving = ref(false)
  const error = ref(null)

  async function accountId() {
    await waitForAccount()
    const id = currentAccount.value?.id
    if (!id) throw new Error('No account selected')
    return id
  }

  /**
   * Create a source. For a Zid store, pass `storeId` and `sourceType: 'zid'` —
   * the backend provisions the Jitsu site + write key from the account's
   * workspace as part of this call.
   *
   * @returns {Promise<object>} the created Source (snake_case, straight from the API)
   */
  async function create({
    name,
    slug,
    sourceType = null,
    templateId = null,
    storeId = null
  }) {
    saving.value = true
    error.value = null
    try {
      const id = await accountId()
      const { data } = await createSource(id, {
        name,
        slug,
        source_type: sourceType,
        template_id: templateId,
        store_id: storeId
      })
      return data
    } catch (e) {
      error.value = e.message || 'Failed to create source'
      throw e
    } finally {
      saving.value = false
    }
  }

  /**
   * Register the Zid store's webhooks (and return the install snippet). The
   * source must already have a write key + Jitsu site, which createSource sets
   * for a Zid source.
   *
   * @returns {Promise<object>} ZidSourceConnectResult { status, storeId, webhooks, snippet }
   */
  async function connectZid(sourceId) {
    const id = await accountId()
    const { data } = await connectZidSource(id, sourceId)
    return data
  }

  /**
   * Whether the Zid store behind this source has finished OAuth (the zid-app
   * holds tokens for it). Used by the setup wizard to gate the webhook step, so
   * an un-authorised store gets a clear prompt instead of a 502 from connect.
   *
   * Raw customFetch rather than a generated fetcher: the route exists in the
   * backend (sources.py, operation_id getZidConnectStatus) but is missing from
   * spec/openapi.yml, so orval does not generate it. Add it to the spec and
   * re-run `pnpm openapi:generate` to type it properly.
   *
   * @returns {Promise<boolean>}
   */
  async function isZidConnected(sourceId) {
    const id = await accountId()
    const { data } = await customFetch(
      `/v1/accounts/${id}/sources/${sourceId}/zid-status`,
      { method: 'GET' }
    )
    return Boolean(data?.connected)
  }

  return { saving, error, create, connectZid, isZidConnected }
}
