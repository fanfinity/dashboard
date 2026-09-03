/**
 * Opening a Salla authorisation, and the one rule about where its URL comes from.
 * Salla port of `zidAuthorize.js`.
 *
 * ## The URL is the backend's to build, never ours
 *
 * The backend answers an authorisation URL from two places — `…/salla-authorize`
 * for an account with no store yet, and `authorize_url` on
 * `…/sources/{id}/salla-status` for a source whose store has not authorised. Both
 * point at the same start hop, `/api/salla/start?start={code}`: it consumes a
 * single-use code and sets an HMAC-signed first-party cookie carrying the
 * `account_id`. That cookie is load-bearing — Salla's login flow drops the URL
 * `state` for a merchant who is not already signed in, so the cookie is the only
 * thing that tells the OAuth callback which account just finished. The backend
 * trusts no client-supplied account id, so a URL assembled in the browser cannot
 * be account-linked. Fetch it, do not build it.
 *
 * ## The legacy entry
 *
 * `{VITE_SALLA_APP_URL}/redirect-url?store_id=…` is a best-effort fallback for an
 * environment that only exposes a bare install entry. Like the Zid fallback it is
 * a real downgrade: it completes OAuth and stores a token against the store, so
 * `salla-status` flips to connected, but nothing links the store to this account
 * and it will not appear in `salla-connections`. It needs a `storeId` for that
 * reason — there is no account context to carry.
 *
 * ## Always a navigation, never a fetch
 *
 * `connect-src` names the Sfere API hosts only, so fetching an authorisation URL
 * would be blocked — correctly, since the merchant signs in on Salla's own
 * domain. `window.open` throughout.
 */

/** The host serving the legacy `/redirect-url`. Empty unless `.env` sets it. */
export const sallaAppUrl = import.meta.env.VITE_SALLA_APP_URL || ''

/**
 * The legacy authorisation entry. Empty when the var is unset or no store id is
 * known — callers disable the control rather than opening a broken URL.
 *
 * @param {string} [storeId]
 * @returns {string}
 */
export function legacyAuthorizeUrl(storeId) {
  if (!sallaAppUrl || !storeId) return ''
  return `${sallaAppUrl.replace(/\/$/, '')}/redirect-url?store_id=${encodeURIComponent(storeId)}`
}

/**
 * Open an authorisation URL in a new tab.
 *
 * Call it **synchronously from the click**. Minting a fresh start code first
 * would put an `await` between the gesture and the open, which is what popup
 * blockers exist to stop; callers open the URL they already hold and refresh
 * afterwards for the next click.
 *
 * @param {string} url
 * @returns {boolean} whether there was a URL to open
 */
export function openAuthorize(url) {
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
