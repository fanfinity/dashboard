<template>
  <CardPanel>
    <template #header>
      <span class="text-sm font-semibold text-ink">Warehouse events</span>
      <StatusBadge
        v-if="!isMock && eventsTotal"
        tone="neutral"
        :label="`${formatCount(eventsTotal)} total`"
      />
    </template>

    <!-- These come from the account-scoped ClickHouse endpoint
         (/v1/accounts/{id}/sources/{id}/events), which only exists on the real
         backend. In mock mode there is nothing to call, so say so rather than
         firing a request that can't succeed. -->
    <EmptyState
      v-if="isMock"
      title="Switch to real data to load events"
      description="These are the events warehoused for this source. Set Settings → Data source to “real” to load them from the backend."
    />

    <DataTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="eventsLoading"
      :error="eventsError"
      row-key="id"
      empty-title="No events yet"
      empty-description="No events have been warehoused for this source yet."
      @retry="reload"
    >
      <template #cell-timestamp="{ row }">
        <span class="whitespace-nowrap text-muted">{{
          formatDateTime(row.timestamp)
        }}</span>
      </template>
      <template #cell-eventName="{ row }">
        <span class="font-medium text-ink">{{ row.eventName || '—' }}</span>
      </template>
      <template #cell-payload="{ row }">
        <span class="line-clamp-1 block max-w-[420px] text-xs text-muted">{{
          payloadSummary(row)
        }}</span>
      </template>
    </DataTable>
  </CardPanel>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useDataSource } from '@/composables/useDataSource'
import { useSourceDataAPI } from '@/composables/useSourceDataAPI'
import { formatCount, formatDateTime } from '@/composables/useSources'

const props = defineProps({
  source: { type: Object, required: true }
})

const { isMock } = useDataSource()
const { events, eventsTotal, eventsLoading, eventsError, listSourceEvents } =
  useSourceDataAPI()

const columns = [
  { key: 'timestamp', label: 'Time' },
  { key: 'eventName', label: 'Event' },
  { key: 'payload', label: 'Payload' }
]

// The warehouse rows carry no id of their own; DataTable needs a stable
// row-key, so synthesise one from the timestamp and position.
const rows = computed(() =>
  events.value.map((e, i) => ({ id: `${e.timestamp}_${i}`, ...e }))
)

function payloadSummary(row) {
  const payload = row.event
  if (payload === undefined || payload === null || payload === '') return '—'
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload)
  } catch {
    return '—'
  }
}

function reload() {
  // No endpoint to hit in mock mode — the EmptyState covers that case.
  if (!isMock.value) listSourceEvents(props.source.id)
}

onMounted(reload)
</script>
