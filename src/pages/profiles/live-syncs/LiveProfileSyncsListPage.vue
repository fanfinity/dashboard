<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the toolbar and the table, so all three
         share a left AND a right edge. Same 1400px literal as DashboardHomePage
         — deliberately wider than `--container-sfere-page` (80rem, the
         marketing-site measure), which left ~40% of a wide monitor empty. On
         the page, not in MainLayout: that layout is shared with screens which
         want the full width. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Live profile syncs"
        subtitle="Each sync pushes the resolved profiles in one audience to one destination, continuously, as they change."
      >
        <template #actions>
          <ToolbarSearch v-model="query" placeholder="Search live syncs..." />
          <SfereIconButton
            icon="plus"
            label="New live sync"
            variant="primary"
            :to="{ name: 'live-profile-syncs-new' }"
          />
        </template>
      </PageHeader>

      <div
        v-if="!loading && !error && syncs.length"
        class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard label="Live syncs" :value="formatCount(syncs.length)" />
        <StatCard
          label="Enabled"
          :value="`${enabledCount} of ${syncs.length}`"
          :hint="pausedHint"
        />
        <StatCard
          label="Profiles delivered (last hour)"
          :value="formatCount(profilesLastHour)"
        />
        <StatCard
          label="Failures (last hour)"
          :value="formatCount(failuresLastHour)"
          :hint="failureHint"
        />
      </div>

      <TabNav v-model="tab" :tabs="tabs" />

      <DataTable
        :columns="columns"
        :rows="visible"
        :loading="loading"
        :error="error"
        row-key="id"
        @retry="load"
      >
        <template #cell-name="{ row }">
          <div class="flex items-center gap-2">
            <p class="font-medium text-ink">{{ row.name }}</p>
            <StatusBadge tone="neutral" :label="modeLabel(row.mode)" />
          </div>
          <p class="text-xs text-subtle">{{ row.id }}</p>
        </template>

        <template #cell-audienceName="{ row }">
          <p class="text-ink">{{ row.audienceName }}</p>
          <p class="text-xs text-subtle"
            >Keyed on {{ row.identifierTypeName }}</p
          >
        </template>

        <template #cell-isEnabled="{ value }">
          <StatusBadge
            :tone="value ? 'success' : 'neutral'"
            :label="value ? 'Live' : 'Paused'"
          />
        </template>

        <template #cell-profileCountLastHour="{ row }">
          <p>{{ formatCount(row.profileCountLastHour) }}</p>
          <p v-if="row.failureCountLastHour" class="text-xs text-rose-600">
            {{ formatCount(row.failureCountLastHour) }} failed
          </p>
        </template>

        <template #cell-lastDeliveryAt="{ value }">
          {{ formatDateTime(value) }}
        </template>

        <!-- No wrapper element: the column is `align: 'right'`, so SfereTable
             puts `text-right` on the cell and the trigger is inline-level,
             which is all the alignment it needs. A flex row here would be one
             more of Quasar's unlayered wrapping `.flex` (collision #4) earning
             nothing. The label names the ROW, not the action — ten identical
             "Actions" buttons give a screen-reader user no way to tell them
             apart. -->
        <template #cell-actions="{ row }">
          <RowActionsMenu
            :label="`Actions for ${row.name}`"
            :actions="actionsFor(row)"
            @select="key => onRowAction(row, key)"
          />
        </template>

        <!-- Two different "no rows" cases: nothing configured yet (offer the
             primary CTA) and nothing matching the filters (offer a way back). -->
        <template #empty>
          <EmptyState :title="emptyTitle" :description="emptyDescription">
            <template #cta>
              <button
                v-if="!syncs.length"
                class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
                @click="router.push({ name: 'live-profile-syncs-new' })"
              >
                Create your first live sync
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
    </div>

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move live sync to trash?"
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import {
  formatCount,
  formatDateTime,
  modeLabel,
  useLiveProfileSyncs,
  useLiveProfileSyncToasts
} from '@/composables/useLiveProfileSyncs'

const router = useRouter()
const { toast } = useLiveProfileSyncToasts()
const {
  syncs,
  loading,
  error,
  load,
  setEnabled,
  remove: removeSync
} = useLiveProfileSyncs()

const query = ref('')
const tab = ref('all')
const confirmDelete = ref(false)
const target = ref(null)

// No detail route exists for a live sync, so rows are deliberately not
// clickable — everything a row can do is in the row's actions menu.
//
// Seven columns is still the ceiling, though the reason has moved: the actions
// cell is one 36px trigger now and cannot wrap, but an eighth column would take
// its width off the ones carrying names. The identifier the sync is keyed on
// still rides under the audience name rather than taking a column of its own.
const columns = [
  { key: 'name', label: 'Live sync', sortable: true },
  { key: 'audienceName', label: 'Audience', sortable: true },
  { key: 'profileDestinationName', label: 'Destination', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  {
    key: 'profileCountLastHour',
    label: 'Profiles / hour',
    sortable: true,
    align: 'right'
  },
  {
    key: 'lastDeliveryAt',
    label: 'Last delivery',
    sortable: true,
    align: 'right'
  },
  { key: 'actions', label: '', align: 'right', width: '72px' }
]

// Each tab is a predicate over a sync; 'all' has none.
const TAB_PREDICATES = {
  live: s => s.isEnabled,
  paused: s => !s.isEnabled,
  failing: s => Number(s.failureCountLastHour) > 0
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: syncs.value.length },
  {
    key: 'live',
    label: 'Live',
    count: syncs.value.filter(TAB_PREDICATES.live).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: syncs.value.filter(TAB_PREDICATES.paused).length
  },
  {
    key: 'failing',
    label: 'Failing',
    count: syncs.value.filter(TAB_PREDICATES.failing).length
  }
])

const SEARCH_FIELDS = [
  'id',
  'name',
  'audienceName',
  'profileDestinationName',
  'identifierTypeName'
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
  () => syncs.value.filter(TAB_PREDICATES.live).length
)

const pausedHint = computed(() => {
  const paused = syncs.value.length - enabledCount.value
  if (!paused) return 'Every sync is delivering'
  return `${paused} paused. Configuration kept, nothing delivered.`
})

const profilesLastHour = computed(() =>
  syncs.value.reduce((sum, s) => sum + (Number(s.profileCountLastHour) || 0), 0)
)

const failuresLastHour = computed(() =>
  syncs.value.reduce((sum, s) => sum + (Number(s.failureCountLastHour) || 0), 0)
)

const failureHint = computed(() => {
  const failing = syncs.value.filter(TAB_PREDICATES.failing).length
  if (!failing) return 'All deliveries acknowledged'
  return `Across ${failing} sync${failing === 1 ? '' : 's'}`
})

const emptyTitle = computed(() =>
  syncs.value.length
    ? 'No live syncs match your filters'
    : 'No live profile syncs yet'
)

const emptyDescription = computed(() =>
  syncs.value.length
    ? 'Try a different search term, or switch back to the All tab.'
    : 'Point an audience at a destination to start delivering resolved profiles the moment they change.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

// A function, not a constant: the toggle's label flips with `isEnabled`, so a
// hoisted array would print "Pause" on a row that is already paused.
//
// The menu reports a choice and nothing else — every item still routes to the
// handler it always had, so both actions keep their own ConfirmDialog, their
// own target ref and their own per-screen sentence.
function actionsFor(row) {
  return [
    { key: 'toggle', label: row.isEnabled ? 'Pause' : 'Enable' },
    { key: 'delete', label: 'Delete', tone: 'destructive' }
  ]
}

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
  toggleTarget.value?.isEnabled ? 'Pause this sync?' : 'Enable this sync?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause sync' : 'Enable sync'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops delivering profiles to ${row.profileDestinationName} straight away. Profiles already delivered are left alone, and you can enable it again at any time.`
    : `“${row.name}” starts delivering profiles to ${row.profileDestinationName} again straight away.`
})

function toggle() {
  const row = toggleTarget.value
  if (!row) return
  setEnabled(row.id, !row.isEnabled)
  toast(`${row.name} ${row.isEnabled ? 'paused' : 'enabled'}`)
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

const deleteMessage = computed(() =>
  target.value
    ? `“${target.value.name}” stops delivering profiles to ${target.value.profileDestinationName} and moves to the trash, where it can be restored for 30 days.`
    : ''
)

function remove() {
  const row = target.value
  if (!row) return
  removeSync(row.id)
  toast(`${row.name} moved to trash`)
  // `target` is deliberately NOT nulled: `deleteMessage` reads it, so clearing it
  // here blanks the dialog's sentence out while the dialog is still fading. The
  // dialog's open state is its own ref, and `ask()` overwrites `target` before
  // reopening, so nothing goes stale.
}

onMounted(load)
</script>
