import { auth } from '@/firebase'

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

// getIdToken() returns the cached Identity Platform ID token, refreshing only
// when it's near expiry; getIdToken(true) forces a refresh (used once after a
// 401, e.g. a token revoked server-side but still cached).
async function send(url, options, forceRefresh) {
  if (!auth.currentUser) throw new ApiError('Not signed in', 401)
  const token = await auth.currentUser.getIdToken(forceRefresh)
  return fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  })
}

export async function customFetch(url, options) {
  let res = await send(url, options, false)
  if (res.status === 401 && auth.currentUser)
    res = await send(url, options, true)

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
