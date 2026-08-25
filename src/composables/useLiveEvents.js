import { computed, ref } from 'vue'
import { currentAccount, waitForAccount } from '@/composables/useMe'

// The Live Events page reads incoming events from the events backend
// (console.fanfinity.io). Unlike the public connector catalog (see
// useConnectorCatalog.js), the events endpoint requires authentication and is NOT
// CORS-enabled, so we go through a same-origin dev proxy: the browser calls
// /japi/... and the dev server (see devServer.proxy in the build config)
// forwards to the backend with an API key attached.
const BASE = (import.meta.env.VITE_EVENTS_API_BASE || '/japi').replace(
  /\/$/,
  ''
)

// Internal workspace id (cuid), NOT the slug — the API rejects the slug.
// Resolve via GET /japi/workspace; this is the fallback for the shared sfere
// workspace, used when the signed-in account has no Jitsu workspace of its own
// (dev, or an account still provisioning). The account's own workspace, when
// present, always wins — see `workspaceId` below.
export const WORKSPACE_ID =
  import.meta.env.VITE_EVENTS_WORKSPACE_ID || 'cmqgzfe6n0007ws09k1wa8qnb'

// Default "site"/stream (actorId) — the one from the shared console URL.
export const DEFAULT_ACTOR_ID =
  import.meta.env.VITE_EVENTS_ACTOR_ID || 'cmqh00pk60000356nau41wpp1'

/**
 * Parses a gzipped-NDJSON response body (one JSON object per line). The browser
 * transparently gunzips the proxied response, so we only deal with text here.
 */
function parseNdjson(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/**
 * Flattens a raw events-log record { date, level, content } into the shape the
 * incoming-events table/drawer renders. Ported from the upstream events browser
 * (the incoming-events table mapper).
 */
function mapIncomingEvent(raw, index) {
  const content = raw.content || {}
  let ingestPayload = {}
  let unparsedPayload = ''
  if (typeof content.body === 'string' && content.body.length > 0) {
    unparsedPayload = content.body
    try {
      ingestPayload = JSON.parse(content.body)
    } catch {
      ingestPayload = {}
    }
  } else if (content.body && typeof content.body === 'object') {
    ingestPayload = content.body
  }

  const event = ingestPayload.httpPayload || undefined
  const context = event?.context

  return {
    id: `${raw.date}_${index}`,
    date: raw.date,
    level: raw.level,
    ingestType: ingestPayload.ingestType,

    status: content.status,
    error: content.error,

    ingestPayload,
    unparsedPayload,

    messageId: ingestPayload.messageId,
    type: ingestPayload.type,
    originDomain:
      ingestPayload.origin?.domain ||
      ingestPayload.httpHeaders?.['x-forwarded-host'],
    writeKey: ingestPayload.writeKey,
    httpHeaders: ingestPayload.httpHeaders,

    event,
    context,

    host: context?.page?.host,
    pageURL: context?.page?.url,
    pagePath: context?.page?.path,
    pageTitle: context?.page?.title,
    userId: event?.userId,
    email: context?.traits?.email || event?.traits?.email,
    anonymousId: event?.anonymousId,
    referringDomain: context?.page?.referring_domain,

    destinations: [
      ...(content.asyncDestinations ?? []),
      ...(content.tags ?? [])
    ]
  }
}

/**
 * Builds the events-log query string for the backend's events-log endpoint.
 * `levels` is omitted when "all"; start/end are ISO strings.
 */
function buildQuery({ limit = 100, start, end, level, search }) {
  const params = [`limit=${limit}`]
  if (start) params.push(`start=${encodeURIComponent(start.toISOString())}`)
  if (end) params.push(`end=${encodeURIComponent(end.toISOString())}`)
  if (level && level !== 'all') params.push(`levels=${level}`)
  if (search) params.push(`search=${encodeURIComponent(search)}`)
  return params.join('&')
}

/**
 * Reactive hook for the Live Events (incoming) view. Mirrors useConnectorCatalog's
 * { data, loading, error, load } contract, plus site listing and pagination.
 */
export function useLiveEvents() {
  const events = ref([])
  const sites = ref([])
  const loading = ref(false)
  const error = ref(null)

  // The workspace whose event log we read: the signed-in account's own Jitsu
  // workspace when it has one, else the shared fallback. The account record
  // comes straight off GET /v1/me (snake_case, not camelized), so it is
  // `jitsu_workspace_id`, not `jitsuWorkspaceId`.
  const workspaceId = computed(
    () => currentAccount.value?.jitsu_workspace_id || WORKSPACE_ID
  )

  /**
   * Loads incoming events for a site.
   * @param opts.actorId  site/stream id
   * @param opts.level    'all' | 'error'
   * @param opts.start    Date | undefined
   * @param opts.end      Date | undefined  (also used as the pagination cursor)
   * @param opts.search   string | undefined
   * @param opts.limit    number
   * @param opts.append   when true, appends to existing events (load-previous)
   */
  async function load(opts = {}) {
    const {
      actorId,
      level = 'all',
      start,
      end,
      search,
      limit = 100,
      append = false
    } = opts
    if (!actorId) return
    loading.value = true
    error.value = null
    try {
      // Settle the account first so the very first load already targets the
      // account's workspace rather than the fallback.
      await waitForAccount()
      const qs = buildQuery({ limit, start, end, level, search })
      const url = `${BASE}/${workspaceId.value}/log/incoming/${actorId}?${qs}`
      const res = await fetch(url, {
        headers: { Accept: 'application/x-ndjson' }
      })
      if (!res.ok) {
        throw new Error(`Events request failed (${res.status})`)
      }
      const text = await res.text()
      const mapped = parseNdjson(text).map(mapIncomingEvent)
      events.value = append ? [...events.value, ...mapped] : mapped
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      if (!append) events.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Loads the list of sites (streams) for the workspace, used by the Site selector.
   * Endpoint returns { objects: [...] }.
   */
  async function loadSites() {
    try {
      await waitForAccount()
      const res = await fetch(`${BASE}/${workspaceId.value}/config/stream`, {
        headers: { Accept: 'application/json' }
      })
      if (!res.ok) return
      const data = await res.json()
      sites.value = Array.isArray(data?.objects) ? data.objects : []
    } catch {
      sites.value = []
    }
  }

  return { events, sites, loading, error, workspaceId, load, loadSites }
}
