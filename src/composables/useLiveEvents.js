import { ref } from 'vue'
import { fetchCollection } from '@/composables/useMockResource'
import { useDataSource } from '@/composables/useDataSource'
import { currentAccount } from '@/composables/useMe'
import { pageItems } from '@/lib/apiShape'

/**
 * The Live Events feed — incoming events for one stream.
 *
 * This reads the Sfere backend and nothing else. Where the events are actually
 * collected is the backend's business: the dashboard has no connection to any
 * collection vendor, no ingest key, and no knowledge of anyone's wire format.
 * `GET /v1/accounts/{account}/events/live` answers with already-flattened
 * `LiveEvent` records precisely so that stays true — unwrapping nested ingest
 * envelopes, redacting credential headers and masking write keys all happen
 * server-side now.
 *
 * It composes `fetchCollection()` rather than `useMockResource()` because the
 * toolbar filters have to reach the request, and `useMockResource().load()`
 * takes no arguments. Everything else is the same contract every other screen
 * is written against — `{ events, loading, error, apiMissing, load }`, never
 * throwing, `apiMissing` meaning "no endpoint here yet" rather than "broken".
 *
 * In "Demo data" mode the filters are applied locally against
 * `public/data/live-events.json`, so the toolbar visibly works in the default
 * mode; in real mode the same filters go out as query parameters and the
 * backend does the narrowing, so re-filtering here is skipped rather than
 * repeated — the two payloads name their fields differently and a local pass
 * over the mapped records would drop rows the backend deliberately returned.
 *
 * "Stream" is this screen's word for what the backend calls a source: the
 * selector's value is a source id, and it goes out as the endpoint's
 * `source_id` parameter. Sources with no provisioned site have no event log,
 * so they are left out of the list rather than offered as an empty selection.
 */

/**
 * Maps a backend `LiveEvent` (snake_case) onto the shape the incoming-events
 * table and drawer render — the same shape `public/data/live-events.json`
 * carries, so the page is written once against one record shape.
 *
 * The backend record has no HTTP headers on it, so `httpHeaders` is left
 * undefined and the drawer shows its em dash there.
 *
 * @param {object} ev
 * @returns {object}
 */
function mapLiveEvent(ev) {
  return {
    id: ev.id,
    date: ev.date,
    level: ev.level,
    // The selector's value is a source id; fall back to the site id so a row
    // the backend could not attribute to a source is still addressable.
    streamId: ev.source_id || ev.site_id,
    ingestType: ev.ingest_type,

    status: ev.status,
    error: ev.error,

    messageId: ev.message_id,
    type: ev.type,
    originDomain: ev.origin_domain,
    writeKey: ev.write_key,

    // The analytics event body. Named `payload` here (and in the fixture)
    // because `event.event` reads as a mistake in the drawer.
    payload: ev.event,
    context: ev.context,

    host: ev.host,
    pageURL: ev.page_url,
    pagePath: ev.page_path,
    pageTitle: ev.page_title,
    userId: ev.user_id,
    email: ev.email,
    anonymousId: ev.anonymous_id,
    referringDomain: ev.referring_domain,

    destinations: ev.destinations ?? []
  }
}

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

// The acting account's events endpoint; null before GET /v1/me settles, in
// which case fetchCollection reports apiMissing rather than calling
// `/v1/accounts//events/live`.
function eventsPath() {
  return (
    currentAccount.value &&
    `/v1/accounts/${currentAccount.value.id}/events/live`
  )
}

function sourcesPath() {
  return (
    currentAccount.value && `/v1/accounts/${currentAccount.value.id}/sources`
  )
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
  const { isMock } = useDataSource()

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
      api: {
        path: eventsPath,
        select: payload => (payload?.items ?? []).map(mapLiveEvent)
      },
      // Snake_case because these are the endpoint's own parameter names
      // (ListLiveEventsParams); `level: 'all'` is the backend default and is
      // dropped rather than sent.
      query: {
        limit,
        source_id: streamId,
        start,
        // The endpoint's `end` is inclusive ("at or before this time"), but
        // `end` here is the load-previous cursor — the date of the oldest row
        // already on screen. Sent as-is it would re-append that row on every
        // click, so step back a millisecond to match the exclusive bound the
        // page (and matchesFilters, via `at >= end`) is written against.
        end: end && new Date(end.getTime() - 1),
        level: level === 'error' ? 'error' : undefined,
        search
      }
    })

    if (res.ok) {
      const all = Array.isArray(res.data) ? res.data : []
      // Demo data is one whole file, so narrow it here. Real mode comes back
      // narrowed by the backend and is taken as-is.
      const mapped = isMock.value
        ? all
            .filter(ev => ev.streamId === streamId)
            .filter(ev => matchesFilters(ev, { level, start, end, search }))
            .slice(0, limit)
        : all
      events.value = append ? [...events.value, ...mapped] : mapped
    } else {
      if (res.apiMissing) apiMissing.value = true
      else error.value = res.error
      if (!append) events.value = []
    }

    loading.value = false
  }

  /**
   * The streams the account collects from — backs the site selector. In real
   * mode these are its sources, minus any the backend has not provisioned a
   * site for: those have no event log, so offering one would select a stream
   * that can only ever come back empty.
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
      api: {
        path: sourcesPath,
        select: payload =>
          pageItems(payload)
            .filter(s => s.jitsuSiteId)
            .map(s => ({ id: s.id, name: s.name }))
      },
      // One page big enough to hold every source an account realistically has:
      // the default page size would truncate the selector silently, and a
      // stream missing from the list is indistinguishable from one that does
      // not exist.
      query: { size: 100 }
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
