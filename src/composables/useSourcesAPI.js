import { ref } from 'vue'
import {
  createProvisionedSource,
  connectZidSource,
  getZidConnectStatus
} from '@/api/fanfinity'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount, waitForAccount } from '@/composables/useMe'

/**
 * Write access to the Sources domain on the real accounts backend.
 *
 * Unlike useSources() (which reads the list through useMockResource and only
 * hits the backend in real mode), this always talks to the generated client —
 * a create/connect is inherently a real operation with no mock equivalent, so
 * callers gate it on `useDataSource().isReal` themselves before invoking.
 *
 * Wraps the generated fetchers so the account id, key-case normalisation and
 * error normalisation live in one place:
 *   POST /v1/accounts/{account}/sources/provisioned        (createProvisionedSource)
 *   POST /v1/accounts/{account}/sources/{source}/connect-zid (connectZidSource)
 *   GET  /v1/accounts/{account}/sources/{source}/zid-status  (getZidConnectStatus)
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
   * **This posts to `…/sources/provisioned`, not to `…/sources`, and the choice
   * is load-bearing.** The agreed contract splits the two: the plain create
   * makes the row, its Jitsu site and a first write key and stops there, while
   * `…/sources/provisioned` also builds the ClickHouse database, the destination
   * and the pipeline joining them — which is the behaviour `/sources/new` step 3
   * is written against. On the plain endpoint `useSourceProvisioning()` finds no
   * pipeline, settles on `state: 'none'`, and `ProvisionedPipePanel` and
   * `SourceProvisionedOverlay` render nothing at all while the step's primary
   * action reverts to "Add a destination" — the exact hand-build that flow was
   * built to remove. It fails silently: no console error and no `ErrorState`,
   * so `pnpm smoke:dist` cannot see it.
   *
   * The backend labels `…/sources/provisioned` **legacy**, so this is a
   * deliberate stay-of-execution rather than a preference. If it goes, step 3
   * needs a real answer first (create then provision in two calls, or a
   * narrowed reveal); do not quietly drop back to the plain endpoint and leave
   * the panel and overlay dark. See `docs/contract-check-pr16.md`.
   *
   * The response is camelized before it leaves here, the same way the list read
   * is (`pageItems` in useSources). It is not a nicety: the write key the
   * backend just issued arrives as `write_key`, and the install guide the create
   * flow steps into reads `source.writeKey`. Returning the raw payload made a
   * freshly created source render "provisioning…" and a `your-write-key`
   * placeholder in every snippet, for a key that had in fact been issued.
   *
   * @returns {Promise<object>} the created Source, camelCase (so `writeKey`)
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
      const { data } = await createProvisionedSource(id, {
        name,
        slug,
        source_type: sourceType,
        template_id: templateId,
        store_id: storeId
      })
      return camelizeKeys(data)
    } catch (e) {
      error.value = e.message || 'Failed to create source'
      throw e
    } finally {
      saving.value = false
    }
  }

  /**
   * Register the Zid store's webhooks (and return the install snippet). The
   * source must already have a write key + Jitsu site, which `create()` above
   * sets for a Zid source.
   *
   * @returns {Promise<object>} ZidSourceConnectResult { status, storeId, webhooks, snippet }
   */
  async function connectZid(sourceId) {
    const id = await accountId()
    const { data } = await connectZidSource(id, sourceId)
    return camelizeKeys(data)
  }

  /**
   * Whether the Zid store behind this source has finished OAuth, and — when it
   * has not — the URL that starts one. Used by the setup wizard to gate the
   * webhook step, so an un-authorised store gets a clear prompt instead of a 502
   * from connect.
   *
   * **Returns the whole body, not a boolean.** PR #16's `zid-status` answers
   * `{connected, store_id, authorize_url?}`, and `authorize_url` is the half
   * that matters: it is a **start hop** (`/api/zid/start?start={code}`) that
   * consumes a single-use code and bakes an HMAC-signed `account_id` into a
   * first-party cookie. Zid drops the URL state for a logged-out merchant, so
   * that cookie is the only thing that links the finished handshake back to this
   * account — which is why the URL has to come from the backend and cannot be
   * built here. Treat each one as spent once opened.
   *
   * Raw customFetch is gone: the route is in the merged spec, so the generated
   * fetcher runs and the hand-built URL can no longer drift from the backend.
   * The 200 schema is a passthrough object, so orval maps no keys and the reply
   * arrives snake_case — hence `camelizeKeys`.
   *
   * @returns {Promise<{connected: boolean, authorizeUrl: string, storeId: ?string}>}
   */
  async function zidStatus(sourceId) {
    const id = await accountId()
    const { data } = await getZidConnectStatus(id, sourceId)
    const body = camelizeKeys(data) ?? {}
    return {
      connected: Boolean(body.connected),
      // Absent on a connected store, and absent everywhere until PR #16 is
      // deployed — the wizard falls back to the legacy entry rather than
      // treating an empty string as a failure.
      authorizeUrl: body.authorizeUrl || '',
      storeId: body.storeId ?? null
    }
  }

  return { saving, error, create, connectZid, zidStatus }
}
