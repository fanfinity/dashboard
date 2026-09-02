import { ref } from 'vue'
import { ApiError, customFetch } from '@/api/mutator'
import { camelizeKeys } from '@/lib/apiShape'
import { currentAccount } from '@/composables/useMe'
import { useDataSource } from '@/composables/useDataSource'

/**
 * Reading a destination's warehouse, and checking it still answers. Four routes,
 * all live as of backend PR #16:
 *
 *   GET  …/destinations/{id}/tables                  what is in there
 *   GET  …/destinations/{id}/tables/{table}/rows     a page of one table
 *   POST …/destinations/{id}/query                   one read-only SELECT
 *   POST …/destinations/{id}/test                    does the connection work
 *
 * ## `listDestinationTables` returns columns too, so it feeds both surfaces
 *
 * A `DestinationTable` is `{name, engine?, rows?, columns[]}`. One call is
 * therefore the whole table list AND the SQL console's schema tree, which is why
 * there is one `loadTables` rather than a per-table schema read.
 *
 * ## Two shapes that look standard and are not
 *
 * `getDestinationTableRows` answers `DestinationRowsPage` — a page envelope that
 * also carries `columns`. It is NOT a `Page_*`, so `pageItems` would throw its
 * column list away and leave the browser guessing at headers from the first row.
 *
 * `queryDestination` answers `DestinationQueryResult` — `{columns, rows,
 * row_count, truncated?, offset, limit, elapsed_ms}`. `truncated` is the field
 * worth surfacing: a result the backend cut short and a result that genuinely
 * had that many rows look identical otherwise, and someone reading the second
 * as the first draws the wrong conclusion from their own data.
 *
 * ## A failed test is a result, not an error
 *
 * `ConnectionTestResult.ok === false` with a message is the endpoint working
 * correctly. It renders as a red panel, never as `ErrorState` — that selector is
 * how `scripts/smoke.mjs` decides a screen is broken.
 *
 * `rows` come back as maps of arbitrary values, so nothing here formats them
 * beyond stringifying non-primitives; a warehouse column can hold anything and
 * a formatter guessing at a type is how a JSON blob becomes `[object Object]`.
 */

/** One wire `DestinationColumn`. */
function adaptColumn(raw) {
  const c = camelizeKeys(raw)
  return { name: c.name, type: c.type || '' }
}

/** One wire `DestinationTable`. */
export function adaptDestinationTable(raw) {
  const t = camelizeKeys(raw)
  return {
    name: t.name,
    engine: t.engine ?? null,
    // NOT defaulted to 0 — a row count the warehouse did not report is unknown,
    // and "0 rows" on a table nobody counted is the confident-zero mistake.
    rows: t.rows ?? null,
    columns: Array.isArray(t.columns) ? t.columns.map(adaptColumn) : []
  }
}

/**
 * A cell value as a string, without pretending to know its type.
 *
 * @param {*} value
 * @returns {string}
 */
export function cellText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function useDestinationBrowser() {
  const { isMock } = useDataSource()

  const tables = ref([])
  const tablesLoading = ref(false)
  const tablesError = ref(null)
  const tablesApiMissing = ref(false)

  const rowsPage = ref(null)
  const rowsLoading = ref(false)
  const rowsError = ref(null)
  const rowsApiMissing = ref(false)

  const queryResult = ref(null)
  const querying = ref(false)
  const queryError = ref(null)
  const queryApiMissing = ref(false)

  const testResult = ref(null)
  const testing = ref(false)

  function base(destinationId) {
    const account = currentAccount.value
    return account && `/v1/accounts/${account.id}/destinations/${destinationId}`
  }

  /** One request with the repo's three-way outcome instead of a throw. */
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

  // ------------------------------------------------------------------- tables

  async function loadTables(destinationId) {
    tablesError.value = null
    tablesApiMissing.value = false
    tablesLoading.value = true
    try {
      const root = base(destinationId)
      const res = await request(root && `${root}/tables`, { method: 'GET' })
      if (!res.ok) {
        if (res.apiMissing) tablesApiMissing.value = true
        else tablesError.value = res.error
        tables.value = []
        return
      }
      tables.value = (res.data?.items ?? []).map(adaptDestinationTable)
    } finally {
      tablesLoading.value = false
    }
  }

  /**
   * A page of one table. `columns` comes back on the page itself, so headers are
   * never inferred from the first row.
   *
   * @param {string} destinationId
   * @param {string} tableName
   * @param {{ page?: number, size?: number }} [opts]
   */
  async function loadRows(
    destinationId,
    tableName,
    { page = 1, size = 25 } = {}
  ) {
    rowsError.value = null
    rowsApiMissing.value = false
    rowsLoading.value = true
    try {
      const root = base(destinationId)
      const res = await request(
        root &&
          `${root}/tables/${encodeURIComponent(tableName)}/rows?page=${page}&size=${size}`,
        { method: 'GET' }
      )
      if (!res.ok) {
        if (res.apiMissing) rowsApiMissing.value = true
        else rowsError.value = res.error
        rowsPage.value = null
        return
      }
      const p = camelizeKeys(res.data) ?? {}
      rowsPage.value = {
        table: tableName,
        columns: Array.isArray(p.columns) ? p.columns.map(adaptColumn) : [],
        rows: Array.isArray(p.rows) ? p.rows : [],
        total: Number(p.total) || 0,
        page: Number(p.page) || page,
        size: Number(p.size) || size,
        pages: Number(p.pages) || 0
      }
    } finally {
      rowsLoading.value = false
    }
  }

  // -------------------------------------------------------------------- query

  /**
   * Run one read-only SELECT.
   *
   * @param {string} destinationId
   * @param {{ sql: string, offset?: number, limit?: number }} input
   */
  async function runQuery(destinationId, { sql, offset = 0, limit = 100 }) {
    queryError.value = null
    queryApiMissing.value = false
    querying.value = true
    try {
      const root = base(destinationId)
      const res = await request(root && `${root}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({ sql, offset, limit })
      })
      if (!res.ok) {
        if (res.apiMissing) queryApiMissing.value = true
        else queryError.value = res.error
        queryResult.value = null
        return res
      }
      const q = camelizeKeys(res.data) ?? {}
      queryResult.value = {
        columns: Array.isArray(q.columns) ? q.columns.map(adaptColumn) : [],
        rows: Array.isArray(q.rows) ? q.rows : [],
        rowCount: Number(q.rowCount) || 0,
        // The difference between "this is all of it" and "we stopped here".
        truncated: Boolean(q.truncated),
        offset: Number(q.offset) || 0,
        limit: Number(q.limit) || limit,
        elapsedMs: Number.isFinite(Number(q.elapsedMs))
          ? Number(q.elapsedMs)
          : null
      }
      return { ok: true, data: queryResult.value }
    } finally {
      querying.value = false
    }
  }

  // --------------------------------------------------------------------- test

  /**
   * Test the SAVED destination. There is a sibling route,
   * `POST …/destinations/test`, that tests a config before it is saved — that
   * one belongs to the create form, not here.
   *
   * @param {string} destinationId
   */
  async function testConnection(destinationId) {
    testing.value = true
    testResult.value = null
    try {
      const root = base(destinationId)
      const res = await request(root && `${root}/test`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() }
      })
      if (!res.ok) return res
      const r = camelizeKeys(res.data) ?? {}
      testResult.value = {
        ok: Boolean(r.ok),
        error: r.error ?? null,
        latencyMs: Number.isFinite(Number(r.latencyMs))
          ? Number(r.latencyMs)
          : null,
        checkedAt: r.checkedAt ?? null,
        details: r.details ?? null
      }
      return { ok: true, data: testResult.value }
    } finally {
      testing.value = false
    }
  }

  return {
    tables,
    tablesLoading,
    tablesError,
    tablesApiMissing,
    loadTables,

    rowsPage,
    rowsLoading,
    rowsError,
    rowsApiMissing,
    loadRows,

    queryResult,
    querying,
    queryError,
    queryApiMissing,
    runQuery,

    testResult,
    testing,
    testConnection
  }
}
