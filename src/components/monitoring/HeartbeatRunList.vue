<template>
  <ul v-if="runs.length" class="flex flex-col">
    <li
      v-for="run in runs"
      :key="run.id"
      class="border-t border-line py-3 first:border-t-0 first:pt-0"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :tone="run.statusVariant" :label="run.statusLabel" />
          <span class="text-sm font-medium text-ink">{{
            run.startedAtLabel
          }}</span>
        </div>
        <span class="text-xs text-subtle"
          >{{ run.durationLabel
          }}<template v-if="run.model"> · {{ run.model }}</template></span
        >
      </div>

      <p
        v-for="(paragraph, index) in run.paragraphs"
        :key="index"
        class="mt-1.5 text-sm leading-6 text-muted"
        >{{ paragraph }}</p
      >

      <!-- A check that did not return is a fact about the worker, not about
           this screen's fetch, so it stays inline text rather than becoming an
           ErrorState (which would trip the smoke gate's data-smoke="error"). -->
      <p
        v-if="run.errorMessage"
        class="mt-1.5 font-mono text-xs text-rose-600"
        >{{ run.errorMessage }}</p
      >
    </li>
  </ul>

  <EmptyState
    v-else
    variant="inline"
    title="No worker checks have run yet"
    description="The heartbeat worker posts a summary every hour once the pipeline is live."
  />
</template>

<script setup>
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// Rows are `{ id, statusVariant, statusLabel, startedAtLabel, durationLabel,
// model, paragraphs, errorMessage }` — shaped by useMonitoringHealth, because
// formatting belongs in the composable.
defineProps({
  runs: { type: Array, default: () => [] }
})
</script>
