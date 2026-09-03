import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, fetchCollection } from '@/composables/useMockResource'

/**
 * Salla stores that have authorized the Sfere app, and the URL that starts an
 * authorization. Salla port of `useZidConnections`:
 *
 *   GET …/salla-connections
 *   GET …/salla-authorize
 *
 * Same shape and reasoning as the Zid tab: a Salla connection is a step in adding
 * a source, not a thing you manage on its own, so it lives beside the streams it
 * produces. `SallaConnection` is `{store_id, name, domain?, connected_at}` with no
 * source link beyond `store_id`, so the join to sources is done by matching on
 * `store_id`. `getSallaAuthorizeUrl` returns an external OAuth start URL that is
 * opened as a link, never fetched (the CSP `connect-src` is the Sfere API only).
 */

/** One wire `SallaConnection`. */
export function adaptSallaConnection(raw) {
  const c = camelizeKeys(raw)
  return {
    storeId: c.storeId,
    name: c.name || c.storeId,
    domain: c.domain ?? null,
    connectedAt: c.connectedAt ?? null
  }
}

export function useSallaConnections() {
  const {
    data: connections,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('salla-connections', {
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/salla-connections`,
      // Not a Page envelope — `SallaConnectionList` is `{items}` with no paging.
      select: payload => (payload?.items ?? []).map(adaptSallaConnection)
    }
  })

  /**
   * The URL that starts an authorization. Read on demand rather than on mount:
   * it is only needed when someone clicks, and a URL fetched early may have gone
   * stale by the time it is used.
   *
   * @returns {Promise<{ok: true, data: string} | {ok: false, apiMissing?: true, error?: string}>}
   */
  async function authorizeUrl() {
    const res = await fetchCollection('salla-connections', {
      select: () => null,
      api: {
        path: () =>
          currentAccount.value &&
          `/v1/accounts/${currentAccount.value.id}/salla-authorize`,
        select: payload => camelizeKeys(payload)?.authorizeUrl ?? null
      }
    })
    if (!res.ok) return res
    if (!res.data) return { ok: false, apiMissing: true }
    return { ok: true, data: res.data }
  }

  return { connections, loading, error, apiMissing, load, authorizeUrl }
}
