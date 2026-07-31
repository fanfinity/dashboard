import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

/**
 * Warehouse models = a named select against a warehouse connection whose result
 * the rest of the product treats as a table.
 *
 * A model is the join between the warehouse and the fan graph: attributes are
 * computed over one (`attributes.json` -> `dataModelId`), and an identifier type
 * can be collected from one of its columns (`identifier-types.json` ->
 * `dataModels[]`). That is why deleting one is never a local decision — see
 * `describeDependants` below.
 *
 * Data is mock JSON (`public/data/warehouse-models.json`) read through
 * `useMockResource`, so this file inherits the repo-wide
 * `{ data, loading, error, load() }` contract and never throws.
 *
 * Writes have no backend. `setEnabled` / `remove` / `add` mutate the loaded
 * array in place and nothing else — a reload re-reads the JSON and the change is
 * gone. Pages own the user feedback (a `useQuasar().notify()` toast); these
 * functions stay side-effect free so they can be called from anywhere.
 *
 * The SQL helpers below are the same story: `validateModelSql` is a **local**
 * parse, not a query. It can tell you the statement is not a select or that a
 * column has no alias; it cannot tell you the table exists. Every screen that
 * calls it says so on the surface.
 */

const CONNECTION_TYPE_LABELS = {
  snowflake: 'Snowflake',
  bigquery: 'BigQuery',
  postgres: 'PostgreSQL',
  redshift: 'Redshift',
  databricks: 'Databricks'
}

const REFRESH_STATUS = {
  success: { label: 'Refreshed', variant: 'success' },
  warning: { label: 'With warnings', variant: 'warn' },
  error: { label: 'Failed', variant: 'danger' }
}

/** Cron presets offered before the user reaches for a raw expression. */
export const SCHEDULE_PRESETS = [
  { value: '', label: 'Manual only — refreshed on demand' },
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '0 * * * *', label: 'Hourly, on the hour' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 3 * * *', label: 'Daily at 03:00' },
  { value: '0 4 * * 1', label: 'Weekly, Monday at 04:00' }
]

/**
 * Human label for a warehouse connection's `type`.
 *
 * @param {string} type
 * @returns {string}
 */
export function connectionTypeLabel(type) {
  return CONNECTION_TYPE_LABELS[type] ?? 'Warehouse'
}

/**
 * A connection a model can actually run against.
 *
 * @param {object|null|undefined} connection
 * @returns {boolean}
 */
export function isConnectionHealthy(connection) {
  return connection?.status === 'connected'
}

/**
 * Human label for a model's `lastRefreshStatus`.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function refreshStatusLabel(status) {
  return REFRESH_STATUS[status]?.label ?? 'Never refreshed'
}

/**
 * `StatusBadge` variant for a model's `lastRefreshStatus`.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function refreshStatusVariant(status) {
  return REFRESH_STATUS[status]?.variant ?? 'neutral'
}

/**
 * Human label for a cron expression, falling back to the expression itself.
 *
 * @param {string|null|undefined} cron
 * @returns {string}
 */
export function scheduleLabel(cron) {
  if (!cron) return 'Manual only'
  return SCHEDULE_PRESETS.find(p => p.value === cron)?.label ?? cron
}

/**
 * Five whitespace-separated fields — the shape the scheduler accepts. The field
 * *contents* are not checked here; the backend is the authority on those.
 *
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
export function isValidCron(value) {
  return /^\S+(?:\s+\S+){4}$/.test(String(value ?? '').trim())
}

/**
 * Thousands-separated count, with a dash for nothing at all.
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
 * `2026-07-31T04:12:00.000Z` -> `31 Jul 2026`.
 *
 * Locale and time zone are both pinned so the smoke runner, CI and a dev box in
 * another region all render the same characters.
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
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/**
 * `2026-07-31T04:12:00.000Z` -> `31 Jul 2026, 04:12`.
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
    minute: '2-digit',
    timeZone: 'UTC'
  })}`
}

/**
 * Identifier derived from a display name: `'Fan orders'` -> `'model_fan_orders'`.
 * Model ids are snake_case with a `model_` prefix because they are addressed by
 * attributes and identifier types as foreign keys.
 *
 * @param {string} value
 * @returns {string}
 */
export function makeModelId(value) {
  const slug = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug ? `model_${slug}` : ''
}

// Splits a select list on its top-level commas only, so `count(*, x)` and any
// string literal survive intact.
function splitTopLevel(list) {
  const parts = []
  let current = ''
  let depth = 0
  let quote = ''

  for (const ch of list) {
    if (quote) {
      current += ch
      if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      current += ch
      continue
    }
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }

  parts.push(current)
  return parts.map(p => p.trim()).filter(Boolean)
}

// One select-list entry -> the column it produces. An expression with no alias
// produces no name, which is a thing the caller has to report rather than hide:
// the mapping fields below can only offer columns that are actually named.
function toColumn(expression) {
  const expr = expression.trim()
  const star = expr === '*' || expr.endsWith('.*')
  const aliased = /\s+as\s+"?([a-z_][a-z0-9_$]*)"?$/i.exec(expr)

  if (aliased) {
    return {
      name: aliased[1].toLowerCase(),
      expression: expr,
      star,
      aliased: true
    }
  }

  const bare =
    !star && /^[a-z0-9_$."]+$/i.test(expr)
      ? expr.split('.').pop().replace(/"/g, '').toLowerCase()
      : ''

  return { name: bare, expression: expr, star, aliased: false }
}

/**
 * The columns a select produces, read off the statement itself.
 *
 * Deliberately shallow: it reads the list between the first `select` and the
 * first `from`, which covers every model in the catalog. A scalar subquery in
 * the select list would end the match early — that shows up as an expression
 * with no name, which `validateModelSql` reports rather than swallows.
 *
 * @param {string|null|undefined} sql
 * @returns {Array<{name: string, expression: string, star: boolean, aliased: boolean}>}
 *
 * @example
 * parseModelColumns('select id, sum(x) as total from t')
 * // [{ name: 'id', … }, { name: 'total', aliased: true, … }]
 */
export function parseModelColumns(sql) {
  const text = String(sql ?? '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return []

  const match = /\bselect\b\s+(?:distinct\s+)?(.+?)\s+\bfrom\b/i.exec(text)
  if (!match) return []

  return splitTopLevel(match[1]).map(toColumn)
}

const WRITE_STATEMENT =
  /^\s*(?:insert|update|delete|drop|alter|truncate|merge|create|grant|call)\b/i

/**
 * Checks a model's query **locally**. No connection is opened and no rows are
 * read — this is a parse, and every caller says so on screen.
 *
 * @param {string|null|undefined} sql
 * @returns {{
 *   ok: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   columns: Array<object>
 * }}
 */
export function validateModelSql(sql) {
  const text = String(sql ?? '').trim()
  const errors = []
  const warnings = []

  if (!text) {
    errors.push('Write the select the model reads from.')
  } else if (WRITE_STATEMENT.test(text)) {
    errors.push('A model only reads — the statement has to be a select.')
  } else if (!/\bselect\b/i.test(text)) {
    errors.push('No select found. A model is defined by one select statement.')
  } else if (!/\bfrom\b/i.test(text)) {
    errors.push('The select needs a from clause naming the table to read.')
  } else if (/;\s*\S/.test(text)) {
    errors.push('One statement per model — remove everything after the first.')
  }

  const columns = errors.length ? [] : parseModelColumns(text)

  if (!errors.length && !columns.length) {
    errors.push('No column list could be read out of the select.')
  }

  if (columns.some(c => c.star)) {
    warnings.push(
      'A star cannot be expanded without running the query. Name the columns so the mapping below can be checked.'
    )
  }

  const unnamed = columns.filter(c => !c.name && !c.star).length
  if (unnamed) {
    warnings.push(
      `${unnamed} expression${unnamed === 1 ? ' has' : 's have'} no alias. Add “as <name>” so ${unnamed === 1 ? 'it becomes a' : 'they become'} named column${unnamed === 1 ? '' : 's'}.`
    )
  }

  return { ok: !errors.length, errors, warnings, columns }
}

const IDENTIFIER_NAMES = [
  'profile_id',
  'fan_id',
  'fan_ref',
  'customer_id',
  'user_id',
  'holder_id',
  'email',
  'phone'
]

/**
 * A first guess at which parsed column plays which role, used to seed the
 * mapping fields on the create form. Only ever fills a field the user has left
 * alone — the page decides that, not this function.
 *
 * @param {Array<{name: string}>} columns
 * @returns {{ primaryKey: string, identifier: string, timestamp: string }}
 */
export function suggestColumnRoles(columns) {
  const names = (columns ?? []).map(c => c.name).filter(Boolean)
  const primaryKey =
    names.find(n => n === 'id' || n.endsWith('_id')) ?? names[0] ?? ''
  const identifier = names.find(n => IDENTIFIER_NAMES.includes(n)) ?? primaryKey
  const timestamp = names.find(n => /(?:_at|_on|_time|_date)$/.test(n)) ?? ''
  return { primaryKey, identifier, timestamp }
}

/**
 * One sentence naming what breaks if a model goes away — the attributes
 * computed over it and the identifier types collected from its columns.
 *
 * @param {{attributes: Array, identifierTypes: Array}} dependants
 * @returns {string} `''` when nothing depends on the model.
 */
export function describeDependants(dependants) {
  const attributes = dependants?.attributes ?? []
  const identifierTypes = dependants?.identifierTypes ?? []
  const parts = []

  if (attributes.length) {
    const names = attributes.map(a => a.name).join(', ')
    parts.push(
      `${attributes.length} attribute${attributes.length === 1 ? '' : 's'} (${names}) stop${attributes.length === 1 ? 's' : ''} being computed`
    )
  }

  if (identifierTypes.length) {
    const names = identifierTypes.map(t => t.displayName ?? t.name).join(', ')
    parts.push(
      `${identifierTypes.length} identifier type${identifierTypes.length === 1 ? '' : 's'} (${names}) stop${identifierTypes.length === 1 ? 's' : ''} collecting from it`
    )
  }

  if (!parts.length) return ''
  return `${parts.join(' and ')}.`
}

/**
 * The configured warehouse models, plus local-only mutations.
 *
 * @returns {{
 *   models: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   setEnabled: (id: string, isEnabled: boolean) => void,
 *   remove: (id: string) => void,
 *   add: (model: object) => object
 * }}
 *
 * @example
 * const { models, loading, error, load } = useWarehouseModels()
 * onMounted(load)
 */
export function useWarehouseModels() {
  const {
    data: models,
    loading,
    error,
    load
  } = useMockResource('warehouse-models')

  function findById(id) {
    return models.value.find(m => m.id === id) ?? null
  }

  function setEnabled(id, isEnabled) {
    models.value = models.value.map(m =>
      m.id === id ? { ...m, isEnabled } : m
    )
  }

  function remove(id) {
    models.value = models.value.filter(m => m.id !== id)
  }

  function add(model) {
    const now = new Date().toISOString()
    const record = {
      id: makeModelId(model.name) || `model_${Date.now()}`,
      description: '',
      dwhConnectionId: null,
      dwhConnectionName: null,
      query: '',
      primaryKeyColumn: null,
      identifierColumn: null,
      timestampColumn: null,
      columnCount: 0,
      rowCount: 0,
      isEnabled: true,
      lastRefreshedAt: null,
      lastRefreshStatus: null,
      usedByAttributeCount: 0,
      usedByAudienceCount: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...model
    }
    models.value = [...models.value, record]
    return record
  }

  return { models, loading, error, load, findById, setEnabled, remove, add }
}

/**
 * Everything a model screen needs *around* the models themselves: the warehouse
 * connections they run on, and the records that depend on them.
 *
 * These are secondary resources on every screen that uses them — one combined
 * `error` and one `load()` so a page renders a single inline failure with a
 * single retry instead of three, and keeps working meanwhile.
 *
 * @returns {{
 *   connections: import('vue').Ref<Array>,
 *   attributes: import('vue').Ref<Array>,
 *   identifierTypes: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   connectionFor: (model: object) => object|null,
 *   dependantsFor: (model: object) => {attributes: Array, identifierTypes: Array}
 * }}
 */
export function useWarehouseModelContext() {
  const {
    data: connections,
    loading: connectionsLoading,
    error: connectionsError,
    load: loadConnections
  } = useMockResource('dwh-connections')

  const {
    data: attributes,
    loading: attributesLoading,
    error: attributesError,
    load: loadAttributes
  } = useMockResource('attributes')

  const {
    data: identifierTypes,
    loading: identifiersLoading,
    error: identifiersError,
    load: loadIdentifierTypes
  } = useMockResource('identifier-types')

  const loading = computed(
    () =>
      connectionsLoading.value ||
      attributesLoading.value ||
      identifiersLoading.value
  )

  const error = computed(
    () =>
      connectionsError.value ?? attributesError.value ?? identifiersError.value
  )

  async function load() {
    await Promise.all([
      loadConnections(),
      loadAttributes(),
      loadIdentifierTypes()
    ])
  }

  function connectionFor(model) {
    if (!model?.dwhConnectionId) return null
    return connections.value.find(c => c.id === model.dwhConnectionId) ?? null
  }

  function dependantsFor(model) {
    if (!model?.id) return { attributes: [], identifierTypes: [] }
    return {
      attributes: attributes.value.filter(a => a.dataModelId === model.id),
      identifierTypes: identifierTypes.value.filter(t =>
        (t.dataModels ?? []).some(d => d.dataModelId === model.id)
      )
    }
  }

  return {
    connections,
    attributes,
    identifierTypes,
    loading,
    error,
    load,
    connectionFor,
    dependantsFor
  }
}
