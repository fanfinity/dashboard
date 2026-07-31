import { ref } from 'vue'

/**
 * Loads one JSON collection from `public/data/`.
 *
 * Every screen in the rebuild reads its data through this factory, so the
 * fetch/normalise/error semantics are written once. It mirrors
 * useConnectorCatalog(): it never throws, it resets `data` to `initial` on
 * failure, it normalises whatever was thrown into a string on `error`, and it
 * always clears `loading` in `finally`.
 *
 * The URL is built as `${import.meta.env.BASE_URL}data/${name}.json` — note
 * there is NO leading slash on the `data/` segment. BASE_URL already ends in
 * one, and a second slash would resolve against the origin root, which breaks
 * hash-mode routing and any deploy under a subpath.
 *
 * @param {string} name
 *   File basename without `.json`, e.g. `'pipes'` -> `data/pipes.json`.
 * @param {object} [options]
 * @param {*} [options.initial=[]]
 *   Value `data` holds before the first load and after a failed one. Pass `{}`
 *   (or a shaped object) for endpoints that return an object rather than a list.
 * @param {(payload: any) => any} [options.select]
 *   Picks a sub-key out of the parsed payload. Used for `trash.json`, which is
 *   one file keyed by resource, and for the object-shaped files.
 * @returns {{ data: import('vue').Ref, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 *
 * @example
 * // A plain list.
 * const { data: pipes, loading, error, load } = useMockResource('pipes')
 * onMounted(load)
 *
 * @example
 * // One resource's slice of the shared trash file.
 * const { data: deletedPipes, load } = useMockResource('trash', {
 *   select: payload => payload.pipes
 * })
 *
 * @example
 * // An object-shaped payload (dashboard, settings, error-logs, ...).
 * const { data: stats, load } = useMockResource('error-stats', { initial: {} })
 *
 * @example
 * // A nested list inside an object-shaped payload.
 * const { data: errors, load } = useMockResource('error-logs', {
 *   select: payload => payload.errors
 * })
 */
export function useMockResource(name, options = {}) {
  const { initial = [], select = null } = options

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

  async function load() {
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

  return { data, loading, error, load }
}
