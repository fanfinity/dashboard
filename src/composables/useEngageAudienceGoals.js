import { useMockResource } from '@/composables/useMockResource'

/**
 * Goals domain data access.
 *
 * A goal is the outcome a journey optimises for, defined over an attribute: a
 * metric (`sum` or `count`), a target, and the window it is measured across.
 * `attachmentCount` is how many journeys point at it — `/goals` loads the
 * journeys themselves as a **secondary** resource so the detail dialog can name
 * them; if that fails, the count still renders and only the names degrade.
 *
 * There is no backend. `setEnabled` mutates the loaded array and nothing else.
 */

const METRIC_LABELS = {
  count: 'Count',
  sum: 'Sum',
  average: 'Average'
}

const METRIC_HINTS = {
  count: 'Counts the fans who match, once each.',
  sum: 'Adds the attribute value across matching fans.',
  average: 'Averages the attribute value across matching fans.'
}

const STATUS_META = {
  achieved: { label: 'Achieved', variant: 'success' },
  on_track: { label: 'On track', variant: 'brand' },
  at_risk: { label: 'At risk', variant: 'warn' },
  off_track: { label: 'Off track', variant: 'danger' }
}

// The bar fill matches the badge, so progress and status never disagree.
const STATUS_BAR = {
  achieved: 'bg-success',
  on_track: 'bg-brand',
  at_risk: 'bg-amber-500',
  off_track: 'bg-rose-600'
}

/**
 * Human label for a goal's `metric`.
 *
 * @param {string|null|undefined} metric
 * @returns {string}
 *
 * @example
 * metricLabel('sum') // 'Sum'
 */
export function metricLabel(metric) {
  return METRIC_LABELS[metric] ?? 'Count'
}

/**
 * One line explaining what a goal's `metric` actually measures.
 *
 * @param {string|null|undefined} metric
 * @returns {string}
 */
export function metricHint(metric) {
  return METRIC_HINTS[metric] ?? METRIC_HINTS.count
}

/**
 * Badge label and variant for a goal's `status`.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, variant: string }}
 */
export function goalStatusMeta(status) {
  return STATUS_META[status] ?? { label: 'On track', variant: 'brand' }
}

/**
 * Tailwind background for the progress bar of a goal in this `status`.
 *
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function goalBarClass(status) {
  return STATUS_BAR[status] ?? STATUS_BAR.on_track
}

/**
 * Progress as a CSS width. Clamped to 0–100 so an overachieving goal
 * (`progress: 1.02`) fills the bar instead of overflowing its track.
 *
 * @param {*} progress
 * @returns {string} e.g. `'75.4%'`
 */
export function goalBarWidth(progress) {
  const n = Number(progress)
  if (!Number.isFinite(n) || n <= 0) return '0%'
  return `${Math.min(100, n * 100).toFixed(1)}%`
}

/**
 * The configured goals, plus local-only mutations.
 *
 * @returns {{
 *   goals: import('vue').Ref<object[]>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   setEnabled: (id: string, isEnabled: boolean) => void
 * }}
 *
 * @example
 * const { goals, loading, error, load } = useEngageAudienceGoals()
 * onMounted(load)
 */
export function useEngageAudienceGoals() {
  const { data: goals, loading, error, load } = useMockResource('goals')

  function setEnabled(id, isEnabled) {
    goals.value = goals.value.map(g => (g.id === id ? { ...g, isEnabled } : g))
  }

  return { goals, loading, error, load, setEnabled }
}

/**
 * The journeys attached to a goal. Secondary on `/goals`.
 *
 * @returns {{ journeys: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useEngageAudienceGoalJourneys() {
  const { data: journeys, loading, error, load } = useMockResource('journeys')
  return { journeys, loading, error, load }
}

/**
 * The attribute catalog a goal is measured over. Secondary on `/goals`: the
 * goal record already denormalises `attributeName`, so a failed load costs the
 * dialog the attribute's kind and nothing else.
 *
 * @returns {{ attributes: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useEngageAudienceGoalAttributes() {
  const {
    data: attributes,
    loading,
    error,
    load
  } = useMockResource('attributes')

  return { attributes, loading, error, load }
}
