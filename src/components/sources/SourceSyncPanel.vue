<template>
  <div class="flex flex-col gap-4">
    <!-- Sync runs and everything that configures them come from the real
         backend only. -->
    <EmptyState
      v-if="isMock"
      title="Switch to real data to run syncs"
      description="Triggering a sync, its run history, the schedule and catalog discovery all need the backend. Set Settings → Data source to “Real API”."
    />

    <template v-else>
      <!-- Only for a source Sfere pulls from. A `web` source receives events
           pushed to it: there is nothing to schedule, nothing to discover and no
           stored credential to test, and all four routes would 404. -->
      <SourceSyncSetupPanel
        v-if="isPulled"
        :test-result="testResult"
        :testing="testing"
        :schedule="schedule"
        :schedule-loading="scheduleLoading"
        :schedule-saving="scheduleSaving"
        :schedule-error="scheduleError"
        :schedule-api-missing="scheduleApiMissing"
        :catalog="catalog"
        :catalog-loading="catalogLoading"
        :catalog-pending="catalogPending"
        :catalog-error="catalogError"
        :catalog-api-missing="catalogApiMissing"
        :discovering="discovering"
        @test="onTest"
        @discover="onDiscover"
        @save-schedule="onSaveSchedule"
        @save-selection="onSaveSelection"
        @reload-schedule="loadSchedule(source.id)"
        @reload-catalog="loadCatalog(source.id)"
      />

      <CardPanel>
        <template #header>
          <span class="text-sm font-semibold text-ink">Sync history</span>
          <div class="flex items-center gap-2">
            <select
              v-model="mode"
              class="h-8 rounded-lg border border-line2 bg-white px-2 text-xs text-ink outline-none"
            >
              <option v-for="m in SYNC_MODES" :key="m.value" :value="m.value">{{
                m.label
              }}</option>
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

        <DataTable
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
              :label="row.status || NOT_KNOWN"
            />
          </template>
          <template #cell-counts="{ row }">
            <span class="text-xs text-muted">{{
              countsSummary(row.counts)
            }}</span>
          </template>
          <template #cell-startedAt="{ row }">
            <span class="whitespace-nowrap text-muted">{{
              formatDateTime(row.startedAt, NEVER)
            }}</span>
          </template>
          <!-- Row-level actions keep their words: the noun that matters in a
               table is WHICH ROW, not the <h1>, so these are not icons. -->
          <template #cell-actions="{ row }">
            <div class="flex items-center justify-end gap-2">
              <button
                class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill"
                @click.stop="openLogs(row)"
              >
                Logs
              </button>
              <button
                v-if="isCancellable(row)"
                class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
                @click.stop="askCancel(row)"
              >
                Cancel
              </button>
            </div>
          </template>
        </DataTable>
      </CardPanel>
    </template>

    <SourceSyncRunLogsDialog
      v-model="logsOpen"
      :run="logsRun"
      :entries="logEntries"
      :loading="logsLoading"
      :error="logsError"
      :api-missing="logsApiMissing"
      @retry="reloadLogs"
    />

    <!-- Its own target ref, not the logs dialog's: two dialogs reading one row
         is how a confirm acts on the wrong record. -->
    <ConfirmDialog
      v-model="cancelOpen"
      title="Cancel this sync run?"
      :message="cancelMessage"
      confirm-label="Cancel run"
      destructive
      @confirm="onCancel"
    />
  </div>
</template>

<script setup>
import { NEVER, NONE, NOT_KNOWN } from '@/lib/emptyValue'
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SourceSyncSetupPanel from '@/components/sources/SourceSyncSetupPanel.vue'
import SourceSyncRunLogsDialog from '@/components/sources/SourceSyncRunLogsDialog.vue'
import { useDataSource } from '@/composables/useDataSource'
import { useSourceSyncAPI } from '@/composables/useSourceSyncAPI'
import {
  SYNC_MODES,
  isPulledSource,
  useSourceCatalogAPI
} from '@/composables/useSourceCatalogAPI'
import { notifyMutationResult } from '@/composables/useMutationFeedback'
import { formatDateTime } from '@/composables/useSources'

const props = defineProps({
  source: { type: Object, required: true }
})

const $q = useQuasar()
const { isMock } = useDataSource()

const {
  runs,
  loading,
  error,
  triggerSync,
  listSyncRuns,
  listSyncRunLogs,
  cancelSyncRun
} = useSourceSyncAPI()

const {
  catalog,
  catalogLoading,
  catalogPending,
  catalogError,
  catalogApiMissing,
  discovering,
  loadCatalog,
  discover,
  saveCatalogSelection,
  schedule,
  scheduleLoading,
  scheduleSaving,
  scheduleError,
  scheduleApiMissing,
  loadSchedule,
  saveSchedule,
  testResult,
  testing,
  testConnection
} = useSourceCatalogAPI()

const isPulled = computed(() => isPulledSource(props.source))

const mode = ref('full')
const triggering = ref(false)

const columns = [
  { key: 'mode', label: 'Mode' },
  { key: 'status', label: 'Status' },
  { key: 'counts', label: 'Records' },
  { key: 'startedAt', label: 'Started' },
  { key: 'actions', label: '', align: 'right', width: '170px' }
]

// `SyncRun.status` is a bare string on the wire, not an enum, so this maps the
// values the backend uses and falls through to neutral rather than asserting a
// tone for one it has not seen.
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
  if (!counts || typeof counts !== 'object') return NOT_KNOWN
  const parts = Object.entries(counts)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${k}: ${v}`)
  return parts.length ? parts.join(' · ') : NONE
}

/** Only a run that has not settled can be asked to stop. */
function isCancellable(run) {
  return run.status === 'running' || run.status === 'pending'
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

// ------------------------------------------------------------------ setup

async function onTest() {
  const res = await testConnection(props.source.id)
  // A failed TEST is reported inside the panel, with the backend's reason. Only
  // a failed REQUEST reaches a toast.
  if (!res.ok) {
    notifyMutationResult($q, res, {
      success: '',
      apiMissing: "Can't test this connection yet."
    })
  }
}

async function onDiscover() {
  const res = await discover(props.source.id)
  if (!res.ok) {
    notifyMutationResult($q, res, {
      success: '',
      apiMissing: "Can't run discovery yet."
    })
  }
}

async function onSaveSchedule(next) {
  const res = await saveSchedule(props.source.id, next)
  notifyMutationResult($q, res, {
    success: 'Sync schedule saved',
    apiMissing: "Can't save the sync schedule yet."
  })
}

async function onSaveSelection(keys) {
  const res = await saveCatalogSelection(props.source.id, keys)
  notifyMutationResult($q, res, {
    success: `Now pulling ${keys.length} entit${keys.length === 1 ? 'y' : 'ies'}`,
    apiMissing: "Can't save the catalog selection yet."
  })
}

// ------------------------------------------------------------------- logs

const logsOpen = ref(false)
const logsRun = ref(null)
const logEntries = ref([])
const logsLoading = ref(false)
const logsError = ref(null)
const logsApiMissing = ref(false)

async function reloadLogs() {
  const run = logsRun.value
  if (!run) return
  logsLoading.value = true
  logsError.value = null
  logsApiMissing.value = false
  logEntries.value = []
  try {
    const res = await listSyncRunLogs(props.source.id, run.id)
    if (res.ok) logEntries.value = res.data
    else if (res.apiMissing) logsApiMissing.value = true
    else logsError.value = res.error
  } finally {
    logsLoading.value = false
  }
}

function openLogs(run) {
  logsRun.value = run
  logsOpen.value = true
  reloadLogs()
}

// ------------------------------------------------------------------ cancel

const cancelOpen = ref(false)
const cancelTarget = ref(null)

const cancelMessage = computed(() => {
  const run = cancelTarget.value
  if (!run) return ''
  return `The run stops where it is. Records already written stay written — cancelling does not roll anything back, so a partially-synced entity stays partially synced until the next run reaches it. Cancelling is a request: if the run finishes first, it finishes.`
})

function askCancel(run) {
  cancelTarget.value = run
  cancelOpen.value = true
}

async function onCancel() {
  const run = cancelTarget.value
  if (!run) return
  const res = await cancelSyncRun(props.source.id, run.id)
  notifyMutationResult($q, res, {
    success: 'Cancellation requested',
    apiMissing: "Can't cancel a sync run yet."
  })
}

// Follows the source rather than the mount, so switching between two sources
// with this tab open re-reads all four.
watch(
  () => props.source?.id,
  id => {
    if (!id || isMock.value) return
    reload()
    if (isPulled.value) {
      loadSchedule(id)
      loadCatalog(id)
    }
  },
  { immediate: true }
)
</script>
