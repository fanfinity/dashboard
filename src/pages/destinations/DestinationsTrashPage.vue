<template>
  <q-page class="p-6">
    <PageHeader
      title="Destinations trash"
      subtitle="Deleted destinations are kept for 30 days, then purged. Restoring one does not restart its pipes."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search trash..." />
        <button
          :disabled="!deleted.length"
          class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="confirmEmpty = true"
        >
          Empty trash
        </button>
      </template>
    </PageHeader>

    <DataTable
      :columns="columns"
      :rows="filtered"
      :loading="loading"
      :error="error"
      row-key="id"
      @retry="load"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">{{
          row.description || `/${row.slug}`
        }}</p>
      </template>

      <template #cell-template="{ row }">
        <DestinationTemplateBadge :record="row" compact />
      </template>

      <template #cell-deletedByName="{ row }">
        {{ row.deletedByName || row.deletedBy || '—' }}
      </template>

      <template #cell-deletedAt="{ value }">{{
        formatDateTime(value)
      }}</template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="restore(row)"
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

      <!-- An empty trash is the good outcome, so the call to action points back
           at the list rather than at anything destructive. -->
      <template #empty>
        <EmptyState
          v-if="deleted.length"
          title="No deleted destinations match your search"
          :description="`None of the ${deleted.length} items in the trash match “${query}”.`"
        >
          <template #cta>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="query = ''"
            >
              Clear search
            </button>
          </template>
        </EmptyState>

        <EmptyState
          v-else
          title="Trash is empty"
          description="No destination has been deleted in the last 30 days."
        >
          <template #cta>
            <button
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'destinations' })"
            >
              Back to destinations
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="confirmPurge"
      title="Delete forever?"
      :message="`“${target?.name}” will be permanently removed. This cannot be undone.`"
      confirm-label="Delete forever"
      destructive
      @confirm="purge"
    />

    <ConfirmDialog
      v-model="confirmEmpty"
      title="Empty the trash?"
      :message="`All ${deleted.length} deleted destination(s) will be permanently removed. This cannot be undone.`"
      confirm-label="Empty trash"
      destructive
      @confirm="purgeAll"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DestinationTemplateBadge from '@/components/destinations/DestinationTemplateBadge.vue'
import {
  formatDateTime,
  useDestinationsTrash,
  useDestinationToasts
} from '@/composables/useDestinations'

const router = useRouter()
const { deleted, loading, error, load } = useDestinationsTrash()
const { toast } = useDestinationToasts()

const query = ref('')
const confirmPurge = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Destination', sortable: true },
  { key: 'template', label: 'Template' },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '220px' }
]

const SEARCH_FIELDS = ['name', 'slug', 'description', 'deletedByName']

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return deleted.value
  return deleted.value.filter(d =>
    SEARCH_FIELDS.some(f =>
      String(d[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  )
})

// Restore and purge differ only in what the toast says — with no backend, both
// are "drop the row from the loaded trash". Restore is deliberately not
// confirmed; it is the reversible one.
function drop(row) {
  const i = deleted.value.findIndex(d => d.id === row.id)
  if (i !== -1) deleted.value.splice(i, 1)
}

function restore(row) {
  drop(row)
  toast(`“${row.name}” restored — demo data, nothing was saved.`)
}

function askPurge(row) {
  target.value = row
  confirmPurge.value = true
}

function purge() {
  const row = target.value
  if (!row) return
  drop(row)
  target.value = null
  toast(`“${row.name}” deleted forever — demo data, nothing was saved.`)
}

function purgeAll() {
  const n = deleted.value.length
  deleted.value = []
  toast(`Trash emptied — ${n} destination(s) removed. Nothing was saved.`)
}

onMounted(load)
</script>
