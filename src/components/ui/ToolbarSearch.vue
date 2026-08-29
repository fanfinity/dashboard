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
      <SfereIcon name="search" />
    </template>
  </SfereInput>
</template>

<script setup>
import { computed } from 'vue'
import SfereIcon from './SfereIcon.vue'
import SfereInput from './SfereInput.vue'

// The filter box that sits in a PageHeader `actions` slot or a
// DataTable `toolbar` slot. A thin wrapper over SfereInput so every search
// box in the product is the same width and carries the same glyph — the two
// screens that hand-rolled one before this existed were 280px and 320px.
//
// The glyph comes from SfereIcon, whose registry this magnifier used to be a
// hand-inlined copy of. Still inline SVG rather than an import from
// `src/assets/`: the kit does not reach into app assets, and the CSP plus
// `assetsInlineLimit: 0` rule out a data: URI anyway (same reason SfereSpinner
// draws its own circle).
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
