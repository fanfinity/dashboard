import { ref } from 'vue'

// Base URL of the backend that serves the public connector catalog.
// The /api/sources endpoint is public (auth: false, CORS open) — no key needed to browse.
// Configurable for later (self-hosted / staging); keep in sync with the CSP host in index.html.
const BASE = (
  import.meta.env.VITE_EVENTS_BASE || 'https://console.fanfinity.io'
).replace(/\/$/, '')

/**
 * Per-connector logo. mode=meta omits logos, so each card points at this SVG endpoint,
 * which returns image/svg+xml (with its own built-in fallback icon).
 */
export function logoUrl(item) {
  const type = encodeURIComponent(item.packageType)
  const pkg = encodeURIComponent(item.packageId)
  return `${BASE}/api/sources/logo?type=${type}&package=${pkg}`
}

/**
 * Fetches the connector catalog from {BASE}/api/sources?mode=meta.
 * Returns reactive { connectors, loading, error } and a load() action.
 *
 * This is the browse-only catalog of connector *types* the upstream events
 * backend supports — not the event streams configured for this account. Those
 * live under /sources and are a different concept entirely.
 */
export function useConnectorCatalog() {
  const connectors = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${BASE}/api/sources?mode=meta`, {
        headers: { Accept: 'application/json' }
      })
      if (!res.ok) {
        throw new Error(`Catalog request failed (${res.status})`)
      }
      const data = await res.json()
      connectors.value = Array.isArray(data?.sources) ? data.sources : []
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      connectors.value = []
    } finally {
      loading.value = false
    }
  }

  return { connectors, loading, error, load }
}
