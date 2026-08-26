import { computed, ref } from 'vue'
import { listLiveEvents, listSources } from '@/api/fanfinity'
import { currentAccount, waitForAccount } from '@/composables/useMe'

// The Live Events page reads incoming events through the Fanfinity backend
// (GET /v1/accounts/{id}/events/live), which proxies the Jitsu incoming log
// server-side — the dashboard no longer talks to the events console directly,
// so the same-origin /japi dev proxy and its API key are no longer needed here.
// The backend answers with normalized LiveEvent records (snake_case); the
// mapper below keeps the camelCase shape the page's table/drawer renders.

// Default selection for the Site selector before the account's sources load.
// Used only until loadSites() swaps in a real source id (LiveEventsPage does
// that switch itself); kept as an export because the page seeds its v-model
// with it.
export const DEFAULT_ACTOR_ID = import.meta.env.VITE_EVENTS_ACTOR_ID || ''

/**
 * Maps a backend LiveEvent (snake_case) onto the shape the incoming-events
 * table/drawer renders — the same shape the retired Jitsu-NDJSON mapper
 * produced. The backend record carries no HTTP headers, so `httpHeaders` is
 * left undefined and the drawer shows its em dash.
 */
function mapLiveEvent(ev) {
  return {
    id: ev.id,
    date: ev.date,
    level: ev.level,
    siteId: ev.site_id,
    sourceId: ev.source_id,
    ingestType: ev.ingest_type,

    status: ev.status,
    error: ev.error,

    ingestPayload: ev.ingest_payload,
    unparsedPayload: ev.unparsed_payload,

    messageId: ev.message_id,
    type: ev.type,
    originDomain: ev.origin_domain,
    writeKey: ev.write_key,

    event: ev.event,
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

/**
 * Reactive hook for the Live Events (incoming) view. Mirrors useConnectorCatalog's
 * { data, loading, error, load } contract, plus site listing and pagination.
 */
export function useLiveEvents() {
  const events = ref([])
  const sites = ref([])
  const loading = ref(false)
  const error = ref(null)

  // The account's Jitsu workspace — the backend resolves it from the account,
  // so this is informational only (no longer used to build request URLs).
  const workspaceId = computed(
    () => currentAccount.value?.jitsu_workspace_id || null
  )

  async function accountId() {
    await waitForAccount()
    const id = currentAccount.value?.id
    if (!id) throw new Error('No account selected')
    return id
  }

  /**
   * Loads incoming events for a site.
   * @param opts.actorId  source id (the Site selector's value; maps to the
   *                      endpoint's source_id param — the backend resolves the
   *                      source's Jitsu site/stream)
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
    loading.value = true
    error.value = null
    try {
      // Settle the account first so the very first load already targets it.
      const id = await accountId()
      const { data } = await listLiveEvents(id, {
        limit,
        source_id: actorId || undefined,
        start: start?.toISOString(),
        end: end?.toISOString(),
        level: level === 'error' ? 'error' : undefined,
        search: search || undefined
      })
      const mapped = (data.items ?? []).map(mapLiveEvent)
      events.value = append ? [...events.value, ...mapped] : mapped
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      if (!append) events.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Loads the account's sources as the Site selector's options: each source
   * owns one Jitsu site/stream, and the endpoint filters by source id, so the
   * option value is the source id. Sources without a provisioned site have no
   * event log and are left out.
   */
  async function loadSites() {
    try {
      const id = await accountId()
      const { data } = await listSources(id, { size: 100 })
      const items = Array.isArray(data?.items) ? data.items : []
      sites.value = items
        .filter(s => s.jitsu_site_id)
        .map(s => ({ id: s.id, name: s.name }))
    } catch {
      sites.value = []
    }
  }

  return { events, sites, loading, error, workspaceId, load, loadSites }
}
