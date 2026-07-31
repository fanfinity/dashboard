import { useMockResource } from '@/composables/useMockResource'
import { formatCount } from '@/composables/useEngageAudienceFormat'

/**
 * Audiences domain data access.
 *
 * An audience is a saved segment of resolved fan profiles: a set of conditions
 * over attributes, re-evaluated continuously (`realtime`) or on the warehouse's
 * schedule (`warehouse`). Journeys enter fans from one, goals are measured over
 * one, and live profile syncs push one out to a destination — which is why this
 * module also exposes the attribute catalog and the live syncs as secondary
 * resources rather than leaving each page to fetch them by hand.
 *
 * There is no backend. `setEnabled` / `remove` / `restore` mutate the loaded
 * array and nothing else; a reload re-reads the JSON and the change is gone.
 * Pages own the user feedback (`useEngageAudienceToasts`), so these stay
 * side-effect free.
 */

const TYPE_LABELS = {
  realtime: 'Real-time',
  warehouse: 'Warehouse'
}

const TYPE_HINTS = {
  realtime: 'Re-evaluated as events arrive.',
  warehouse: 'Re-evaluated when the warehouse model refreshes.'
}

// Every operator the conditions in `public/data/audiences.json` use, plus the
// obvious inverses, phrased so `<attribute> <operator> <value>` reads as English.
const OPERATOR_LABELS = {
  eq: 'is',
  neq: 'is not',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  contains: 'contains',
  not_contains: 'does not contain',
  is_null: 'is not set',
  is_not_null: 'is set'
}

// Operators that stand alone — appending a value would render "is set null".
const UNARY_OPERATORS = new Set(['is_null', 'is_not_null'])

/**
 * Human label for an audience's evaluation `type`.
 *
 * @param {string|null|undefined} type
 * @returns {string}
 *
 * @example
 * audienceTypeLabel('realtime') // 'Real-time'
 */
export function audienceTypeLabel(type) {
  return TYPE_LABELS[type] ?? 'Real-time'
}

/**
 * One line explaining what an audience's `type` costs the reader.
 *
 * @param {string|null|undefined} type
 * @returns {string}
 */
export function audienceTypeHint(type) {
  return TYPE_HINTS[type] ?? TYPE_HINTS.realtime
}

/**
 * `'lifetime_merch_spend'` -> `'Lifetime merch spend'`. The fallback for an
 * attribute id that is not in the catalog — either because the catalog failed
 * to load or because the attribute was deleted out from under the audience.
 *
 * @param {string} id
 * @returns {string}
 */
export function humaniseAttributeId(id) {
  const words = String(id ?? '')
    .replace(/^system_/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  if (!words) return 'Unknown attribute'
  return words[0].toUpperCase() + words.slice(1)
}

/**
 * One condition as a sentence: `'Lifetime merch spend is at least 1,000'`.
 *
 * @param {object} condition `{ attributeId, operator, value }`
 * @param {Record<string, object>} [attributesById]
 *   The attribute catalog, keyed by id. Missing entries fall back to a
 *   humanised id, so a failed catalog load degrades the wording rather than
 *   blanking the condition.
 * @returns {string}
 */
export function conditionLabel(condition, attributesById = {}) {
  if (!condition) return ''
  const attribute = attributesById[condition.attributeId]
  const name = attribute?.name ?? humaniseAttributeId(condition.attributeId)
  const operator = OPERATOR_LABELS[condition.operator] ?? condition.operator
  if (UNARY_OPERATORS.has(condition.operator)) return `${name} ${operator}`
  return `${name} ${operator} ${conditionValue(condition.value)}`
}

function conditionValue(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return formatCount(value)
  return `“${value}”`
}

/**
 * The saved audiences, plus local-only mutations.
 *
 * @returns {{
 *   audiences: import('vue').Ref<object[]>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   setEnabled: (id: string, isEnabled: boolean) => void,
 *   remove: (id: string) => object|null,
 *   restore: (record: object) => void
 * }}
 *
 * @example
 * const { audiences, loading, error, load } = useEngageAudiences()
 * onMounted(load)
 */
export function useEngageAudiences() {
  const { data: audiences, loading, error, load } = useMockResource('audiences')

  function setEnabled(id, isEnabled) {
    audiences.value = audiences.value.map(a =>
      a.id === id ? { ...a, isEnabled } : a
    )
  }

  // Returns the removed record so the caller can hand it to the trash without
  // searching for it again.
  function remove(id) {
    const record = audiences.value.find(a => a.id === id) ?? null
    audiences.value = audiences.value.filter(a => a.id !== id)
    return record
  }

  // The trash record carries the audit fields the list has no column for;
  // dropping them here keeps a restored row the same shape as its neighbours.
  function restore(record) {
    if (!record) return
    const restored = { ...record }
    delete restored.deletedAt
    delete restored.deletedBy
    delete restored.deletedByName
    audiences.value = [...audiences.value, restored]
  }

  return { audiences, loading, error, load, setEnabled, remove, restore }
}

/**
 * The attribute catalog an audience's conditions are written against.
 * Secondary: if it fails, conditions still read via `humaniseAttributeId` and
 * the rest of the screen keeps working.
 *
 * @returns {{ attributes: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useEngageAudienceAttributes() {
  const {
    data: attributes,
    loading,
    error,
    load
  } = useMockResource('attributes')

  return { attributes, loading, error, load }
}

/**
 * The live profile syncs, used to answer "which destinations does this audience
 * feed?". Secondary on `/audiences`.
 *
 * @returns {{ liveSyncs: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useEngageAudienceLiveSyncs() {
  const {
    data: liveSyncs,
    loading,
    error,
    load
  } = useMockResource('live-profile-syncs')

  return { liveSyncs, loading, error, load }
}

/**
 * The audiences slice of the shared trash file.
 *
 * `/audiences` has no trash route of its own — the manifest ships one screen —
 * so deleted audiences surface as a tab on the list rather than as a page, and
 * this composable backs it.
 *
 * @returns {{
 *   deleted: import('vue').Ref<object[]>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   trash: (record: object) => void,
 *   restore: (id: string) => object|null
 * }}
 */
export function useEngageAudienceTrash() {
  const {
    data: deleted,
    loading,
    error,
    load
  } = useMockResource('trash', { select: payload => payload.audiences })

  function trash(record) {
    if (!record) return
    deleted.value = [
      {
        ...record,
        deletedAt: new Date().toISOString(),
        deletedByName: 'You'
      },
      ...deleted.value
    ]
  }

  function restore(id) {
    const record = deleted.value.find(a => a.id === id) ?? null
    deleted.value = deleted.value.filter(a => a.id !== id)
    return record
  }

  return { deleted, loading, error, load, trash, restore }
}
