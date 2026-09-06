<template>
  <div :class="rootClasses" aria-hidden="true">
    <span :class="railClasses"></span>
    <span v-if="flowing" :class="dotClasses"></span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// The connector between two nodes in a FlowChain: a hairline rail with one dot
// travelling it. The topology's curved version is SVG because it has geometry to
// solve; a chain's connector is a straight line between two known points, so it
// is two spans and a keyframe.
//
// THE DOT IS THE ONLY MOTION, AND IT IS CONDITIONAL. `flowing` is set by the
// caller from the pipe's own status — never from "both ends are enabled" — so a
// paused or failing pipe draws a still line. The animation is defined in
// `src/css/sfere.css` next to the app's other keyframes rather than in a scoped
// block here, so `prefers-reduced-motion` is answered in one place for every
// surface that moves.
const props = defineProps({
  flowing: { type: Boolean, default: false },
  // A StatusBadge tone, so the rail is the same colour as the chip reporting it.
  tone: {
    type: String,
    default: 'neutral',
    validator: v => ['success', 'warn', 'danger', 'neutral'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

const RAILS = {
  success: 'bg-sfere-brand/40',
  warn: 'bg-sfere-warn/55',
  danger: 'bg-sfere-danger/50',
  neutral: 'bg-sfere-line'
}

const RAILS_DARK = {
  success: 'bg-sfere-500/50',
  warn: 'bg-sfere-warn/50',
  danger: 'bg-sfere-danger/50',
  neutral: 'bg-sfere-hairline'
}

const rootClasses = computed(() => [
  'relative grid shrink-0 place-items-center',
  // Horizontal in a row, vertical once the chain stacks — the connector has to
  // follow the layout or it points across the gap between two stacked cards.
  'h-6 w-10 @max-[52rem]:h-6 @max-[52rem]:w-full'
])

const railClasses = computed(() => [
  'absolute rounded-full',
  'h-px w-full @max-[52rem]:h-full @max-[52rem]:w-px',
  (props.onDark ? RAILS_DARK : RAILS)[props.tone]
])

// Hidden once the chain stacks: `sfere-travel` moves the dot left-to-right, and
// a horizontally travelling dot on a vertical rail points across the layout
// rather than along it. The rail alone still says the two ends are joined.
const dotClasses = computed(() => [
  'animate-sfere-travel absolute size-1.5 rounded-full',
  '@max-[52rem]:hidden',
  props.onDark ? 'bg-sfere-300' : 'bg-sfere-brand'
])
</script>
