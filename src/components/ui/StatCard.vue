<template>
  <div :class="rootClasses">
    <p :class="labelClasses">{{ label }}</p>

    <p :class="valueClasses">
      <slot>{{ value }}</slot>
    </p>

    <p v-if="delta || hint || $slots.hint" :class="metaClasses">
      <span v-if="delta" :class="deltaClasses">
        <span aria-hidden="true">{{ ARROWS[direction] }}</span>
        {{ delta }}
      </span>
      <span v-if="hint || $slots.hint" class="opacity-80">
        <slot name="hint">{{ hint }}</slot>
      </span>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// A single number, presented so it can be read across a room. The figure is set
// in the display face with tabular figures — a column of stats whose digits
// don't line up looks broken even when every value is correct.
//
// `delta` is a TREND and always draws an arrow in a trend colour. Anything that
// is not a trend ("37 errors", "1.65x fan-out") belongs in `hint`; pushing it
// through `delta` earns it a red down-arrow it did not deserve. Same rule as
// the existing StatCard — see docs/ui-conventions.md.
const props = defineProps({
  label: { type: String, required: true },
  // Pre-formatted. This component never formats numbers or dates.
  value: { type: [String, Number], default: '' },
  delta: { type: String, default: '' },
  direction: {
    type: String,
    default: 'up',
    validator: v => ['up', 'down', 'flat'].includes(v)
  },
  hint: { type: String, default: '' },
  onDark: { type: Boolean, default: false },
  // Drops the border/padding so the stat can sit inside an existing card.
  bare: { type: Boolean, default: false }
})

const ARROWS = { up: '↑', down: '↓', flat: '→' }

const rootClasses = computed(() => [
  !props.bare && 'rounded-sfere-xl border p-5',
  !props.bare &&
    (props.onDark
      ? 'border-sfere-hairline bg-sfere-ink-raised'
      : 'border-sfere-line bg-sfere-surface')
])

const labelClasses = computed(() => [
  'font-sfere-mono text-sfere-label uppercase',
  props.onDark ? 'text-white/45' : 'text-sfere-fg-muted'
])

const valueClasses = computed(() => [
  'mt-2 font-sfere-display text-3xl font-bold tabular-nums tracking-tight',
  props.onDark ? 'text-white' : 'text-sfere-fg'
])

const metaClasses = computed(() => [
  'mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sfere-xs',
  props.onDark ? 'text-white/55' : 'text-sfere-fg-muted'
])

const DELTAS = {
  up: 'text-sfere-success',
  down: 'text-sfere-danger',
  flat: ''
}

const deltaClasses = computed(() => [
  'font-medium tabular-nums',
  props.onDark && props.direction === 'up'
    ? 'text-sfere-success-on-ink'
    : DELTAS[props.direction]
])
</script>
