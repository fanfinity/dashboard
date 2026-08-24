import { useMockResource } from '@/composables/useMockResource'

/**
 * The browsable catalog of connector *types* — what could be connected — behind
 * `/sources?tab=connectors`.
 *
 * NOT the sources at `/sources` (that is `useSources`, the streams already
 * configured for this account) and not `useSourceTemplates()` either, which
 * backs the create screen's picker with workspace-shaped defaults.
 *
 * This used to fetch a third-party vendor's public catalog endpoint directly,
 * including per-connector logo images from that host — which is why the CSP
 * had to whitelist it under both `connect-src` and `img-src`. It now reads
 * `GET /v1/connectors` like every other screen: the dashboard talks to the
 * Sfere backend and to nothing else, and the backend owns whichever upstream
 * catalog it aggregates.
 */
export function useConnectorCatalog() {
  const {
    data: connectors,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('connectors', {
    api: { path: '/v1/connectors', select: payload => payload.items }
  })

  return { connectors, loading, error, apiMissing, load }
}
