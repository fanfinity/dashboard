/**
 * Opening a Zid authorisation, and the one rule about where its URL comes from.
 *
 * ## The URL is the backend's to build, never ours
 *
 * PR #16 answers an authorisation URL from two places — `…/zid-authorize` for an
 * account with no store yet, and `authorize_url` on `…/sources/{id}/zid-status`
 * for a source whose store has not authorised. Both point at the same start hop,
 * `/api/zid/start?start={code}`: it consumes a single-use code and sets an
 * HMAC-signed first-party cookie carrying the `account_id`. That cookie is
 * load-bearing — Zid's login flow drops the URL `state` for a merchant who is
 * not already signed in, so the cookie is the only thing that tells the OAuth
 * callback which account just finished. The backend deliberately trusts no
 * client-supplied account id, so a URL assembled in the browser cannot be
 * account-linked. Fetch it, do not build it.
 *
 * ## The legacy entry, and why it is still here
 *
 * `{VITE_ZID_APP_URL}/redirect-url?store_id=…` is the pre-PR-#16 entry. It is
 * what `api-staging` serves **today** — measured, not assumed: `/redirect-url`
 * answers a 302 there while `/api/zid/start`, `/zid-authorize` and
 * `/zid-connections` all answer 404. So this file prefers the backend's URL and
 * falls back to the legacy one, which means the correct signed flow switches
 * itself on the day PR #16 deploys, with no code change and no flag.
 *
 * The fallback is a real downgrade, not a synonym: it completes OAuth and stores
 * tokens against the store, so `zid-status` flips to connected, but nothing
 * links the store to this account and it will not appear in `zid-connections`.
 * It needs a `storeId` for that reason — there is no account context to carry.
 *
 * ## Always a navigation, never a fetch
 *
 * `connect-src` names the Sfere API hosts only, so fetching an authorisation URL
 * would be blocked — correctly, since the whole point is that the merchant signs
 * in on Zid's own domain. `window.open` throughout.
 */

/** The host serving the legacy `/redirect-url`. Empty unless `.env` sets it. */
export const zidAppUrl = import.meta.env.VITE_ZID_APP_URL || ''

/**
 * The pre-PR-#16 authorisation entry. Empty when the var is unset or no store id
 * is known — callers disable the control rather than opening a broken URL.
 *
 * @param {string} [storeId]
 * @returns {string}
 */
export function legacyAuthorizeUrl(storeId) {
  if (!zidAppUrl || !storeId) return ''
  return `${zidAppUrl.replace(/\/$/, '')}/redirect-url?store_id=${encodeURIComponent(storeId)}`
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
