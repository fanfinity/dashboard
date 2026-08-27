<template>
  <SfereInput
    :model-value="modelValue"
    type="search"
    :placeholder="placeholder"
    :id="id"
    :on-dark="onDark"
    :class="widthClass"
    @update:model-value="v => emit('update:modelValue', v)"
  >
    <template #leading>
      <svg
        class="size-4"
        viewBox="0 0 256 256"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M192 112a80 80 0 1 1-80-80a80 80 0 0 1 80 80" opacity="0.2" />
        <path
          d="m229.66 218.34l-50.07-50.06a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.32M40 112a72 72 0 1 1 72 72a72.08 72.08 0 0 1-72-72"
        />
      </svg>
    </template>
  </SfereInput>
</template>

<script setup>
import { computed } from 'vue'
import SfereInput from './SfereInput.vue'

// The filter box that sits in a PageHeader `actions` slot or a
// DataTable `toolbar` slot. A thin wrapper over SfereInput so every search
// box in the product is the same width and carries the same glyph — the two
// screens that hand-rolled one before this existed were 280px and 320px.
//
// The icon is inline SVG rather than an import from `src/assets/`: the kit does
// not reach into app assets, and the CSP plus `assetsInlineLimit: 0` rule out a
// data: URI anyway (same reason SfereSpinner draws its own circle).
//
// `type="search"` gives the native clear affordance in WebKit for free.
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Search…' },
  id: { type: String, default: '' },
  // Let it fill a narrow toolbar cell instead of holding the house width.
  block: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

// A DEFINITE width, not `w-full max-w-[280px]`. In a PageHeader the actions
// group is content-sized (`shrink-0`), so a percentage width has nothing to
// resolve against and the box collapsed to ~80px — unusable, and it was the
// reason the whole actions row used to wrap onto a second line instead. A fixed
// basis lets the group report a real max-content width; `max-w-full` still lets
// it shrink inside a narrow container.
const widthClass = computed(() =>
  props.block ? 'w-full' : 'w-[280px] max-w-full'
)
</script>
