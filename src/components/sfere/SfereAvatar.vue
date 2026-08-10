<template>
  <span :class="rootClasses">
    <img v-if="src" :src="src" :alt="name" class="size-full object-cover" />
    <span v-else aria-hidden="true">{{ initials }}</span>
    <span v-if="!src" class="sr-only">{{ name }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// Falls back to initials on a brand tint rather than to a generic silhouette:
// a wall of identical grey heads carries no information, whereas initials at
// least distinguish rows at a glance.
const props = defineProps({
  name: { type: String, default: '' },
  src: { type: String, default: '' },
  size: {
    type: String,
    default: 'md',
    validator: v => ['xs', 'sm', 'md', 'lg'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

const SIZES = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-sfere-xs',
  md: 'size-10 text-sfere-sm',
  lg: 'size-14 text-sfere-body'
}

// Two letters max: first + last where there are two words, else the first two
// characters. Longer strings stop being readable at 24px.
const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})

const rootClasses = computed(() => [
  'inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none',
  SIZES[props.size],
  props.onDark
    ? 'bg-sfere-500/20 text-sfere-200 ring-1 ring-sfere-hairline'
    : 'bg-sfere-100 text-sfere-800'
])
</script>
