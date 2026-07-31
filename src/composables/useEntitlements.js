import { ref } from 'vue'

// Which product modules this account may use. In the reference product this is
// GET /api/entitlements returning [{ key, name, enabled }]; here it is mock data
// until there is a backend to ask.
//
// Module-level state so the nav and every gated page agree without refetching.
const entitlements = ref([])
const loading = ref(false)
const error = ref(null)
let loaded = false

// Optimistic default: gates are for hiding modules an account hasn't bought, and
// showing a screen briefly is far better than hiding one that should be there.
// Callers that need certainty should await load() first.
const DEFAULT_ENABLED = true

export function useEntitlements() {
  async function load() {
    if (loaded) return
    loading.value = true
    error.value = null
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}data/entitlements.json`,
        { headers: { Accept: 'application/json' } }
      )
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`)
      }
      const data = await res.json()
      entitlements.value = Array.isArray(data) ? data : []
      loaded = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      entitlements.value = []
    } finally {
      loading.value = false
    }
  }

  function isEnabled(key) {
    if (!key) return true
    const hit = entitlements.value.find(e => e.key === key)
    return hit ? Boolean(hit.enabled) : DEFAULT_ENABLED
  }

  return { entitlements, loading, error, load, isEnabled }
}
