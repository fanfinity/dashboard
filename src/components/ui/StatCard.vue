<template>
  <div class="rounded-xl border border-line2 bg-white p-4 shadow-sm">
    <p class="text-sm text-muted">{{ label }}</p>
    <div class="mt-2 flex items-baseline gap-2">
      <span class="text-2xl font-semibold tracking-[-0.5px] text-ink">{{
        value
      }}</span>
      <span v-if="delta" class="text-xs font-medium" :class="deltaClass"
        >{{ deltaArrow }} {{ delta }}</span
      >
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// KPI tile, lifted verbatim from DashboardHomePage's `kpis` grid. That page only
// ever renders an upward delta (`text-success` + '↑'); the down/flat cases are
// composed from the same shape — rose for a regression, muted for no change.
const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  delta: { type: String, default: '' },
  deltaDirection: {
    type: String,
    default: 'up',
    validator: v => ['up', 'down', 'flat'].includes(v)
  }
})

const DELTA = {
  up: { arrow: '↑', cls: 'text-success' },
  down: { arrow: '↓', cls: 'text-rose-600' },
  flat: { arrow: '→', cls: 'text-muted' }
}

const deltaArrow = computed(
  () => (DELTA[props.deltaDirection] ?? DELTA.up).arrow
)
const deltaClass = computed(() => (DELTA[props.deltaDirection] ?? DELTA.up).cls)
</script>
