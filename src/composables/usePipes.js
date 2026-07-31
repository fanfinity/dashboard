import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

/**
 * The pipe collection — `public/data/pipes.json` — plus the derived counters and
 * the local-only mutations the Pipes screens perform.
 *
 * A pipe joins exactly one source to exactly one event destination and may run a
 * transform function on the events in between. Everything the four Pipes screens
 * know about that shape lives here so the pages stay presentational.
 *
 * There is no backend: `setEnabled`, `addPipe` and `removePipe` mutate the
 * loaded array and nothing else. Each `usePipes()` call owns its own state (it
 * wraps a fresh `useMockResource`), so a mutation on one screen is deliberately
 * invisible to the next — screens must never imply a write was persisted.
 *
 * @returns {{
 *   pipes: import('vue').Ref<any[]>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   enabledCount: import('vue').ComputedRef<number>,
 *   transformCount: import('vue').ComputedRef<number>,
 *   deliveriesLastHour: import('vue').ComputedRef<number>,
 *   byId: (id: string) => any,
 *   findRoute: (sourceId: string, destinationId: string) => any,
 *   setEnabled: (id: string, isEnabled: boolean) => any,
 *   addPipe: (pipe: object) => object,
 *   removePipe: (id: string) => boolean
 * }}
 *
 * @example
 * const { pipes, loading, error, load } = usePipes()
 * onMounted(load)
 */
export function usePipes() {
  const { data: pipes, loading, error, load } = useMockResource('pipes')

  const enabledCount = computed(
    () => pipes.value.filter(p => p.isEnabled).length
  )

  const transformCount = computed(
    () => pipes.value.filter(p => p.hasFunctionCode).length
  )

  const deliveriesLastHour = computed(() =>
    pipes.value.reduce((total, p) => total + (p.deliveryCountLastHour || 0), 0)
  )

  function byId(id) {
    return pipes.value.find(p => p.id === id) ?? null
  }

  /** The pipe already joining this source to this destination, if any. */
  function findRoute(sourceId, destinationId) {
    return (
      pipes.value.find(
        p => p.sourceId === sourceId && p.eventDestinationId === destinationId
      ) ?? null
    )
  }

  function setEnabled(id, isEnabled) {
    const pipe = byId(id)
    if (!pipe) return null
    pipe.isEnabled = isEnabled
    pipe.updatedAt = new Date().toISOString()
    return pipe
  }

  function addPipe(pipe) {
    pipes.value = [pipe, ...pipes.value]
    return pipe
  }

  function removePipe(id) {
    const before = pipes.value.length
    pipes.value = pipes.value.filter(p => p.id !== id)
    return pipes.value.length < before
  }

  return {
    pipes,
    loading,
    error,
    load,
    enabledCount,
    transformCount,
    deliveriesLastHour,
    byId,
    findRoute,
    setEnabled,
    addPipe,
    removePipe
  }
}

/**
 * Thousands-separated count. `null`/`undefined` read as zero rather than as a
 * gap, because every counter in this data is a real measured number.
 *
 * @param {number|null|undefined} n
 * @returns {string}
 *
 * @example
 * formatCount(18420) // '18,420'
 */
export function formatCount(n) {
  return Number(n || 0).toLocaleString('en-GB')
}

/**
 * `'11 Feb 2026'`. Returns an em dash for a missing value and the raw input for
 * an unparseable one — never `Invalid Date`.
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
 * `'11 Feb 2026, 09:34'`. Same fallbacks as {@link formatDate}.
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
 * A stable id for a locally-created pipe, derived from its name.
 *
 * Ids in `pipes.json` are readable slugs (`pipe_web_to_snowflake`), not uuids,
 * and the route table's `smokeParams` point at them — so a generated id follows
 * the same convention rather than inventing a second one. The random suffix
 * keeps two pipes with the same name distinct.
 *
 * @param {string} name
 * @returns {string}
 *
 * @example
 * makePipeId('Web SDK to S3') // 'pipe_web_sdk_to_s3_k3f9'
 */
export function makePipeId(name) {
  const slug = String(name || 'pipe')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `pipe_${slug || 'pipe'}_${suffix}`
}
