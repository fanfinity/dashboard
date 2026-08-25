import { ref } from 'vue'
import { Notify } from 'quasar'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '@/firebase'
import { API_BASE } from '@/api/mutator'
import { loadMe, clearMe } from '@/composables/useMe'

// Module-scoped singletons so every useAuth() call shares one reactive view
// of the signed-in user, mirroring the pattern in useJitsu.js.
export const user = ref(null)
const loading = ref(false)
const error = ref(null)
let authReady = false

// onAuthStateChanged's first callback is async (it round-trips to check
// persisted auth state), so a router guard reading `user.value` immediately
// on page load would wrongly treat a signed-in user as signed-out. This
// resolves once that first callback fires, so callers can await it.
let resolveAuthReady
const authReadyPromise = new Promise(resolve => {
  resolveAuthReady = resolve
})

function ensureListener() {
  if (authReady) return
  authReady = true
  onAuthStateChanged(auth, firebaseUser => {
    user.value = firebaseUser
    // Best-effort session bootstrap from the backend (fire-and-forget so a
    // backend hiccup never delays resolveAuthReady / the router guard).
    if (firebaseUser) loadMe()
    else clearMe()
    resolveAuthReady()
  })
}

export function waitForAuthReady() {
  ensureListener()
  return authReadyPromise
}

// Identity Platform error codes (https://cloud.google.com/identity-platform/docs/error-codes)
// mapped to short, user-facing messages.
const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests':
    'Too many attempts. Please wait a moment and try again.'
}

function messageFor(e) {
  return ERROR_MESSAGES[e?.code] || e?.message || 'Something went wrong.'
}

// Registration goes through the backend (POST /v1/register), which is the only
// path that creates an account: it signs the user up in Identity Platform AND
// provisions their backend user + workspace in one step. Client-side Firebase
// sign-up is deliberately not used — it would create an auth user with no
// backend account, which the API now rejects with 403. Unauthenticated, so it
// bypasses the auth-required orval mutator with a plain fetch.
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
    const err = new Error(
      body?.detail || body?.title || `Registration failed (${res.status})`
    )
    if (res.status === 409) err.code = 'auth/email-already-in-use'
    throw err
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

export function useAuth() {
  ensureListener()

  // v0.1: email + password only, no verification step. Registration provisions
  // the backend account first (POST /v1/register), then signs the user in via
  // Firebase so onAuthStateChanged fires and loadMe() finds a real account.
  const signUp = (email, password, displayName) =>
    run(async () => {
      await registerViaBackend(email, password, displayName)
      await signInWithEmailAndPassword(auth, email, password)
    })

  const signIn = (email, password) =>
    run(() => signInWithEmailAndPassword(auth, email, password))

  const logOut = () => run(() => signOut(auth))

  return {
    user,
    loading,
    error,
    signUp,
    signIn,
    logOut,
    tenantId: auth.tenantId
  }
}
