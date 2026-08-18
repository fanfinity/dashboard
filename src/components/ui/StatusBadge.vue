<template>
  <span :class="classes">
    <span v-if="dot" :class="['size-1.5 shrink-0 rounded-full', DOTS[tone]]" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// Small, squared-off (6px) status marker. Deliberately NOT a pill: pills are
// spent on buttons and on SferePill, so a badge that reads as a button is the
// failure mode this shape avoids.
//
// This was the one component in the kit migration that was NOT a straight
// rename. The five palette strings carried over exactly (success / warn /
// neutral / danger / brand), but the prop is `tone` where the badge this
// replaced called it `variant`, and there is no `enabled` shorthand — write the
// ternary out:
//
//   :tone="row.active ? 'success' : 'neutral'"
//
// That is deliberate. `enabled` reads as on/off next to a prop called
// `variant`; next to `tone` it looks like it might tint rather than switch.
//
// Note the default is `brand`, where the old badge defaulted to `neutral`. No
// call site relies on the default — every one of the 171 in the repo passes a
// tone — but a new bare <StatusBadge> will come out purple, not grey.
const props = defineProps({
  label: { type: String, default: '' },
  tone: {
    type: String,
    default: 'brand',
    validator: v =>
      ['brand', 'neutral', 'success', 'warn', 'danger', 'onDark'].includes(v)
  },
  dot: { type: Boolean, default: false }
})

const TONES = {
  brand: 'bg-sfere-50 text-sfere-brand-text',
  neutral: 'bg-sfere-fill text-sfere-fg-muted',
  success: 'bg-sfere-success-soft text-sfere-success',
  warn: 'bg-sfere-warn-soft text-sfere-warn',
  danger: 'bg-sfere-danger-soft text-sfere-danger',
  onDark: 'bg-sfere-wash text-white/85 ring-1 ring-sfere-hairline'
}

const DOTS = {
  brand: 'bg-sfere-brand',
  neutral: 'bg-sfere-fg-muted',
  success: 'bg-sfere-success',
  warn: 'bg-sfere-warn',
  danger: 'bg-sfere-danger',
  onDark: 'bg-sfere-success-on-ink'
}

const classes = computed(() => [
  'inline-flex items-center gap-1.5 rounded-sfere-sm px-2 py-0.5',
  'text-sfere-xs font-medium whitespace-nowrap',
  TONES[props.tone]
])
</script>
