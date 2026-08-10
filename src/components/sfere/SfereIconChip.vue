<template>
  <span :class="classes" aria-hidden="true">
    <slot />
  </span>
</template>

<script setup>
import { computed } from 'vue'

// The tinted square behind a feature icon. Always decorative — the label next
// to it carries the meaning — so it is aria-hidden and takes no label prop.
const props = defineProps({
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

const classes = computed(() => [
  'grid shrink-0 place-items-center',
  props.size === 'sm' ? 'size-9 rounded-sfere' : 'size-11 rounded-sfere-lg',
  props.onDark
    ? 'bg-sfere-500/10 text-sfere-300 ring-1 ring-sfere-hairline'
    : 'bg-sfere-50 text-sfere-brand-text'
])
</script>
