import { NOT_KNOWN } from '@/lib/emptyValue'
import { useMockResource, sendMutation } from '@/composables/useMockResource'
import { currentAccount } from '@/composables/useMe'
import { pageItems, camelizeKeys } from '@/lib/apiShape'

/**
 * Sources = configured event streams and cloud apps that feed the fan graph.
 *
 * NOT the connector catalog at `/connectors` (that is `useConnectorCatalog`,
 * which browses what *could* be connected). A source here is an existing,
 * configured ingestion point with a write key, event counts and pipes hanging
 * off it.
 *
 * Data is mock JSON (`public/data/sources.json`), read through
 * `useMockResource`, so this file inherits the repo-wide
 * `{ data, loading, error, load() }` contract and never throws.
 *
 * `setEnabled` / `remove` send their write through `sendMutation()` — a
 * local-only no-op in "Demo data" mode (a reload re-reads the JSON and the
 * change is gone, deliberately: mock mode must never pretend to persist), and
 * `PATCH`/`DELETE /v1/accounts/{account}/sources/{id}` in real mode. Creating
 * a source is NOT here: it goes through `useSourcesAPI().create()`, because
 * the backend provisions a Jitsu site and write key as part of the call and
 * the typed client is the honest way to express that. Pages own the user
 * feedback (`notifyMutationResult()` in `useMutationFeedback.js`); these
 * functions stay side-effect-free beyond the write itself.
 */

const TYPE_LABELS = {
  event_stream: 'Event stream',
  cloud_app: 'Cloud app',
  reverse_etl: 'Reverse ETL',
  // The backend's own kinds (see Source.source_type); not template types, so
  // the mock catalog never uses them.
  zid: 'Zid store',
  web: 'Web SDK'
}

/**
 * Human label for a source's `sourceType`.
 *
 * @param {string} type
 * @returns {string}
 */
export function sourceTypeLabel(type) {
  return TYPE_LABELS[type] ?? 'Source'
}

/**
 * Thousands-separated count, with a dash for nothing at all.
 *
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function formatCount(n) {
  const value = Number(n)
  if (!Number.isFinite(value)) return NOT_KNOWN
  return value.toLocaleString('en-GB')
}

/**
 * `2026-02-11T09:14:02.104Z` -> `11 Feb 2026`.
 *
 * The locale is pinned to `en-GB` rather than left to the browser so two
 * machines render the same string — dates appear in screenshots and in the
 * smoke run's DOM.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * `2026-02-11T09:14:02.104Z` -> `11 Feb 2026, 09:14`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso, fallback = NOT_KNOWN) {
  if (!iso) return fallback
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${formatDate(iso)}, ${d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  })}`
}

/**
 * URL-safe identifier derived from a display name.
 *
 * @param {string} value
 * @returns {string} e.g. `'Stadium Wi-Fi Portal'` -> `'stadium-wi-fi-portal'`
 */
export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The configured sources, plus local-only mutations.
 *
 * `setEnabled`/`remove` are async: each sends the matching write via
 * `sendMutation()` (mock mode = local-only, real mode = the account-scoped
 * endpoint) and only applies the local mutation once it comes back `ok`, so a
 * page must `await` and check the result rather than assume success — see
 * `notifyMutationResult()` in `useMutationFeedback.js`.
 *
 * @returns {{
 *   sources: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   setEnabled: (id: string, isEnabled: boolean) => Promise<object>,
 *   remove: (id: string) => Promise<object>
 * }}
 *
 * @example
 * const { sources, loading, error, load, setEnabled } = useSources()
 * onMounted(load)
 */
export function useSources() {
  const {
    data: sources,
    loading,
    error,
    apiMissing,
    load
  } = useMockResource('sources', {
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/sources`,
      select: pageItems
    }
  })

  function findById(id) {
    return sources.value.find(s => s.id === id) ?? null
  }

  // The acting account's collection path; null before GET /v1/me settles, in
  // which case sendMutation reports apiMissing rather than calling `/v1/accounts//…`.
  function sourcePath(id) {
    return () =>
      currentAccount.value &&
      `/v1/accounts/${currentAccount.value.id}/sources/${id}`
  }

  async function setEnabled(id, isEnabled) {
    const res = await sendMutation({
      method: 'PATCH',
      path: sourcePath(id),
      // SourceUpdate is snake_case; the response is too, hence camelizeKeys on
      // the way back in — the screens are written against camelCase.
      body: { is_enabled: isEnabled }
    })
    if (!res.ok) return res
    sources.value = sources.value.map(s =>
      s.id === id
        ? res.skipped
          ? { ...s, isEnabled }
          : { ...s, ...camelizeKeys(res.data) }
        : s
    )
    return res
  }

  async function remove(id) {
    const res = await sendMutation({ method: 'DELETE', path: sourcePath(id) })
    if (!res.ok) return res
    sources.value = sources.value.filter(s => s.id !== id)
    return res
  }

  return {
    sources,
    loading,
    error,
    apiMissing,
    load,
    findById,
    setEnabled,
    remove
  }
}

/**
 * The source template catalog used by the create screen's picker and by the
 * detail screen's template panel.
 *
 * Lives here rather than in its own file so everything a Sources screen needs
 * is one import away; the packet owns `useSources*.js`.
 *
 * @returns {{
 *   templates: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null
 * }}
 *
 * @example
 * const { templates, load } = useSourceTemplates()
 * onMounted(load)
 */
export function useSourceTemplates() {
  const {
    data: templates,
    loading,
    error,
    load
  } = useMockResource('source-templates', { mockOnly: true })

  function findById(id) {
    return templates.value.find(t => t.id === id) ?? null
  }

  return { templates, loading, error, load, findById }
}
