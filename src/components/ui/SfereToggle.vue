<template>
  <button
    type="button"
    role="switch"
    :aria-checked="String(modelValue)"
    :aria-label="label || undefined"
    :disabled="disabled"
    :class="trackClasses"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span :class="knobClasses" />
  </button>
</template>

<script setup>
import { computed } from 'vue'

// role="switch" + aria-checked, not a styled checkbox: a switch takes effect
// immediately, a checkbox takes effect on submit, and screen readers announce
// the difference. Use this only where the change is instant.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const trackClasses = computed(() => [
  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent',
  'transition-colors duration-200 ease-sfere-ui',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60 focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.modelValue
    ? 'bg-sfere-brand-fill'
    : props.onDark
      ? 'bg-white/15'
      : 'bg-sfere-line',
  props.onDark && 'focus-visible:ring-offset-transparent'
])

const knobClasses = computed(() => [
  'inline-block size-5 rounded-full bg-white shadow-sm',
  'transition-transform duration-200 ease-sfere-ui motion-reduce:transition-none',
  props.modelValue ? 'translate-x-5' : 'translate-x-0.5'
])
</script>
