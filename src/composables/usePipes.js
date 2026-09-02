import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, ref } from 'vue'
import {
  useMockResource,
  sendMutation,
  fetchCollection
} from '@/composables/useMockResource'
import { currentAccount } from '@/composables/useMe'
import { pageItems, camelizeKeys } from '@/lib/apiShape'

/**
 * The pipe collection — `public/data/pipes.json` — plus the derived counters and
 * the mutations the Pipes screens perform.
 *
 * A pipe joins exactly one source to exactly one event destination and may run a
 * transform function on the events in between. Everything the four Pipes screens
 * know about that shape lives here so the pages stay presentational.
 *
 * `setEnabled` and `removePipe` are async: each sends the matching write via
 * `sendMutation()` (mock mode = local-only, real mode =
 * `PATCH`/`DELETE /v1/accounts/{account}/pipelines/{id}`) and only applies the
 * local mutation once
 * it comes back `ok` — see `notifyMutationResult()` in `useMutationFeedback.js`.
 * Each `usePipes()` call still owns its own state (it wraps a fresh
 * `useMockResource`), so a mutation on one screen stays invisible to another
 * screen's already-loaded copy until that screen reloads.
 *
 * `load()` is a two-step read, not one: the pipes call, then `joinEnds()`
 * resolving each pipe's two ends against Sources and Destinations. See that
 * function for why the backend's pipeline record cannot name them itself.
 *
 * @returns {{
 *   pipes: import('vue').Ref<any[]>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>,
 *   enabledCount: import('vue').ComputedRef<number>,
 *   transformCount: import('vue').ComputedRef<number>,
 *   deliveriesLastHour: import('vue').ComputedRef<number>,
 *   byId: (id: string) => any,
 *   findRoute: (sourceId: string, destinationId: string) => any,
 *   setEnabled: (id: string, isEnabled: boolean) => Promise<object>,
 *   addPipe: (pipe: object) => object,
 *   removePipe: (id: string) => Promise<object>
 * }}
 *
 * @example
 * const { pipes, loading, error, load } = usePipes()
 * onMounted(load)
 */
/**
 * The acting account's path for one of its collections, as a function rather
 * than a string: `currentAccount` is null until `GET /v1/me` settles, and
 * `useMockResource`/`sendMutation` both resolve the function only after
 * `waitForAccount()`. A string built here would capture that null.
 */
function accountPath(collection) {
  return () =>
    currentAccount.value &&
    `/v1/accounts/${currentAccount.value.id}/${collection}`
}

export function usePipes() {
  const {
    data: pipes,
    loading: pipesLoading,
    error,
    apiMissing,
    load: loadPipes
  } = useMockResource('pipes', {
    api: {
      path: accountPath('pipelines'),
      // The backend calls the field `destination_id`; every Pipes screen reads
      // `eventDestinationId` (a pipe delivers to an *event* destination). Alias
      // it here so a live pipe still resolves its destination link.
      select: payload =>
        pageItems(payload).map(p => ({
          ...p,
          eventDestinationId: p.destinationId
        }))
    }
  })

  const joining = ref(false)

  // One flag for the whole two-step read. Without this the pipes call resolves,
  // `loading` drops, and every screen paints its two ends blank for the length
  // of the join before they fill in.
  const loading = computed(() => pipesLoading.value || joining.value)

  /**
   * Fill in each pipe's `sourceName` / `sourceSlug` / `sourceType` and
   * `eventDestinationName` / `eventDestinationSlug` from the Sources and
   * Destinations collections.
   *
   * The backend's `Pipeline` record is nine fields — id, account_id, name,
   * source_id, destination_id, jitsu_link_id, is_enabled, created_at,
   * updated_at. None of the five above is among them: they exist only in
   * `pipes.json`, so every screen that names a pipe's two ends rendered
   * `undefined` against a real pipeline, and the detail header read
   * "undefined -> undefined". They are recoverable rather than lost, though —
   * the two ids do come back, and Sources and Destinations are live endpoints
   * too, so the labels are one lookup away.
   *
   * The `needsJoin` check is what keeps this free in Demo mode: `pipes.json`
   * already carries all five, so the fixtures return before either extra read.
   * An end that no longer exists stays `null`, which is the screens' own
   * missing-value state, not a fabricated name.
   */
  async function joinEnds() {
    const needsJoin = pipes.value.some(
      p => !p.sourceName || !p.eventDestinationName
    )
    if (!needsJoin) return

    joining.value = true
    try {
      // `size: 100` is the endpoint's maximum, against a default of 50. This
      // is a single-page read on purpose — an account with more than 100
      // sources leaves the overflow unnamed, which renders as an em dash
      // rather than as a wrong name, and paging here would mean two more
      // round trips on every Pipes screen for a case nobody has yet.
      const [sourceRes, destinationRes] = await Promise.all([
        fetchCollection('sources', {
          api: { path: accountPath('sources'), select: pageItems },
          query: { size: 100 }
        }),
        fetchCollection('destinations', {
          api: { path: accountPath('destinations'), select: pageItems },
          query: { size: 100 }
        })
      ])

      const sourceById = new Map(
        (sourceRes.ok ? sourceRes.data || [] : []).map(s => [s.id, s])
      )
      const destinationById = new Map(
        (destinationRes.ok ? destinationRes.data || [] : []).map(d => [d.id, d])
      )
      if (!sourceById.size && !destinationById.size) return

      pipes.value = pipes.value.map(p => {
        const source = sourceById.get(p.sourceId)
        const destination = destinationById.get(p.eventDestinationId)
        return {
          ...p,
          sourceName: p.sourceName ?? source?.name ?? null,
          sourceSlug: p.sourceSlug ?? source?.slug ?? null,
          sourceType: p.sourceType ?? source?.sourceType ?? null,
          eventDestinationName:
            p.eventDestinationName ?? destination?.name ?? null,
          eventDestinationSlug:
            p.eventDestinationSlug ?? destination?.slug ?? null
        }
      })
    } finally {
      joining.value = false
    }
  }

  async function load() {
    await loadPipes()
    await joinEnds()
  }

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

  // The acting account's path for one pipeline; null before GET /v1/me
  // settles, which sendMutation reports as apiMissing rather than calling
  // `/v1/accounts//pipelines/…`.
  function pipelinePath(id) {
    return accountPath(`pipelines/${id}`)
  }

  async function setEnabled(id, isEnabled) {
    const pipe = byId(id)
    if (!pipe) return { ok: false, error: 'Pipe not found' }
    const res = await sendMutation({
      method: 'PATCH',
      path: pipelinePath(id),
      // PipelineUpdate is snake_case, and so is the record that comes back.
      body: { is_enabled: isEnabled }
    })
    if (!res.ok) return res
    if (res.skipped) {
      pipe.isEnabled = isEnabled
      pipe.updatedAt = new Date().toISOString()
    } else {
      pipes.value = pipes.value.map(p =>
        p.id === id ? { ...p, ...camelizeKeys(res.data) } : p
      )
    }
    return res
  }

  // Local-only, and only ever reached in "Demo data" mode: a real pipeline is
  // the Jitsu link between a source's site and a destination, which the backend
  // builds inside POST /v1/accounts/{account}/pipelines. PipeCreatePage calls
  // usePipelinesAPI().create() for that and only falls through to here when
  // there is no backend to call.
  function addPipe(pipe) {
    pipes.value = [pipe, ...pipes.value]
    return pipe
  }

  async function removePipe(id) {
    const res = await sendMutation({
      method: 'DELETE',
      path: pipelinePath(id)
    })
    if (!res.ok) return res
    pipes.value = pipes.value.filter(p => p.id !== id)
    return res
  }

  return {
    pipes,
    loading,
    error,
    apiMissing,
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
 * `'11 Feb 2026, 09:34'`. Same fallbacks as {@link formatDate}.
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
