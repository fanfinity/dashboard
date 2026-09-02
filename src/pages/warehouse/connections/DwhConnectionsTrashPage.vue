<template>
  <q-page class="p-6">
    <PageHeader
      title="Warehouse connections trash"
      subtitle="Deleted connections are kept for 30 days, then removed for good."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search trash..." />
        <button
          :disabled="!items.length"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="confirmEmpty = true"
        >
          Empty trash
        </button>
      </template>
    </PageHeader>

    <!-- Credentials are not kept in the trash. That is a property of a working
         screen, so it is a notice rather than an ErrorState. -->
    <NoticeBanner
      v-if="!loading && !error && items.length"
      tone="warn"
      class="mb-4"
      title="A restored connection comes back without its password"
      message="Host, port and database survive deletion; the secret does not. Restore, re-enter the credentials and test before anything can read from it again."
    />

    <!-- The cascade check is secondary: the trash still lists, restores and
         purges without it, so a failure degrades in place with its own retry. -->
    <NoticeBanner
      v-else-if="dependantsError"
      tone="info"
      class="mb-4"
      title="Couldn't check what was deleted alongside these"
      :message="dependantsError"
    >
      <button
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="loadDependants"
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
        <div class="flex items-center gap-2">
          <p class="font-medium text-ink">{{ row.name }}</p>
          <StatusBadge
            v-if="cascadeCount(row)"
            tone="warn"
            :label="`${cascadeCount(row)} deleted with it`"
          />
        </div>
        <code class="font-mono text-xs text-subtle"
          >{{ row.host }}:{{ row.port }}</code
        >
      </template>

      <template #cell-type="{ row }">
        <StatusBadge tone="neutral" :label="connectionTypeLabel(row.type)" />
        <p class="mt-1 font-mono text-xs text-subtle">{{ row.database }}</p>
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
      title="Restore this connection?"
      :message="restoreMessage"
      confirm-label="Restore"
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
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import {
  connectionTypeLabel,
  formatDateTime,
  useDwhConnectionToasts
} from '@/composables/useDwhConnections'
import {
  useDeletedDwhConnectionDependants,
  useDwhConnectionsTrash
} from '@/composables/useDwhConnectionsTrash'

const { toast } = useDwhConnectionToasts()
const { items, loading, error, load, restore, purge, purgeAll } =
  useDwhConnectionsTrash()
const {
  error: dependantsError,
  load: loadDependants,
  countFor
} = useDeletedDwhConnectionDependants()

const query = ref('')
const confirmRestore = ref(false)
const confirmPurge = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const RETENTION_DAYS = 30

const columns = [
  { key: 'name', label: 'Connection', sortable: true },
  { key: 'type', label: 'Engine', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  // Wide enough for "Restore" and "Delete forever" side by side: Quasar's own
  // `.flex` rule carries `flex-wrap: wrap`, so a narrower column stacks them.
  { key: 'actions', label: '', align: 'right', width: '280px' }
]

const SEARCH_FIELDS = [
  'name',
  'id',
  'type',
  'host',
  'database',
  'deletedByName'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(i =>
    SEARCH_FIELDS.some(f =>
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
    : `No warehouse connection has been deleted in the last ${RETENTION_DAYS} days.`
)

// Deleting a connection soft-deletes everything reading from it in the same
// sweep, and restoring the connection does not bring those back.
function cascadeCount(row) {
  return dependantsError.value ? 0 : countFor(row.id)
}

// How long a record has left before it is purged automatically.
function retentionLabel(row) {
  const deleted = new Date(row.deletedAt)
  if (Number.isNaN(deleted.getTime())) return ''
  const elapsed = Math.floor((Date.now() - deleted.getTime()) / 86400000)
  const left = RETENTION_DAYS - elapsed
  if (left <= 0) return 'Past retention. Purged on the next sweep.'
  return `${left} day${left === 1 ? '' : 's'} left`
}

function askRestore(row) {
  target.value = row
  confirmRestore.value = true
}

function onRestore(row) {
  if (!row) return
  restore(row)
  toast(`“${row.name}” restored. Re-enter its password before using it.`)
  target.value = null
}

function askPurge(row) {
  target.value = row
  confirmPurge.value = true
}

const restoreMessage = computed(() => {
  const row = target.value
  if (!row) return ''
  const cascaded = cascadeCount(row)
  const tail = cascaded
    ? ` ${cascaded} sync${cascaded === 1 ? '' : 's'} deleted alongside it stay in the trash and have to be restored separately.`
    : ''
  return `“${row.name}” comes back disconnected: the password was not kept, so re-enter it and run a test before anything reads from it.${tail}`
})

const purgeMessage = computed(() =>
  target.value
    ? `“${target.value.name}” and its configuration are removed permanently. Nothing in ${target.value.database} is touched; this only forgets how to reach it. This cannot be undone.`
    : ''
)

const emptyMessage = computed(() => {
  const count = items.value.length
  return `All ${count} deleted connection${count === 1 ? '' : 's'} will be removed permanently. The warehouses themselves are untouched. This cannot be undone.`
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
  toast(`${count} connection${count === 1 ? '' : 's'} deleted permanently`)
}

onMounted(() => {
  load()
  loadDependants()
})
</script>
