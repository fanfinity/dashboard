import { ref } from 'vue'
import { getMe } from '@/api/fanfinity'

// Session bootstrap: the signed-in user's backend record + account
// memberships from GET /v1/me, loaded once auth is ready (useAuth.js calls
// loadMe/clearMe from its onAuthStateChanged listener). Module-scoped
// singletons, same pattern as useAuth.js — future account-scoped screens
// read `memberships` to drive an account picker.
export const me = ref(null)
export const memberships = ref([])
const loading = ref(false)
const error = ref(null)

// Best-effort: errors land in `error` instead of throwing, so a backend
// hiccup never blocks routing (the router guard only awaits Firebase auth).
export async function loadMe() {
  loading.value = true
  error.value = null
  try {
    const { data } = await getMe()
    me.value = data.user
    memberships.value = data.memberships
  } catch (e) {
    error.value = e.message || 'Failed to load profile.'
  } finally {
    loading.value = false
  }
}

export function clearMe() {
  me.value = null
  memberships.value = []
  error.value = null
}

export function useMe() {
  return { me, memberships, loading, error, loadMe }
}
