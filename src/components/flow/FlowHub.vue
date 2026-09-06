<template>
  <div :class="rootClasses">
    <!-- The mark, not the lockup, and it takes no `on-dark`: the sphere is the
         one part of the identity that never re-colours, so the file is the same
         on both canvases. -->
    <SfereLogo variant="mark" class="h-6 w-auto" />
    <span v-if="label" :class="labelClasses">{{ label }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'

// The Sfere mark between the two columns of a flow picture — the thing every
// arrow points at. Rendered as a circle so it reads as a junction rather than as
// a third node in the row: the boxes either side are records you can open, and
// this one is the product.
//
// SIZED WITH A CLASS, NEVER SfereLogo's `height` PROP. That prop is inert app
// wide — Tailwind preflight ships `img, video { height: auto }` in `@layer base`
// and the component only sets a `height` attribute, which is a presentational
// hint any author rule beats. `/design-system` demonstrates it by rendering
// `:height="32"` and `:height="22"` as two identical logos.
const props = defineProps({
  // Printed under the mark. Omit inside a tight chain where the circle alone
  // carries it.
  label: { type: String, default: '' },
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

const SIZES = { sm: 'size-16', md: 'size-24' }

const rootClasses = computed(() => [
  'relative z-10 grid shrink-0 place-items-center gap-1 rounded-full border',
  SIZES[props.size],
  props.onDark
    ? 'border-sfere-hairline bg-sfere-ink-raised'
    : 'border-sfere-200 bg-sfere-surface shadow-sfere-soft'
])

const labelClasses = computed(() => [
  'font-sfere-mono text-sfere-eyebrow uppercase',
  props.onDark ? 'text-sfere-dark-fg-muted' : 'text-sfere-fg-muted'
])
</script>
