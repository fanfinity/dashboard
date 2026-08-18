<template>
  <div class="relative">
    <span
      v-if="$slots.leading"
      class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center opacity-60"
    >
      <slot name="leading" />
    </span>

    <input
      :id="id || undefined"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="invalid ? 'true' : undefined"
      :class="classes"
      @input="emit('update:modelValue', $event.target.value)"
    />

    <span
      v-if="$slots.trailing"
      class="absolute inset-y-0 right-3 grid place-items-center opacity-60"
    >
      <slot name="trailing" />
    </span>
  </div>
</template>

<script setup>
import { computed, useSlots } from 'vue'

// One height (40px) for every control in the kit, so an input, a select and a
// medium button line up on the same row without per-form fiddling.
//
// The focus treatment is a soft brand ring rather than the browser default:
// 2px at 25% opacity plus a warmed border. It is the only place in the system
// where the brand colour appears on an otherwise neutral control, which is what
// makes "where am I typing" answerable at a glance.
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  id: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])
const slots = useSlots()

const classes = computed(() => [
  'h-10 w-full rounded-sfere border text-sfere-sm outline-none transition duration-150 ease-sfere-ui',
  slots.leading ? 'pl-9' : 'pl-3',
  slots.trailing ? 'pr-9' : 'pr-3',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-wash text-white placeholder:text-white/40'
    : 'border-sfere-line bg-sfere-surface text-sfere-fg placeholder:text-sfere-fg-muted',
  props.invalid
    ? 'border-sfere-danger focus:border-sfere-danger focus:ring-2 focus:ring-rose-500/25'
    : 'focus:border-sfere-400 focus:ring-2 focus:ring-sfere-500/25'
])
</script>
