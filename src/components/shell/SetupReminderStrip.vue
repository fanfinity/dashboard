<template>
  <!-- The deliberately thin counterpart to SetupProgressPanel. One line, on the
       three screens the steps point at, saying where you are and where the real
       tracker lives.

       WHY NOT THE FULL BREAKDOWN HERE: four copies of the same three steps is
       four things to keep in agreement, and the Dashboard is the one that is
       always on screen first. This page only needs to answer "am I on track?",
       not re-teach the sequence. -->
  <div
    v-if="visible"
    class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sfere-lg border border-sfere-200 bg-sfere-50 px-4 py-3"
  >
    <p class="min-w-0 flex-1 text-sm text-sfere-brand-text">
      <span class="font-semibold"
        >You're on step {{ stepNumber }} of {{ total }}</span
      >
      — {{ line }}
    </p>
    <SfereLinkArrow :to="{ name: 'dashboard-home' }"
      >See full setup progress</SfereLinkArrow
    >
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'

const props = defineProps({
  // Which step this screen is. 'source' | 'destination' | 'pipe'.
  step: { type: String, required: true },
  steps: { type: Array, default: () => [] },
  total: { type: Number, default: 3 },
  complete: { type: Boolean, default: false },
  unavailable: { type: Boolean, default: false }
})

// The number shown is the step the WORKSPACE is on, not the step this screen
// happens to be. Someone who added a destination first should read "you're on
// step 1 of 3" on the Destinations page, because connecting a source is still
// what is outstanding — labelling it step 2 because Destinations is second in
// the sequence would tell them they had finished something they had not.
const stepNumber = computed(() => {
  const i = props.steps.findIndex(s => s.current)
  return i === -1 ? props.total : i + 1
})

// Gone once setup is finished, and never shown when the counts cannot be
// trusted. A reminder that outlives the thing it reminds you of is noise.
const visible = computed(
  () => !props.complete && !props.unavailable && props.steps.length > 0
)

// Three cases, and conflating any two of them makes the strip lie. "Not the
// current step" is NOT the same as "done": on Destinations with no source
// connected, destinations is a step still *ahead*, and saying "this one is done"
// there was exactly the bug this shape exists to prevent.
const line = computed(() => {
  const current = props.steps.find(s => s.current)
  if (!current) return 'finish the remaining steps to go live.'

  if (current.key === props.step) {
    return `${current.description.replace(/\.$/, '')}, then move on to the next step.`
  }

  const mine = props.steps.find(s => s.key === props.step)
  if (mine?.done) {
    return `this one is done — ${current.label.toLowerCase()} is what's left.`
  }

  // Ahead of the current step. Doing it now is allowed (a destination without a
  // source is a valid thing to configure), so this points forward rather than
  // blocking.
  return `${current.label.toLowerCase()} comes first, but you can set this up now if you'd rather.`
})
</script>
