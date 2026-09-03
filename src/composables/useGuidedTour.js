import { computed, ref } from 'vue'
import { tourPosition, tourStep } from '@/config/tours'
import { useOnboarding } from '@/composables/useOnboarding'

/**
 * The guided walkthrough: which step is being pointed at right now.
 *
 * MODULE SINGLETON for the usual reason — `SpotlightTour` is mounted once in
 * MainLayout and the pages that advance the walkthrough are three levels below
 * it, so the current step has to be one object both can see. Whether a
 * walkthrough is running at all lives in the onboarding record (see
 * useOnboarding's `tour`), because that outlives a reload; which step is showing
 * is in memory here, because it does not need to.
 *
 * THAT SPLIT IS DELIBERATE AND IT IS WHAT KEEPS THE THING HONEST. A persisted
 * step index would come back after a reload and point at a control that is no
 * longer on screen — the create flow does not restore step 3, so a stored
 * "click Check for events" would survive the button it names. Instead the page
 * that owns the state calls `show()` for whatever step it is actually on, on
 * mount as well as on change, so the coachmark is re-derived from the screen
 * every time rather than remembered.
 *
 * `show()` IS A NO-OP UNLESS A TOUR IS RUNNING, which is what lets a page call
 * it unconditionally from a watcher. It also refuses a step belonging to another
 * tour, so two walkthroughs can never interleave.
 *
 * NOTHING HERE TOUCHES THE DOM. Finding the anchor, measuring it and drawing the
 * ring is SpotlightTour's job; this only ever names a step.
 */

// The step id currently being pointed at, or null. In memory on purpose — see
// above.
const stepId = ref(null)

export function useGuidedTour() {
  const { tour, startTour, endTour } = useOnboarding()

  // The resolved step, or null. Guarded three ways — a tour has to be running,
  // the id has to resolve in the registry, and the step has to belong to the
  // running tour — because each of those, left ungated, is a coachmark pointing
  // at something nobody asked about.
  const step = computed(() => {
    if (!tour.value || !stepId.value) return null
    const resolved = tourStep(stepId.value)
    if (!resolved || resolved.tour !== tour.value) return null
    return {
      id: stepId.value,
      ...resolved,
      ...tourPosition(stepId.value)
    }
  })

  /**
   * Point at a step. Safe to call from any page at any time.
   *
   * @param {string} id A key of TOUR_STEPS.
   */
  function show(id) {
    if (!tour.value) return
    const resolved = tourStep(id)
    if (!resolved || resolved.tour !== tour.value) return
    stepId.value = id
  }

  /** Stop pointing, without ending the walkthrough. */
  function hide() {
    stepId.value = null
  }

  /**
   * End the walkthrough — done with it, or skipped. One exit for both, for the
   * reason `endTour` gives: neither should leave a coachmark waiting on the next
   * page load, and there is nothing yet that treats them differently.
   */
  function end() {
    stepId.value = null
    endTour()
  }

  return { tour, step, show, hide, end, startTour }
}

export default useGuidedTour
