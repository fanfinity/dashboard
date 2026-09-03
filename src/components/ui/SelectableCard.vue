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
  // THE ON-DARK HOVER CARRIES THE BRAND, not just a brighter hairline. Both
  // branches have to deliver the same signal — "this is the thing you press" —
  // and the light one does it with a purple border plus a plum-tinted lift.
  // On ink it used to be `hover:border-sfere-hairline-strong hover:bg-white/[0.06]`:
  // a white wash and a slightly less faint white line, no brand and no
  // elevation. That is thin anywhere and it was thinnest on the one surface
  // where these cards are the only controls on screen (the first-run persona
  // question), because there is no neighbouring button to borrow the
  // affordance from.
  //
  // Fixed HERE rather than on the instance on purpose. An instance
  // `hover:border-sfere-400` and this component's `hover:border-…` are two
  // layered utilities setting the same property in the same layer, so which
  // one wins is Tailwind's emission order rather than the order they were
  // written — the same trap CLAUDE.md records for `font-medium` on the
  // PageHeader back button. A component that owns the property has no
  // ordering to lose.
  !props.disabled &&
    !props.selected &&
    (props.onDark
      ? 'hover:border-sfere-500/70 hover:bg-white/[0.06] hover:shadow-sfere-glow'
      : 'hover:border-sfere-300 hover:shadow-sfere-soft')
])
</script>
