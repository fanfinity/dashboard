import {
  accessToken,
  clearTokens,
  refreshToken,
  setTokens
} from '@/composables/useSession'

// Custom fetch used by every generated operation in src/api/fanfinity.ts
// (wired via orval.config.js). Talks to the Fanfinity backend (accounts/RBAC
// API — NOT the console.fanfinity.io events system).
//
// Dev default is the local backend (`make run` in ../backend); deployed
// builds set VITE_API_BASE to the staging/prod host
// (docs/backend-auth-integration.md).
export const API_BASE = (
  import.meta.env.VITE_API_BASE || 'http://localhost:8080'
).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, problem) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    // RFC 9457 problem+json body ({ type, title, status, detail, ... })
    this.problem = problem
  }
}

// Attach the current access token as a Bearer header when we have one. The
// unauthenticated calls (login, register, refresh) simply go out without it.
function send(url, options) {
  const headers = { ...options?.headers, Accept: 'application/json' }
  if (accessToken.value) headers.Authorization = `Bearer ${accessToken.value}`
  return fetch(`${API_BASE}${url}`, { ...options, headers })
}

// Trade the refresh token for a fresh access token. Uses a plain fetch (not the
// generated refresh() operation) so it never recurses back through customFetch's
// 401 handler. Returns true on success; clears the session and returns false on
// any failure, so the caller can surface a 401 that bounces to /login.
let refreshing = null
async function tryRefresh() {
  if (!refreshToken.value) return false
  // De-dupe: several requests hitting 401 at once share one refresh round-trip.
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ refresh_token: refreshToken.value })
        })
        if (!res.ok) {
          clearTokens()
          return false
        }
        const body = await res.json().catch(() => null)
        if (!body?.access_token) {
          clearTokens()
          return false
        }
        setTokens({ access: body.access_token, refresh: body.refresh_token })
        return true
      } catch {
        clearTokens()
        return false
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}

export async function customFetch(url, options) {
  let res = await send(url, options)
  // A 401 on an authenticated call usually means the access token expired —
  // refresh once and retry. Nothing to refresh (login/register/refresh itself,
  // or a signed-out caller) falls straight through.
  if (res.status === 401 && refreshToken.value && (await tryRefresh())) {
    res = await send(url, options)
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(
      body?.detail || body?.title || `Request failed (${res.status})`,
      res.status,
      body
    )
  }
  return { data: body, status: res.status, headers: res.headers }
}
