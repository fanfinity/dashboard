import { useMockResource } from '@/composables/useMockResource'

/**
 * OAuth authorizations = the consent Fanfinity holds to act on a third-party
 * account (a Google Ads manager account, a Meta business, a Salesforce org) on
 * the workspace's behalf.
 *
 * Two things live in `public/data/oauth-authorizations.json`, and they answer
 * different questions:
 *
 *   providers       which third parties this instance can authorize against,
 *                   and the scopes each one asks for. Reference data.
 *   authorizations  the grants actually obtained, each tied to one named
 *                   account, with an expiry that destinations depend on.
 *
 * They are separate endpoints on the real product (`/api/oauth-providers` and
 * `/api/oauth-authorizations`), so they are separate composables here: the
 * provider catalog is *secondary* to the screen, and its failure must degrade
 * one panel rather than the page.
 *
 * Writes have no backend. `revoke` mutates the loaded array and nothing else —
 * a reload re-reads the JSON and the change is gone. Pages own the toast.
 */

/**
 * How a grant reads. `expired` is amber rather than rose because it is a
 * routine end-of-life that a reconnect fixes; `revoked` is a deliberate
 * withdrawal and reads as the harder state.
 */
export const AUTHORIZATION_STATUS = {
  active: { label: 'Active', variant: 'success' },
  expired: { label: 'Expired', variant: 'warn' },
  revoked: { label: 'Revoked', variant: 'danger' }
}

/**
 * The status descriptor for one authorization.
 *
 * The stored `status` is the source of truth rather than a comparison against
 * `Date.now()`: a screen whose badges flip while it is open — and whose smoke
 * screenshots differ per run — is not worth the extra accuracy.
 *
 * @param {object} authorization
 * @returns {{ key: string, label: string, variant: string }}
 */
export function authorizationStatus(authorization) {
  const key = authorization?.status ?? 'active'
  const entry = AUTHORIZATION_STATUS[key] ?? AUTHORIZATION_STATUS.active
  return { key, ...entry }
}

/**
 * `https://www.googleapis.com/auth/adwords` -> `adwords`.
 *
 * Google states scopes as URLs and everyone else states them as bare strings.
 * The trailing segment is the part that differs between two Google scopes, so
 * it is the part worth showing in a table cell.
 *
 * @param {string} scope
 * @returns {string}
 */
export function shortScope(scope) {
  const value = String(scope ?? '')
  if (!value.includes('/')) return value
  return value.split('/').filter(Boolean).pop() ?? value
}

/**
 * A scope list as one line, shortened.
 *
 * @param {Array<string>|null|undefined} scopes
 * @returns {string}
 */
export function formatScopes(scopes) {
  return (scopes ?? []).map(shortScope).join(', ')
}

/**
 * The grants obtained, plus local-only revocation.
 *
 * @returns {{
 *   authorizations: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   revoke: (id: string) => void
 * }}
 *
 * @example
 * const { authorizations, loading, error, load } = useSettingsAuthorizations()
 * onMounted(load)
 */
export function useSettingsAuthorizations() {
  const {
    data: authorizations,
    loading,
    error,
    load
  } = useMockResource('oauth-authorizations', {
    select: payload => payload.authorizations
  })

  function findById(id) {
    return authorizations.value.find(a => a.id === id) ?? null
  }

  // Revoking keeps the record: the audit trail of who authorized what, and
  // when it stopped working, is the point of the screen.
  function revoke(id) {
    authorizations.value = authorizations.value.map(a =>
      a.id === id ? { ...a, status: 'revoked', expiresAt: a.expiresAt } : a
    )
  }

  return { authorizations, loading, error, load, findById, revoke }
}

/**
 * The provider catalog. Reference data, read-only, and *secondary* on the
 * authorizations screen — it gets its own loading/error/retry so a failure here
 * costs one panel rather than the whole route.
 *
 * @returns {{
 *   providers: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 */
export function useSettingsOauthProviders() {
  const {
    data: providers,
    loading,
    error,
    load
  } = useMockResource('oauth-authorizations', {
    select: payload => payload.providers
  })

  return { providers, loading, error, load }
}

/**
 * Providers decorated with the grants pointing at them, so a panel can say
 * "connected" without re-deriving the join per row.
 *
 * A provider counts as connected only while a grant against it is `active`: an
 * expired or revoked grant is exactly the case the screen exists to surface.
 *
 * @param {Array} providers
 * @param {Array} authorizations
 * @returns {Array}
 */
export function decorateProviders(providers, authorizations) {
  return (providers ?? []).map(provider => {
    const grants = (authorizations ?? []).filter(
      a => a.providerId === provider.id
    )
    return {
      ...provider,
      authorizationCount: grants.length,
      isConnected: grants.some(a => a.status === 'active')
    }
  })
}
