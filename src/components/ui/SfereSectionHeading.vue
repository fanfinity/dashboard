<template>
  <div :class="wrapClasses">
    <SfereEyebrow
      v-if="eyebrow"
      :label="eyebrow"
      :on-dark="onDark"
      class="mb-4"
    />

    <h2 :class="headingClasses">
      <slot name="title">{{ title }}</slot>
    </h2>

    <p v-if="lead || $slots.lead" :class="leadClasses">
      <slot name="lead">{{ lead }}</slot>
    </p>

    <div v-if="$slots.actions" class="mt-7 flex flex-wrap items-center gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereEyebrow from './SfereEyebrow.vue'

// Eyebrow → heading → deck, the three-part opener every section on sfere.io
// uses. Prefer this over a bare <h2>: it applies the Tailwind v4 important
// SUFFIX on size, weight, leading and tracking in one go, which is what makes
// the heading survive Quasar's unlayered base stylesheet (docs/ui-conventions.md
// rules 2–3). A hand-rolled <h2 class="text-4xl"> renders at Quasar's scale.
const props = defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, default: '' },
  lead: { type: String, default: '' },
  level: {
    type: String,
    default: 'h2',
    validator: v => ['h1', 'h2', 'h3'].includes(v)
  },
  align: {
    type: String,
    default: 'left',
    validator: v => ['left', 'center'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

// Responsive shrink matches the site: one step down below `sm`.
const LEVELS = {
  h1: 'text-sfere-h2! sm:text-sfere-h1!',
  h2: 'text-sfere-h3! sm:text-sfere-h2!',
  h3: 'text-sfere-h4! sm:text-sfere-h3!'
}

const wrapClasses = computed(() => [
  props.align === 'center' && 'mx-auto max-w-2xl text-center'
])

const headingClasses = computed(() => [
  'font-sfere-display! text-balance',
  LEVELS[props.level],
  props.onDark ? 'text-white' : 'text-sfere-fg'
])

const leadClasses = computed(() => [
  'mt-4 max-w-2xl text-sfere-lead',
  props.align === 'center' && 'mx-auto',
  props.onDark ? 'text-white/70' : 'text-sfere-fg-muted'
])
</script>
