<template>
  <q-page class="p-6">
    <PageHeader
      title="DWH syncs trash"
      subtitle="Deleted syncs are kept for 30 days, then removed for good."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search trash..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'dwh-syncs' })"
        >
          All syncs
        </button>
        <button
          :disabled="!items.length"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="confirmEmpty = true"
        >
          Empty trash
        </button>
      </template>
    </PageHeader>

    <!-- A whole sentence does not fit a StatusBadge, and a warehouse that is
         gone or down is not a load failure — so this is a notice, not an
         ErrorState. -->
    <NoticeBanner
      v-if="blockedCount"
      tone="warn"
      class="mb-4"
      title="Some of these cannot resume on their own"
      :message="blockedMessage"
    />

    <!-- The connection check is secondary: if it fails, the trash still lists
         and restores, and the check offers its own retry. -->
    <NoticeBanner
      v-else-if="connectionsError"
      tone="info"
      class="mb-4"
      title="Couldn't check the warehouse connections"
      :message="connectionsError"
    >
      <button
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="loadConnections"
      >
        Retry check
      </button>
    </NoticeBanner>

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      @retry="load"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <code class="font-mono text-xs text-subtle"
          >{{ row.sourceTable }} → {{ row.targetTable }}</code
        >
      </template>

      <template #cell-dwhConnectionName="{ row }">
        <div class="flex items-center gap-2">
          <span class="text-muted">{{ row.dwhConnectionName }}</span>
          <StatusBadge
            v-if="blockReason(row)"
            tone="warn"
            :label="blockReason(row)"
          />
        </div>
      </template>

      <template #cell-deletedAt="{ row }">
        <p class="text-muted">{{ formatDateTime(row.deletedAt) }}</p>
        <p class="text-xs text-subtle">{{ retentionLabel(row) }}</p>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="askRestore(row)"
          >
            Restore
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click="askPurge(row)"
          >
            Delete forever
          </button>
        </div>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="confirmRestore"
      title="Restore a sync that cannot run?"
      :message="restoreMessage"
      confirm-label="Restore anyway"
      @confirm="onRestore(target)"
    />

    <ConfirmDialog
      v-model="confirmPurge"
      title="Delete forever?"
      :message="purgeMessage"
      confirm-label="Delete forever"
      destructive
      @confirm="onPurge"
    />

    <ConfirmDialog
      v-model="confirmEmpty"
      title="Empty the trash?"
      :message="emptyMessage"
      confirm-label="Empty trash"
      destructive
      @confirm="onPurgeAll"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import {
  formatDateTime,
  isConnectionHealthy,
  useDwhSyncConnections,
  useDwhSyncToasts
} from '@/composables/useDwhSyncs'
import { useDwhSyncsTrash } from '@/composables/useDwhSyncsTrash'

const router = useRouter()
const { toast } = useDwhSyncToasts()
const { items, loading, error, load, restore, purge, purgeAll } =
  useDwhSyncsTrash()
const {
  error: connectionsError,
  load: loadConnections,
  findById: findConnection
} = useDwhSyncConnections()

const query = ref('')
const confirmRestore = ref(false)
const confirmPurge = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const RETENTION_DAYS = 30

const columns = [
  { key: 'name', label: 'Sync', sortable: true },
  { key: 'dwhConnectionName', label: 'Warehouse', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '230px' }
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(i =>
    [
      'name',
      'sourceTable',
      'targetTable',
      'dwhConnectionName',
      'deletedByName'
    ].some(f =>
      String(i[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  )
})

// An empty trash is the good outcome, so it does not get a call to action —
// a filtered-to-nothing trash does.
const emptyTitle = computed(() =>
  items.value.length ? 'Nothing matches your search' : 'Trash is empty'
)

const emptyDescription = computed(() =>
  items.value.length
    ? 'Try a different search term.'
    : `No DWH sync has been deleted in the last ${RETENTION_DAYS} days.`
)

// Two different ways a restored sync still would not run, and the copy has to
// tell them apart: the warehouse connection was deleted along with it, or it is
// still there and refusing connections. Anything else restores silently.
function blockReason(row) {
  const connection = findConnection(row.dwhConnectionId)
  if (!connection) return 'Connection deleted'
  if (!isConnectionHealthy(connection)) return 'Connection failing'
  return ''
}

const blockedCount = computed(
  () => items.value.filter(i => blockReason(i)).length
)

const blockedMessage = computed(() => {
  const n = blockedCount.value
  return `${n} of these reference a warehouse connection that was deleted or is failing. Restoring works, but the sync will not run until the connection is back.`
})

// How long a record has left before it is purged automatically.
function retentionLabel(row) {
  const deleted = new Date(row.deletedAt)
  if (Number.isNaN(deleted.getTime())) return ''
  const elapsed = Math.floor((Date.now() - deleted.getTime()) / 86400000)
  const left = RETENTION_DAYS - elapsed
  if (left <= 0) return 'Past retention — purged on the next sweep'
  return `${left} day${left === 1 ? '' : 's'} left`
}

function askRestore(row) {
  target.value = row
  // Restoring into a healthy warehouse needs no ceremony; restoring into a
  // missing or broken one does, because the sync will silently not run.
  if (!blockReason(row)) {
    onRestore(row)
    return
  }
  confirmRestore.value = true
}

function onRestore(row) {
  if (!row) return
  restore(row)
  toast(`“${row.name}” restored`)
  target.value = null
}

function askPurge(row) {
  target.value = row
  confirmPurge.value = true
}

const restoreMessage = computed(() => {
  const row = target.value
  if (!row) return ''
  const reason =
    blockReason(row) === 'Connection deleted'
      ? `${row.dwhConnectionName} no longer exists`
      : `${row.dwhConnectionName} is not accepting connections`
  return `${reason}. “${row.name}” will come back configured, but no run will succeed until the warehouse connection is restored or repaired.`
})

const purgeMessage = computed(() =>
  target.value
    ? `“${target.value.name}” and its column mapping will be removed permanently. Rows it already wrote to ${target.value.dwhConnectionName} are not touched. This cannot be undone.`
    : ''
)

const emptyMessage = computed(() => {
  const count = items.value.length
  return `All ${count} deleted sync${count === 1 ? '' : 's'} will be removed permanently. This cannot be undone.`
})

function onPurge() {
  const row = target.value
  if (!row) return
  purge(row)
  toast(`“${row.name}” deleted permanently`)
  target.value = null
}

function onPurgeAll() {
  const count = items.value.length
  purgeAll()
  toast(`${count} sync${count === 1 ? '' : 's'} deleted permanently`)
}

onMounted(() => {
  load()
  loadConnections()
})
</script>
