<template>
  <CardPanel
    :tone="onDark ? 'ink' : 'surface'"
    interactive
    :gradient-border="highlighted"
  >
    <SfereIconChip v-if="$slots.icon" :on-dark="onDark" class="mb-4">
      <slot name="icon" />
    </SfereIconChip>

    <h3 :class="titleClasses">
      <slot name="title">{{ title }}</slot>
    </h3>

    <p :class="bodyClasses">
      <slot>{{ description }}</slot>
    </p>

    <SfereLinkArrow
      v-if="linkLabel"
      :label="linkLabel"
      :to="to"
      :href="href"
      :on-dark="onDark"
      class="mt-4"
    />
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from './CardPanel.vue'
import SfereIconChip from './SfereIconChip.vue'
import SfereLinkArrow from './SfereLinkArrow.vue'

// The repeating unit of every "what this does" grid on sfere.io: tinted icon,
// short title, two lines of body, one link. Composed from the primitives rather
// than styled from scratch, so a change to CardPanel reaches every feature grid.
//
// Note the `!` suffixes on the <h3>: Quasar's unlayered base stylesheet sets
// font-size, weight and leading on bare headings and beats any layered Tailwind
// utility regardless of specificity. See docs/ui-conventions.md rules 2–3.
const props = defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  linkLabel: { type: String, default: '' },
  to: { type: [String, Object], default: null },
  href: { type: String, default: '' },
  // One per grid, at most. The gradient border is a spotlight.
  highlighted: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const titleClasses = computed(() => [
  'font-sfere-display! text-sfere-h4! text-balance',
  props.onDark ? 'text-white' : 'text-sfere-fg'
])

const bodyClasses = computed(() => [
  'mt-2 text-sfere-sm',
  props.onDark ? 'text-white/60' : 'text-sfere-fg-muted'
])
</script>
