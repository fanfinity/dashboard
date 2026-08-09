<template>
  <div :class="rootClasses">
    <div v-if="$slots.header" :class="headerClasses">
      <slot name="header" />
    </div>

    <div :class="bodyClasses">
      <slot />
    </div>

    <div v-if="$slots.footer" :class="footerClasses">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// The surface everything else sits on. 16px radius, hairline border, no shadow
// at rest — elevation is reserved for things that float (menus, popovers), so a
// grid of cards stays flat and the page reads as one plane.
const props = defineProps({
  // `ink` is the dark-section card. It is a surface tone, not a dark theme:
  // put it inside a SfereSection tone="ink" and nowhere else.
  tone: {
    type: String,
    default: 'surface',
    validator: v => ['surface', 'soft', 'ink'].includes(v)
  },
  padded: { type: Boolean, default: true },
  // Lifts and warms the border on hover. For cards that are themselves links.
  interactive: { type: Boolean, default: false },
  // The brand-purple corner fade. Use on at most one card per view — it is a
  // spotlight, and three spotlights light nothing.
  gradientBorder: { type: Boolean, default: false }
})

const TONES = {
  surface: 'border-sfere-line bg-sfere-surface text-sfere-fg',
  soft: 'border-sfere-line bg-sfere-fill text-sfere-fg',
  ink: 'border-sfere-hairline bg-sfere-ink-raised text-sfere-dark-fg'
}

const DIVIDERS = {
  surface: 'border-sfere-line',
  soft: 'border-sfere-line',
  ink: 'border-sfere-hairline'
}

const rootClasses = computed(() => [
  'rounded-sfere-xl border transition duration-200 ease-sfere-ui',
  TONES[props.tone],
  props.gradientBorder && 'sfere-gradient-border',
  props.interactive &&
    (props.tone === 'ink'
      ? 'hover:-translate-y-0.5 hover:border-sfere-hairline-strong hover:shadow-sfere-ink'
      : 'hover:-translate-y-0.5 hover:border-sfere-300 hover:shadow-sfere-soft')
])

const bodyClasses = computed(() => (props.padded ? 'p-5' : ''))

const headerClasses = computed(() => [
  'flex items-center justify-between gap-3 border-b px-5 py-3.5',
  DIVIDERS[props.tone]
])

const footerClasses = computed(() => [
  'flex items-center justify-between gap-3 border-t px-5 py-3',
  DIVIDERS[props.tone]
])
</script>
