import { computed, ref } from 'vue'
import { useMockResource } from '@/composables/useMockResource'
import { currentAccount } from '@/composables/useMe'
import { pageItems } from '@/lib/apiShape'

/**
 * "How far through setup is this workspace?" — a source, a destination, and a
 * pipe joining them.
 *
 * DERIVED, NEVER STORED. There is no `setupComplete` flag anywhere, on purpose:
 * a flag can disagree with reality (someone deletes their only pipe and the
 * tracker still says done), and reconciling it would mean a second source of
 * truth for something three list endpoints already answer. The cost is three
 * reads; the benefit is that the tracker cannot be wrong.
 *
 * It reads the three collections directly rather than through `useSources()` and
 * friends, because those carry mutation helpers this has no use for, and because
 * a shared `load()` would make the Dashboard's tracker refetch whenever the
 * Sources table did.
 *
 * All three domains have live endpoints, so this is accurate in the default real
 * mode — unlike most of the app. In Demo data mode it reads the fixtures, which
 * are fully populated, so the tracker shows complete.
 *
 * @returns {{
 *   steps: import('vue').ComputedRef<Array>,
 *   doneCount: import('vue').ComputedRef<number>,
 *   total: number,
 *   complete: import('vue').ComputedRef<boolean>,
 *   currentStep: import('vue').ComputedRef<object|null>,
 *   loading: import('vue').ComputedRef<boolean>,
 *   unavailable: import('vue').ComputedRef<boolean>,
 *   load: () => Promise<void>
 * }}
 */
export function useSetupProgress() {
  const sources = useMockResource('sources', {
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/sources`,
      select: pageItems
    }
  })

  const destinations = useMockResource('destinations', {
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/destinations`,
      select: pageItems
    }
  })

  const pipes = useMockResource('pipes', {
    api: {
      path: () =>
        currentAccount.value &&
        `/v1/accounts/${currentAccount.value.id}/pipelines`,
      select: pageItems
    }
  })

  const parts = [sources, destinations, pipes]

  const loaded = ref(false)

  const loading = computed(() => parts.some(p => p.loading.value))

  // Any of the three failing or missing makes the whole tracker untrustworthy —
  // "1 of 3 done" when the pipes read failed would be a guess presented as a
  // fact. The panel hides itself instead.
  const unavailable = computed(() =>
    parts.some(p => p.error.value || p.apiMissing.value)
  )

  const counts = computed(() => ({
    sources: sources.data.value?.length ?? 0,
    destinations: destinations.data.value?.length ?? 0,
    pipes: pipes.data.value?.length ?? 0
  }))

  // Order is the dependency order, not a preference: a pipe needs both ends to
  // exist first, so a workspace can never legitimately finish step 3 before 1
  // and 2. That is what lets `currentStep` be "the first undone one".
  const STEPS = [
    {
      key: 'source',
      label: 'Connect a source',
      done: 'Events are being collected',
      todo: 'Point a website, app or store at Sfere so events start arriving.',
      to: { name: 'sources-new' },
      cta: 'Connect a source',
      count: c => c.sources
    },
    {
      key: 'destination',
      label: 'Add a destination',
      done: 'Somewhere for the data to land',
      todo: 'Pick where the events should go — a warehouse, a tool, a webhook.',
      to: { name: 'destinations-new' },
      cta: 'Add a destination',
      count: c => c.destinations
    },
    {
      key: 'pipe',
      label: 'Create a pipe',
      done: 'Data is moving end to end',
      todo: 'Join the two so events actually flow, transforming them if you need to.',
      to: { name: 'pipes-new' },
      cta: 'Create a pipe',
      count: c => c.pipes
    }
  ]

  const steps = computed(() => {
    const c = counts.value
    let firstUndoneSeen = false
    return STEPS.map(step => {
      const n = step.count(c)
      const isDone = n > 0
      const isCurrent = !isDone && !firstUndoneSeen
      if (isCurrent) firstUndoneSeen = true
      return {
        key: step.key,
        label: step.label,
        description: isDone ? step.done : step.todo,
        to: step.to,
        cta: step.cta,
        count: n,
        done: isDone,
        current: isCurrent
      }
    })
  })

  const doneCount = computed(() => steps.value.filter(s => s.done).length)
  const complete = computed(() => doneCount.value === STEPS.length)
  const currentStep = computed(() => steps.value.find(s => s.current) ?? null)

  async function load() {
    await Promise.all(parts.map(p => p.load()))
    loaded.value = true
  }

  return {
    steps,
    counts,
    doneCount,
    total: STEPS.length,
    complete,
    currentStep,
    loading,
    loaded,
    unavailable,
    load
  }
}

export default useSetupProgress
