import { ref } from 'vue'
import { ApiError, customFetch } from '@/api/mutator'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useDataSource } from '@/composables/useDataSource'

/**
 * The three sync-configuration surfaces a pull-based source has, all live as of
 * backend PR #16:
 *
 *   POST …/sources/{id}/test           does the stored credential still work
 *   POST …/sources/{id}/discover       ask the connector what it can pull
 *   GET/PUT …/sources/{id}/catalog     which of those entities to pull
 *   GET/PUT …/sources/{id}/sync-schedule   how often, and in what mode
 *
 * Grouped in one file because they are one job — "set this source up to pull" —
 * and because discover and catalog are two halves of the same round trip: you
 * cannot select an entity the catalog has not discovered.
 *
 * ## `SourceCatalog.pending` is a loading state, and getting that wrong is
 * ## expensive
 *
 * `POST …/discover` starts a discovery and `GET …/catalog` answers with
 * `pending: true` while it runs. An empty `entities` under a true `pending` does
 * NOT mean "this connector exposes nothing" — it means nobody has finished
 * asking. Rendering it as an empty state would tell someone their Shopify store
 * has no tables. `loadCatalog()` therefore polls while pending and the panel
 * shows a spinner with the word "Discovering" on it.
 *
 * The poll is bounded (`MAX_POLLS`). Giving up leaves `pending` true rather than
 * flipping to empty, because "still running" stays the honest answer.
 */

const MAX_POLLS = 10
const POLL_MS = 2000

/** What a sync run pulls. Vocabulary is `Mode` in the spec. */
export const SYNC_MODES = [
  {
    value: 'full',
    label: 'Full refresh',
    description: 'Re-pull everything on every run.'
  },
  {
    value: 'incremental',
    label: 'Incremental',
    description: 'Only records that changed since the last run.'
  },
  {
    value: 'date_range',
    label: 'Date range',
    description: 'A window you choose, re-pulled each run.'
  }
]

/**
 * Whether this source is pulled on a schedule at all.
 *
 * A `web` source receives events pushed to it and has nothing to discover or
 * schedule; the sync endpoints exist for the ones Sfere polls. Gated here so
 * the panel does not render four controls that can only 404.
 *
 * @param {object|null} source
 * @returns {boolean}
 */
export function isPulledSource(source) {
  return source?.sourceType === 'cloud_app' || source?.sourceType === 'zid'
}

/** One wire `SourceCatalogEntity`. */
function adaptEntity(raw) {
  const e = camelizeKeys(raw)
  return {
    key: e.key,
    name: e.name || e.key,
    selected: Boolean(e.selected),
    supportedModes: Array.isArray(e.supportedModes) ? e.supportedModes : [],
    cursorField: e.cursorField ?? null,
    primaryKey: Array.isArray(e.primaryKey) ? e.primaryKey : [],
    schema: e.schema ?? null,
    // NOT defaulted to 0. An estimate the connector did not give is unknown,
    // and "0 rows" about a table nobody counted is the confident-zero mistake.
    recordCountEstimate: e.recordCountEstimate ?? null
  }
}

/** One wire `SourceCatalog`. */
export function adaptSourceCatalog(raw) {
  const c = camelizeKeys(raw)
  return {
    sourceId: c.sourceId ?? null,
    pending: Boolean(c.pending),
    discoveredAt: c.discoveredAt ?? null,
    error: c.error ?? null,
    entities: Array.isArray(c.entities) ? c.entities.map(adaptEntity) : []
  }
}

/** One wire `SyncSchedule`. */
export function adaptSyncSchedule(raw) {
  const s = camelizeKeys(raw)
  return {
    sourceId: s.sourceId ?? null,
    isEnabled: Boolean(s.isEnabled),
    cron: s.cron ?? null,
    timezone: s.timezone || 'UTC',
    mode: s.mode || 'incremental',
    nextRunAt: s.nextRunAt ?? null,
    lastRunAt: s.lastRunAt ?? null
  }
}

/** One wire `ConnectionTestResult`. */
export function adaptTestResult(raw) {
  const r = camelizeKeys(raw)
  return {
    ok: Boolean(r.ok),
    error: r.error ?? null,
    latencyMs: Number.isFinite(Number(r.latencyMs))
      ? Number(r.latencyMs)
      : null,
    checkedAt: r.checkedAt ?? null,
    details: r.details ?? null
  }
}

export function useSourceCatalogAPI() {
  const { isMock } = useDataSource()

  const catalog = ref(null)
  const catalogLoading = ref(false)
  const catalogPending = ref(false)
  const catalogError = ref(null)
  const catalogApiMissing = ref(false)
  const discovering = ref(false)

  const schedule = ref(null)
  const scheduleLoading = ref(false)
  const scheduleSaving = ref(false)
  const scheduleError = ref(null)
  const scheduleApiMissing = ref(false)

  const testResult = ref(null)
  const testing = ref(false)

  function base(sourceId) {
    const account = currentAccount.value
    return account && `/v1/accounts/${account.id}/sources/${sourceId}`
  }

  /**
   * One request, with the repo's three-way outcome instead of a throw. Returns
   * `{ok:true,data}` / `{ok:false,apiMissing}` / `{ok:false,error}`.
   */
  async function request(url, init) {
    if (isMock.value) return { ok: false, apiMissing: true }
    if (!url) return { ok: false, apiMissing: true }
    try {
      const { data } = await customFetch(url, init)
      return { ok: true, data }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 404) {
        return { ok: false, error: e.message }
      }
      return { ok: false, apiMissing: true }
    }
  }

  // ------------------------------------------------------------------ catalog

  async function readCatalogOnce(sourceId) {
    const root = base(sourceId)
    return request(root && `${root}/catalog`, { method: 'GET' })
  }

  /**
   * Read the catalog, polling while the backend reports `pending`.
   *
   * @param {string} sourceId
   */
  async function loadCatalog(sourceId) {
    catalogError.value = null
    catalogApiMissing.value = false
    catalogLoading.value = true
    try {
      for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
        const res = await readCatalogOnce(sourceId)
        if (!res.ok) {
          if (res.apiMissing) catalogApiMissing.value = true
          else catalogError.value = res.error
          catalog.value = null
          catalogPending.value = false
          return
        }
        catalog.value = adaptSourceCatalog(res.data)
        catalogPending.value = catalog.value.pending
        if (!catalogPending.value) return
        await new Promise(resolve => setTimeout(resolve, POLL_MS))
      }
      // Still pending after the last poll. Left true on purpose — see the note
      // at the top of this file.
    } finally {
      catalogLoading.value = false
    }
  }

  /**
   * Ask the connector what it can pull, then re-read the catalog.
   *
   * @param {string} sourceId
   */
  async function discover(sourceId) {
    discovering.value = true
    try {
      const root = base(sourceId)
      const res = await request(root && `${root}/discover`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() }
      })
      if (!res.ok) return res
      // The POST's own body is a SourceCatalog too, but it is the pre-poll one;
      // going back through loadCatalog is what gives us the polling loop.
      await loadCatalog(sourceId)
      return { ok: true, data: catalog.value }
    } finally {
      discovering.value = false
    }
  }

  /**
   * Choose which entities to pull. `SourceCatalogUpdate` is the whole selection
   * (`selected_entities`), not a delta, so the caller passes every selected key.
   *
   * @param {string} sourceId
   * @param {string[]} selectedKeys
   */
  async function saveCatalogSelection(sourceId, selectedKeys) {
    const root = base(sourceId)
    const res = await request(root && `${root}/catalog`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_entities: selectedKeys })
    })
    if (res.ok) {
      catalog.value = adaptSourceCatalog(res.data)
      catalogPending.value = catalog.value.pending
    }
    return res
  }

  // ----------------------------------------------------------------- schedule

  async function loadSchedule(sourceId) {
    scheduleError.value = null
    scheduleApiMissing.value = false
    scheduleLoading.value = true
    try {
      const root = base(sourceId)
      const res = await request(root && `${root}/sync-schedule`, {
        method: 'GET'
      })
      if (!res.ok) {
        if (res.apiMissing) scheduleApiMissing.value = true
        else scheduleError.value = res.error
        schedule.value = null
        return
      }
      schedule.value = adaptSyncSchedule(res.data)
    } finally {
      scheduleLoading.value = false
    }
  }

  /**
   * @param {string} sourceId
   * @param {{ isEnabled: boolean, cron?: string|null, timezone?: string, mode?: string }} next
   */
  async function saveSchedule(sourceId, next) {
    scheduleSaving.value = true
    try {
      const root = base(sourceId)
      const res = await request(root && `${root}/sync-schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: Boolean(next.isEnabled),
          ...(next.cron ? { cron: next.cron } : {}),
          ...(next.timezone ? { timezone: next.timezone } : {}),
          ...(next.mode ? { mode: next.mode } : {})
        })
      })
      if (res.ok) schedule.value = adaptSyncSchedule(res.data)
      return res
    } finally {
      scheduleSaving.value = false
    }
  }

  // --------------------------------------------------------------------- test

  /**
   * Does the stored credential still work? A failed test is a RESULT, not an
   * error — it renders as a red panel with the backend's message in it, never
   * as `ErrorState`, because the request itself succeeded in telling us so.
   *
   * @param {string} sourceId
   */
  async function testConnection(sourceId) {
    testing.value = true
    testResult.value = null
    try {
      const root = base(sourceId)
      const res = await request(root && `${root}/test`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() }
      })
      if (!res.ok) return res
      testResult.value = adaptTestResult(res.data)
      return { ok: true, data: testResult.value }
    } finally {
      testing.value = false
    }
  }

  return {
    catalog,
    catalogLoading,
    catalogPending,
    catalogError,
    catalogApiMissing,
    discovering,
    loadCatalog,
    discover,
    saveCatalogSelection,
    schedule,
    scheduleLoading,
    scheduleSaving,
    scheduleError,
    scheduleApiMissing,
    loadSchedule,
    saveSchedule,
    testResult,
    testing,
    testConnection
  }
}
