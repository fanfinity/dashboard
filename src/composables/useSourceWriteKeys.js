import { ref } from 'vue'
import { ApiError, customFetch } from '@/api/mutator'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useDataSource } from '@/composables/useDataSource'

/**
 * A source's write keys — `GET/POST …/sources/{id}/write-keys` and
 * `DELETE …/sources/{id}/write-keys/{write_key_id}`, all live as of backend
 * PR #16. This is three of the five items in
 * `todos/backend-ask-source-settings.md`: rotation, server-to-server keys and
 * revocation.
 *
 * ## Rotation is two steps, and that turns out to be the better answer
 *
 * There is no `rotate-write-key` route, which is what the ask asked for.
 * Instead: mint a new key, paste it, revoke the old one. Revocation takes
 * effect immediately with no overlap window — so the two-step version is the
 * one that gives you a window at all, because you choose when the old key dies.
 * The panel's copy says that sequence rather than the impossible "update your
 * snippet first, then rotate" it used to.
 *
 * The half that made rotation LOOK broken is below, under "the key the snippet
 * has to show": nothing on the backend moves `Source.write_key` onto the new
 * key, and `plaintext` on the create response is the bare secret rather than the
 * `keyId:secret` pair ingest wants. So a rotation used to change nothing the
 * reader could see, and the value they copied would have been rejected if they
 * had pasted it.
 *
 * ## Three sharp edges, all of them load-bearing
 *
 * 1. **A source with no Jitsu site answers `400`, not `404`.** Both the list and
 *    the create route raise
 *    `"Source has no Jitsu site; write keys are provisioned with it"`. That
 *    matters because the repo-wide gate in `useMockResource` treats any
 *    `ApiError` whose status is not 404 as a real failure and renders
 *    `ErrorState` — so an unprovisioned source would show a red "something
 *    broke" box for a perfectly ordinary state. This composable therefore does
 *    its own fetching and reports that case as `noSite`, which the panel renders
 *    as a sentence.
 * 2. **`last_used_at` is null for every key created here.**
 *    `stream_write_keys()` hardcodes `last_used_at=None` on the branch that
 *    merges the local `write_keys` row, which is the branch every key minted
 *    through `POST …/write-keys` takes. A key that came from Jitsu's own stream
 *    config does carry `lastUsed`. So the field is real for some keys and never
 *    populated for others, and a null has to print `NOT_KNOWN` rather than
 *    "Never": telling someone a key is unused when it may be serving
 *    production traffic is exactly the wrong way to inform a revoke decision.
 * 3. **`name` DOES survive a re-read**, whatever the handler's docstring says.
 *    `create_source_write_key_route`'s docstring claims the label "is echoed in
 *    this response but not persisted"; two lines later it calls
 *    `record_write_key(..., name=body.name)`, and `listSourceWriteKeys` merges
 *    that local row back in. The code is right and the comment is wrong, so the
 *    UI shows and keeps key names.
 *
 * The plaintext comes back once, on the create response only, exactly like an
 * API token — hand it to `SecretRevealDialog` and drop it.
 */

/** `public` goes in client-side code; `private` must never leave a server. */
export const WRITE_KEY_KINDS = [
  {
    value: 'public',
    label: 'Browser key',
    description:
      'Public by design. Safe in client-side code, the same way a Google Analytics id is.'
  },
  {
    value: 'private',
    label: 'Server-to-server key',
    description:
      'Private. For calls from your own backend, never in anything a browser downloads.'
  }
]

/**
 * One wire `WriteKey` in the shape the settings panel renders.
 *
 * @param {object} raw  A snake_case `WriteKey`.
 * @returns {object}
 */
export function adaptWriteKey(raw) {
  const k = camelizeKeys(raw)
  return {
    id: k.id,
    sourceId: k.sourceId ?? null,
    kind: k.kind === 'private' ? 'private' : 'public',
    name: k.name || '',
    // The last few characters. Never the key.
    hint: k.hint || '',
    createdAt: k.createdAt ?? null,
    // Null for anything minted through this UI — see note 2.
    lastUsedAt: k.lastUsedAt ?? null,
    expiresAt: k.expiresAt ?? null
  }
}

// -------------------------------------------- the key the snippet has to show
//
// ROTATION DOES NOT MOVE `Source.write_key`, AND NOTHING ON THE BACKEND WILL.
// `POST …/write-keys` mints a key on the Jitsu stream and records its
// kind/name/hint locally; `DELETE …/write-keys/{id}` takes it back off. Neither
// touches `sources.write_key`, which is written once, at create, to the key
// issued with the site (`_mappers.py`: `write_key=source.write_key or
// source.jitsu_site_id`). So the field every install snippet in this app reads
// is a snapshot of the FIRST key, and re-reading the source after a rotation
// returns exactly what it returned before — which is why rotating a browser key
// left the "Setup instructions" snippet showing the old key, and, once the old
// one was revoked, showing a dead one.
//
// The dashboard therefore keeps the key it just minted, for this session, and
// prefers it over the record's. Session-only and deliberately NOT persisted: the
// value exists exactly once, in the create response, so writing it to
// `localStorage` would park a live credential on disk to save a click — the same
// call `useOnboarding` already makes when it records `sourceId` and refuses the
// key beside it. A reload falls back to the record, and the banner below says
// which key is on screen.
const mintedKeys = ref({})

/**
 * A usable write key is the `keyId:secret` pair. `POST …/write-keys` answers
 * with the BARE SECRET (`plaintext=key.secret` in the backend's create route,
 * with a comment saying the dashboard is the one that composes the pair), while
 * `Source.write_key` is stored already composed (`f"{id}:{secret}"`). Composing
 * it here is what makes a freshly minted key interchangeable with the record's
 * — and what stops a rotated key being pasted into a snippet in a form ingest
 * rejects.
 *
 * @param {string} keyId
 * @param {string} secret
 * @returns {string} `keyId:secret`, or '' when there is no secret
 */
export function composeWriteKey(keyId, secret) {
  if (!secret) return ''
  if (!keyId || secret.startsWith(`${keyId}:`)) return secret
  return `${keyId}:${secret}`
}

/**
 * The id half of a `keyId:secret` pair — what a `WriteKey.id` from the list
 * endpoint can be matched against. Empty for a key with no id half, which is
 * what `Source.write_key` falls back to when the source has no key at all (the
 * mapper substitutes the bare `jitsu_site_id`), so callers can tell "this is a
 * real pair" from "this is the fallback".
 *
 * @param {string} writeKey
 * @returns {string}
 */
export function writeKeyIdOf(writeKey) {
  const value = String(writeKey || '')
  if (!value.includes(':')) return ''
  return value.slice(0, value.indexOf(':'))
}

/**
 * Record a key minted in this session so the install snippets can show it.
 *
 * @param {string} sourceId
 * @param {{ id: string, value: string }} key
 */
export function rememberMintedWriteKey(sourceId, key) {
  if (!sourceId || !key?.value) return
  mintedKeys.value = { ...mintedKeys.value, [sourceId]: { ...key } }
}

/**
 * Drop a remembered key — called when that same key is revoked, so revoking the
 * replacement puts the snippet back on the record's key rather than leaving it
 * showing something that no longer works.
 *
 * @param {string} sourceId
 * @param {string} keyId
 */
export function forgetMintedWriteKey(sourceId, keyId) {
  const held = mintedKeys.value[sourceId]
  if (!held || (keyId && held.id !== keyId)) return
  const next = { ...mintedKeys.value }
  delete next[sourceId]
  mintedKeys.value = next
}

/**
 * The browser key minted for this source in this session, or null.
 *
 * @param {string} sourceId
 * @returns {{ id: string, value: string } | null}
 */
export function mintedWriteKeyFor(sourceId) {
  return mintedKeys.value[sourceId] ?? null
}

/**
 * The key an install snippet should carry: whatever was minted this session,
 * falling back to the one on the source record. The single reader for every
 * snippet surface, so the Setup instructions tab, the Web SDK panel and the
 * create flow's step 3 cannot disagree about which key is live.
 *
 * @param {object} source a source row carrying `id` and `writeKey`
 * @returns {string}
 */
export function snippetWriteKey(source) {
  return mintedWriteKeyFor(source?.id)?.value || source?.writeKey || ''
}

export function useSourceWriteKeys() {
  const { isMock } = useDataSource()

  const keys = ref([])
  const loading = ref(false)
  const error = ref(null)
  const apiMissing = ref(false)
  /** The source has no Jitsu site, so it has no keys to have. Not a failure. */
  const noSite = ref(false)

  function basePath(sourceId) {
    const account = currentAccount.value
    return (
      account && `/v1/accounts/${account.id}/sources/${sourceId}/write-keys`
    )
  }

  /**
   * Reads the source's keys. Never throws; the caller reads the four flags.
   *
   * @param {string} sourceId
   */
  async function load(sourceId) {
    keys.value = []
    error.value = null
    apiMissing.value = false
    noSite.value = false

    // Demo mode has no fixture for this collection — there was no endpoint to
    // model when the fixtures were written, and inventing keys in a file that
    // ships in the bundle is the one fixture worth not having.
    if (isMock.value) {
      apiMissing.value = true
      return
    }

    const path = basePath(sourceId)
    if (!path) {
      apiMissing.value = true
      return
    }

    loading.value = true
    try {
      const { data } = await customFetch(path, { method: 'GET' })
      keys.value = (data?.items ?? []).map(adaptWriteKey)
    } catch (e) {
      // The 400 branch is a real state and not an error — see note 1. Checked
      // before the generic branch precisely because the shared gate would get
      // this one wrong.
      if (e instanceof ApiError && e.status === 400) noSite.value = true
      else if (e instanceof ApiError && e.status !== 404)
        error.value = e.message
      else apiMissing.value = true
    } finally {
      loading.value = false
    }
  }

  /**
   * Mint a key. Its plaintext is on this response and nowhere else, ever.
   *
   * @param {string} sourceId
   * @param {{ kind: 'public'|'private', name?: string, expiresAt?: string|null }} input
   * @returns {Promise<{ ok: true, data: { key: object, plaintext: string } } | { ok: false, apiMissing?: true, noSite?: true, error?: string }>}
   */
  async function create(sourceId, { kind, name = '', expiresAt = null }) {
    if (isMock.value) return { ok: false, apiMissing: true }
    const path = basePath(sourceId)
    if (!path) return { ok: false, apiMissing: true }
    try {
      const { data } = await customFetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Same reason every other POST here carries one: a dropped response
          // must not mint a second key nobody knows about.
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          kind,
          ...(name ? { name } : {}),
          ...(expiresAt ? { expires_at: expiresAt } : {})
        })
      })
      const created = camelizeKeys(data) ?? {}
      const key = adaptWriteKey(created.key ?? {})
      // `plaintext` is the bare secret; `writeKey` is what a snippet takes. Both
      // are returned because they are two different claims — the panel reveals
      // the pair, and a caller that only wants to know a secret came back can
      // still ask that question.
      const writeKey = composeWriteKey(key.id, created.plaintext ?? '')
      keys.value = [...keys.value, key]
      // A browser key is the one an install snippet carries, so remembering it
      // here is what makes the rotation visible on the Setup instructions tab.
      // A server-to-server key is never in a snippet and is deliberately not
      // held: it must not outlive the dialog that shows it.
      if (key.kind === 'public') {
        rememberMintedWriteKey(sourceId, { id: key.id, value: writeKey })
      }
      return {
        ok: true,
        data: { key, plaintext: created.plaintext ?? '', writeKey }
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        return { ok: false, noSite: true }
      }
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    }
  }

  /**
   * Revoke a key. Immediate, with no overlap window — anything still presenting
   * it is rejected from the next request, which is why the panel confirms first
   * and names the key.
   *
   * @param {string} sourceId
   * @param {string} writeKeyId
   */
  async function revoke(sourceId, writeKeyId) {
    if (isMock.value) return { ok: false, apiMissing: true }
    const path = basePath(sourceId)
    if (!path) return { ok: false, apiMissing: true }
    try {
      await customFetch(`${path}/${writeKeyId}`, { method: 'DELETE' })
      keys.value = keys.value.filter(k => k.id !== writeKeyId)
      // Revoking the key we are showing in the snippets puts them back on the
      // source record's key. Leaving it held would keep a dead key on screen,
      // which is the failure this whole session store exists to end.
      forgetMintedWriteKey(sourceId, writeKeyId)
      return { ok: true }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    }
  }

  return { keys, loading, error, apiMissing, noSite, load, create, revoke }
}
