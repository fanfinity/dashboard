import { ref } from 'vue'
import { useDataSource } from '@/composables/useDataSource'
import { waitForAccount } from '@/composables/useMe'
import { customFetch, ApiError } from '@/api/mutator'

/**
 * The read half of the data-source gate, factored out of `useMockResource()`
 * so `fetchCollection()` below shares the exact same fetch/select semantics
 * rather than reimplementing them. Both return the *picked* payload and let
 * the caller decide what a missing pick means; both throw on failure so the
 * caller owns the error-vs-apiMissing distinction.
 */
async function readMockFile(name, select) {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, {
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`)
  }
  const payload = await res.json()
  return select ? select(payload) : payload
}

/**
 * Turns a `path` — a static string, or a function evaluated once the acting
 * account has settled — into the string to call, or `null` when there is
 * nothing to call yet.
 *
 * `waitForAccount()` subsumes `waitForAuthReady()` and additionally settles
 * `currentAccount`, so an account-scoped path function has the id it needs on
 * the very first load rather than resolving to null and reading as "not built
 * yet". Every read and write goes through here, so that guarantee is made
 * once instead of per caller.
 */
async function resolveApiPath(path) {
  await waitForAccount()
  return (typeof path === 'function' ? path() : path) || null
}

async function readApiPath(path, select) {
  const { data: payload } = await customFetch(path, { method: 'GET' })
  return select ? select(payload) : payload
}

/**
 * `{ level: 'error', search: 'checkout', start: undefined }` -> `'?level=error&search=checkout'`.
 *
 * Drops `undefined`, `null` and `''` so a cleared filter widens the query
 * instead of sending an empty-string filter the backend would have to
 * special-case. `Date` values go out as ISO strings.
 */
function buildQueryString(params) {
  const parts = []
  for (const [key, raw] of Object.entries(params || {})) {
    if (raw === undefined || raw === null || raw === '') continue
    const value = raw instanceof Date ? raw.toISOString() : String(raw)
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  }
  return parts.length ? `?${parts.join('&')}` : ''
}

/**
 * Loads one JSON collection from `public/data/`, or — in the default "real"
 * data-source mode — the equivalent live endpoint on the Fanfinity backend.
 *
 * Every screen in the rebuild reads its data through this factory, so the
 * fetch/normalise/error semantics are written once: it never throws, it resets
 * `data` to `initial` on failure, it normalises whatever was thrown into a
 * string on `error`, and it always clears `loading` in `finally`.
 *
 * Use `fetchCollection()` below instead when a read needs query parameters —
 * `load()` here deliberately takes no arguments, so a filtered or paginated
 * read (Live Events) composes the one-shot helper rather than bending this
 * one. Both go through the same gate and the same two readers.
 *
 * The mock URL is built as `${import.meta.env.BASE_URL}data/${name}.json` —
 * note there is NO leading slash on the `data/` segment. BASE_URL already ends
 * in one, and a second slash would resolve against the origin root, which
 * breaks hash-mode routing and any deploy under a subpath.
 *
 * @param {string} name
 *   File basename without `.json`, e.g. `'pipes'` -> `data/pipes.json`.
 * @param {object} [options]
 * @param {*} [options.initial=[]]
 *   Value `data` holds before the first load and after a failed one. Pass `{}`
 *   (or a shaped object) for endpoints that return an object rather than a list.
 * @param {(payload: any) => any} [options.select]
 *   Picks a sub-key out of the parsed mock payload. Used for `trash.json`,
 *   which is one file keyed by resource, and for the object-shaped files.
 * @param {boolean} [options.mockOnly=false]
 *   For a static catalog with no backend equivalent (the source/destination
 *   template lists): always read the bundled JSON, in every mode. Without it
 *   real mode would report `apiMissing` and leave a create form with nothing
 *   to pick.
 * @param {object} [options.api]
 *   Wires this resource to its live endpoint. Omit it entirely for a domain
 *   that has no endpoint yet — real mode then reports `apiMissing` with no
 *   network attempt, rather than guessing a path. The live payload shape is
 *   its own contract: `api.select` defaults to identity rather than falling
 *   back to `options.select`, because several mock files are wrapped (e.g.
 *   `trash.json`'s `payload.pipes`) in a way the endpoint is not — and because
 *   the backend answers snake_case inside a `Page` envelope, which is what
 *   `pageItems` from `@/lib/apiShape` exists to unwrap.
 * @param {string|(() => string|null)} options.api.path
 *   The live endpoint, appended to the same `VITE_API_BASE` the generated
 *   accounts/RBAC client uses (`src/api/mutator.js`). Either a static string
 *   (`'/v1/customers'`) or a function evaluated at load time — the latter for
 *   account-scoped routes that need the acting account id, e.g.
 *   `() => account.value && '/v1/accounts/' + account.value.id + '/sources'`.
 *   A function returning null (no account yet) reads as `apiMissing`, no
 *   request made. The account is awaited before the function runs.
 * @param {(payload: any) => any} [options.api.select]
 * @returns {{ data: import('vue').Ref, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, apiMissing: import('vue').Ref<boolean>, load: () => Promise<void> }}
 *
 * @example
 * // An account-scoped list — the backend wraps it in a Page envelope.
 * const { data: sources, loading, error, apiMissing, load } = useMockResource(
 *   'sources',
 *   {
 *     api: {
 *       path: () =>
 *         currentAccount.value &&
 *         `/v1/accounts/${currentAccount.value.id}/sources`,
 *       select: pageItems
 *     }
 *   }
 * )
 * onMounted(load)
 *
 * @example
 * // One resource's slice of the shared trash file — mock only for now.
 * const { data: deletedPipes, load } = useMockResource('trash', {
 *   select: payload => payload.pipes
 * })
 */
export function useMockResource(name, options = {}) {
  const { initial = [], select = null, api = null, mockOnly = false } = options
  const { isReal } = useDataSource()

  // A fresh copy every time, so a screen that mutates `data` in place cannot
  // poison the value a later failed load resets to.
  function blank() {
    if (Array.isArray(initial)) return [...initial]
    if (initial && typeof initial === 'object') return { ...initial }
    return initial
  }

  const data = ref(blank())
  const loading = ref(false)
  const error = ref(null)
  // True when real mode has nothing to call — either this resource has no
  // `api` wired yet, or the live request came back 404 / failed outright
  // (network error, CORS, an unreachable local backend). All three read the
  // same to a screen: "no endpoint exists here yet", not "something broke".
  const apiMissing = ref(false)

  async function loadMock() {
    loading.value = true
    error.value = null
    try {
      const picked = await readMockFile(name, select)
      // A `select` that misses (renamed key, absent slice) must land on the
      // caller's `initial` shape rather than on undefined — screens render
      // straight off `data` and an undefined would blow up the template.
      data.value = picked === undefined || picked === null ? blank() : picked
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      data.value = blank()
    } finally {
      loading.value = false
    }
  }

  async function loadReal() {
    if (!api) {
      apiMissing.value = true
      data.value = blank()
      return
    }
    loading.value = true
    error.value = null
    try {
      const path = await resolveApiPath(api.path)
      // A path function with no account to build from means "nothing to call
      // yet" — same contract as an unwired resource, no request attempted.
      if (!path) {
        apiMissing.value = true
        data.value = blank()
        return
      }
      const picked = await readApiPath(path, api.select)
      data.value = picked === undefined || picked === null ? blank() : picked
    } catch (e) {
      // A route that does not exist yet, or a request that never reached the
      // backend at all (connection refused, CORS-blocked staging), both mean
      // "not built yet" here — only a real non-404 response is a genuine
      // error worth an `ErrorState`.
      if (e instanceof ApiError && e.status !== 404) {
        error.value = e.message
      } else {
        apiMissing.value = true
      }
      data.value = blank()
    } finally {
      loading.value = false
    }
  }

  async function load() {
    apiMissing.value = false
    if (isReal.value && !mockOnly) {
      await loadReal()
    } else {
      await loadMock()
    }
  }

  return { data, loading, error, apiMissing, load }
}

/**
 * Sends a write (POST/PATCH/DELETE) through the same gate `loadReal()` reads
 * through: a no-op in "Demo data" mode (the caller applies its own local
 * mutation), the live endpoint in "Real API" mode.
 *
 * This is the generic escape hatch, and it is deliberately *not* the only way
 * to write. A create is typed and often does more than write a row — the
 * backend provisions a Jitsu site for a source, a ClickHouse database for a
 * destination — so creates go through the generated client in
 * `useSourcesAPI`/`useDestinationsAPI`/`usePipelinesAPI`. What lands here is
 * the flat rest: enable/pause and soft-delete, where the whole operation is
 * one PATCH or DELETE and a typed wrapper would be ceremony.
 *
 * It returns a discriminated result rather than throwing, because a page that
 * fires a success toast unconditionally after a write would lie whenever the
 * endpoint isn't there — see `notifyMutationResult()` in
 * `useMutationFeedback.js`, which is the one shared toast for all three
 * outcomes.
 *
 * @param {{ method: 'POST'|'PUT'|'PATCH'|'DELETE', path: string|(() => string|null), body?: object }} args
 *   `path` takes the same two forms as `useMockResource`'s `api.path`; a
 *   function is resolved after the acting account settles, and a null result
 *   reads as `apiMissing` with no request made.
 * @returns {Promise<
 *   | { ok: true, skipped: true, data: null }
 *   | { ok: true, skipped?: false, data: any }
 *   | { ok: false, apiMissing: true }
 *   | { ok: false, error: string }
 * >}
 *
 * @example
 * const res = await sendMutation({
 *   method: 'DELETE',
 *   path: () =>
 *     currentAccount.value &&
 *     `/v1/accounts/${currentAccount.value.id}/sources/${id}`
 * })
 * if (res.ok) sources.value = sources.value.filter(s => s.id !== id)
 */
export async function sendMutation({ method, path, body }) {
  const { isMock } = useDataSource()
  if (isMock.value) return { ok: true, skipped: true, data: null }

  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  // Required by every POST in the draft (Idempotency-Key parameter) so a
  // dropped-response retry can't double-create; PUT/PATCH/DELETE don't need one
  // (repeating any of them converges to the same state).
  if (method === 'POST') headers['Idempotency-Key'] = crypto.randomUUID()

  try {
    const resolved = await resolveApiPath(path)
    if (!resolved) return { ok: false, apiMissing: true }
    const { data } = await customFetch(resolved, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    return { ok: true, data }
  } catch (e) {
    if (e instanceof ApiError && e.status !== 404) {
      return { ok: false, error: e.message }
    }
    return { ok: false, apiMissing: true }
  }
}

/**
 * One-shot read for a collection that needs query parameters — the read-side
 * counterpart to `sendMutation()`, and the escape hatch for the one thing
 * `useMockResource()` cannot express: `load()` there takes no arguments, so a
 * filtered/paginated read has nowhere to put its filters.
 *
 * Same gate, same two readers, same "a 404 or an unreachable backend means
 * not-built-yet, a real non-404 means broken" rule — and the same
 * discriminated result shape `sendMutation()` returns, rather than throwing,
 * so a caller can tell `apiMissing` from `error` without a try/catch.
 *
 * In "Demo data" mode `query` is ignored: the fixture is a whole file, and
 * filtering it is the caller's job (see `useLiveEvents()`, which applies the
 * same predicates locally so the toolbar still visibly works in that mode).
 *
 * @param {string} name  Mock file basename, e.g. `'live-events'`.
 * @param {object} [options]
 * @param {(payload: any) => any} [options.select]      Pick out of the mock file.
 * @param {object} [options.api]                        `{ path, select? }`, as in `useMockResource`.
 * @param {object} [options.query]                      Appended as a query string in real mode only.
 * @returns {Promise<
 *   | { ok: true, data: any }
 *   | { ok: false, apiMissing: true }
 *   | { ok: false, error: string }
 * >}
 *
 * @example
 * const res = await fetchCollection('live-events', {
 *   api: { path: '/v1/events', select: p => p.items },
 *   query: { streamId, level, search }
 * })
 * if (res.ok) events.value = res.data
 */
export async function fetchCollection(name, options = {}) {
  const { select = null, api = null, query = null } = options
  const { isMock } = useDataSource()

  if (isMock.value) {
    try {
      const picked = await readMockFile(name, select)
      return { ok: true, data: picked ?? null }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  if (!api) return { ok: false, apiMissing: true }

  try {
    const resolved = await resolveApiPath(api.path)
    if (!resolved) return { ok: false, apiMissing: true }
    const picked = await readApiPath(
      `${resolved}${buildQueryString(query)}`,
      api.select
    )
    return { ok: true, data: picked ?? null }
  } catch (e) {
    if (e instanceof ApiError && e.status !== 404) {
      return { ok: false, error: e.message }
    }
    return { ok: false, apiMissing: true }
  }
}
