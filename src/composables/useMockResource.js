import { ref } from 'vue'
import { useDataSource } from '@/composables/useDataSource'
import { waitForAccount } from '@/composables/useMe'
import { customFetch, ApiError } from '@/api/mutator'

/**
 * Loads one JSON collection from `public/data/`, or — once Settings → Data
 * source is switched to "real" — the equivalent live endpoint.
 *
 * Every screen in the rebuild reads its data through this factory, so the
 * fetch/normalise/error semantics are written once. It mirrors
 * useConnectorCatalog(): it never throws, it resets `data` to `initial` on
 * failure, it normalises whatever was thrown into a string on `error`, and it
 * always clears `loading` in `finally`.
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
 * @param {object} [options.api]
 *   Wires this resource to a real endpoint from `openapi/cdp-api-draft.yaml`
 *   for when Settings → Data source is set to "real". Omit it entirely for a
 *   domain that has not been checked against the draft yet — in real mode it
 *   then reports `apiMissing` with no network attempt, rather than guessing a
 *   path. The real payload shape is its own contract: `api.select` defaults to
 *   identity rather than falling back to `options.select`, because several
 *   mock files are wrapped (e.g. `trash.json`'s `payload.pipes`) in a way the
 *   drafted real endpoint is not.
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
 * // A plain list, wired to the real endpoint once the backend ships it.
 * const { data: sources, loading, error, apiMissing, load } = useMockResource(
 *   'sources',
 *   { api: { path: '/v1/sources' } }
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
      const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, {
        headers: { Accept: 'application/json' }
      })
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`)
      }
      const payload = await res.json()
      const picked = select ? select(payload) : payload
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
      // waitForAccount() subsumes waitForAuthReady() and additionally settles
      // the acting account, so a function `api.path` (account-scoped route) has
      // the id it needs on the first load rather than resolving to null.
      await waitForAccount()
      const path = typeof api.path === 'function' ? api.path() : api.path
      // A path function with no account to build from means "nothing to call
      // yet" — same contract as an unwired resource, no request attempted.
      if (!path) {
        apiMissing.value = true
        data.value = blank()
        return
      }
      const { data: payload } = await customFetch(path, { method: 'GET' })
      const picked = api.select ? api.select(payload) : payload
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
    // `mockOnly` resources are static catalogs with no backend equivalent
    // (e.g. the source/destination template lists), so they always read the
    // bundled JSON — otherwise real mode would report `apiMissing` and leave a
    // create form with nothing to pick.
    if (isReal.value && !mockOnly) {
      await loadReal()
    } else {
      await loadMock()
    }
  }

  return { data, loading, error, apiMissing, load }
}
