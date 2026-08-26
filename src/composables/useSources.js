import { useMockResource } from '@/composables/useMockResource'
import { currentAccount } from '@/composables/useMe'
import { pageItems } from '@/lib/apiShape'

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
 * Writes have no backend. `setEnabled` / `remove` / `add` mutate the loaded
 * array in place and nothing else — a reload re-reads the JSON and the change
 * is gone. That is deliberate: the screens must not pretend to persist. Pages
 * own the user feedback (a `useQuasar().notify()` toast); these functions stay
 * side-effect free so they can be called from anywhere.
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
  if (!Number.isFinite(value)) return '—'
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
export function formatDate(iso) {
  if (!iso) return '—'
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
export function formatDateTime(iso) {
  if (!iso) return '—'
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
 * @returns {{
 *   sources: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   setEnabled: (id: string, isEnabled: boolean) => void,
 *   remove: (id: string) => void,
 *   add: (source: object) => object
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

  function setEnabled(id, isEnabled) {
    sources.value = sources.value.map(s =>
      s.id === id ? { ...s, isEnabled } : s
    )
  }

  function remove(id) {
    sources.value = sources.value.filter(s => s.id !== id)
  }

  function add(source) {
    const record = {
      id: `src_${slugify(source.slug || source.name) || Date.now()}`,
      sourceType: 'event_stream',
      isEnabled: true,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      eventCountLastHour: 0,
      eventTypeCount: 0,
      pipeCount: 0,
      writeKey: null,
      ...source
    }
    sources.value = [...sources.value, record]
    return record
  }

  return {
    sources,
    loading,
    error,
    apiMissing,
    load,
    findById,
    setEnabled,
    remove,
    add
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
