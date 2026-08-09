<template>
  <span :class="classes">
    <slot name="icon" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// The bordered capsule the site uses for "trust" chips above a hero — region
// tags, compliance marks, "SOC 2". It is a label, never a control; if it needs
// a click handler you wanted SfereButton size="sm" variant="secondary".
const props = defineProps({
  label: { type: String, default: '' },
  onDark: { type: Boolean, default: false }
})

const classes = computed(() => [
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
  'text-sfere-xs font-medium whitespace-nowrap',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-wash text-white/70'
    : 'border-sfere-line bg-sfere-surface text-sfere-fg-muted'
])
</script>
