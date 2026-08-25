import { ref, computed } from 'vue'
import { getMe } from '@/api/fanfinity'
import { waitForAuthReady } from '@/composables/useAuth'

// Session bootstrap: the signed-in user's backend record + account
// memberships from GET /v1/me, loaded once auth is ready (useAuth.js calls
// loadMe/clearMe from its onAuthStateChanged listener). Module-scoped
// singletons, same pattern as useAuth.js — future account-scoped screens
// read `memberships` to drive an account picker.
export const me = ref(null)
export const memberships = ref([])
const loading = ref(false)
const error = ref(null)

// True when GET /v1/me was rejected because no backend account exists for this
// identity (403 — self-provisioning is disabled server-side; accounts are made
// only via registration or invitation). Distinct from a transient backend error:
// the login flow and router guard sign such a user out instead of stranding them
// in a shell that 403s every call.
export const accountMissing = ref(false)

// The account the user acts in: prefer one they own, else their first
// membership. Every signed-up user now has at least one (the backend
// auto-provisions a personal account + owner role on first login), so this is
// null only before GET /v1/me returns.
export const currentMembership = computed(() => {
  const list = memberships.value
  if (!list.length) return null
  return list.find(m => m.role === 'owner') || list[0]
})
export const currentAccount = computed(
  () => currentMembership.value?.account ?? null
)
export const currentRole = computed(() => currentMembership.value?.role ?? null)

// Best-effort: errors land in `error` instead of throwing, so a backend
// hiccup never blocks routing (the router guard only awaits Firebase auth).
//
// De-duped: the auth listener kicks this off fire-and-forget, and
// `waitForAccount()` may call it again before that first request resolves. A
// single in-flight promise means both await the same GET rather than racing two.
let inflight = null
export async function loadMe() {
  if (inflight) return inflight
  loading.value = true
  error.value = null
  accountMissing.value = false
  inflight = (async () => {
    try {
      const { data } = await getMe()
      me.value = data.user
      memberships.value = data.memberships
    } catch (e) {
      error.value = e.message || 'Failed to load profile.'
      // 403 (and 404) mean "no account for this identity", not a transient
      // outage — surface it so the caller can sign the user out.
      accountMissing.value = e?.status === 403 || e?.status === 404
    } finally {
      loading.value = false
      inflight = null
    }
  })()
  return inflight
}

// Resolves once the acting account is known, or null if the user has none / the
// profile load failed. Account-scoped data (`/v1/accounts/{id}/...`) awaits this
// rather than `waitForAuthReady()` alone, because the auth listener starts
// `loadMe()` without awaiting it, so `currentAccount` is usually still null the
// instant auth becomes ready.
export async function waitForAccount() {
  await waitForAuthReady()
  if (!currentAccount.value) await loadMe()
  return currentAccount.value
}

export function clearMe() {
  me.value = null
  memberships.value = []
  error.value = null
  accountMissing.value = false
}

export function useMe() {
  return {
    me,
    memberships,
    currentMembership,
    currentAccount,
    currentRole,
    loading,
    error,
    loadMe
  }
}
