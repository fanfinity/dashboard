<template>
  <CardPanel>
    <template #header>
      <span class="text-sm font-semibold text-ink">Syncs</span>
      <div v-if="!isMock" class="flex items-center gap-2">
        <select
          v-model="mode"
          class="h-8 rounded-lg border border-line2 bg-white px-2 text-xs text-ink outline-none"
        >
          <option value="full">Full</option>
          <option value="incremental">Incremental</option>
        </select>
        <button
          :disabled="triggering"
          class="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="trigger"
        >
          {{ triggering ? 'Starting…' : 'Run sync' }}
        </button>
      </div>
    </template>

    <!-- Sync runs come from the real backend only. -->
    <EmptyState
      v-if="isMock"
      title="Switch to real data to run syncs"
      description="Triggering a sync and its run history need the backend. Set Settings → Data source to “real”."
    />

    <DataTable
      v-else
      :columns="columns"
      :rows="runs"
      :loading="loading"
      :error="error"
      row-key="id"
      empty-title="No syncs yet"
      empty-description="Run a sync to pull records from this source."
      @retry="reload"
    >
      <template #cell-mode="{ row }">
        <span class="capitalize text-ink">{{ row.mode }}</span>
      </template>
      <template #cell-status="{ row }">
        <StatusBadge
          :tone="statusTone(row.status)"
          :label="row.status || '—'"
        />
      </template>
      <template #cell-counts="{ row }">
        <span class="text-xs text-muted">{{ countsSummary(row.counts) }}</span>
      </template>
      <template #cell-startedAt="{ row }">
        <span class="whitespace-nowrap text-muted">{{
          formatDateTime(row.startedAt)
        }}</span>
      </template>
    </DataTable>
  </CardPanel>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useDataSource } from '@/composables/useDataSource'
import { useSourceSyncAPI } from '@/composables/useSourceSyncAPI'
import { formatDateTime } from '@/composables/useSources'

const props = defineProps({
  source: { type: Object, required: true }
})

const { isMock } = useDataSource()
const { runs, loading, error, triggerSync, listSyncRuns } = useSourceSyncAPI()

const mode = ref('full')
const triggering = ref(false)

const columns = [
  { key: 'mode', label: 'Mode' },
  { key: 'status', label: 'Status' },
  { key: 'counts', label: 'Records' },
  { key: 'startedAt', label: 'Started' }
]

function statusTone(status) {
  switch (status) {
    case 'success':
    case 'completed':
      return 'success'
    case 'failed':
    case 'error':
      return 'danger'
    case 'running':
    case 'pending':
      return 'warn'
    default:
      return 'neutral'
  }
}

function countsSummary(counts) {
  if (!counts || typeof counts !== 'object') return '—'
  const parts = Object.entries(counts)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${k}: ${v}`)
  return parts.length ? parts.join(' · ') : '—'
}

async function trigger() {
  triggering.value = true
  try {
    await triggerSync(props.source.id, { mode: mode.value })
  } catch {
    // triggerSync surfaces failures via the shared error ref on reload; keep the
    // button responsive regardless.
  } finally {
    triggering.value = false
  }
}

function reload() {
  if (!isMock.value) listSyncRuns(props.source.id)
}

onMounted(reload)
</script>
