<template>
  <q-page class="p-6">
    <PageHeader
      title="Profile API trash"
      subtitle="Deleted endpoints are kept for 30 days, then removed for good."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search trash..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'profile-api' })"
        >
          All endpoints
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

    <!-- The screen worked; this is something the user should know before they
         restore one, so it is a notice rather than an error. -->
    <NoticeBanner
      v-if="!loading && !error && items.length"
      class="mb-5"
      tone="warn"
      title="A restored endpoint comes back without its key"
      message="Deleting an endpoint revokes the key issued for it. Restoring brings back the path and its configuration, so issue a new key before pointing clients at it again."
    />

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
        <p class="font-mono text-xs text-subtle"
          >{{ row.method }} {{ row.path }}</p
        >
      </template>

      <template #cell-identifierTypeName="{ value }">
        <StatusBadge tone="neutral" :label="value" />
      </template>

      <template #cell-deletedAt="{ row }">
        <p class="text-muted">{{ formatDateTime(row.deletedAt) }}</p>
        <p class="text-xs text-subtle">{{ retentionLabel(row) }}</p>
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
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { formatDateTime } from '@/composables/useProfileApi'
import {
  RETENTION_DAYS,
  retentionLabel,
  useProfileApiTrash
} from '@/composables/useProfileApiTrash'

const router = useRouter()
const $q = useQuasar()
const { items, loading, error, load, restore, purge, purgeAll } =
  useProfileApiTrash()

const query = ref('')
const confirmOne = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Endpoint', sortable: true },
  { key: 'identifierTypeName', label: 'Looks up by', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '230px' }
]

const SEARCH_FIELDS = [
  'name',
  'slug',
  'path',
  'identifierTypeName',
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
    : `No Profile API endpoint has been deleted in the last ${RETENTION_DAYS} days.`
)

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
  notifyLocal(`${row.name} restored — issue a new key before it serves traffic`)
}

function ask(row) {
  target.value = row
  confirmOne.value = true
}

const purgeMessage = computed(() =>
  target.value
    ? `“${target.value.name}” and its configuration will be removed permanently, and ${target.value.path} will stop resolving for good. This cannot be undone.`
    : ''
)

const emptyMessage = computed(
  () =>
    `All ${items.value.length} deleted endpoint${items.value.length === 1 ? '' : 's'} will be removed permanently. This cannot be undone.`
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
  notifyLocal(`${count} endpoint${count === 1 ? '' : 's'} deleted permanently`)
}

onMounted(load)
</script>
