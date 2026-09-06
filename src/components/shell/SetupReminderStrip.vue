<template>
  <!-- One line, on the three screens the steps point at, saying where the
       workspace is in the sequence.

       IT IS THE ONLY SETUP TRACKER LEFT. The Dashboard used to carry the full
       three-step diagram and this was its thin counterpart, pointing back at
       it; the diagram is gone, so there is nothing to link to and the link came
       off with it. This still only answers "am I on track?" rather than
       re-teaching the sequence — three screens carrying the full breakdown
       would be three things to keep in agreement. -->
  <div
    v-if="visible"
    class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sfere-lg border border-sfere-200 bg-sfere-50 px-4 py-3"
  >
    <!-- Two sentences, not one line hinged on two em dashes. It used to read
         "You're on step 1 of 3 — this one is done — connect a source is what's
         left", which QA picked out as the clearest case of the dash doing three
         different jobs in one breath. -->
    <p class="min-w-0 flex-1 text-sm text-sfere-brand-text">
      <span class="font-semibold"
        >You're on step {{ stepNumber }} of {{ total }}.</span
      >
      {{ line }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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
  if (!current) return 'Finish the remaining steps to go live.'

  if (current.key === props.step) {
    return `${current.description.replace(/\.$/, '')}, then move on to the next step.`
  }

  const mine = props.steps.find(s => s.key === props.step)
  if (mine?.done) {
    return `This one is done. Next up: ${current.label.toLowerCase()}.`
  }

  // Ahead of the current step. Doing it now is allowed (a destination without a
  // source is a valid thing to configure), so this points forward rather than
  // blocking.
  return `${current.label} comes first, but you can set this up now if you'd rather.`
})
</script>
