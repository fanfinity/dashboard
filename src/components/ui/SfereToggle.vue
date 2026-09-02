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

// OFF IS NOT THE SAME AS UNAVAILABLE, and the off track used to be drawn in
// `--color-sfere-line` — the hairline token, the same grey as a card border. A
// control the colour of chrome reads as chrome, so people stopped clicking the
// ones that were merely off. Off is now a solid mid-grey with a hover state and
// a pointer cursor; disabled keeps the pale hairline it gave up.
//
// The disabled half is deliberately a BACKGROUND change rather than a fade,
// because the fade is not ours to set: Quasar ships unlayered
// `[disabled] { opacity: .6 !important; cursor: not-allowed !important }`, so
// `disabled:opacity-*` and `disabled:cursor-not-allowed` are dead classes here
// (this is cascade collision #2 in CLAUDE.md, in its `!important` form). What a
// layered utility can still win is the colour — `:disabled` outranks the plain
// state classes on specificity, so `disabled:bg-*` applies whatever the order.
// `enabled:` on the hover keeps a disabled track from lighting up under the
// pointer, which CSS `:hover` would otherwise happily do.
const trackClasses = computed(() => [
  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border',
  'transition-colors duration-200 ease-sfere-ui',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60 focus-visible:ring-offset-2',
  'enabled:cursor-pointer',
  props.modelValue
    ? 'border-transparent bg-sfere-brand-fill enabled:hover:bg-sfere-brand-text'
    : props.onDark
      ? 'border-white/25 bg-white/25 enabled:hover:bg-white/35'
      : 'border-sfere-fg-muted/25 bg-sfere-fg-muted/50 enabled:hover:bg-sfere-fg-muted/65',
  props.onDark
    ? 'disabled:border-white/10 disabled:bg-white/10'
    : 'disabled:border-sfere-line disabled:bg-sfere-line',
  props.onDark && 'focus-visible:ring-offset-transparent'
])

const knobClasses = computed(() => [
  'inline-block size-5 rounded-full bg-white shadow-sm',
  'transition-transform duration-200 ease-sfere-ui motion-reduce:transition-none',
  props.modelValue ? 'translate-x-5' : 'translate-x-0.5'
])
</script>
