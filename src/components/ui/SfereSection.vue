<template>
  <section :class="rootClasses">
    <div
      v-if="tone === 'ink' && dotGrid"
      class="sfere-dot-grid absolute inset-0"
    />
    <div :class="innerClasses">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

// The page's vertical rhythm, in one place. Sections are 80px tall on mobile
// and 112px on desktop; `sm` is 56/80. Everything on sfere.io uses one of those
// two, and nothing uses a bespoke value — that consistency is most of why the
// long marketing page scans as a single document.
//
// TONES
//   light — plain page background
//   soft  — same background plus the purple bloom at the top edge
//   ink   — the dark band. Content inside must switch to its on-dark variants.
const props = defineProps({
  tone: {
    type: String,
    default: 'light',
    validator: v => ['light', 'soft', 'ink'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md'].includes(v)
  },
  // Hairlines above and below, the way the site separates adjacent bands.
  bordered: { type: Boolean, default: false },
  dotGrid: { type: Boolean, default: true },
  // Set false to lay out the section's children yourself, full-bleed.
  contained: { type: Boolean, default: true }
})

const TONES = {
  light: 'bg-sfere-bg text-sfere-fg',
  soft: 'sfere-glow-top bg-sfere-bg text-sfere-fg',
  ink: 'bg-sfere-ink text-sfere-dark-fg'
}

const rootClasses = computed(() => [
  'relative overflow-hidden',
  props.size === 'sm' ? 'py-14 md:py-20' : 'py-20 md:py-28',
  TONES[props.tone],
  props.bordered &&
    (props.tone === 'ink'
      ? 'border-y border-sfere-hairline'
      : 'border-y border-sfere-line')
])

const innerClasses = computed(() => [
  'relative',
  props.contained && 'mx-auto w-full max-w-sfere-page px-5 sm:px-6 lg:px-8'
])
</script>
