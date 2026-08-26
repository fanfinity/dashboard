import { useQuasar } from 'quasar'
import { useMockResource } from '@/composables/useMockResource'

/**
 * Live profile syncs domain data access.
 *
 * A live profile sync continuously pushes resolved fan profiles out of one
 * audience to one destination as they change — a profile entering the audience,
 * or an attribute on it moving, triggers a delivery. That is the distinction
 * from a profile DWH sync (`public/data/profile-dwh-syncs.json`), which is a
 * scheduled batch export owned by another packet.
 *
 * Three screens read this (list, create, trash) and each is a thin wrapper over
 * `useMockResource`, so the file names, the repo-wide
 * `{ data, loading, error, load() }` contract and the shared formatting live
 * here rather than being re-derived per page.
 *
 * There is no backend. `setEnabled` / `remove` / `add` mutate the loaded array
 * and nothing else — a reload re-reads the JSON and the change is gone. That is
 * deliberate: the screens must not pretend to persist. Pages own the user
 * feedback (`useLiveProfileSyncToasts`), so these stay side-effect free.
 */

const MODE_LABELS = {
  realtime: 'Real-time',
  batch: 'Batched'
}

/**
 * Human label for a sync's delivery `mode`.
 *
 * @param {string|null|undefined} mode
 * @returns {string}
 *
 * @example
 * modeLabel('realtime') // 'Real-time'
 */
export function modeLabel(mode) {
  return MODE_LABELS[mode] ?? 'Real-time'
}

/**
 * Thousands-separated integer. Returns an em dash for a missing value so a
 * table cell never reads "0" when the truth is "unknown".
 *
 * @param {number|null|undefined} n
 * @returns {string}
 *
 * @example
 * formatCount(8412) // '8,412'
 * formatCount(null) // '—'
 */
export function formatCount(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-GB')
}

// Fixed locale and time zone: the smoke run and a developer's machine must
// render the same string, and `toLocaleDateString()` with no arguments does not
// guarantee that.
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC'
})

/**
 * `'2026-07-31T05:52:10.400Z'` -> `'31 Jul 2026'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string} `'—'` when absent or unparseable.
 */
export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : DATE.format(d)
}

/**
 * `'2026-07-31T05:52:10.400Z'` -> `'31 Jul 2026 · 05:52 UTC'`.
 *
 * @param {string|null|undefined} iso
 * @returns {string} `'—'` when absent or unparseable.
 */
export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${DATE.format(d)} · ${TIME.format(d)} UTC`
}

/**
 * The configured live profile syncs, plus local-only mutations.
 *
 * @returns {{
 *   syncs: import('vue').Ref<object[]>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   setEnabled: (id: string, isEnabled: boolean) => void,
 *   remove: (id: string) => void,
 *   add: (sync: object) => object
 * }}
 *
 * @example
 * const { syncs, loading, error, load, setEnabled } = useLiveProfileSyncs()
 * onMounted(load)
 */
export function useLiveProfileSyncs() {
  const {
    data: syncs,
    loading,
    error,
    load
  } = useMockResource('live-profile-syncs')

  function findById(id) {
    return syncs.value.find(s => s.id === id) ?? null
  }

  function setEnabled(id, isEnabled) {
    syncs.value = syncs.value.map(s => (s.id === id ? { ...s, isEnabled } : s))
  }

  function remove(id) {
    syncs.value = syncs.value.filter(s => s.id !== id)
  }

  function add(sync) {
    const record = {
      id: `lps_${Date.now()}`,
      mode: 'realtime',
      isEnabled: true,
      profileCountLastHour: 0,
      failureCountLastHour: 0,
      lastDeliveryAt: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...sync
    }
    syncs.value = [...syncs.value, record]
    return record
  }

  return { syncs, loading, error, load, findById, setEnabled, remove, add }
}

/**
 * The audiences a sync can draw profiles from — the create screen's primary
 * resource, since a sync with no audience has nothing to deliver.
 *
 * @returns {{ audiences: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useLiveProfileSyncAudiences() {
  const { data: audiences, loading, error, load } = useMockResource('audiences')
  return { audiences, loading, error, load }
}

/**
 * The destinations a sync can deliver to. Secondary on the create screen: if it
 * fails, the rest of the form still works and the field retries on its own.
 *
 * @returns {{ destinations: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useLiveProfileSyncDestinations() {
  const {
    data: destinations,
    loading,
    error,
    load
  } = useMockResource('destinations')
  return { destinations, loading, error, load }
}

/**
 * The identifier types a sync can be keyed on. A destination matches profiles
 * on exactly one of these, and profiles carrying no value for it are skipped.
 * Secondary on the create screen, same as the destinations above.
 *
 * @returns {{ identifierTypes: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useLiveProfileSyncIdentifierTypes() {
  const {
    data: identifierTypes,
    loading,
    error,
    load
  } = useMockResource('identifier-types')
  return { identifierTypes, loading, error, load }
}

/**
 * One-line toast in the house style, with the caption every mutating screen in
 * the rebuild carries: nothing here reaches a backend.
 * Must be called from `setup()` — it reaches for the Quasar instance.
 *
 * @returns {{ toast: (message: string) => void }}
 *
 * @example
 * const { toast } = useLiveProfileSyncToasts()
 * toast('Meta custom audience paused')
 */
export function useLiveProfileSyncToasts() {
  const $q = useQuasar()

  function toast(message) {
    $q.notify({
      message,
      caption: 'Local preview only — no backend is connected yet.',
      color: 'dark',
      timeout: 2500
    })
  }

  return { toast }
}
