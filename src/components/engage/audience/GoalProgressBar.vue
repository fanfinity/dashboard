<template>
  <div class="min-w-0">
    <p class="text-sm font-medium text-ink">{{ percentLabel }}</p>
    <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-fill">
      <div class="h-full rounded-full" :class="barClass" :style="barStyle" />
    </div>
    <!-- Under the bar rather than beside the percentage: a long currency pair
         wraps at some widths and not others, and a cell that reflows per row
         reads as a rendering bug. -->
    <p class="mt-1 text-xs text-subtle">{{ amountLabel }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  goalBarClass,
  goalBarWidth
} from '@/composables/useEngageAudienceGoals'
import {
  formatAmount,
  formatPercent
} from '@/composables/useEngageAudienceFormat'

// A goal's progress towards its target: percentage, the raw current/target
// pair, and a track. There is no meter or progress primitive in
// `src/components/ui/`, and both the list cell and the detail dialog need this
// exact shape, so it is composed here from plain Tailwind rather than copied
// into two places. Reported as a primitive gap.
const props = defineProps({
  goal: { type: Object, default: null }
})

const percentLabel = computed(() => formatPercent(props.goal?.progress))

const amountLabel = computed(() => {
  const g = props.goal
  if (!g) return ''
  return `${formatAmount(g.currentValue, g.unit)} of ${formatAmount(
    g.targetValue,
    g.unit
  )}`
})

const barClass = computed(() => goalBarClass(props.goal?.status))

const barStyle = computed(() => ({ width: goalBarWidth(props.goal?.progress) }))
</script>
