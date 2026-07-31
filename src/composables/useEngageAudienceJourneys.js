import { useMockResource } from '@/composables/useMockResource'

/**
 * Journeys domain data access.
 *
 * A journey is multi-step orchestration over one audience: fans enter from the
 * entry audience, move through wait / branch / send steps, and leave by
 * completing the journey or by exiting it (they stopped matching the audience,
 * or a step sent them out). A journey optimises for at most one goal.
 *
 * `public/data/journeys.json` denormalises the entry audience's name but not
 * the goal's, so `/journeys` loads the goal catalog as a **secondary** resource:
 * if it fails, rows still render and only the Goal column degrades.
 *
 * There is no backend. `setStatus` mutates the loaded array and nothing else.
 */

// status -> { label, variant } for StatusBadge. There is no violet variant in
// the primitive, so draft and archived share `neutral` and are told apart by
// their label.
const STATUS_META = {
  live: { label: 'Live', variant: 'success' },
  paused: { label: 'Paused', variant: 'warn' },
  draft: { label: 'Draft', variant: 'neutral' },
  archived: { label: 'Archived', variant: 'neutral' }
}

/**
 * Badge label and variant for a journey's `status`.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, variant: string }}
 *
 * @example
 * journeyStatusMeta('live') // { label: 'Live', variant: 'success' }
 */
export function journeyStatusMeta(status) {
  return STATUS_META[status] ?? { label: 'Draft', variant: 'neutral' }
}

/**
 * The single action a journey in this status offers, or `null` when it offers
 * none — an archived journey is read-only, and there is no create route to
 * duplicate it into.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, next: string, verb: string }|null}
 */
export function journeyAction(status) {
  if (status === 'live')
    return { label: 'Pause', next: 'paused', verb: 'paused' }
  if (status === 'paused')
    return { label: 'Resume', next: 'live', verb: 'resumed' }
  if (status === 'draft')
    return { label: 'Launch', next: 'live', verb: 'launched' }
  return null
}

/**
 * How the fans who ever entered a journey are split right now. Percentages are
 * of `enrolledCount`, so an unlaunched journey yields zeroes rather than NaN.
 *
 * @param {object} journey
 * @returns {{ enrolled: number, active: number, completed: number, exited: number, activeShare: number, completedShare: number, exitedShare: number }}
 */
export function journeyProgress(journey) {
  const enrolled = Number(journey?.enrolledCount) || 0
  const active = Number(journey?.activeCount) || 0
  const completed = Number(journey?.completedCount) || 0
  const exited = Number(journey?.exitedCount) || 0
  const share = n => (enrolled > 0 ? n / enrolled : 0)
  return {
    enrolled,
    active,
    completed,
    exited,
    activeShare: share(active),
    completedShare: share(completed),
    exitedShare: share(exited)
  }
}

/**
 * The configured journeys, plus local-only status changes.
 *
 * @returns {{
 *   journeys: import('vue').Ref<object[]>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>,
 *   setStatus: (id: string, status: string) => void
 * }}
 *
 * @example
 * const { journeys, loading, error, load } = useEngageAudienceJourneys()
 * onMounted(load)
 */
export function useEngageAudienceJourneys() {
  const { data: journeys, loading, error, load } = useMockResource('journeys')

  function setStatus(id, status) {
    journeys.value = journeys.value.map(j =>
      j.id === id ? { ...j, status } : j
    )
  }

  return { journeys, loading, error, load, setStatus }
}

/**
 * The goals a journey can optimise for — a journey stores only `goalId`, so
 * this is what turns that into a name. Secondary on `/journeys`.
 *
 * @returns {{ goals: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 */
export function useEngageAudienceJourneyGoals() {
  const { data: goals, loading, error, load } = useMockResource('goals')
  return { goals, loading, error, load }
}
