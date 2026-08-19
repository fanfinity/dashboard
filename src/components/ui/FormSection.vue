<template>
  <CardPanel :tone="onDark ? 'ink' : 'surface'">
    <h2 :class="titleClasses">{{ title }}</h2>
    <p v-if="description" :class="descriptionClasses">{{ description }}</p>

    <div class="mt-5 flex flex-col gap-4">
      <slot />
    </div>

    <template v-if="$slots.actions" #footer>
      <slot name="actions" />
    </template>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from './CardPanel.vue'

// A run of SfereFields under one heading. Long forms get read as one wall of
// controls unless they are cut into named groups, and the group heading is what
// tells someone which half of the form they still have to fill in.
//
// The heading is an <h2>, deliberately smaller than SfereSectionHeading's ramp:
// a form section is a subdivision of the page, not a second page. Note the
// Tailwind v4 important SUFFIX, which is what survives Quasar's unlayered h2
// rules (docs/ui-conventions.md rules 2-3).
//
// `onDark` reaches the card, the heading AND the description — but not the
// fields inside it. Each FormField needs its own `on-dark`, or the labels stay
// black on black.
const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  onDark: { type: Boolean, default: false }
})

const titleClasses = computed(() => [
  'font-sfere-display! text-sfere-h4!',
  props.onDark ? 'text-white' : 'text-sfere-fg'
])

const descriptionClasses = computed(() => [
  'mt-1 max-w-2xl text-sfere-sm',
  props.onDark ? 'text-white/55' : 'text-sfere-fg-muted'
])
</script>
