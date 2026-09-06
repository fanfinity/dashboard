import { ref, computed } from 'vue'
import { getMe } from '@/api/fanfinity'
import { waitForAuthReady } from '@/composables/useAuth'

// Session bootstrap: the signed-in user's backend record + account
// memberships from GET /v1/me. useAuth.js calls loadMe() after a successful
// sign-in and clearMe() on sign-out; the router also calls loadMe() (via
// waitForAccount) on cold load into an authed route. Module-scoped singletons,
// same pattern as useAuth.js — future account-scoped screens read `memberships`
// to drive an account picker.
export const me = ref(null)
export const memberships = ref([])
const loading = ref(false)
const error = ref(null)

// True when GET /v1/me says this identity has no usable backend account.
// Distinct from a transient backend error: the login flow and router guard sign
// such a user out instead of stranding them in a shell where every
// account-scoped call has no id to send.
//
// TWO SHAPES, because the backend's identity flip added the second one. It used
// to be a 403 alone (self-provisioning disabled; accounts came only from
// registration or invitation). Identity is now Firebase-only — one Identity
// Platform tenant per account, with `account_id` and `role` as custom claims —
// and `/v1/me` builds its memberships array FROM THOSE CLAIMS, so a token
// missing them answers `200 {user, memberships: []}` rather than a 403. That is
// a reachable state, not a theoretical one: provisioning stamps the claims in a
// best-effort step, so a tenant user whose claim write failed can sign in
// perfectly well and still have no account behind them.
//
// Read as a success, it is the worse of the two failures: sign-in reports
// success, the guard lets the reader through, and the app renders a shell where
// `currentAccount` is null and every screen reports "No API yet" — a workspace
// that looks broken rather than a login that says what is wrong.
export const accountMissing = ref(false)

// The account the user acts in: prefer one they own, else their first
// membership. With one tenant per account this is a single-entry list in
// practice, but the endpoint still answers an array so the pick stays. Null
// before GET /v1/me returns — and null AFTER it, for a token carrying no
// `account_id` claim, which is what `accountMissing` above reports.
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
      memberships.value = data.memberships ?? []
      // A 200 with an empty array is an answer, not a gap: the endpoint reads
      // the caller's account and role off the token's claims, so nothing there
      // means nothing to act in. Set only after a successful read — while the
      // request is in flight `memberships` is still the previous value.
      accountMissing.value = memberships.value.length === 0
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
