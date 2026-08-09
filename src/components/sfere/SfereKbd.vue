<template>
  <kbd :class="classes">
    <slot>{{ label }}</slot>
  </kbd>
</template>

<script setup>
import { computed } from 'vue'

// A real <kbd>. Set in the mono face so ⌘K and Ctrl+K occupy the same width in
// a list of shortcuts.
const props = defineProps({
  label: { type: String, default: '' },
  onDark: { type: Boolean, default: false }
})

const classes = computed(() => [
  'inline-flex min-w-6 items-center justify-center rounded-sfere-sm border px-1.5 py-0.5',
  'font-sfere-mono text-[0.6875rem] leading-none',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-wash text-white/70'
    : 'border-sfere-line bg-sfere-fill text-sfere-fg-muted'
])
</script>
