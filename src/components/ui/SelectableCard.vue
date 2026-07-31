<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="selected"
    class="flex h-full w-full flex-col items-start rounded-xl border border-line2 bg-white p-4 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
    :class="[
      selected ? 'ring-2 ring-brand' : '',
      disabled ? '' : 'hover:bg-fill'
    ]"
    @click="onClick"
  >
    <slot :selected="selected" :disabled="disabled" />
  </button>
</template>

<script setup>
// A picker card that is a real control. Template pickers recur across the create
// screens, and the first two — DestinationTemplateCard and SourceTemplatePicker
// — each had to wrap or re-implement a card to get one that a keyboard can
// reach, because CardPanel is a plain <div>.
//
// The surface is CardPanel's own `rounded-xl border border-line2 bg-white
// shadow-sm` plus its `p-5`-family padding at the `p-4` the shipped pickers use;
// `ring-2 ring-brand` for selection is lifted from DestinationTemplateCard.
//
// The focus ring is an `outline`, not a `ring`: `ring` is already spent on the
// selected state, so a selected card would otherwise show no focus at all.
const props = defineProps({
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['select'])

function onClick() {
  if (!props.disabled) emit('select')
}
</script>
