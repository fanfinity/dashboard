// Adapts the accounts/RBAC backend's payload shape to the one the screens are
// written against. The backend (see openapi/fanfinity-api.json) returns
// snake_case fields wrapped in a Page envelope ({ items, total, page, size,
// pages }); the mock JSON in public/data/ and every screen use camelCase bare
// arrays. These helpers bridge the two so a domain composable can wire a real
// endpoint through useMockResource() with a one-line `api.select`.

/**
 * snake_case -> camelCase for the top-level keys of a flat object. Shallow by
 * design: nested blobs (a destination's `config`, a sync run's `counts`) are
 * passed through untouched, matching how the source-scoped composables already
 * treat them and avoiding mangling arbitrary user config keys.
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function camelizeKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v
  }
  return out
}

/**
 * Unwraps a Page envelope's `items` and camelizes each row. Use as the
 * `api.select` for a list endpoint:
 *
 *   api: { path: () => `/v1/accounts/${id}/sources`, select: pageItems }
 *
 * A payload that is already a bare array (or missing `items`) is tolerated, so
 * this stays correct if an endpoint is ever un-paginated.
 *
 * @param {{ items?: any[] } | any[]} payload
 * @returns {any[]}
 */
export function pageItems(payload) {
  const items = Array.isArray(payload) ? payload : (payload?.items ?? [])
  return items.map(camelizeKeys)
}
