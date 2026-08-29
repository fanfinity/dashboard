<template>
  <q-page class="p-6">
    <PageHeader
      title="Attributes trash"
      subtitle="Deleted attributes are kept for 30 days. Restoring one puts it back and recomputes it on the next run."
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
        <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
      </template>

      <template #cell-type="{ row }">
        <StatusBadge
          :tone="row.type === 'realtime' ? 'success' : 'neutral'"
          :label="attributeTypeLabel(row.type)"
        />
      </template>

      <template #cell-derivedFrom="{ row }">
        <p class="text-ink">{{ attributeSourceLabel(row) }}</p>
        <p class="text-xs text-subtle">{{ algorithmLabel(row.algorithm) }}</p>
      </template>

      <template #cell-deletedAt="{ row }">
        <p class="text-muted">{{ formatDateTime(row.deletedAt) }}</p>
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
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import {
  algorithmLabel,
  attributeSourceLabel,
  attributeTypeLabel,
  formatDateTime
} from '@/composables/useAttributes'
import { useAttributesTrash } from '@/composables/useAttributesTrash'

const $q = useQuasar()
const { items, loading, error, load, restore, purge, purgeAll } =
  useAttributesTrash()

const query = ref('')
const confirmOne = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const RETENTION_DAYS = 30

const columns = [
  { key: 'name', label: 'Attribute', sortable: true },
  { key: 'type', label: 'Kind', sortable: true },
  { key: 'derivedFrom', label: 'Derived from' },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '230px' }
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(i =>
    ['name', 'id', 'dataModelName', 'deletedByName'].some(f =>
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
    : `No attribute has been deleted in the last ${RETENTION_DAYS} days.`
)

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
    ? `“${target.value.name}” and its definition will be removed permanently. Any audience that still filters on it will need editing. This cannot be undone.`
    : ''
)

const emptyMessage = computed(
  () =>
    `All ${items.value.length} deleted attribute${items.value.length === 1 ? '' : 's'} will be removed permanently. This cannot be undone.`
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
  notifyLocal(`${count} attribute${count === 1 ? '' : 's'} deleted permanently`)
}

onMounted(load)
</script>
