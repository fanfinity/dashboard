import { useMockResource } from '@/composables/useMockResource'

/**
 * Surveys domain data access.
 *
 * A survey is an in-product questionnaire shown to one audience; answers land
 * back on the fan profile as attributes, which is what makes them targetable.
 *
 * `public/data/surveys.json` is **intentionally empty**, and that is the normal
 * case rather than a fixture someone forgot to fill in: the fan-facing widget
 * that would collect responses is still a design mockup, so a tenant genuinely
 * has no surveys. The load succeeds and returns zero records — the screen must
 * therefore render `EmptyState`, never `ErrorState`, or the smoke gate reports
 * a working screen as broken.
 *
 * There is no backend, and with no records there is nothing to mutate; this
 * composable is deliberately read-only.
 */

const STATUS_META = {
  live: { label: 'Live', variant: 'success' },
  paused: { label: 'Paused', variant: 'warn' },
  draft: { label: 'Draft', variant: 'neutral' },
  closed: { label: 'Closed', variant: 'neutral' }
}

/**
 * Badge label and variant for a survey's `status`.
 *
 * @param {string|null|undefined} status
 * @returns {{ label: string, variant: string }}
 */
export function surveyStatusMeta(status) {
  return STATUS_META[status] ?? { label: 'Draft', variant: 'neutral' }
}

/**
 * The configured surveys — an empty list on every tenant today.
 *
 * @returns {{ surveys: import('vue').Ref<object[]>, loading: import('vue').Ref<boolean>, error: import('vue').Ref<string|null>, load: () => Promise<void> }}
 *
 * @example
 * const { surveys, loading, error, load } = useEngageAudienceSurveys()
 * onMounted(load)
 */
export function useEngageAudienceSurveys() {
  const { data: surveys, loading, error, load } = useMockResource('surveys')
  return { surveys, loading, error, load }
}
