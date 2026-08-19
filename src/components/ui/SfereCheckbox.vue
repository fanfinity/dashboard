<template>
  <label :class="wrapClasses">
    <span class="relative grid shrink-0 place-items-center">
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        :class="boxClasses"
        @change="emit('update:modelValue', $event.target.checked)"
      />
      <svg
        v-if="modelValue"
        class="pointer-events-none absolute size-3 text-white"
        viewBox="0 0 256 256"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M232.49 80.49l-128 128a12 12 0 0 1-17 0l-56-56a12 12 0 1 1 17-17L96 183l119.51-119.5a12 12 0 0 1 17 17Z"
        />
      </svg>
    </span>

    <span v-if="label || $slots.default" :class="labelClasses">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup>
import { computed } from 'vue'

// A real <input type="checkbox"> with `appearance-none`, so it keeps native
// focus, keyboard and form-submission behaviour while taking the Sfere border
// and brand fill. The tick is drawn over it rather than via a background image,
// which the app's `default-src 'self'` CSP would block as a data: URI.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const wrapClasses = computed(() => [
  'inline-flex items-start gap-2.5',
  props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
])

const boxClasses = computed(() => [
  'size-[18px] appearance-none rounded-[5px] border transition duration-150 ease-sfere-ui',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60 focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed',
  props.modelValue
    ? 'border-sfere-brand-fill bg-sfere-brand-fill'
    : props.onDark
      ? 'border-sfere-hairline-strong bg-transparent'
      : 'border-sfere-line bg-sfere-surface',
  props.onDark && 'focus-visible:ring-offset-transparent'
])

const labelClasses = computed(() => [
  'text-sfere-sm',
  props.onDark ? 'text-white/85' : 'text-sfere-fg'
])
</script>
