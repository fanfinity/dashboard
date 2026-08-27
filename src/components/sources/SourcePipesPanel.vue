<template>
  <div class="flex flex-col gap-4">
    <!-- Collecting but going nowhere is the single most common half-finished
         state in the product, and the source detail page is where someone
         notices it. Saying so plainly, with the fix one click away, is the whole
         point of this tab. -->
    <NoticeBanner
      v-if="!loading && !error && !pipes.length"
      tone="warn"
      title="This source feeds nothing"
      message="Events are being collected but nothing downstream is using them. A pipe is what carries them to a warehouse or a tool."
    />

    <DataTable
      :columns="columns"
      :rows="pipes"
      :loading="loading"
      :error="error"
      :api-missing="apiMissing"
      row-key="id"
      clickable-rows
      @retry="$emit('retry')"
      @row-click="row => $emit('open', row)"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle"
          >{{ source.name }} →
          {{ row.eventDestinationName || 'destination' }}</p
        >
      </template>

      <template #cell-hasFunctionCode="{ value }">
        <StatusBadge
          :tone="value ? 'brand' : 'neutral'"
          :label="value ? 'Custom function' : 'Pass-through'"
        />
      </template>

      <template #cell-isEnabled="{ value }">
        <StatusBadge
          :tone="value ? 'success' : 'neutral'"
          :label="value ? 'Enabled' : 'Paused'"
        />
      </template>

      <template #cell-deliveryCountLastHour="{ value }">
        <span class="tabular-nums">{{ formatCount(value) }}</span>
      </template>

      <template #empty>
        <EmptyState
          title="Not feeding any destination yet"
          description="Create a pipe to send this source's events to a warehouse, an ad platform or a webhook."
        >
          <template #cta>
            <SfereButton :to="{ name: 'pipes-new' }"
              >Create a pipe →</SfereButton
            >
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <div v-if="pipes.length" class="flex items-center gap-3">
      <SfereButton variant="secondary" size="sm" :to="{ name: 'pipes-new' }"
        >Add another pipe</SfereButton
      >
      <SfereLinkArrow :to="{ name: 'pipes' }">All pipes</SfereLinkArrow>
    </div>
  </div>
</template>

<script setup>
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'
import { formatCount } from '@/composables/useSources'

// What this source actually feeds. The rows are pre-filtered by the page — this
// component owns no data, so the pipes read happens once on the page rather than
// again per tab switch.
defineProps({
  source: { type: Object, required: true },
  pipes: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false }
})

defineEmits(['retry', 'open'])

const columns = [
  { key: 'name', label: 'Pipe' },
  { key: 'hasFunctionCode', label: 'Transform' },
  { key: 'isEnabled', label: 'Status' },
  { key: 'deliveryCountLastHour', label: 'Deliveries / hr', align: 'right' }
]
</script>
