<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the toolbar and the table, so all
         three share a left AND a right edge. Same measure and the same
         reasoning as DashboardHomePage.vue: 1400px is deliberately wider than
         `--container-sfere-page` (80rem), which is the marketing-site measure
         and left ~40% of a wide monitor empty here, and it sits on the page
         rather than in MainLayout because the layout is shared with screens
         that want the whole width. Literal, not a token: Tailwind v4 extracts
         class names from source text. A plain block div — `flex` here would be
         one of Quasar's unlayered wrapping containers. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Sources"
        subtitle="Every event stream and cloud app feeding the fan graph."
      >
        <!-- Stream-only actions. On the Connectors tab a "New source" button would
             be pointing at the wrong flow — you pick a connector from the catalog
             itself — and its search box would compete with the catalog's own. -->
        <template v-if="view === 'streams'" #actions>
          <ToolbarSearch v-model="query" placeholder="Search sources..." />
          <SfereIconButton
            icon="plus"
            label="New source"
            variant="primary"
            :to="{ name: 'sources-new' }"
          />
        </template>
      </PageHeader>

      <!-- Underline tabs switch the page's primary content; the pill row below
           filters one list. That is exactly the split TabNav documents, and the two
           shapes are what stop a filter reading like a navigation change. -->
      <!-- Where this screen sits in first-run setup. One line only; the
           full tracker is on the Dashboard, deliberately in one place. -->
      <SetupReminderStrip
        step="source"
        :steps="setupSteps"
        :total="setupTotal"
        :complete="setupComplete"
        :unavailable="setupUnavailable"
      />

      <TabNav v-model="view" :tabs="viewTabs" />

      <ConnectorCatalog v-if="view === 'connectors'" />

      <!-- `sources` is passed in so a store can be joined to the source built from
           it: `ZidConnection` carries no source id and `Source` carries no
           connection id, only a matching `store_id`. -->
      <ZidConnectionsPanel v-else-if="view === 'zid'" :sources="sources" />

      <template v-else>
        <div class="mb-4">
          <TabNav v-model="tab" :tabs="tabs" variant="pill" />
        </div>

        <DataTable
          :columns="columns"
          :rows="visible"
          :loading="loading"
          :error="error"
          :api-missing="apiMissing"
          row-key="id"
          clickable-rows
          @retry="load"
          @row-click="open"
        >
          <!-- `sfere-flush` because this cell owns the spacing of its two
               lines. The name used to sit in an `items-center` flex row holding
               an "Upgrade to …" badge, and that row zeroed Quasar's unlayered
               `p { margin: 0 0 16px }` for free (collision #5); dropping the row
               with the badge would have pushed the slug 16px down instead. -->
          <template #cell-name="{ row }">
            <div class="sfere-flush">
              <p class="font-medium text-ink">{{ row.name }}</p>
              <p class="text-xs text-subtle">{{ row.slug }}</p>
            </div>
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

          <!-- `formatCount` already reads a missing value as an em dash, and it
               has to stay that way here: the backend's Source record carries no
               per-hour counter (it is a `sources.json` field), so a `?? 0` would
               report a measured zero for every live source. -->
          <template #cell-eventCountLastHour="{ value }">{{
            formatCount(value)
          }}</template>

          <!-- No wrapper element: the column is `align: 'right'`, so
               SfereTable's own `text-right` already pushes RowActionsMenu's
               inline-grid root to the cell's right edge — and a flex wrapper
               here would be one more of Quasar's unlayered wrapping `.flex`
               containers for nothing. The menu reports a choice and acts on
               nothing; both branches still open the confirms below. -->
          <template #cell-actions="{ row }">
            <RowActionsMenu
              :label="`Actions for ${row.name}`"
              :actions="rowActions(row)"
              @select="onRowAction(row, $event)"
            />
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

      <!-- Same verb and the same sentence as the detail screen's confirm: one
           action told two ways is how "Delete" and "Move to trash" ended up
           describing the same 204. -->
      <ConfirmDialog
        v-model="confirmDelete"
        :title="deleteTitle"
        :message="deleteMessage"
        confirm-label="Delete source"
        destructive
        @confirm="remove"
      />
      <ConfirmDialog
        v-model="confirmToggle"
        :title="toggleTitle"
        :message="toggleMessage"
        :confirm-label="toggleConfirmLabel"
        @confirm="toggle"
      />
    </div>
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
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import SetupReminderStrip from '@/components/shell/SetupReminderStrip.vue'
import { useSetupProgress } from '@/composables/useSetupProgress'
import ConnectorCatalog from '@/components/sources/ConnectorCatalog.vue'
import ZidConnectionsPanel from '@/components/sources/ZidConnectionsPanel.vue'
import {
  formatCount,
  sourceTypeLabel,
  useSources
} from '@/composables/useSources'
import { notifyMutationResult } from '@/composables/useMutationFeedback'

// The reminder strip needs the same three counts the Dashboard tracker
// derives. Read here rather than passed down: this page has no parent to
// pass it, and the reads are cached by the browser for the round trip.
const {
  steps: setupSteps,
  total: setupTotal,
  complete: setupComplete,
  unavailable: setupUnavailable,
  load: loadSetupProgress
} = useSetupProgress()

const router = useRouter()
const route = useRoute()
const $q = useQuasar()
const {
  sources,
  loading,
  error,
  apiMissing,
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
const VIEWS = ['streams', 'connectors', 'zid']

const view = ref(VIEWS.includes(route.query.tab) ? route.query.tab : 'streams')

const viewTabs = [
  { key: 'streams', label: 'Event streams' },
  { key: 'connectors', label: 'Connectors' },
  // Third view rather than a screen, same reasoning as Connectors: authorising a
  // Zid store is a step in adding a source, and both halves share this <h1>.
  { key: 'zid', label: 'Zid stores' }
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
  // No Pipes column: `pipeCount` is a sources.json invention with no field
  // behind it on the backend's `Source`, so on a real account the cell was
  // blank on every row — a header promising a count nobody measured.
  // 72px: SfereTable pads a cell `px-4` either side of a 36px kebab. The
  // 190px this held was measured for two text buttons, and keeping it would
  // spend the width this page just reclaimed on an empty gutter.
  { key: 'actions', label: '', align: 'right', width: '72px' }
]

// Each tab is a predicate over a source; 'all' has none.
const TAB_PREDICATES = {
  enabled: s => s.isEnabled,
  paused: s => !s.isEnabled
}

// There is no "Upgrade available" tab, and its badge is gone from the name cell
// with it. Both read `latestTemplateVersion`, which is a `sources.json` fixture
// field absent from the backend's Source schema — so in the default real mode
// the count was permanently 0 and selecting the tab filtered to an empty table.
// A control that can never do anything is worse than an absent one.
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

// Built per row rather than hoisted to a module constant: the first label
// depends on `row.isEnabled`. Each label is the word for word the matching
// ConfirmDialog's confirm button, so the menu item and the button that carries
// it out never describe the same action two ways.
function rowActions(row) {
  return [
    row.isEnabled
      ? { key: 'toggle', label: 'Pause source', icon: 'pause' }
      : { key: 'toggle', label: 'Enable source', icon: 'play' },
    {
      key: 'delete',
      label: 'Delete source',
      icon: 'trash',
      tone: 'destructive'
    }
  ]
}

// The menu never acts, so both branches land on the confirm the old row buttons
// opened — Pause included, which still asks in BOTH directions.
function onRowAction(row, key) {
  if (key === 'toggle') askToggle(row)
  else if (key === 'delete') ask(row)
}

const confirmToggle = ref(false)
const toggleTarget = ref(null)

// Pausing asks first, the same as it does on the detail screens: a row action
// carries no sentence of its own, so the dialog is where the consequence is
// written and where the record gets named. Not `destructive` — pausing is
// reversible, and a red button on a routine confirm teaches people to click
// through red buttons.
//
// Its own ref rather than sharing `target` with the delete flow: two dialogs
// reading one row is how a confirm ends up acting on the wrong record. The row
// is left in place after the confirm rather than nulled, so the message does
// not blank out while the dialog fades.
function askToggle(row) {
  toggleTarget.value = row
  confirmToggle.value = true
}

const toggleTitle = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause this source?' : 'Enable this source?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause source' : 'Enable source'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops collecting events straight away. Anything already delivered stays where it is, and you can enable it again at any time.`
    : `“${row.name}” starts collecting events again straight away.`
})

async function toggle() {
  const row = toggleTarget.value
  if (!row) return
  const wasEnabled = row.isEnabled
  const res = await setEnabled(row.id, !wasEnabled)
  notifyMutationResult($q, res, {
    success: `${row.name} ${wasEnabled ? 'paused' : 'enabled'}`,
    apiMissing: `Can't ${wasEnabled ? 'pause' : 'enable'} ${row.name} yet.`
  })
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

const deleteTitle = computed(() =>
  target.value ? `Delete “${target.value.name}”?` : 'Delete this source?'
)

// The closing sentence is interim, and it is the honest one: the backend's
// DELETE is a hard 204 with no soft delete, no trash listing and no restore, so
// "restorable for 30 days" was a promise nothing kept.
const deleteMessage = computed(() =>
  target.value
    ? `“${target.value.name}” stops collecting events straight away, and any pipe reading from it stops delivering. Events already written to a destination are untouched; they live in the warehouse, not here. Restoring from trash is not available yet, so this cannot be undone.`
    : ''
)

async function remove() {
  const row = target.value
  if (!row) return
  // `target` is deliberately NOT nulled: `deleteTitle` and `deleteMessage` both
  // read it, and this one awaits — so clearing it here blanked the dialog's
  // heading AND its sentence for the whole length of the request, not just for
  // the fade. `ask()` overwrites `target` before reopening, so nothing goes
  // stale.
  const res = await removeSource(row.id)
  notifyMutationResult($q, res, {
    success: `${row.name} deleted`,
    apiMissing: `Can't delete ${row.name} yet.`
  })
}

onMounted(() => {
  load()
  // Deliberately not awaited alongside `load()`: the strip is secondary, and a
  // slow setup read must not hold the table's first paint.
  loadSetupProgress()
})
</script>
