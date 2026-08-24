import { ref } from 'vue'
import { fetchCollection } from '@/composables/useMockResource'

/**
 * The Live Events feed — incoming events for one stream.
 *
 * This reads the Sfere CDP backend (`GET /v1/events`) and nothing else. Where
 * the events are actually collected is the backend's business: the dashboard
 * has no connection to any collection vendor, no ingest key, and no knowledge
 * of anyone's wire format. `LiveEvent` in `openapi/cdp-api-draft.yaml` is
 * specified as an already-flattened record precisely so that stays true —
 * unwrapping nested ingest envelopes, redacting credential headers and
 * masking write keys all happen server-side now.
 *
 * It composes `fetchCollection()` rather than `useMockResource()` because the
 * toolbar filters have to reach the request, and `useMockResource().load()`
 * takes no arguments. Everything else is the same contract every other screen
 * is written against — `{ events, loading, error, apiMissing, load }`, never
 * throwing, `apiMissing` meaning "no endpoint here yet" rather than "broken".
 *
 * In "Demo data" mode the filters are applied locally against
 * `public/data/live-events.json`, so the toolbar visibly works in the default
 * mode; in the two API modes the same filters go out as query parameters and
 * the backend does the narrowing.
 */

/** Matches a fixture event against the same filters the API takes. */
function matchesFilters(ev, { level, start, end, search }) {
  if (level && level !== 'all' && ev.level !== level) return false

  const at = new Date(ev.date).getTime()
  if (start && at < start.getTime()) return false
  // `end` is exclusive — it doubles as the "load previous" cursor, and an
  // inclusive bound would re-return the event the page paginated from.
  if (end && at >= end.getTime()) return false

  if (search) {
    const needle = search.toLowerCase()
    const haystack = [
      ev.pageURL,
      ev.pagePath,
      ev.pageTitle,
      ev.userId,
      ev.email,
      ev.anonymousId,
      ev.type,
      ev.payload?.event,
      ev.error
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(needle)) return false
  }

  return true
}

/**
 * @returns {{
 *   events: import('vue').Ref<Array>,
 *   streams: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: (opts?: object) => Promise<void>,
 *   loadStreams: () => Promise<void>
 * }}
 *
 * @example
 * const { events, streams, load, loadStreams } = useLiveEvents()
 * onMounted(async () => {
 *   await loadStreams()
 *   load({ streamId: streams.value[0]?.id })
 * })
 */
export function useLiveEvents() {
  const events = ref([])
  const streams = ref([])
  const loading = ref(false)
  const error = ref(null)
  const apiMissing = ref(false)

  /**
   * Loads events for one stream.
   *
   * @param {object} opts
   * @param {string}  opts.streamId  Which stream to read (see `loadStreams`).
   * @param {'all'|'error'} [opts.level]
   * @param {Date}   [opts.start]
   * @param {Date}   [opts.end]      Also the "load previous" cursor.
   * @param {string} [opts.search]
   * @param {number} [opts.limit]
   * @param {boolean} [opts.append]  Append rather than replace (load-previous).
   */
  async function load(opts = {}) {
    const {
      streamId,
      level = 'all',
      start,
      end,
      search,
      limit = 100,
      append = false
    } = opts
    if (!streamId) return

    loading.value = true
    error.value = null
    apiMissing.value = false

    const res = await fetchCollection('live-events', {
      api: { path: '/v1/events', select: payload => payload.items },
      query: { streamId, level, start, end, search, limit }
    })

    if (res.ok) {
      const all = Array.isArray(res.data) ? res.data : []
      // Demo data is one whole file, so narrow it here; the API modes come
      // back already narrowed and re-filtering is a harmless no-op.
      const mapped = all
        .filter(ev => ev.streamId === streamId)
        .filter(ev => matchesFilters(ev, { level, start, end, search }))
        .slice(0, limit)
      events.value = append ? [...events.value, ...mapped] : mapped
    } else {
      if (res.apiMissing) apiMissing.value = true
      else error.value = res.error
      if (!append) events.value = []
    }

    loading.value = false
  }

  /**
   * The streams (sites) the workspace collects from — backs the site selector.
   *
   * This reports into the same `apiMissing` / `error` refs as `load()` on
   * purpose. `load()` needs a `streamId` and bails without one, so on a backend
   * where nothing is built the stream list fails first and the event request is
   * never attempted — leaving the page to render an empty table under "no
   * events match your filters", which is a lie. Surfacing it here is what makes
   * the screen say "no API yet" instead.
   */
  async function loadStreams() {
    const res = await fetchCollection('event-streams', {
      api: { path: '/v1/event-streams', select: payload => payload.items }
    })
    if (res.ok) {
      streams.value = Array.isArray(res.data) ? res.data : []
      return
    }
    streams.value = []
    if (res.apiMissing) apiMissing.value = true
    else error.value = res.error
  }

  return { events, streams, loading, error, apiMissing, load, loadStreams }
}
