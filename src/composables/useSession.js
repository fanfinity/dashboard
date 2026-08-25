import { computed, ref } from 'vue'

// Session token store. Replaces the Firebase Auth SDK's IndexedDB persistence
// and silent token refresh: the dashboard now signs in through the backend's
// POST /v1/auth/token (project-level, matching registration) and holds the
// returned Firebase ID token + refresh token here. The access token is a
// short-lived (~1h) Bearer credential; when it expires, src/api/mutator.js
// trades the refresh token at POST /v1/auth/refresh for a fresh one.
//
// Leaf module by design — depends only on vue + localStorage — so both the API
// mutator and useAuth can import it without a cycle.

const ACCESS_KEY = 'sfere_access_token'
const REFRESH_KEY = 'sfere_refresh_token'

function read(key) {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    // localStorage can throw in private-mode / non-browser contexts.
    return ''
  }
}

function write(key, value) {
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Best-effort: an in-memory ref still backs the current tab.
  }
}

// Hydrated synchronously at import so the router guard can read auth state on
// cold load without awaiting anything (unlike Firebase's async first callback).
export const accessToken = ref(read(ACCESS_KEY))
export const refreshToken = ref(read(REFRESH_KEY))

export const isAuthenticated = computed(() => !!accessToken.value)

export function setTokens({ access, refresh }) {
  accessToken.value = access || ''
  write(ACCESS_KEY, accessToken.value)
  // A refresh response may omit the refresh token; keep the existing one then.
  if (refresh !== undefined) {
    refreshToken.value = refresh || ''
    write(REFRESH_KEY, refreshToken.value)
  }
}

export function clearTokens() {
  accessToken.value = ''
  refreshToken.value = ''
  write(ACCESS_KEY, '')
  write(REFRESH_KEY, '')
}
