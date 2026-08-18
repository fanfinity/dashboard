<template>
  <q-page class="p-6">
    <PageHeader
      title="Sources"
      subtitle="Every event stream and cloud app feeding the fan graph."
    >
      <!-- Stream-only actions. On the Connectors tab a "New source" button would
           be pointing at the wrong flow — you pick a connector from the catalog
           itself — and its search box would compete with the catalog's own. -->
      <template v-if="view === 'streams'" #actions>
        <ToolbarSearch v-model="query" placeholder="Search sources..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'sources-trash' })"
        >
          Trash
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'sources-new' })"
        >
          New source
        </button>
      </template>
    </PageHeader>

    <!-- Underline tabs switch the page's primary content; the pill row below
         filters one list. That is exactly the split TabNav documents, and the two
         shapes are what stop a filter reading like a navigation change. -->
    <TabNav v-model="view" :tabs="viewTabs" />

    <ConnectorCatalog v-if="view === 'connectors'" />

    <template v-else>
      <div class="mb-4">
        <TabNav v-model="tab" :tabs="tabs" variant="pill" />
      </div>

      <DataTable
        :columns="columns"
        :rows="visible"
        :loading="loading"
        :error="error"
        row-key="id"
        clickable-rows
        @retry="load"
        @row-click="open"
      >
        <template #cell-name="{ row }">
          <div class="flex items-center gap-2">
            <p class="font-medium text-ink">{{ row.name }}</p>
            <StatusBadge
              v-if="hasUpgrade(row)"
              tone="warn"
              :label="`Upgrade to ${row.latestTemplateVersion}`"
            />
          </div>
          <p class="text-xs text-subtle">{{ row.slug }}</p>
        </template>

        <template #cell-sourceType="{ value }">
          <StatusBadge tone="neutral" :label="sourceTypeLabel(value)" />
        </template>

        <template #cell-isEnabled="{ value }">
          <StatusBadge
            :tone="value ? 'success' : 'neutral'"
            :label="value ? 'Enabled' : 'Paused'"
          />
        </template>

        <template #cell-eventCountLastHour="{ value }">
          {{ formatCount(value) }}
        </template>

        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end gap-2">
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click.stop="toggle(row)"
            >
              {{ row.isEnabled ? 'Pause' : 'Enable' }}
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
              @click.stop="ask(row)"
            >
              Delete
            </button>
          </div>
        </template>

        <!-- Two different "no rows" cases: nothing configured yet (offer the
             primary CTA) and nothing matching the filters (offer a way back). -->
        <template #empty>
          <EmptyState :title="emptyTitle" :description="emptyDescription">
            <template #cta>
              <button
                v-if="!sources.length"
                class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
                @click="router.push({ name: 'sources-new' })"
              >
                Connect your first source
              </button>
              <button
                v-else
                class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
                @click="clearFilters"
              >
                Clear filters
              </button>
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </template>

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move source to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ConnectorCatalog from '@/components/sources/ConnectorCatalog.vue'
import { useTemplates } from '@/composables/useTemplates'
import {
  formatCount,
  sourceTypeLabel,
  useSources
} from '@/composables/useSources'

const router = useRouter()
const route = useRoute()
const $q = useQuasar()
const { hasUpgrade } = useTemplates()
const {
  sources,
  loading,
  error,
  load,
  setEnabled,
  remove: removeSource
} = useSources()

const query = ref('')
const tab = ref('all')
const confirmDelete = ref(false)
const target = ref(null)

// Which half of the page you are looking at, held in ?tab= so the Connectors
// catalog is linkable and survives a reload. It is a query rather than a child
// route because both halves are the same screen with the same <h1> — a route
// would put "Connectors" back in the sidebar, which is what this change undid.
const VIEWS = ['streams', 'connectors']

const view = ref(VIEWS.includes(route.query.tab) ? route.query.tab : 'streams')

const viewTabs = [
  { key: 'streams', label: 'Event streams' },
  { key: 'connectors', label: 'Connectors' }
]

// `replace` so flipping tabs does not stack history entries the back button then
// has to chew through. The default view writes no query at all, keeping /sources
// clean as the canonical URL.
watch(view, next => {
  const tabQuery = next === 'streams' ? undefined : next
  if (route.query.tab === tabQuery) return
  router.replace({ query: { ...route.query, tab: tabQuery } })
})

// Someone editing the URL, or arriving via the /connectors redirect, moves the
// tabs rather than being ignored.
watch(
  () => route.query.tab,
  next => {
    view.value = VIEWS.includes(next) ? next : 'streams'
  }
)

const columns = [
  { key: 'name', label: 'Source', sortable: true },
  { key: 'sourceType', label: 'Type', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  {
    key: 'eventCountLastHour',
    label: 'Events / hour',
    sortable: true,
    align: 'right'
  },
  { key: 'pipeCount', label: 'Pipes', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '190px' }
]

// Each tab is a predicate over a source; 'all' has none.
const TAB_PREDICATES = {
  enabled: s => s.isEnabled,
  paused: s => !s.isEnabled,
  upgrade: s => hasUpgrade(s)
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: sources.value.length },
  {
    key: 'enabled',
    label: 'Enabled',
    count: sources.value.filter(TAB_PREDICATES.enabled).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: sources.value.filter(TAB_PREDICATES.paused).length
  },
  {
    key: 'upgrade',
    label: 'Upgrade available',
    count: sources.value.filter(TAB_PREDICATES.upgrade).length
  }
])

const SEARCH_FIELDS = ['name', 'slug', 'description', 'templateId']

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return sources.value.filter(s => {
    if (predicate && !predicate(s)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(s[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const emptyTitle = computed(() =>
  sources.value.length ? 'No sources match your filters' : 'No sources yet'
)

const emptyDescription = computed(() =>
  sources.value.length
    ? 'Try a different search term, or switch back to the All tab.'
    : 'Connect a website, an app or a ticketing system to start collecting fan events.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function open(row) {
  router.push({ name: 'sources-detail', params: { id: row.id } })
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

function toggle(row) {
  setEnabled(row.id, !row.isEnabled)
  notifyLocal(`${row.name} ${row.isEnabled ? 'paused' : 'enabled'}`)
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

const deleteMessage = computed(() =>
  target.value
    ? `“${target.value.name}” stops collecting events and moves to the trash, where it can be restored for 30 days.`
    : ''
)

function remove() {
  const row = target.value
  if (!row) return
  removeSource(row.id)
  notifyLocal(`${row.name} moved to trash`)
  target.value = null
}

onMounted(load)
</script>
