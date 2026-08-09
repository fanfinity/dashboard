<template>
  <span :class="classes">
    <span v-if="dot" :class="['size-1.5 shrink-0 rounded-full', DOTS[tone]]" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// Small, squared-off (6px) status marker. Deliberately NOT a pill: pills are
// spent on buttons and on SferePill, so a badge that reads as a button is the
// failure mode this shape avoids.
const props = defineProps({
  label: { type: String, default: '' },
  tone: {
    type: String,
    default: 'brand',
    validator: v =>
      ['brand', 'neutral', 'success', 'warn', 'danger', 'onDark'].includes(v)
  },
  dot: { type: Boolean, default: false }
})

const TONES = {
  brand: 'bg-sfere-50 text-sfere-brand-text',
  neutral: 'bg-sfere-fill text-sfere-fg-muted',
  success: 'bg-sfere-success-soft text-sfere-success',
  warn: 'bg-sfere-warn-soft text-sfere-warn',
  danger: 'bg-sfere-danger-soft text-sfere-danger',
  onDark: 'bg-sfere-wash text-white/85 ring-1 ring-sfere-hairline'
}

const DOTS = {
  brand: 'bg-sfere-brand',
  neutral: 'bg-sfere-fg-muted',
  success: 'bg-sfere-success',
  warn: 'bg-sfere-warn',
  danger: 'bg-sfere-danger',
  onDark: 'bg-sfere-success-on-ink'
}

const classes = computed(() => [
  'inline-flex items-center gap-1.5 rounded-sfere-sm px-2 py-0.5',
  'text-sfere-xs font-medium whitespace-nowrap',
  TONES[props.tone]
])
</script>
