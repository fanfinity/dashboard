import { ref } from 'vue'
import { Notify } from 'quasar'
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '@/firebase'
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

  const signUp = (email, password) =>
    run(async () => {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      // The backend API rejects unverified emails (its JIT user provisioning
      // trusts the email claim), so kick off verification immediately.
      // Best-effort: a failed send shouldn't fail the whole sign-up.
      try {
        await sendEmailVerification(cred.user)
        Notify.create({
          type: 'info',
          message: `Verification email sent to ${email}.`
        })
      } catch {
        /* user can be re-sent one later */
      }
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
