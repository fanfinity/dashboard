<template>
  <q-page class="p-6">
    <PageHeader
      title="Destinations"
      subtitle="Where routed events are delivered — warehouses, ad platforms and webhooks."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search destinations..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'destinations-trash' })"
        >
          Trash
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'destinations-new' })"
        >
          New destination
        </button>
      </template>
    </PageHeader>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="filtered"
      :loading="loading"
      :error="error"
      row-key="id"
      clickable-rows
      @retry="load"
      @row-click="open"
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

      <template #cell-isEnabled="{ value }">
        <StatusBadge :enabled="value" :label="value ? 'Enabled' : 'Paused'" />
      </template>

      <template #cell-pipeCount="{ value }">{{ formatCount(value) }}</template>

      <template #cell-deliveryCountLastHour="{ value }">{{
        formatCount(value)
      }}</template>

      <template #cell-createdAt="{ value }">{{ formatDate(value) }}</template>

      <template #cell-actions="{ row }">
        <button
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click.stop="toggle(row)"
        >
          {{ row.isEnabled ? 'Pause' : 'Enable' }}
        </button>
      </template>

      <!-- Two different "no rows" situations: nothing exists yet (offer the
           primary action) versus a filter that matched nothing (offer a way
           back). Both go through EmptyState, so the smoke run still reads
           data-smoke="empty" rather than mistaking either for a failure. -->
      <template #empty>
        <EmptyState
          v-if="destinations.length"
          title="No destinations match your filters"
          :description="`None of the ${destinations.length} destinations match this search or tab.`"
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
          title="No destinations yet"
          description="Add a destination and your pipes can start delivering events to it."
        >
          <template #cta>
            <button
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'destinations-new' })"
            >
              New destination
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import DestinationTemplateBadge from '@/components/destinations/DestinationTemplateBadge.vue'
import {
  formatCount,
  formatDate,
  useDestinations,
  useDestinationToasts
} from '@/composables/useDestinations'

const router = useRouter()
const { destinations, loading, error, load } = useDestinations()
const { toast } = useDestinationToasts()

const query = ref('')
const tab = ref('all')

const columns = [
  { key: 'name', label: 'Destination', sortable: true },
  { key: 'template', label: 'Template' },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'pipeCount', label: 'Pipes', sortable: true, align: 'right' },
  {
    key: 'deliveryCountLastHour',
    label: 'Delivered (1h)',
    sortable: true,
    align: 'right'
  },
  { key: 'createdAt', label: 'Created', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '120px' }
]

const tabs = computed(() => [
  { key: 'all', label: 'All', count: destinations.value.length },
  {
    key: 'enabled',
    label: 'Enabled',
    count: destinations.value.filter(d => d.isEnabled).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: destinations.value.filter(d => !d.isEnabled).length
  }
])

const TAB_PREDICATES = {
  enabled: d => d.isEnabled,
  paused: d => !d.isEnabled
}

// Every field the user can read off the row, so searching "webhook" matches the
// template as well as the name.
const SEARCH_FIELDS = ['name', 'slug', 'description', 'templateId']

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return destinations.value.filter(d => {
    if (predicate && !predicate(d)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(d[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function open(row) {
  router.push({ name: 'destinations-detail', params: { id: row.id } })
}

// No backend: flip the loaded record and say so in the toast. A reload puts the
// mock JSON back.
function toggle(row) {
  row.isEnabled = !row.isEnabled
  toast(
    `“${row.name}” ${row.isEnabled ? 'enabled' : 'paused'} — demo data, nothing was saved.`
  )
}

onMounted(load)
</script>
