<template>
  <!-- TELEPORTED TO BODY, for the reason every fixed overlay in this repo is:
       `fixed` resolves against the nearest transformed ancestor, and the screens
       this points at are full of animated cards — an in-place layer would be
       clipped into whichever panel contained it.

       IT RENDERS NOTHING UNTIL AN ANCHOR IS ACTUALLY ON SCREEN. A step whose
       `data-tour` element is missing (renamed, or a page that advanced without
       telling the tour) draws no ring and no callout, rather than a card
       floating in a corner pointing at nothing. Silent, but the honest kind of
       silent. -->
  <Teleport to="body">
    <div v-if="step && rect" class="pointer-events-none fixed inset-0 z-[9990]">
      <!-- THE DIM AND THE HOLE ARE ONE ELEMENT, and that is the whole trick: a
           9999px spread box-shadow paints everything OUTSIDE this box, so the
           box itself is the hole. No clip-path, no four rectangles to keep in
           agreement, and a rounded hole is just a border radius.

           `pointer-events-none` on the whole layer, so THE DIM BLOCKS NOTHING.
           That is a choice and it goes with the dim's opacity: this is emphasis,
           not a modal. Step 2 spotlights the action row while saying the details
           above are editable, and a blocking scrim would make that sentence a
           lie — so the dimmed area stays readable and stays clickable, and
           nobody can be trapped in a walkthrough by a layer they cannot
           dismiss.

           The colour is the brand's ink rather than black: `--color-sfere-ink`
           is what every dark surface in the app is, so a dimmed screen reads as
           the same product with the lights down rather than as a grey wash. -->
      <div
        class="absolute rounded-sfere-xl shadow-[0_0_0_9999px_rgb(11_7_18/0.55)] outline-2 outline-offset-2 outline-sfere-brand"
        :style="holeStyle"
      ></div>

      <!-- The pulse. A second ring on the same box, scaling and fading out, so
           the eye is pulled to the hole rather than merely permitted to find it.
           Its own element because it animates `transform` and `opacity` and the
           element above owns a box-shadow that must not be re-composited.
           Removed outright under reduced motion rather than slowed. -->
      <div
        v-if="!reduced"
        class="spot-pulse absolute rounded-sfere-xl border-2 border-sfere-brand"
        :style="holeStyle"
        aria-hidden="true"
      ></div>

      <!-- The callout. `pointer-events-auto` because it is the one part of this
           layer with controls in it. -->
      <div
        ref="calloutEl"
        class="spot-callout pointer-events-auto absolute flex w-[min(20rem,calc(100vw-2rem))] flex-col flex-nowrap! gap-2 rounded-sfere-xl border border-sfere-hairline bg-sfere-ink p-4 shadow-sfere-ink-deep"
        :style="calloutStyle"
        role="group"
        :aria-label="`Guided setup, step ${step.index} of ${step.total}`"
      >
        <!-- `aria-live="polite"` rather than moving focus. A coachmark that
             stole focus on every step would take the cursor out of the field
             someone is typing in — the announcement is what a screen reader
             needs here, and the page keeps the focus it had.
             No heading: `pnpm smoke:dist` asserts on the first `<h1>` and this
             floats over pages that own theirs, so a heading here would put an
             overlay in the page's outline. Same rule the persona card and the
             provisioned overlay follow. -->
        <div class="flex flex-col gap-1.5" aria-live="polite">
          <p
            class="font-sfere-mono text-sfere-label uppercase text-sfere-dark-fg-muted"
            >Step {{ step.index }} of {{ step.total }}</p
          >
          <p class="text-sfere-sm font-semibold text-sfere-dark-fg">{{
            step.title
          }}</p>
          <p class="text-pretty text-sfere-xs text-sfere-dark-fg-muted">{{
            step.body
          }}</p>
        </div>

        <!-- ONE control, and it ends the walkthrough rather than hiding this
             step. There is no Next: the step advances when the page advances,
             because the page is what knows whether the thing was done — a Next
             button would let someone walk the tour past work they have not done
             and then point at a control that is not there. -->
        <div class="flex justify-end">
          <button
            type="button"
            class="-mr-1 rounded-sfere px-1 py-1.5 text-sfere-xs text-sfere-dark-fg-muted underline-offset-4 transition-colors duration-200 hover:text-sfere-dark-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sfere-brand"
            @click="end"
          >
            Skip the walkthrough
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useGuidedTour } from '@/composables/useGuidedTour'

// The spotlight: dim the screen, cut a hole around the control someone should
// use next, and say what it is for. Mounted once, in MainLayout; every page that
// takes part does so by calling `useGuidedTour().show(stepId)` and by carrying a
// `data-tour` attribute on the thing to point at.
//
// MEASURED EVERY FRAME WHILE A STEP IS SHOWING, and that is cheaper than the
// alternative rather than lazy. One getBoundingClientRect per frame is nothing;
// the alternative is subscribing to scroll, resize, a ResizeObserver on the
// anchor, a MutationObserver for the sticky bar settling and the transitions of
// whichever card the anchor lives in — five listeners that between them still
// miss a case, against a ring that is simply always where the element is. It is
// also why there is NO CSS TRANSITION on the hole's position: a transition plus
// per-frame updates is the wobbling, lagging spotlight every tour library
// eventually files a bug about. The travel between steps comes from the smooth
// scroll instead, which moves the page under a ring that stays glued to its
// target.
const { step, end } = useGuidedTour()

// Space between the ring and the anchor's own edges, so a highlighted button is
// not traced exactly and a highlighted grid is not clipped.
const PAD = 8
// Between the ring and the callout, and between the callout and the viewport.
const GAP = 12
const MARGIN = 16

const rect = ref(null)
const calloutEl = ref(null)
const calloutSize = ref({ width: 320, height: 160 })

let raf = 0

const reduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

function anchorEl() {
  if (!step.value?.anchor) return null
  return document.querySelector(`[data-tour="${step.value.anchor}"]`)
}

function measure() {
  const el = anchorEl()
  if (!el) {
    rect.value = null
    return
  }
  const r = el.getBoundingClientRect()
  // A zero-sized box is an element that is in the DOM but not laid out —
  // `display: none`, or a panel mid-transition. Pointing at it would put the
  // ring in the top-left corner.
  if (r.width < 1 || r.height < 1) {
    rect.value = null
    return
  }
  rect.value = {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2
  }
  if (calloutEl.value) {
    calloutSize.value = {
      width: calloutEl.value.offsetWidth,
      height: calloutEl.value.offsetHeight
    }
  }
}

function loop() {
  measure()
  raf = requestAnimationFrame(loop)
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  rect.value = null
}

const holeStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  return {
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`
  }
})

// Below the anchor when there is room, above it when there is not, and clamped
// to the viewport on both axes — so a spotlight on a sticky bottom bar puts its
// callout above the bar rather than off the bottom of the screen.
const calloutStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  const { width, height } = calloutSize.value
  const vh = window.innerHeight
  const vw = window.innerWidth

  const below = r.top + r.height + GAP
  const above = r.top - GAP - height
  const top =
    below + height + MARGIN <= vh
      ? below
      : above >= MARGIN
        ? above
        : Math.max(MARGIN, Math.min(below, vh - height - MARGIN))

  const left = Math.max(MARGIN, Math.min(r.left, vw - width - MARGIN))

  return { top: `${top}px`, left: `${left}px` }
})

// Start and stop the measuring loop with the step, and bring the anchor into
// view when a new one is named. `block: 'center'` rather than 'nearest' because
// a control at the very bottom of the window is technically in view and still
// has nowhere to put a callout.
watch(
  () => step.value?.id ?? null,
  id => {
    if (!id) {
      stop()
      return
    }
    measure()
    const el = anchorEl()
    if (el) {
      el.scrollIntoView({
        block: 'center',
        behavior: reduced ? 'auto' : 'smooth'
      })
    }
    if (!raf) raf = requestAnimationFrame(loop)
  },
  { immediate: true }
)

onBeforeUnmount(stop)
</script>

<style scoped>
/* The pulse. `transform` and `opacity` only, so it composites on its own layer
   and never triggers layout on the frame the ring is being repositioned. It is
   removed from the DOM entirely under reduced motion rather than being slowed
   down here, so this needs no media query of its own. */
.spot-pulse {
  animation: spot-pulse 1.8s ease-out infinite;
}

@keyframes spot-pulse {
  0% {
    opacity: 0.55;
    transform: scale(1);
  }
  70% {
    opacity: 0;
    transform: scale(1.06);
  }
  100% {
    opacity: 0;
    transform: scale(1.06);
  }
}

/* The callout arrives rather than appearing. Opacity and a small lift, both
   composited, and off under reduced motion — a card that materialises next to a
   ring that also just appeared reads as a rendering glitch. */
.spot-callout {
  animation: spot-in 220ms cubic-bezier(0.2, 0, 0, 1) both;
}

@keyframes spot-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spot-callout {
    animation: none;
  }
}
</style>
