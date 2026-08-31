import { computed, ref } from 'vue'
import { fetchCollection } from '@/composables/useMockResource'
import { currentAccount } from '@/composables/useMe'
import { pageItems } from '@/lib/apiShape'

/**
 * "What did the backend build for me when I created this source?"
 *
 * Creating a `web` or `zid` source provisions three things in one call, not
 * one: the Jitsu stream and write key, a per-source ClickHouse destination, and
 * the pipeline joining the two. All three exist by the time
 * `POST /v1/accounts/{account}/sources` returns — measured against staging on
 * 2026-08-27 by creating one source of each type and reading the two
 * collections immediately afterwards. No polling was needed, and only two of
 * the four types provision anything:
 *
 *   source_type   templates                        destination            pipeline
 *   web           web-sdk                          "{name} — ClickHouse"  "{name} → ClickHouse"
 *   zid           zid                              "{name} — ClickHouse"  "{name} → ClickHouse"
 *   event_stream  ios-sdk, android-sdk, http-api   none                   none
 *   cloud_app     shopify, stripe                  none                   none
 *
 * Those last two rows are why this discovers rather than assumes — and why the
 * matrix is worth keeping here rather than in the copy. Three of the seven
 * source templates get a write key and nothing else, so a panel hardcoded to
 * say "we connected your warehouse" would be wrong on an iOS SDK source and
 * would contradict the install guide's own "Nothing to install" on a Shopify
 * one. Nothing here is rendered from the source type: the pipe and the
 * destination are the records the backend actually returned, or the caller
 * shows nothing.
 *
 * The ClickHouse database is named off the source, not the account alone
 * (`web_{source8}_{account8}`, `store_{storeId}_{account8}`), so each of these
 * warehouses is genuinely per-source rather than a shared one being relinked.
 *
 * WHY A SEARCH RATHER THAN A LOOKUP: `Source` carries no `destination_id` or
 * `pipeline_id` (nine fields, none of them a link), and `listPipelines` takes no
 * `source_id` filter — so the only path from a source to its pipe is to list the
 * account's pipelines and match on `source_id`. If the backend later returns the
 * ids on the created source, this collapses to two `GET`s by id and the panel
 * above it does not change.
 *
 * `attempts`/`delayMs` exist for the case the observed behaviour stops being
 * true — if provisioning ever moved to a background job, a single read would come
 * back empty and the flow would quietly treat a web source as a pull source.
 * Retrying a bounded number of times and then saying "still setting up" is
 * correct whether it is synchronous or not.
 *
 * Two attempts rather than more, because provisioning IS synchronous today: on
 * `web`/`zid` the first read hits and nothing is retried, and the only source
 * types that reach the second attempt are the two that legitimately have no pipe,
 * where the extra 1.2s is invisible — the caller renders nothing either way. More
 * attempts would only lengthen the wait for an answer already known to be no.
 *
 * REAL MODE ONLY — the caller gates on `useDataSource().isReal`. In Demo mode a
 * source is never persisted, so there is no created source to find a pipe for,
 * and `fetchCollection` would answer out of `pipes.json` with somebody else's
 * fixture pipes.
 *
 * @returns {{
 *   state: import('vue').Ref<'idle'|'looking'|'found'|'none'|'unavailable'>,
 *   pipe: import('vue').Ref<object|null>,
 *   destination: import('vue').Ref<object|null>,
 *   provisioned: import('vue').ComputedRef<boolean>,
 *   discover: (sourceId: string, options?: {attempts?: number, delayMs?: number}) => Promise<void>
 * }}
 *
 * @example
 * const { state, pipe, destination, discover } = useSourceProvisioning()
 * if (isReal.value) discover(created.value.id)
 */
export function useSourceProvisioning() {
  // 'none' and 'unavailable' are deliberately different answers. 'none' is "the
  // backend built no pipe for this source", which is the truth for a cloud app.
  // 'unavailable' is "we could not find out" — a failed or missing read. They
  // render differently because collapsing them would report a read failure as a
  // fact about the product.
  const state = ref('idle')
  const pipe = ref(null)
  const destination = ref(null)

  const provisioned = computed(() => state.value === 'found')

  function accountPath(collection) {
    return () =>
      currentAccount.value &&
      `/v1/accounts/${currentAccount.value.id}/${collection}`
  }

  /**
   * One pass: list the account's pipelines and destinations, match the pipe to
   * this source, then the destination to that pipe.
   *
   * `size: 100` is the endpoint's maximum, and this is a single page on purpose
   * — the same trade `usePipes().joinEnds()` makes. An account with more than
   * 100 pipelines would fail to find a brand-new one, which reads as "still
   * setting up" rather than as a wrong pipe.
   */
  async function attempt(sourceId) {
    const [pipeRes, destinationRes] = await Promise.all([
      fetchCollection('pipes', {
        api: { path: accountPath('pipelines'), select: pageItems },
        query: { size: 100 }
      }),
      fetchCollection('destinations', {
        api: { path: accountPath('destinations'), select: pageItems },
        query: { size: 100 }
      })
    ])

    if (!pipeRes.ok) return { unavailable: true }

    const found =
      (pipeRes.data || []).find(p => p.sourceId === sourceId) ?? null
    if (!found) return { unavailable: false, pipe: null }

    // The pipe is the load-bearing find; its destination is the label. A
    // destinations read that failed leaves `destination` null and the panel
    // names the pipe without naming its end, rather than withholding a pipe we
    // did find.
    const end = destinationRes.ok
      ? ((destinationRes.data || []).find(d => d.id === found.destinationId) ??
        null)
      : null

    return { unavailable: false, pipe: found, destination: end }
  }

  async function discover(sourceId, { attempts = 2, delayMs = 1200 } = {}) {
    if (!sourceId) {
      state.value = 'none'
      return
    }

    state.value = 'looking'
    pipe.value = null
    destination.value = null

    for (let i = 0; i < attempts; i += 1) {
      const res = await attempt(sourceId)

      if (res.pipe) {
        pipe.value = res.pipe
        destination.value = res.destination ?? null
        state.value = 'found'
        return
      }

      // A read we could not complete is worth retrying; a read that completed
      // and found no pipe is only worth retrying because provisioning *might*
      // one day be async. Either way, the last attempt decides.
      const last = i === attempts - 1
      if (last) {
        state.value = res.unavailable ? 'unavailable' : 'none'
        return
      }

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return { state, pipe, destination, provisioned, discover }
}

export default useSourceProvisioning
