import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, fetchCollection } from '@/composables/useMockResource'

/**
 * Zid stores that have authorised the Sfere app, and the URL that starts an
 * authorisation. Both live as of backend PR #16:
 *
 *   GET …/zid-connections
 *   GET …/zid-authorize
 *
 * ## Why this is a tab on /sources and not a screen
 *
 * Same reasoning as the connector catalog: a Zid connection is a step in adding
 * a source, not a thing you manage on its own. A store authorises, then a source
 * is created against it — so the list belongs beside the streams it produces.
 *
 * ## An authorised store is not a source
 *
 * `ZidConnection` is `{store_id, name, domain?, connected_at}`. There is no
 * source id on it and no source-to-store link on the `Source` record either
 * beyond `store_id`, so the join is done here by matching on `store_id`. A store
 * with no source is the interesting row on this tab — it means someone finished
 * the authorisation and nobody built the source, which is a stalled setup rather
 * than a completed one.
 *
 * ## `getZidAuthorizeUrl` returns a URL to send someone to, not a fetch target
 *
 * `{authorize_url}` is an external OAuth page. It is opened as a link, never
 * fetched: the CSP is `connect-src` on the Sfere API hosts only, so a fetch of
 * it would be blocked — correctly, since the whole point is that the merchant
 * signs in on Zid's own domain.
 */

/** One wire `ZidConnection`. */
export function adaptZidConnection(raw) {
  const c = camelizeKeys(raw)
  return {
    storeId: c.storeId,
    name: c.name || c.storeId,
    domain: c.domain ?? null,
    connectedAt: c.connectedAt ?? null
  }
}

export function useZidConnections() {
  const {
    data: connections,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('zid-connections', {
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/zid-connections`,
      // Not a Page envelope — `ZidConnectionList` is `{items}` with no paging,
      // so `pageItems` would work but would imply pagination that is not there.
      select: payload => (payload?.items ?? []).map(adaptZidConnection)
    }
  })

  /**
   * The URL that starts an authorisation. Read on demand rather than on mount:
   * it is only needed when someone clicks, and a URL fetched early may have gone
   * stale by the time it is used.
   *
   * @returns {Promise<{ok: true, data: string} | {ok: false, apiMissing?: true, error?: string}>}
   */
  async function authorizeUrl() {
    const res = await fetchCollection('zid-connections', {
      // No fixture equivalent: Demo mode has stores but no live OAuth to start,
      // and a fake authorise URL is worse than an honest "not in Demo mode".
      select: () => null,
      api: {
        path: () =>
          currentAccount.value &&
          `/v1/accounts/${currentAccount.value.id}/zid-authorize`,
        select: payload => camelizeKeys(payload)?.authorizeUrl ?? null
      }
    })
    if (!res.ok) return res
    if (!res.data) return { ok: false, apiMissing: true }
    return { ok: true, data: res.data }
  }

  return { connections, loading, error, apiMissing, load, authorizeUrl }
}
