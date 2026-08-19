import { useMockResource } from '@/composables/useMockResource'

// Which product modules this account may use. In the reference product this is
// GET /api/entitlements returning [{ key, name, enabled }]; here it is mock data
// until there is a backend to ask.
//
// Module-level state so the nav and every gated page agree without refetching.
// A single shared useMockResource instance gives every caller the same
// data/loading/error refs; `loaded` is the extra guard useMockResource itself
// doesn't have, so a second caller's load() is a no-op instead of a refetch.
const resource = useMockResource('entitlements', { initial: [] })
let loaded = false

// Optimistic default: gates are for hiding modules an account hasn't bought, and
// showing a screen briefly is far better than hiding one that should be there.
// Callers that need certainty should await load() first.
const DEFAULT_ENABLED = true

export function useEntitlements() {
  async function load() {
    if (loaded) return
    await resource.load()
    // Only latch on success, mirroring the original fetch-based guard: a
    // failed load must stay retriable on the next call rather than freezing
    // every gate at the optimistic default for the rest of the session.
    if (!resource.error.value) loaded = true
  }

  function isEnabled(key) {
    if (!key) return true
    const hit = resource.data.value.find(e => e.key === key)
    return hit ? Boolean(hit.enabled) : DEFAULT_ENABLED
  }

  return {
    entitlements: resource.data,
    loading: resource.loading,
    error: resource.error,
    load,
    isEnabled
  }
}
