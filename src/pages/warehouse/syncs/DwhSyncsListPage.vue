<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the toolbar and the table, so all
         three share a left AND a right edge. Same measure and same string as
         DashboardHomePage's wrapper — 1400px, deliberately wider than
         `--container-sfere-page` (80rem), which left ~40% of a wide monitor
         empty. It sits on the page rather than in MainLayout because the layout
         is shared with screens that want the whole width, and the dialogs below
         stay outside it since q-dialog teleports anyway. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="DWH syncs"
        subtitle="Scheduled copies of collected events between your sources and your data warehouses."
      >
        <template #actions>
          <ToolbarSearch v-model="query" placeholder="Search syncs..." />
          <SfereIconButton
            icon="plus"
            label="New sync"
            variant="primary"
            :to="{ name: 'dwh-syncs-new' }"
          />
        </template>
      </PageHeader>

      <div
        v-if="!loading && !error && syncs.length"
        class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard label="Syncs" :value="formatCount(syncs.length)" />
        <StatCard
          label="Enabled"
          :value="`${enabledCount} of ${syncs.length}`"
          :hint="nextRunHint"
        />
        <StatCard
          label="Rows moved (last run)"
          :value="formatCount(rowsLastRun)"
          hint="Across every sync that has run."
        />
        <StatCard
          label="Needs attention"
          :value="formatCount(attentionCount)"
          :hint="
            attentionCount
              ? 'A last run failed or skipped rows.'
              : 'Every last run finished cleanly.'
          "
        />
      </div>

      <!-- A whole sentence does not fit a StatusBadge, and a warehouse that is
           down is not a load failure — so this is a notice, not an ErrorState. -->
      <NoticeBanner
        v-if="unhealthyCount"
        tone="warn"
        class="mb-4"
        title="Some of these cannot run right now"
        :message="unhealthyMessage"
      />

      <!-- The connection health check is secondary: if it fails, the list still
           loads and the check offers its own retry. -->
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

      <TabNav v-model="tab" :tabs="tabs" />

      <DataTable
        :columns="columns"
        :rows="visible"
        :loading="loading"
        :error="error"
        row-key="id"
        clickable-rows
        @retry="load"
        @row-click="inspect"
      >
        <template #cell-name="{ row }">
          <div class="flex items-center gap-2">
            <p class="font-medium text-ink">{{ row.name }}</p>
            <StatusBadge
              v-if="isUnhealthy(row)"
              tone="warn"
              label="Connection failing"
            />
          </div>
          <code class="font-mono text-xs text-subtle"
            >{{ row.sourceTable }} → {{ row.targetTable }}</code
          >
        </template>

        <template #cell-dwhConnectionName="{ row }">
          <p class="text-muted">{{ row.dwhConnectionName }}</p>
          <p class="text-xs text-subtle">{{ directionLabel(row.direction) }}</p>
        </template>

        <template #cell-schedule="{ row }">
          <p class="text-muted">{{ syncScheduleLabel(row) }}</p>
          <p class="text-xs text-subtle"
            >Next: {{ formatDate(row.nextRunAt, NOT_SET) }}</p
          >
        </template>

        <template #cell-lastRunAt="{ row }">
          <StatusBadge
            :tone="runStatusMeta(row.lastRunStatus).variant"
            :label="runStatusMeta(row.lastRunStatus).label"
          />
          <p class="mt-1 text-xs text-subtle"
            >{{ formatDate(row.lastRunAt, NEVER) }} ·
            {{ formatCount(row.lastRunRowCount) }} rows</p
          >
        </template>

        <template #cell-isEnabled="{ value }">
          <StatusBadge
            :tone="value ? 'success' : 'neutral'"
            :label="value ? 'Enabled' : 'Paused'"
          />
        </template>

        <!-- No flex wrapper: the column is `align: 'right'`, which SfereTable
             renders as `text-align: right` on the <td>, and RowActionsMenu's root
             is `inline-grid` — an inline-level box, so it lands on the right edge
             on its own. The rows are `clickable-rows`, and the two halves of the
             menu escape `inspect` differently: the trigger sits inside the <tr>
             and stops its own click, while an ITEM is not a descendant of the
             row at all — the panel is teleported to <body>. -->
        <template #cell-actions="{ row }">
          <RowActionsMenu
            :label="`Actions for ${row.name}`"
            :actions="rowActions(row)"
            @select="key => onRowAction(key, row)"
          />
        </template>

        <!-- Two different "no rows" cases: nothing configured yet (offer the
             primary CTA) and nothing matching the filters (offer a way back). -->
        <template #empty>
          <EmptyState
            v-if="syncs.length"
            title="No syncs match your filters"
            description="Try a different search term, or switch back to the All tab."
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
            title="No DWH syncs yet"
            description="A sync copies collected events into a warehouse table on a schedule, so analysts query the same events your pipes deliver."
          >
            <template #cta>
              <button
                class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
                @click="router.push({ name: 'dwh-syncs-new' })"
              >
                Create your first sync
              </button>
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </div>

    <DwhSyncDetailDialog
      v-model="showDetail"
      :sync="detailTarget"
      :connection="detailConnection"
    />

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move sync to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
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
  </q-page>
</template>

<script setup>
import { NEVER, NOT_SET } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import DwhSyncDetailDialog from '@/components/warehouse/syncs/DwhSyncDetailDialog.vue'
import {
  directionLabel,
  formatCount,
  formatDate,
  formatDateTime,
  isConnectionHealthy,
  needsAttention,
  runStatusMeta,
  syncScheduleLabel,
  useDwhSyncConnections,
  useDwhSyncs,
  useDwhSyncToasts
} from '@/composables/useDwhSyncs'

const router = useRouter()
const { toast } = useDwhSyncToasts()
const {
  syncs,
  loading,
  error,
  load,
  setEnabled,
  remove: removeSync
} = useDwhSyncs()
const {
  error: connectionsError,
  load: loadConnections,
  findById: findConnection
} = useDwhSyncConnections()

const query = ref('')
const tab = ref('all')
const showDetail = ref(false)
const detailTarget = ref(null)
const confirmDelete = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Sync', sortable: true },
  { key: 'dwhConnectionName', label: 'Warehouse', sortable: true },
  { key: 'schedule', label: 'Schedule', sortable: true },
  { key: 'lastRunAt', label: 'Last run', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  // Sized for one 36px kebab plus the cell's own px-4, not for the two text
  // buttons this replaced — a 190px column of whitespace is exactly what makes
  // the data columns feel cramped on a wide window.
  { key: 'actions', label: '', align: 'right', width: '76px' }
]

// Each tab is a predicate over a sync; 'all' has none.
const TAB_PREDICATES = {
  enabled: s => s.isEnabled,
  paused: s => !s.isEnabled,
  attention: needsAttention
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: syncs.value.length },
  {
    key: 'enabled',
    label: 'Enabled',
    count: syncs.value.filter(TAB_PREDICATES.enabled).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: syncs.value.filter(TAB_PREDICATES.paused).length
  },
  {
    key: 'attention',
    label: 'Needs attention',
    count: syncs.value.filter(TAB_PREDICATES.attention).length
  }
])

const SEARCH_FIELDS = [
  'name',
  'id',
  'sourceTable',
  'targetTable',
  'dwhConnectionName',
  'scheduleLabel'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return syncs.value.filter(s => {
    if (predicate && !predicate(s)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(s[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const enabledCount = computed(
  () => syncs.value.filter(TAB_PREDICATES.enabled).length
)

const attentionCount = computed(
  () => syncs.value.filter(TAB_PREDICATES.attention).length
)

const rowsLastRun = computed(() =>
  syncs.value.reduce((sum, s) => sum + (Number(s.lastRunRowCount) || 0), 0)
)

// The soonest scheduled run across every sync, so the card says something more
// useful than a repeat of the count. ISO-8601 sorts lexicographically, so no
// date parsing is needed to find the earliest.
const nextRunHint = computed(() => {
  const next = syncs.value
    .map(s => s.nextRunAt)
    .filter(Boolean)
    .sort()[0]
  return next ? `Next run ${formatDateTime(next)}` : 'Nothing is scheduled.'
})

// A connection that has not loaded (or no longer exists) cannot be judged, so
// it is not reported as failing — the check degrades to silence rather than to
// a false alarm.
function isUnhealthy(row) {
  const connection = findConnection(row.dwhConnectionId)
  return Boolean(connection) && !isConnectionHealthy(connection)
}

const unhealthyCount = computed(() => syncs.value.filter(isUnhealthy).length)

const unhealthyMessage = computed(() => {
  const n = unhealthyCount.value
  return `${n} sync${n === 1 ? '' : 's'} point at a warehouse connection that is refusing connections. They stay configured, but no run will succeed until the connection is repaired.`
})

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

const detailConnection = computed(() =>
  detailTarget.value ? findConnection(detailTarget.value.dwhConnectionId) : null
)

// There is no detail route for a sync — the manifest ships list, create and
// trash — so a row opens a read-only dialog instead of navigating.
function inspect(row) {
  detailTarget.value = row
  showDetail.value = true
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
  toggleTarget.value?.isEnabled ? 'Pause this sync?' : 'Enable this sync?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause sync' : 'Enable sync'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops copying events from ${row.sourceTable} into ${row.dwhConnectionName}, and no scheduled run starts while it is paused. Rows it has already written are left alone.`
    : `“${row.name}” goes back on its schedule and copies from ${row.sourceTable} into ${row.dwhConnectionName} on its next run.`
})

function toggle() {
  const row = toggleTarget.value
  if (!row) return
  setEnabled(row.id, !row.isEnabled)
  toast(`“${row.name}” ${row.isEnabled ? 'paused' : 'enabled'}`)
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

// The menu reports a key and does nothing else — both branches still open the
// screen's own ConfirmDialog, against its own target ref. The labels carry the
// noun ("Pause sync") because the trigger's aria-label names the ROW, so the
// item is the only place the verb's object appears.
function rowActions(row) {
  return [
    {
      key: 'toggle',
      label: row.isEnabled ? 'Pause sync' : 'Enable sync',
      icon: row.isEnabled ? 'pause' : 'play'
    },
    // "Move to trash", not "Delete": it has to say the same thing the confirm
    // it opens says, and that dialog is titled "Move sync to trash?".
    {
      key: 'delete',
      label: 'Move to trash',
      icon: 'trash',
      tone: 'destructive'
    }
  ]
}

function onRowAction(key, row) {
  if (key === 'toggle') askToggle(row)
  else if (key === 'delete') ask(row)
}

const deleteMessage = computed(() =>
  target.value
    ? `“${target.value.name}” stops copying events between ${target.value.sourceTable} and ${target.value.dwhConnectionName}, and moves to the trash where it can be restored for 30 days. Rows it has already written are left alone.`
    : ''
)

function remove() {
  const row = target.value
  if (!row) return
  removeSync(row.id)
  toast(`“${row.name}” moved to trash`)
  // `target` is deliberately NOT nulled: `deleteMessage` reads it, so clearing it
  // here blanks the dialog's sentence out while the dialog is still fading. The
  // dialog's open state is its own ref, and `ask()` overwrites `target` before
  // reopening, so nothing goes stale.
}

onMounted(() => {
  load()
  loadConnections()
})
</script>
