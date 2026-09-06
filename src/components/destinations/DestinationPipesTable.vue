<template>
  <DataTable
    :columns="columns"
    :rows="rows"
    :loading="loading"
    :error="error"
    :api-missing="apiMissing"
    row-key="id"
    clickable-rows
    empty-title="No pipes deliver here yet"
    empty-description="A pipe connects a source to this destination and decides which events reach it."
    empty-cta-label="New pipe"
    :empty-cta-to="{ name: 'pipes-new' }"
    @retry="emit('retry')"
    @row-click="emit('row-click', $event)"
  >
    <template #cell-name="{ row }">
      <div class="sfere-flush grid gap-0.5">
        <p class="font-medium text-sfere-fg">{{ row.name }}</p>
        <p class="text-sfere-xs text-sfere-fg-muted">{{
          row.sourceName || NOT_KNOWN
        }}</p>
      </div>
    </template>

    <template #cell-isEnabled="{ value }">
      <StatusBadge
        :tone="value ? 'success' : 'neutral'"
        :label="value ? 'Running' : 'Paused'"
      />
    </template>

    <template #cell-updatedAt="{ value }">{{ formatDate(value) }}</template>
  </DataTable>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatDate } from '@/composables/useDestinations'

// Everything routing events INTO one destination. Rendered twice on the detail
// screen — a five-row preview on Overview and the full list on the Pipes tab —
// which is the whole reason it is a component: two copies of a table is two
// places for a column to drift.
//
// THERE IS NO "Delivered (1h)" COLUMN, and that is the point rather than an
// omission. `deliveryCountLastHour` is a field of `pipes.json` and of nothing
// else: the backend's `Pipeline` is nine keys and carries no counter, so the
// column printed a confident `0` on every live row — a measurement nobody took,
// which is worse than a gap because nobody reports it. Every column here comes
// off the real record, `sourceName` included (usePipes() resolves it from the
// Sources collection; an end that no longer exists stays null and prints
// "Not known" rather than a fabricated name).
defineProps({
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false }
})

const emit = defineEmits(['retry', 'row-click'])

const columns = [
  { key: 'name', label: 'Pipe', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' }
]
</script>
