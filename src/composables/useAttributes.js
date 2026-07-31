import { useMockResource } from '@/composables/useMockResource'

/**
 * Attributes = computed fields on a fan profile.
 *
 * An attribute is derived, never captured: "Lifetime merch spend" is an
 * aggregate over a warehouse model, "Last page viewed" is the newest value seen
 * on the event stream. Each one declares the dimensions it produces, so an
 * audience rule can filter on them.
 *
 * Two kinds exist and they behave differently everywhere:
 *   - `realtime`  — evaluated over incoming events as they arrive.
 *   - `warehouse` — evaluated against a warehouse model on its refresh cycle.
 *
 * Data is mock JSON (`public/data/attributes.json`) read through
 * `useMockResource`, so this file inherits the repo-wide
 * `{ data, loading, error, load() }` contract and never throws.
 *
 * Writes have no backend. `remove` / `add` mutate the loaded array in place and
 * nothing else — a reload re-reads the JSON and the change is gone. Pages own
 * the user feedback (a `useQuasar().notify()` toast); these functions stay
 * side-effect free so they can be called from anywhere.
 */

const TYPE_LABELS = {
  realtime: 'Realtime',
  warehouse: 'Warehouse'
}

/**
 * Human label for an attribute's `type`.
 *
 * @param {string} type
 * @returns {string}
 */
export function attributeTypeLabel(type) {
  return TYPE_LABELS[type] ?? 'Attribute'
}

/** The aggregations an attribute can apply to the rows it matches. */
export const ALGORITHMS = [
  { value: 'last', label: 'Last value' },
  { value: 'first', label: 'First value' },
  { value: 'count', label: 'Count of rows' },
  { value: 'sum', label: 'Sum' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' }
]

/** The value types a dimension can hold. */
export const DIMENSION_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'True / false' },
  { value: 'timestamp', label: 'Timestamp' }
]

/**
 * Human label for an aggregation, or a dash when the attribute does not use one
 * (the system-managed ones do not).
 *
 * @param {string|null|undefined} algorithm
 * @returns {string}
 */
export function algorithmLabel(algorithm) {
  if (!algorithm) return '—'
  return ALGORITHMS.find(a => a.value === algorithm)?.label ?? algorithm
}

/**
 * Where an attribute reads from, as one line: the warehouse model it is built
 * on, or the event stream for a realtime one.
 *
 * @param {object} attribute
 * @returns {string}
 */
export function attributeSourceLabel(attribute) {
  if (attribute?.dataModelName) return attribute.dataModelName
  return attribute?.type === 'warehouse' ? 'No data model' : 'Event data'
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
 * `2026-07-24T14:02:11.220Z` -> `24 Jul 2026`.
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
 * `2026-07-24T14:02:11.220Z` -> `24 Jul 2026, 14:02`.
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
 * Identifier derived from a display name: `'Most Frequent City'` ->
 * `'most_frequent_city'`. Attribute ids are snake_case because they are
 * addressed as columns in audience rules and warehouse syncs.
 *
 * @param {string} value
 * @returns {string}
 */
export function makeAttributeId(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * True for the attributes another part of the product owns — the channel
 * unsubscribe flags, for instance. They are read-only here: deleting one would
 * break the feature that maintains it.
 *
 * @param {object} attribute
 * @returns {boolean}
 */
export function isManaged(attribute) {
  return Boolean(attribute?.managedBy)
}

/**
 * The configured attributes, plus local-only mutations.
 *
 * @returns {{
 *   attributes: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   findById: (id: string) => object|null,
 *   remove: (id: string) => void,
 *   add: (attribute: object) => object
 * }}
 *
 * @example
 * const { attributes, loading, error, load } = useAttributes()
 * onMounted(load)
 */
export function useAttributes() {
  const {
    data: attributes,
    loading,
    error,
    load
  } = useMockResource('attributes')

  function findById(id) {
    return attributes.value.find(a => a.id === id) ?? null
  }

  function remove(id) {
    attributes.value = attributes.value.filter(a => a.id !== id)
  }

  function add(attribute) {
    const now = new Date().toISOString()
    const record = {
      id: makeAttributeId(attribute.name) || `attribute_${Date.now()}`,
      type: 'realtime',
      query: '',
      dimensions: [],
      dataModelId: null,
      dataModelName: null,
      dataColumn: null,
      dataWarehouseConnectionName: null,
      timestampColumn: null,
      algorithm: 'last',
      isSingleRow: true,
      managedBy: null,
      managedKind: null,
      managedOwnerId: null,
      usedByAudienceCount: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...attribute
    }
    attributes.value = [...attributes.value, record]
    return record
  }

  return { attributes, loading, error, load, findById, remove, add }
}
