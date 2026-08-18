<template>
  <q-page class="p-6">
    <PageHeader
      title="Warehouse models trash"
      subtitle="Deleted models are kept for 30 days, then removed for good."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search trash..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'warehouse-models' })"
        >
          All models
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

    <!-- An empty trash is the normal state of this screen, so it carries the
         explanation rather than leaving the user to guess what deleting did. -->
    <NoticeBanner
      v-if="!loading && !error"
      tone="info"
      class="mb-5"
      title="Deleting a model never touches your warehouse"
      :message="noticeMessage"
    />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      @retry="load"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
      </template>

      <template #cell-dwhConnectionName="{ row }">
        <p class="text-ink">{{ row.dwhConnectionName || '—' }}</p>
        <p class="font-mono text-xs text-subtle">{{ shapeLabel(row) }}</p>
      </template>

      <template #cell-deletedAt="{ row }">
        <p class="whitespace-nowrap text-muted">{{
          formatDateTime(row.deletedAt)
        }}</p>
        <p class="text-xs text-subtle">{{ retentionLabel(row) }}</p>
      </template>

      <template #cell-deletedByName="{ row }">
        {{ row.deletedByName || row.deletedBy || '—' }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="onRestore(row)"
          >
            Restore
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="ask(row)"
          >
            Delete forever
          </button>
        </div>
      </template>

      <!-- Two different "no rows" cases. The second one — nothing has been
           deleted at all — is the healthy outcome here, so its call to action
           points back at the models rather than at anything destructive. -->
      <template #empty>
        <EmptyState
          v-if="items.length"
          title="Nothing in the trash matches your search"
          :description="`None of the ${items.length} deleted model${items.length === 1 ? '' : 's'} match “${query.trim()}”.`"
        >
          <template #cta>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="clearFilters"
            >
              Clear filters
            </button>
          </template>
        </EmptyState>

        <EmptyState
          v-else
          title="Trash is empty"
          description="No warehouse model has been deleted in the last 30 days. Anything you delete lands here first, keeps its query and column mapping, and can be put back until the retention window closes."
        >
          <template #cta>
            <button
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'warehouse-models' })"
            >
              Back to warehouse models
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="confirmOne"
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
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { formatCount, formatDateTime } from '@/composables/useWarehouseModels'
import { useWarehouseModelsTrash } from '@/composables/useWarehouseModelsTrash'

const router = useRouter()
const $q = useQuasar()
const { items, loading, error, load, restore, purge, purgeAll } =
  useWarehouseModelsTrash()

const query = ref('')
const confirmOne = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const RETENTION_DAYS = 30

const noticeMessage = `Only Sfere's copy of the query and its column mapping are removed — the table it reads stays exactly as it is. Restoring a model puts the definition back and recomputes it on the next refresh, so any attribute built on it starts updating again. Deleted models are purged automatically after ${RETENTION_DAYS} days.`

const columns = [
  { key: 'name', label: 'Model', sortable: true },
  { key: 'dwhConnectionName', label: 'Connection', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '230px' }
]

const SEARCH_FIELDS = ['name', 'id', 'dwhConnectionName', 'deletedByName']

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

function clearFilters() {
  query.value = ''
}

function shapeLabel(row) {
  const columnCount = row.columnCount ?? 0
  return `${formatCount(columnCount)} columns · ${formatCount(row.rowCount)} rows`
}

// How long a record has left before it is purged automatically.
function retentionLabel(row) {
  const deleted = new Date(row.deletedAt)
  if (Number.isNaN(deleted.getTime())) return ''
  const elapsed = Math.floor((Date.now() - deleted.getTime()) / 86400000)
  const left = RETENTION_DAYS - elapsed
  if (left <= 0) return 'Past retention — purged on the next sweep'
  return `${left} day${left === 1 ? '' : 's'} left`
}

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}

function onRestore(row) {
  restore(row)
  notifyLocal(`${row.name} restored`)
}

function ask(row) {
  target.value = row
  confirmOne.value = true
}

const purgeMessage = computed(() =>
  target.value
    ? `“${target.value.name}” and its column mapping will be removed permanently. Any attribute that still reads it will need pointing at another model. This cannot be undone.`
    : ''
)

const emptyMessage = computed(
  () =>
    `All ${items.value.length} deleted model${items.value.length === 1 ? '' : 's'} will be removed permanently. This cannot be undone.`
)

function onPurge() {
  const row = target.value
  if (!row) return
  purge(row)
  notifyLocal(`${row.name} deleted permanently`)
  target.value = null
}

function onPurgeAll() {
  const count = items.value.length
  purgeAll()
  notifyLocal(`${count} model${count === 1 ? '' : 's'} deleted permanently`)
}

onMounted(load)
</script>
