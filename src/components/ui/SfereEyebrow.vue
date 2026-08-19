<template>
  <p :class="classes">
    <span
      v-if="dot"
      class="inline-block size-1.5 shrink-0 rounded-full bg-current"
    />
    <slot>{{ label }}</slot>
  </p>
</template>

<script setup>
import { computed } from 'vue'

// Mono, uppercase, 0.18em tracking. This sits above a section heading and is
// the most recognisable typographic move in the brand — the wide tracking is
// the whole effect, so nothing here exposes a way to tighten it.
const props = defineProps({
  label: { type: String, default: '' },
  onDark: { type: Boolean, default: false },
  dot: { type: Boolean, default: false }
})

const classes = computed(() => [
  'inline-flex items-center gap-2 font-sfere-mono text-sfere-eyebrow uppercase',
  props.onDark ? 'text-sfere-300' : 'text-sfere-brand-text'
])
</script>
