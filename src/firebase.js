import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Google Cloud Identity Platform runs on the Firebase Auth JS SDK. Only
// apiKey + authDomain are required for email/password sign-in (no other
// Firebase product is used here, so no projectId/storageBucket/etc).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)

// Pin every sign-in/sign-up to the one Identity Platform tenant that exists
// today (see CLAUDE.md § Authentication & multi-tenancy). auth.tenantId is an
// in-memory instance property the SDK never persists, so it must be set here,
// at module init, before anything else can call a sign-in/sign-up function —
// this module's top-level code reruns on every full page load, which is the
// only time it could need re-establishing.
const defaultTenantId = import.meta.env.VITE_FIREBASE_DEFAULT_TENANT_ID
if (!defaultTenantId) {
  console.warn(
    'VITE_FIREBASE_DEFAULT_TENANT_ID is not set — auth will fall back to the ' +
      'project-level user pool instead of the fanfinity-app tenant.'
  )
}
auth.tenantId = defaultTenantId || null
