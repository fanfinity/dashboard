<template>
  <div>
    <div v-if="label || showValue" :class="headClasses">
      <span>{{ label }}</span>
      <span v-if="showValue" class="font-sfere-mono tabular-nums">
        {{ Math.round(pct) }}%
      </span>
    </div>

    <div
      :class="trackClasses"
      role="progressbar"
      :aria-valuenow="Math.round(pct)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label || undefined"
    >
      <div :class="barClasses" :style="{ width: `${pct}%` }" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Determinate only. An indeterminate bar and a spinner say the same thing, and
// the spinner says it in less space — use SfereSpinner for unknown durations.
const props = defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  label: { type: String, default: '' },
  showValue: { type: Boolean, default: false },
  tone: {
    type: String,
    default: 'brand',
    validator: v => ['brand', 'success', 'warn', 'danger'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

// Clamped, so a value that overshoots its max renders full instead of
// overflowing the track and pushing the layout sideways.
const pct = computed(() => {
  if (!props.max) return 0
  return Math.min(100, Math.max(0, (props.value / props.max) * 100))
})

const TONES = {
  brand: 'bg-sfere-brand-fill',
  success: 'bg-sfere-success',
  warn: 'bg-sfere-warn',
  danger: 'bg-sfere-danger'
}

const headClasses = computed(() => [
  'mb-1.5 flex items-center justify-between text-sfere-xs',
  props.onDark ? 'text-white/60' : 'text-sfere-fg-muted'
])

const trackClasses = computed(() => [
  'h-1.5 w-full overflow-hidden rounded-full',
  props.onDark ? 'bg-white/10' : 'bg-sfere-line'
])

const barClasses = computed(() => [
  'h-full rounded-full transition-[width] duration-500 ease-sfere motion-reduce:transition-none',
  TONES[props.tone]
])
</script>
