import { ref } from 'vue'
import { Notify } from 'quasar'
import { login } from '@/api/fanfinity'
import { API_BASE } from '@/api/mutator'
import {
  clearTokens,
  isAuthenticated,
  setTokens
} from '@/composables/useSession'
import { clearMe, loadMe } from '@/composables/useMe'

// Auth actions for the dashboard. Sign-in/registration go through the Fanfinity
// backend (POST /v1/auth/token and /v1/register) rather than the Firebase Auth
// SDK: the backend authenticates at the Identity Platform *project* level, which
// is where /v1/register creates users — a client-side, tenant-scoped Firebase
// sign-in cannot find those users and fails with EMAIL_NOT_FOUND. Tokens live in
// useSession; the signed-in user's profile lives in useMe.
const loading = ref(false)
const error = ref(null)

// Auth state is now synchronous — the access token is hydrated from localStorage
// at import (see useSession), so there's no async first-callback to await like
// Firebase's onAuthStateChanged had. Kept as an already-resolved promise so the
// router guard and useMe (which await it) need no change.
const authReadyPromise = Promise.resolve()
export function waitForAuthReady() {
  return authReadyPromise
}

function messageFor(e) {
  // Backend errors arrive as ApiError with a friendly RFC 9457 `detail`
  // (e.g. "No account found with that email", "Invalid password"), already
  // surfaced as e.message by the mutator.
  return e?.message || 'Something went wrong.'
}

// Registration goes through the backend (POST /v1/register), which is the only
// path that creates an account: it signs the user up in Identity Platform AND
// provisions their backend user + workspace in one step. Unauthenticated, so it
// bypasses the orval mutator with a plain fetch.
async function registerViaBackend(email, password, displayName) {
  const res = await fetch(`${API_BASE}/v1/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    // No name field on the login form yet, so default display_name to the email.
    body: JSON.stringify({
      email,
      password,
      display_name: displayName || email
    })
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // RFC 9457 problem+json ({ detail, title, ... }).
    throw new Error(
      body?.detail || body?.title || `Registration failed (${res.status})`
    )
  }
  return body
}

async function run(fn) {
  loading.value = true
  error.value = null
  try {
    await fn()
    return true
  } catch (e) {
    const msg = messageFor(e)
    error.value = msg
    Notify.create({ type: 'negative', message: msg })
    return false
  } finally {
    loading.value = false
  }
}

// Exchange credentials for tokens via the backend, persist them, then bootstrap
// the session profile (GET /v1/me).
async function signInWithBackend(email, password) {
  const { data } = await login({
    grant_type: 'password',
    username: email,
    password
  })
  setTokens({ access: data.access_token, refresh: data.refresh_token })
  await loadMe()
}

export function useAuth() {
  // v0.1: email + password only, no verification step. Registration provisions
  // the backend account first (POST /v1/register), then signs in through
  // /v1/auth/token so loadMe() finds a real account.
  const signUp = (email, password, displayName) =>
    run(async () => {
      await registerViaBackend(email, password, displayName)
      await signInWithBackend(email, password)
    })

  const signIn = (email, password) =>
    run(() => signInWithBackend(email, password))

  const logOut = () =>
    run(async () => {
      clearTokens()
      clearMe()
    })

  return {
    isAuthenticated,
    loading,
    error,
    signUp,
    signIn,
    logOut
  }
}
