import { NOT_KNOWN } from '@/lib/emptyValue'
import { camelizeKeys, pageItems } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useMockResource, sendMutation } from '@/composables/useMockResource'

/**
 * Machine tokens that authenticate a caller to the Sfere API without a person
 * signing in — `GET/POST /v1/accounts/{account}/api-tokens` and
 * `DELETE …/api-tokens/{id}`, all live as of backend PR #16.
 *
 * ONE composable for what used to be two copies of
 * `useMockResource('api-tokens')`, in `useSettingsApiTokens` (Settings → API
 * tokens) and `useProfileApiTokens` (which lists the tokens allowed to read a
 * profile). Both read the same collection.
 *
 * ## Three things about the real endpoint that change the UI, not just the shape
 *
 * 1. **The plaintext is returned once and never again.** `POST` answers
 *    `ApiTokenCreated` — `{token, plaintext}` — and every later read carries
 *    only `hint`, the last four characters. `app/services/api_tokens.py` stores
 *    a SHA-256 hash and the hint, so the value genuinely cannot be recovered.
 *    That makes creation a copy-it-now moment rather than a row you can come
 *    back to, which is why `create()` returns the plaintext to its caller and
 *    this file never stashes it anywhere.
 * 2. **Revoke is a hard DELETE, not a state.** There is no `is_revoked`, no
 *    `revoked_at` and no tombstone — `revoke_api_token()` deletes the row. The
 *    fixture modelled a revoked-but-visible token as an audit record; the
 *    backend keeps no such record, so the row leaves the table and the confirm
 *    dialog has to say so.
 * 3. **`last_used_at` is in the schema and nothing writes it.** Nothing in the
 *    routers or services assigns `row.last_used_at`, so it is null on every
 *    response. Printing "Never" there would assert a token is unused when it
 *    may be serving production traffic, so it reports `NOT_KNOWN`. Same class
 *    as `WriteKey.last_used_at`, and the same reason.
 *
 * ## The scope vocabulary changed, and one screen depended on the old one
 *
 * `ApiTokenScope` is `read | write | admin`. The fixture used resource-scoped
 * strings (`profiles:read`, `events:write`), and `useProfileApi` filtered on
 * `'profiles:read'` exactly. There is no per-resource scope on the wire, so
 * `canReadProfiles()` below is the one place that decides — `read` or `admin`
 * on the wire, the old string in Demo mode — rather than each screen matching a
 * literal that only exists in one of the two modes.
 */

/** The scopes a token may hold, least privileged first. */
export const API_TOKEN_SCOPES = [
  {
    value: 'read',
    label: 'Read',
    description: 'List and fetch. Cannot change anything.'
  },
  {
    value: 'write',
    label: 'Write',
    description: 'Create, update and delete the resources it can read.'
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Everything write can do, plus account-level settings.'
  }
]

/** The fixture's per-resource profile-read scope. No wire counterpart. */
export const LEGACY_PROFILE_READ_SCOPE = 'profiles:read'

/**
 * Whether a token can read a profile through the Profile API.
 *
 * Accepts both vocabularies on purpose: the wire's coarse `read`/`admin` and
 * the fixture's `profiles:read`. One function rather than a literal in each
 * screen, because a screen matching only one of the two silently lists no
 * tokens in the other mode.
 *
 * @param {object} token
 * @returns {boolean}
 */
export function canReadProfiles(token) {
  const scopes = token?.scopes ?? []
  return (
    scopes.includes('read') ||
    scopes.includes('admin') ||
    scopes.includes(LEGACY_PROFILE_READ_SCOPE)
  )
}

/**
 * One wire `ApiToken` in the shape the tokens table reads.
 *
 * `isRevoked` is hardcoded false because a revoked token does not exist — see
 * note 2. It is set rather than omitted so the table's `v-if="!row.isRevoked"`
 * keeps showing the Revoke button instead of falling through to a "Revoked"
 * badge with no date.
 *
 * @param {object} raw  A snake_case `ApiToken`.
 * @returns {object}
 */
export function adaptApiToken(raw) {
  const t = camelizeKeys(raw)
  return {
    id: t.id,
    accountId: t.accountId ?? null,
    name: t.name || '',
    // No `description` on the wire. Absent, so the table's `v-if` drops the
    // second line rather than rendering an empty one.
    description: null,
    // The last four characters. The masked-reveal control already treats this
    // as a preview rather than a value, which is exactly what it is now.
    tokenPreview: t.hint ? `…${t.hint}` : '',
    scopes: Array.isArray(t.scopes) ? t.scopes : [],
    createdBy: t.createdBy ?? null,
    // A user id, not a name — `/v1/me` is the only thing that resolves names and
    // it only resolves the signed-in one. The table shows the id rather than
    // guessing a display name.
    createdByName: null,
    createdAt: t.createdAt ?? null,
    // Always null today. NOT the `NEVER` this column used to print.
    lastUsedAt: t.lastUsedAt ?? null,
    lastUsedFallback: NOT_KNOWN,
    expiresAt: t.expiresAt ?? null,
    isRevoked: false,
    revokedAt: null
  }
}

function tokensPath() {
  return (
    currentAccount.value && `/v1/accounts/${currentAccount.value.id}/api-tokens`
  )
}

/**
 * The account's API tokens, plus create and revoke.
 *
 * @returns {object}
 *   `{ tokens, loading, error, apiMissing, load, create, revoke }`.
 *   `create()` resolves to `sendMutation`'s discriminated result with
 *   `{ token, plaintext }` on `data` — hand `plaintext` straight to a
 *   copy-it-now dialog and drop it after; there is no second chance to read it.
 *
 * @example
 * const { tokens, load, create } = useApiTokens()
 * const res = await create({ name: 'CI', scopes: ['read'] })
 * if (res.ok && !res.skipped) showOnce(res.data.plaintext)
 */
export function useApiTokens() {
  const {
    data: tokens,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('api-tokens', {
    api: {
      path: tokensPath,
      select: payload => pageItems(payload).map(adaptApiToken)
    }
  })

  /**
   * Mint a token. The plaintext comes back on this one response and is never
   * served again, so the caller owns showing it.
   *
   * @param {{ name: string, scopes: string[], expiresAt?: string|null }} input
   */
  async function create({ name, scopes, expiresAt = null }) {
    const res = await sendMutation({
      method: 'POST',
      path: tokensPath,
      body: {
        name,
        scopes,
        // Omitted rather than sent as null when there is no expiry: the field is
        // optional and a null reads the same, but sending only what was chosen
        // keeps the request honest about what the form asked.
        ...(expiresAt ? { expires_at: expiresAt } : {})
      }
    })
    if (!res.ok) return res
    // Demo mode: nothing was created, so there is no plaintext to show. The
    // caller checks `skipped` before opening a dialog that would otherwise
    // display an empty secret.
    if (res.skipped) return res
    const created = camelizeKeys(res.data) ?? {}
    const token = adaptApiToken(created.token ?? {})
    tokens.value = [...tokens.value, token]
    return { ok: true, data: { token, plaintext: created.plaintext ?? '' } }
  }

  /**
   * Delete a token. It stops authenticating immediately and leaves no record —
   * the row goes, rather than turning into a revoked one.
   *
   * @param {string} id
   */
  async function revoke(id) {
    const res = await sendMutation({
      method: 'DELETE',
      path: () => {
        const base = tokensPath()
        return base && `${base}/${id}`
      }
    })
    if (!res.ok) return res
    if (res.skipped) {
      // Demo mode keeps the fixture's revoked-but-visible behaviour, because
      // that file models it and there is nothing to delete.
      tokens.value = tokens.value.map(t =>
        t.id === id
          ? { ...t, isRevoked: true, revokedAt: new Date().toISOString() }
          : t
      )
      return res
    }
    tokens.value = tokens.value.filter(t => t.id !== id)
    return res
  }

  return { tokens, loading, error, apiMissing, load, create, revoke }
}
