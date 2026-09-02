<template>
  <CardPanel>
    <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Events in and out</h2
        >
        <p class="mt-0.5 text-xs text-muted"
          >Received from sources vs. delivered to destinations, per minute for
          the last hour.</p
        >
      </div>
      <p class="text-xs text-subtle"
        >Fan-out <span class="font-medium text-ink">{{ routingRate }}×</span></p
      >
    </div>
    <ThroughputChart
      :labels="labels"
      :received="received"
      :delivered="delivered"
    />
  </CardPanel>
</template>

<script setup>
import CardPanel from '@/components/ui/CardPanel.vue'
import ThroughputChart from '@/components/shell/ThroughputChart.vue'

// Lifted verbatim out of DashboardHomePage's template, unchanged, so that Home
// can render its blocks in a persona's order instead of one fixed sequence. The
// page used to hold ~180 lines of inline block markup, which is fine for one
// order and unreadable for three.
//
// Extraction rather than CSS `order-*` on purpose: an `order` utility moves the
// box and leaves the DOM alone, so a screen reader and the tab key would still
// walk the engineer's sequence on a marketer's screen. Reordering the render
// list keeps reading order and visual order the same thing.
defineProps({
  labels: { type: Array, default: () => [] },
  received: { type: Array, default: () => [] },
  delivered: { type: Array, default: () => [] },
  // Already formatted by the page — this component asserts nothing about the
  // number, including whether it was measured. See useDashboardHome.
  routingRate: { type: [String, Number], default: '' }
})
</script>
