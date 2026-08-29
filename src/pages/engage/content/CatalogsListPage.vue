<template>
  <q-page class="p-6">
    <PageHeader
      title="Catalogs"
      subtitle="Product and content tables synced from your warehouse, so a message can name the exact item a fan cares about."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search catalogs..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="create"
        >
          New catalog
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && catalogs.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard label="Catalogs" :value="formatCount(catalogs.length)" />
      <StatCard
        label="Enabled"
        :value="`${enabledCount} of ${catalogs.length}`"
      />
      <StatCard
        label="Rows indexed"
        :value="formatCount(totalRows)"
        hint="Across every enabled catalog"
      />
      <StatCard
        label="Needs attention"
        :value="formatCount(attention.length)"
        :hint="attention.length ? 'Failed sync or unhealthy connection' : ''"
      />
    </div>

    <NoticeBanner
      v-if="attention.length"
      class="mb-5"
      tone="warn"
      :title="attentionTitle"
      :message="attentionMessage"
    />

    <!-- Connection health is a secondary read: the catalogs still list without
         it, so its failure degrades the Source column instead of the page. -->
    <NoticeBanner
      v-if="connectionsError"
      class="mb-5"
      tone="info"
      title="Connection health is unavailable"
      :message="connectionsError"
    >
      <button
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="loadConnections"
      >
        Retry
      </button>
    </NoticeBanner>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      clickable-rows
      @retry="load"
      @row-click="openDetails"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">{{ row.description || row.id }}</p>
      </template>

      <template #cell-sourceLabel="{ row }">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-ink">{{ row.sourceLabel }}</span>
          <StatusBadge
            v-if="row.connectionStatus === 'error'"
            tone="danger"
            label="Connection failed"
          />
        </div>
        <p v-if="row.sourceTable" class="text-xs text-subtle">{{
          row.sourceTable
        }}</p>
      </template>

      <template #cell-itemCount="{ value }">
        {{ formatCount(value) }}
      </template>

      <template #cell-fieldCount="{ value }">
        {{ formatCount(value) }}
      </template>

      <template #cell-lastSyncedAt="{ row, value }">
        <div class="flex items-center justify-end gap-2">
          <span>{{ formatDate(value) }}</span>
          <StatusBadge
            :tone="syncStatusMeta(row.lastSyncStatus).variant"
            :label="syncStatusMeta(row.lastSyncStatus).label"
          />
        </div>
      </template>

      <template #cell-isEnabled="{ value }">
        <StatusBadge
          :tone="value ? 'success' : 'neutral'"
          :label="value ? 'Enabled' : 'Paused'"
        />
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="sync(row)"
          >
            Sync now
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="askToggle(row)"
          >
            {{ row.isEnabled ? 'Pause' : 'Enable' }}
          </button>
        </div>
      </template>

      <template #empty>
        <EmptyState :title="emptyTitle" :description="emptyDescription">
          <template #cta>
            <button
              v-if="filtered"
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="clearFilters"
            >
              Clear filters
            </button>
            <button
              v-else
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="create"
            >
              Create your first catalog
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <CatalogDetailsDialog
      v-model="detailsOpen"
      :catalog="selected"
      :connection="selectedConnection"
    />
    <ConfirmDialog
      v-model="confirmToggle"
      :title="toggleTitle"
      :message="toggleMessage"
      :confirm-label="toggleConfirmLabel"
      @confirm="toggle"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import CatalogDetailsDialog from '@/components/engage/content/CatalogDetailsDialog.vue'
import {
  catalogSourceLabel,
  formatCount,
  formatDate,
  syncStatusMeta,
  useEngageCatalogConnections,
  useEngageCatalogs,
  useEngageContentToasts
} from '@/composables/useEngageContent'

// Catalogs are rows of numbers — row count, field count, last sync — so this is
// a table. The asset library, one screen over, is a card grid for the same
// reason in reverse.
const { toast } = useEngageContentToasts()
const { catalogs, loading, error, load, setEnabled } = useEngageCatalogs()
const {
  error: connectionsError,
  load: loadConnections,
  findById: findConnection
} = useEngageCatalogConnections()

const query = ref('')
const tab = ref('all')
const selected = ref(null)
const detailsOpen = ref(false)

// A catalog's health is two things joined: its own last sync, and whether the
// connection underneath it is still up. Resolving both here keeps them out of
// the template and gives DataTable real keys to sort on.
const rows = computed(() =>
  catalogs.value.map(c => {
    const connection = findConnection(c.dwhConnectionId)
    const sourceLabel = c.dwhConnectionName || catalogSourceLabel(c.sourceType)
    return {
      ...c,
      sourceLabel,
      connectionStatus: connection?.status ?? null,
      needsAttention:
        c.lastSyncStatus === 'failed' || connection?.status === 'error'
    }
  })
)

const enabledCount = computed(() => rows.value.filter(r => r.isEnabled).length)

const totalRows = computed(() =>
  rows.value
    .filter(r => r.isEnabled)
    .reduce((sum, r) => sum + Number(r.itemCount ?? 0), 0)
)

const attention = computed(() => rows.value.filter(r => r.needsAttention))

const attentionTitle = computed(() =>
  attention.value.length === 1
    ? '1 catalog needs attention'
    : `${attention.value.length} catalogs need attention`
)

const attentionMessage = computed(() =>
  attention.value
    .map(
      r =>
        `${r.name}: ${r.lastSyncMessage || 'the warehouse connection is down'}`
    )
    .join(' · ')
)

const TAB_PREDICATES = {
  enabled: r => r.isEnabled,
  paused: r => !r.isEnabled,
  attention: r => r.needsAttention
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: rows.value.length },
  {
    key: 'enabled',
    label: 'Enabled',
    count: rows.value.filter(TAB_PREDICATES.enabled).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: rows.value.filter(TAB_PREDICATES.paused).length
  },
  {
    key: 'attention',
    label: 'Needs attention',
    count: attention.value.length
  }
])

const columns = [
  { key: 'name', label: 'Catalog', sortable: true },
  { key: 'sourceLabel', label: 'Source', sortable: true },
  { key: 'itemCount', label: 'Rows', sortable: true, align: 'right' },
  { key: 'fieldCount', label: 'Fields', sortable: true, align: 'right' },
  {
    key: 'lastSyncedAt',
    label: 'Last sync',
    sortable: true,
    align: 'right'
  },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '210px' }
]

const SEARCH_FIELDS = [
  'name',
  'description',
  'sourceLabel',
  'sourceTable',
  'primaryKeyColumn'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return rows.value.filter(r => {
    if (predicate && !predicate(r)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(r[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const filtered = computed(
  () => Boolean(query.value.trim()) || tab.value !== 'all'
)

const emptyTitle = computed(() =>
  filtered.value ? 'No catalogs match your filters' : 'No catalogs yet'
)

const emptyDescription = computed(() =>
  filtered.value
    ? 'Try a different search term, or switch back to the All tab.'
    : 'Point a catalog at a warehouse table to personalise messages with products, fixtures or offers.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

const selectedConnection = computed(() =>
  selected.value ? findConnection(selected.value.dwhConnectionId) : null
)

function openDetails(row) {
  selected.value = row
  detailsOpen.value = true
}

function create() {
  toast(
    'Creating a catalog needs a warehouse connection this preview cannot make.'
  )
}

function sync(row) {
  toast(`Sync requested for “${row.name}” — no sync ran.`)
}

const confirmToggle = ref(false)
const toggleTarget = ref(null)

// Pausing asks first, the same as it does on every other list screen and on the
// detail screens: a row action carries no sentence of its own, so the dialog is
// where the consequence is written and where the record gets named. Not
// `destructive` — pausing is reversible. Its own ref rather than sharing the
// delete flow's `target`, and the row is left in place after the confirm so the
// message does not blank out while the dialog fades.
function askToggle(row) {
  toggleTarget.value = row
  confirmToggle.value = true
}

const toggleTitle = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause this catalog?' : 'Enable this catalog?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause catalog' : 'Enable catalog'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops syncing from ${row.sourceTable} in ${row.dwhConnectionName}. Messages naming an item keep the ${formatCount(row.itemCount)} items it holds now until you enable it again.`
    : `“${row.name}” starts syncing from ${row.sourceTable} in ${row.dwhConnectionName} again on its next run.`
})

function toggle() {
  const row = toggleTarget.value
  if (!row) return
  setEnabled(row.id, !row.isEnabled)
  toast(`“${row.name}” ${row.isEnabled ? 'paused' : 'enabled'}`)
}

onMounted(() => {
  load()
  loadConnections()
})
</script>
