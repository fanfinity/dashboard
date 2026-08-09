<template>
  <textarea
    :id="id || undefined"
    :value="modelValue"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    :aria-invalid="invalid ? 'true' : undefined"
    :class="classes"
    @input="emit('update:modelValue', $event.target.value)"
  />
</template>

<script setup>
import { computed } from 'vue'

// Same border, focus ring and radius as SfereInput; only the height differs.
// `resize-y` is deliberate — horizontal resize breaks every layout it is in.
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  rows: { type: [Number, String], default: 4 },
  id: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const classes = computed(() => [
  'w-full resize-y rounded-sfere border px-3 py-2.5 text-sfere-sm leading-relaxed outline-none',
  'transition duration-150 ease-sfere-ui',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-wash text-white placeholder:text-white/40'
    : 'border-sfere-line bg-sfere-surface text-sfere-fg placeholder:text-sfere-fg-muted',
  props.invalid
    ? 'border-sfere-danger focus:border-sfere-danger focus:ring-2 focus:ring-rose-500/25'
    : 'focus:border-sfere-400 focus:ring-2 focus:ring-sfere-500/25'
])
</script>
