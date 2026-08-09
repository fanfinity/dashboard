import { computed, ref } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

/**
 * The demo pipeline's event log — the pair of screens' shared spine.
 *
 * `/demo-store` fires events, `/demo-event-inspector` reads them back. The log
 * therefore lives at MODULE level, not inside `useDemoEvents()`: the two routes
 * are two components, and a per-call `ref` would give each of them its own empty
 * array. A store click followed by a client-side navigation must land in the
 * same list.
 *
 * Nothing here talks to Jitsu, to `/japi` or to any ingest endpoint, and nothing
 * is persisted. `capture()` builds a payload in the shape the Web SDK would have
 * sent and pushes it onto an in-memory array; a reload starts a fresh session.
 * That is the honest model — none of it ever reached a backend, so the screens
 * say so rather than implying an ingest happened.
 *
 * Reference data (which pipes matched, where they deliver, what earlier events
 * looked like) does come from mock JSON, through `useMockResource`, so those
 * loaders keep the repo-wide `{ data, loading, error, load() }` contract.
 */

/** The source a browser-side demo store would report as (`sources.json`). */
export const DEMO_SOURCE_ID = 'src_web_sdk'
export const DEMO_SOURCE_NAME = 'Web SDK'

/** The profile the demo shopper resolves to once they sign in. */
export const DEMO_PROFILE_ID = 'prof_4e9f60'

// `page`/`identify` are separate call types in every SDK of this shape; anything
// else is a `track`. It decides which envelope key the body lands under.
const CALL_TYPES = {
  page_view: 'page',
  identify: 'identify'
}

// Properties for an event we did not build ourselves — i.e. one replayed from
// the sample feed, which records only a name, a source and a profile.
const SAMPLE_PROPERTIES = {
  page_view: {
    path: '/fixtures/al-hilal-al-nassr',
    title: 'Riyadh Derby — Fixtures',
    referrer: 'https://www.google.com/'
  },
  add_to_cart: {
    productId: 'prd_home_jersey',
    name: 'Home Jersey 2026/27',
    price: 349,
    currency: 'SAR',
    quantity: 1
  },
  wifi_signin: {
    venue: 'King Fahd International Stadium',
    ssid: 'STADIUM-FREE-WIFI',
    gate: 'B'
  },
  identify: {
    email: 'saud.dossari@example.com',
    firstName: 'Saud',
    city: 'Riyadh',
    favouriteTeam: 'Al-Hilal'
  },
  app_open: {
    appVersion: '4.2.0',
    platform: 'ios',
    pushEnabled: true
  }
}

// One shared log and one shared browsing session, both module-scoped. See the
// header comment: this is what makes the store and the inspector the same demo.
const events = ref([])
const session = ref(newSession())

let sequence = 0

function randomToken() {
  return Math.random().toString(16).slice(2, 10)
}

function newSession() {
  return { anonymousId: `anon_${randomToken()}`, profileId: null }
}

function nextEventId() {
  sequence += 1
  return `evt_demo_${String(sequence).padStart(4, '0')}`
}

// Both formatters pin `en-GB` and UTC so the same ISO string renders the same
// characters on a dev box, in a screenshot and on the smoke runner.
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC'
})

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC'
})

/**
 * `2026-07-31T05:58:44.000Z` -> `05:58:44 UTC`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatEventTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${TIME.format(d)} UTC`
}

/**
 * `2026-07-31T05:58:44.000Z` -> `31 Jul 2026, 05:58:44 UTC`.
 *
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatEventDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${DATE_TIME.format(d)} UTC`
}

/**
 * Thousands-separated count.
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
 * Builds the record the inspector renders: the flat row fields plus the nested
 * `payload` an SDK of this shape would have POSTed.
 *
 * @param {object} spec
 * @param {string} spec.eventName
 * @param {string} [spec.id]
 * @param {string} [spec.sourceId]
 * @param {string} [spec.sourceName]
 * @param {string|null} [spec.profileId]
 * @param {string} [spec.occurredAt]  ISO; defaults to now
 * @param {'store'|'sample'} [spec.origin]
 * @param {string|null} [spec.replayOf]  id of the sample event this replays
 * @param {object|null} [spec.properties]  body; derived from the name if absent
 * @returns {object}
 */
export function buildDemoEvent(spec) {
  const {
    eventName,
    id = nextEventId(),
    sourceId = DEMO_SOURCE_ID,
    sourceName = DEMO_SOURCE_NAME,
    profileId = null,
    occurredAt = new Date().toISOString(),
    origin = 'store',
    replayOf = null,
    properties = null
  } = spec

  const callType = CALL_TYPES[eventName] ?? 'track'
  const body = properties ?? SAMPLE_PROPERTIES[eventName] ?? {}

  return {
    id,
    eventName,
    callType,
    sourceId,
    sourceName,
    profileId,
    occurredAt,
    origin,
    replayOf,
    payload: {
      messageId: id,
      type: callType,
      event: eventName,
      timestamp: occurredAt,
      anonymousId: session.value.anonymousId,
      userId: profileId,
      source: { id: sourceId, name: sourceName },
      context: {
        library: { name: 'sfere-web-sdk', version: '3.1.0' },
        locale: 'en-GB',
        timezone: 'Asia/Riyadh',
        page: {
          url: 'https://demo.sfere.io/store',
          path: '/store',
          title: 'Sfere Demo Store'
        },
        consent: { analytics: true, marketing: false }
      },
      // An identify carries traits about the person; everything else carries
      // properties about the thing that happened.
      ...(callType === 'identify' ? { traits: body } : { properties: body })
    }
  }
}

/**
 * The shared, in-memory demo event log.
 *
 * Not a data loader: nothing is fetched and nothing can fail, so this one does
 * not carry `loading` / `error` / `load`.
 *
 * @returns {{
 *   events: import('vue').Ref<Array>,
 *   session: import('vue').Ref<{ anonymousId: string, profileId: string|null }>,
 *   eventNames: import('vue').ComputedRef<string[]>,
 *   capture: (spec: object) => object,
 *   identify: (profileId: string) => void,
 *   reset: () => void
 * }}
 *
 * @example
 * const { events, capture } = useDemoEvents()
 * capture({ eventName: 'add_to_cart', properties: { productId: 'prd_x' } })
 */
export function useDemoEvents() {
  // Newest first: the inspector reads top-down and a new event must not appear
  // below a page of older ones.
  function capture(spec) {
    const event = buildDemoEvent({
      profileId: session.value.profileId,
      ...spec
    })
    events.value = [event, ...events.value]
    return event
  }

  // Once the demo shopper signs in, every later event carries the userId too —
  // which is what makes the inspector's anonymous/identified split visible.
  function identify(profileId) {
    session.value = { ...session.value, profileId }
  }

  function reset() {
    events.value = []
    session.value = newSession()
  }

  const eventNames = computed(() => [
    ...new Set(events.value.map(e => e.eventName))
  ])

  return { events, session, eventNames, capture, identify, reset }
}

/**
 * Pipes and destinations, so an event can be told which pipes matched it and
 * where they would have delivered it.
 *
 * Two files behind one `{ loading, error, load }` because a screen never wants
 * one without the other — a pipe with no resolvable destination is half a row.
 *
 * @returns {{
 *   pipes: import('vue').Ref<Array>,
 *   destinations: import('vue').Ref<Array>,
 *   loading: import('vue').ComputedRef<boolean>,
 *   error: import('vue').ComputedRef<string|null>,
 *   load: () => Promise<void>,
 *   routesFor: (event: object|null) => Array
 * }}
 */
export function useDemoRouting() {
  const {
    data: pipes,
    loading: pipesLoading,
    error: pipesError,
    load: loadPipes
  } = useMockResource('pipes')

  const {
    data: destinations,
    loading: destinationsLoading,
    error: destinationsError,
    load: loadDestinations
  } = useMockResource('destinations')

  const loading = computed(
    () => pipesLoading.value || destinationsLoading.value
  )
  const error = computed(() => pipesError.value ?? destinationsError.value)

  async function load() {
    await Promise.all([loadPipes(), loadDestinations()])
  }

  /**
   * Which pipes an event matches, and what each would have done with it.
   * A paused pipe still matches — it just does not deliver, and saying so is
   * more useful than hiding the row.
   */
  function routesFor(event) {
    if (!event) return []
    return pipes.value
      .filter(p => p.sourceId === event.sourceId)
      .map(p => {
        const destination =
          destinations.value.find(d => d.id === p.eventDestinationId) ?? null
        const destinationEnabled = destination?.isEnabled ?? true
        const delivered = p.isEnabled && destinationEnabled
        return {
          id: p.id,
          name: p.name,
          destinationId: p.eventDestinationId,
          destinationName: p.eventDestinationName,
          isEnabled: p.isEnabled,
          delivered,
          status: delivered ? 'Delivered' : 'Not delivered',
          reason: delivered
            ? describeParams(p.destinationParams)
            : p.isEnabled
              ? `${p.eventDestinationName} is paused`
              : 'Pipe is paused'
        }
      })
  }

  return { pipes, destinations, loading, error, load, routesFor }
}

// `{ table: 'raw_web_events', batchSize: 500 }` -> `table=raw_web_events ·
// batchSize=500`. Keeps the delivery row informative without a nested table.
function describeParams(params) {
  if (!params || typeof params !== 'object') return ''
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(' · ')
}

/**
 * The five most recent events already on the account (`dashboard.json`'s
 * `lastEvents`), offered in the inspector as something to replay when the demo
 * store has not been opened yet.
 *
 * Secondary to both screens: if this fails, the rest of the inspector still
 * works, so it degrades inside its own panel.
 *
 * @returns {{
 *   samples: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 */
export function useDemoSampleEvents() {
  const {
    data: samples,
    loading,
    error,
    load
  } = useMockResource('dashboard', {
    initial: [],
    select: payload => payload.lastEvents
  })

  return { samples, loading, error, load }
}
