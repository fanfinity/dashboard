<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="String(selected)"
    :class="classes"
    @click="onClick"
  >
    <slot :selected="selected" :disabled="disabled" />
  </button>
</template>

<script setup>
import { computed } from 'vue'

// A picker card that is a real control. Template and catalog pickers recur all
// over the create screens, and a <div> with a click handler is unreachable by
// keyboard — CardPanel and SfereFeatureCard are both plain divs, so neither can
// be the thing you tab to and press Enter on. This is that thing.
//
// `selected`, `disabled` and `@select` are carried over from the picker card
// this replaced.
//
// The focus treatment is an OUTLINE, not a ring: the ring is already spent on
// the selected state, so a selected card would otherwise show no focus at all.
const props = defineProps({
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

function onClick() {
  if (!props.disabled) emit('select')
}

const classes = computed(() => [
  'flex h-full w-full flex-col items-start rounded-sfere-xl border p-5 text-left',
  'transition duration-200 ease-sfere-ui',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sfere-brand',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-ink-raised text-sfere-dark-fg'
    : 'border-sfere-line bg-sfere-surface text-sfere-fg',
  props.selected &&
    (props.onDark
      ? 'ring-2 ring-sfere-400'
      : 'border-sfere-300 ring-2 ring-sfere-brand-fill'),
  !props.disabled &&
    !props.selected &&
    (props.onDark
      ? 'hover:border-sfere-hairline-strong hover:bg-white/[0.06]'
      : 'hover:border-sfere-300 hover:shadow-sfere-soft')
])
</script>
