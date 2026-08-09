<template>
  <div class="relative">
    <select
      :id="id || undefined"
      :value="modelValue"
      :disabled="disabled"
      :class="classes"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in normalised" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>

    <svg
      class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-50"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="m213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32"
      />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// A real <select>, restyled — not a div pretending to be one. It inherits
// keyboard behaviour, mobile pickers and screen-reader semantics for free, and
// nothing about the Sfere look needs a custom listbox. Reach for a combobox
// only when you genuinely need search or multi-select.
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  // Accepts ['a', 'b'] or [{ value, label }].
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  id: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const normalised = computed(() =>
  props.options.map(o =>
    typeof o === 'object' && o !== null ? o : { value: o, label: String(o) }
  )
)

const classes = computed(() => [
  'h-10 w-full appearance-none rounded-sfere border pl-3 pr-9 text-sfere-sm outline-none',
  'transition duration-150 ease-sfere-ui',
  'focus:border-sfere-400 focus:ring-2 focus:ring-sfere-500/25',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-ink-raised text-white'
    : 'border-sfere-line bg-sfere-surface text-sfere-fg'
])
</script>
