import { useQuasar } from 'quasar'
import { useMockResource, sendMutation } from '@/composables/useMockResource'
import { currentAccount } from '@/composables/useMe'
import { pageItems, camelizeKeys } from '@/lib/apiShape'

/**
 * Destinations domain data access.
 *
 * A Destination is where routed events are delivered — a warehouse, an ads
 * platform, a webhook. Four screens read it (list, detail, create, trash) and
 * each one is a thin wrapper over `useMockResource`, so the file names, the
 * `{ data, loading, error, load() }` contract and the shared formatting live in
 * one place rather than being re-derived per page.
 *
 * `setEnabled`/`remove` send their write via `sendMutation()` — a local-only
 * no-op in "Demo data" mode, `PATCH`/`DELETE
 * /v1/accounts/{account}/destinations/{id}` in real mode — and only apply the
 * local mutation once it comes back `ok`; see `notifyMutationResult()` in
 * `useMutationFeedback.js`. Creating a destination is NOT here: it goes
 * through `useDestinationsAPI().create()`, because the backend provisions a
 * per-account ClickHouse database as part of that call. Trash restore/purge
 * has no read wired yet, so `useDestinationsTrash()` stays local-only.
 */

/**
 * All destinations, newest field set as authored in `public/data/destinations.json`,
 * plus the mutations the four Destinations screens perform.
 *
 * @returns {{
 *   destinations: import('vue').Ref<object[]>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>,
 *   setEnabled: (id: string, isEnabled: boolean) => Promise<object>,
 *   remove: (id: string) => Promise<object>
 * }}
 *
 * @example
 * const { destinations, loading, error, apiMissing, load } = useDestinations()
 * onMounted(load)
 */
export function useDestinations() {
  const { data, loading, error, apiMissing, load } = useMockResource(
    'destinations',
    {
      api: {
        path: () =>
          currentAccount.value &&
          `/v1/accounts/${currentAccount.value.id}/destinations`,
        select: pageItems
      }
    }
  )

  // The acting account's path for one destination; null before GET /v1/me
  // settles, which sendMutation reports as apiMissing rather than calling
  // `/v1/accounts//destinations/…`.
  function destinationPath(id) {
    return () =>
      currentAccount.value &&
      `/v1/accounts/${currentAccount.value.id}/destinations/${id}`
  }

  async function setEnabled(id, isEnabled) {
    const res = await sendMutation({
      method: 'PATCH',
      path: destinationPath(id),
      // DestinationUpdate is snake_case, and so is the record that comes back.
      body: { is_enabled: isEnabled }
    })
    if (!res.ok) return res
    data.value = data.value.map(d =>
      d.id === id
        ? res.skipped
          ? { ...d, isEnabled }
          : { ...d, ...camelizeKeys(res.data) }
        : d
    )
    return res
  }

  async function remove(id) {
    const res = await sendMutation({
      method: 'DELETE',
      path: destinationPath(id)
    })
    if (!res.ok) return res
    data.value = data.value.filter(d => d.id !== id)
    return res
  }

  return {
    destinations: data,
    loading,
    error,
    apiMissing,
    load,
    setEnabled,
    remove
  }
}

/**
 * The template catalog the create screen picks from.
 *
 * @returns {{ templates: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useDestinationTemplates() {
  const { data, loading, error, load } = useMockResource(
    'destination-templates',
    { mockOnly: true }
  )
  return { templates: data, loading, error, load }
}

/**
 * Every pipe in the workspace. The detail screen filters this on
 * `eventDestinationId` to show what feeds a destination — `pipeCount` on the
 * destination record is guaranteed to agree with that count.
 *
 * @returns {{ pipes: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useDestinationPipes() {
  const { data, loading, error, load } = useMockResource('pipes')
  return { pipes: data, loading, error, load }
}

/**
 * Soft-deleted destinations — the `destinations` slice of the shared trash file.
 *
 * @returns {{ deleted: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useDestinationsTrash() {
  const { data, loading, error, load } = useMockResource('trash', {
    select: payload => payload.destinations
  })
  return { deleted: data, loading, error, load }
}

/**
 * One-line toast in the house style (ConnectorsPage sets it: dark, bottom, 2s).
 * Must be called from `setup()` — it reaches for the Quasar instance.
 *
 * @returns {{ toast: (message: string) => void }}
 *
 * @example
 * const { toast } = useDestinationToasts()
 * toast(`“${row.name}” restored. Demo data — nothing was saved.`)
 */
export function useDestinationToasts() {
  const $q = useQuasar()
  function toast(message) {
    $q.notify({ message, color: 'dark', timeout: 2000 })
  }
  return { toast }
}

/**
 * Thousands-separated integer. Returns an em dash for a missing value so a
 * table cell never reads "0" when the truth is "unknown".
 *
 * @param {number|null|undefined} n
 * @returns {string}
 *
 * @example
 * formatCount(24218) // '24,218'
 * formatCount(null)  // '—'
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
 * `'2026-02-11T09:31:48.400Z'` -> `'11 Feb 2026'`.
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
 * `'2026-02-11T09:31:48.400Z'` -> `'11 Feb 2026 · 09:31 UTC'`.
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
