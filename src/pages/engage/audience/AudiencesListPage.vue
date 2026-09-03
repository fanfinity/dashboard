<template>
  <!-- 1400px cap, centred: the header, the toolbar and the table have to share
       a right edge or the screen reads as three unrelated bands, and an
       uncapped table stretches its columns into unreadable runs on a wide
       monitor. No important suffix needed here — Quasar ships `.q-mx-auto`,
       not `.mx-auto`, and no `max-w-*` rule at all. -->
  <q-page class="mx-auto w-full max-w-[1400px] p-6">
    <PageHeader
      title="Audiences"
      subtitle="Saved segments of resolved fans. Journeys enter from one, goals are measured over one, and live syncs push one to a destination."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search audiences..." />
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && audiences.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        label="Audiences"
        :value="formatCount(audiences.length)"
        :hint="typeHint"
      />
      <StatCard
        label="Fans in an audience"
        :value="formatCount(totalProfiles)"
        :delta="formatChange(totalChange)"
        :direction="trendDirection(totalChange)"
        hint="Counted once per audience. A fan can be in several."
      />
      <StatCard
        label="Feeding a destination"
        :value="`${activatedCount} of ${audiences.length}`"
        :hint="activationHint"
      />
      <StatCard
        label="Paused"
        :value="formatCount(pausedCount)"
        :hint="pausedHint"
      />
    </div>

    <!-- Secondary catalogs. Their failure degrades the detail dialog, so it is a
         notice with its own retry rather than a page-level ErrorState. -->
    <NoticeBanner
      v-if="secondaryError"
      tone="warn"
      class="mb-4"
      title="Some audience details are unavailable"
      :message="secondaryError"
    >
      <button
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="loadSecondary"
      >
        Retry
      </button>
    </NoticeBanner>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="isTrashTab ? trashLoading : loading"
      :error="isTrashTab ? trashError : error"
      row-key="id"
      :clickable-rows="!isTrashTab"
      @retry="retry"
      @row-click="inspect"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
      </template>

      <template #cell-type="{ value }">
        <StatusBadge tone="neutral" :label="audienceTypeLabel(value)" />
      </template>

      <template #cell-isEnabled="{ value }">
        <StatusBadge
          :tone="value ? 'success' : 'neutral'"
          :label="value ? 'Active' : 'Paused'"
        />
      </template>

      <template #cell-profileCount="{ row }">
        <p>{{ formatCount(row.profileCount) }}</p>
        <p
          v-if="formatChange(row.profileCountChange7d)"
          class="text-xs"
          :class="changeClass(row.profileCountChange7d)"
          >{{ changeArrow(row.profileCountChange7d) }}
          {{ formatChange(row.profileCountChange7d) }} / 7d</p
        >
      </template>

      <template #cell-destinationCount="{ value }">
        <span :class="value ? '' : 'text-subtle'">{{
          formatCount(value)
        }}</span>
      </template>

      <template #cell-lastEvaluatedAt="{ value }">
        {{ formatDateTime(value) }}
      </template>

      <template #cell-deletedAt="{ row }">
        <p>{{ formatDateTime(row.deletedAt) }}</p>
        <p class="text-xs text-subtle"
          >by {{ row.deletedByName ?? NOT_KNOWN }}</p
        >
      </template>

      <!-- The trash tab keeps its labelled button: one action behind a kebab
           costs a click and shows no verb, so the glyph is all the reader
           gets. No wrapper on the menu — SfereTable puts `text-align: right`
           on a right-aligned cell and the trigger's root is inline-level, so
           it lands on the right edge on its own. -->
      <template #cell-actions="{ row }">
        <button
          v-if="isTrashTab"
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click.stop="restore(row)"
        >
          Restore
        </button>
        <RowActionsMenu
          v-else
          :label="`Actions for ${row.name}`"
          :actions="rowActions(row)"
          @select="key => onRowAction(key, row)"
        />
      </template>

      <!-- Three "no rows" cases: the filters emptied the tab (offer a way
           back), the trash is empty (the good outcome), or there are no
           audiences at all. The manifest has no create route for an audience,
           so the last one points at the attributes they are built from. -->
      <template #empty>
        <EmptyState
          v-if="tabHasRecords"
          :title="`No ${emptyNoun} match your filters`"
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
          v-else-if="isTrashTab"
          title="Nothing in the trash"
          description="Deleted audiences are kept here for 30 days before they are purged."
        >
          <template #cta>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="clearFilters"
            >
              Back to all audiences
            </button>
          </template>
        </EmptyState>

        <EmptyState
          v-else
          title="No audiences yet"
          description="An audience is a set of conditions over fan attributes. Everyone who matches is a member, and stays one only while they match."
        >
          <template #cta>
            <button
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'attributes' })"
            >
              Browse attributes
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <AudienceDetailDialog
      v-model="showDetail"
      :audience="detailTarget"
      :attributes-by-id="attributesById"
      :live-syncs="liveSyncs"
    />

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move audience to trash?"
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
import { NOT_KNOWN } from '@/lib/emptyValue'
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
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import AudienceDetailDialog from '@/components/engage/audience/AudienceDetailDialog.vue'
import {
  audienceTypeLabel,
  useEngageAudienceAttributes,
  useEngageAudienceLiveSyncs,
  useEngageAudiences,
  useEngageAudienceTrash
} from '@/composables/useEngageAudiences'
import {
  formatChange,
  formatCount,
  formatDateTime,
  pluralize,
  trendDirection,
  useEngageAudienceToasts
} from '@/composables/useEngageAudienceFormat'

const router = useRouter()
const { toast } = useEngageAudienceToasts()

const {
  audiences,
  loading,
  error,
  load,
  setEnabled,
  remove: removeAudience,
  restore: restoreAudience
} = useEngageAudiences()

// Secondary: the dialog reads condition names out of the attribute catalog and
// destination names out of the live syncs. Neither blocks the list.
const {
  attributes,
  error: attributesError,
  load: loadAttributes
} = useEngageAudienceAttributes()

const {
  liveSyncs,
  error: liveSyncsError,
  load: loadLiveSyncs
} = useEngageAudienceLiveSyncs()

// Also secondary, except on the Trash tab where it is the primary — /audiences
// has no trash route of its own, so deleted audiences live on this screen.
const {
  deleted,
  loading: trashLoading,
  error: trashError,
  load: loadTrash,
  trash,
  restore: restoreFromTrash
} = useEngageAudienceTrash()

const query = ref('')
const tab = ref('all')
const showDetail = ref(false)
const detailTarget = ref(null)
const confirmDelete = ref(false)
const target = ref(null)

const isTrashTab = computed(() => tab.value === 'deleted')

// Six columns plus actions for a live audience. The trash shows who deleted it
// and when instead of the activation and evaluation columns, which no longer
// say anything true about a record nobody is reading.
const LIVE_COLUMNS = [
  { key: 'name', label: 'Audience', sortable: true },
  { key: 'type', label: 'Evaluation', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'profileCount', label: 'Fans', sortable: true, align: 'right' },
  {
    key: 'destinationCount',
    label: 'Destinations',
    sortable: true,
    align: 'right'
  },
  {
    key: 'lastEvaluatedAt',
    label: 'Last evaluated',
    sortable: true,
    align: 'right'
  },
  // 72px: a 36px kebab plus the cell's own px-4. The column used to be 220 to
  // hold two text buttons side by side without wrapping; sized for the old
  // markup it would now be ~150px of empty cell on every row.
  { key: 'actions', label: '', align: 'right', width: '72px' }
]

const TRASH_COLUMNS = [
  { key: 'name', label: 'Audience', sortable: true },
  { key: 'type', label: 'Evaluation', sortable: true },
  {
    key: 'profileCount',
    label: 'Fans at deletion',
    sortable: true,
    align: 'right'
  },
  { key: 'deletedAt', label: 'Deleted', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '120px' }
]

const columns = computed(() =>
  isTrashTab.value ? TRASH_COLUMNS : LIVE_COLUMNS
)

// Each tab is a predicate over an audience; 'all' has none, and 'deleted' swaps
// the row source rather than filtering it.
const TAB_PREDICATES = {
  realtime: a => a.type === 'realtime',
  warehouse: a => a.type === 'warehouse',
  paused: a => !a.isEnabled
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: audiences.value.length },
  {
    key: 'realtime',
    label: 'Real-time',
    count: audiences.value.filter(TAB_PREDICATES.realtime).length
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    count: audiences.value.filter(TAB_PREDICATES.warehouse).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: audiences.value.filter(TAB_PREDICATES.paused).length
  },
  { key: 'deleted', label: 'Trash', count: deleted.value.length }
])

const SEARCH_FIELDS = ['id', 'name', 'description']

const rows = computed(() =>
  isTrashTab.value ? deleted.value : audiences.value
)

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = isTrashTab.value ? null : TAB_PREDICATES[tab.value]
  return rows.value.filter(a => {
    if (predicate && !predicate(a)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(a[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

// Which empty state applies: the tab's source has records (so the filters are
// what emptied it) or it genuinely has none.
const tabHasRecords = computed(() => rows.value.length > 0)

const emptyNoun = computed(() =>
  isTrashTab.value ? 'deleted audiences' : 'audiences'
)

const attributesById = computed(() =>
  Object.fromEntries(attributes.value.map(a => [a.id, a]))
)

const secondaryError = computed(() => {
  const failed = []
  if (attributesError.value) failed.push('the attribute catalog')
  if (liveSyncsError.value) failed.push('the live profile syncs')
  if (!failed.length) return ''
  return `Conditions and destinations may be incomplete. ${failed.join(' and ')} could not be loaded.`
})

function loadSecondary() {
  loadAttributes()
  loadLiveSyncs()
}

function retry() {
  if (isTrashTab.value) loadTrash()
  else load()
}

const typeHint = computed(() => {
  const realtime = audiences.value.filter(TAB_PREDICATES.realtime).length
  const warehouse = audiences.value.filter(TAB_PREDICATES.warehouse).length
  return `${realtime} real-time · ${warehouse} warehouse`
})

const totalProfiles = computed(() =>
  audiences.value.reduce((sum, a) => sum + (Number(a.profileCount) || 0), 0)
)

// The membership figures are absolute and their movements are ratios, so the
// headline trend is re-derived from last week's implied totals rather than
// averaged: a 31% swing on 412 fans must not outweigh 0.8% on 128,440.
const totalChange = computed(() => {
  const previous = audiences.value.reduce((sum, a) => {
    const count = Number(a.profileCount) || 0
    const change = Number(a.profileCountChange7d) || 0
    return sum + count / (1 + change)
  }, 0)
  if (!previous) return 0
  return (totalProfiles.value - previous) / previous
})

const activatedCount = computed(
  () => audiences.value.filter(a => Number(a.destinationCount) > 0).length
)

const activationHint = computed(() => {
  if (liveSyncsError.value) return 'Live sync count unavailable.'
  if (!liveSyncs.value.length) return 'No live profile syncs configured yet.'
  return `${pluralize(liveSyncs.value.length, 'live profile sync')} configured`
})

const pausedCount = computed(
  () => audiences.value.filter(TAB_PREDICATES.paused).length
)

const pausedHint = computed(() =>
  pausedCount.value
    ? 'A paused audience stops re-evaluating; its membership freezes.'
    : 'Every audience is re-evaluating.'
)

const CHANGE = {
  up: { arrow: '↑', cls: 'text-success' },
  down: { arrow: '↓', cls: 'text-rose-600' },
  flat: { arrow: '→', cls: 'text-muted' }
}

function changeArrow(ratio) {
  return CHANGE[trendDirection(ratio)].arrow
}

function changeClass(ratio) {
  return CHANGE[trendDirection(ratio)].cls
}

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function inspect(row) {
  detailTarget.value = row
  showDetail.value = true
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
  toggleTarget.value?.isEnabled
    ? 'Pause this audience?'
    : 'Activate this audience?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause audience' : 'Activate audience'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops being re-evaluated, so the ${pluralize(row.destinationCount ?? 0, 'destination')} and ${pluralize(row.goalCount ?? 0, 'goal')} reading it keep its ${formatCount(row.profileCount)} profiles as they stand until you activate it again.`
    : `“${row.name}” starts being re-evaluated again, and what reads it follows the profiles moving in and out.`
})

function toggle() {
  const row = toggleTarget.value
  if (!row) return
  setEnabled(row.id, !row.isEnabled)
  toast(`${row.name} ${row.isEnabled ? 'paused' : 'activated'}`)
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

// Icons here because BOTH items have a glyph in sfereIcons.js. That rule is
// per-menu, not per-app: RowActionsMenu lays an item out as
// `flex items-center gap-2`, so a single icon-less entry starts its label a
// glyph's width left of its neighbour's. Email campaigns and Catalogs each
// hold an action with no glyph, so those two menus go icon-less instead.
function rowActions(row) {
  return [
    {
      key: 'toggle',
      label: row.isEnabled ? 'Pause' : 'Enable',
      icon: row.isEnabled ? 'pause' : 'play'
    },
    { key: 'delete', label: 'Delete', icon: 'trash', tone: 'destructive' }
  ]
}

// The menu reports a key and nothing else — the confirm dialogs, and the two
// separate target refs behind them, stay on the page.
function onRowAction(key, row) {
  if (key === 'toggle') askToggle(row)
  else ask(row)
}

const deleteMessage = computed(() => {
  const a = target.value
  if (!a) return ''
  const readers = `${pluralize(a.destinationCount ?? 0, 'destination')} and ${pluralize(a.goalCount ?? 0, 'goal')}`
  return `“${a.name}” stops being evaluated and moves to the trash, where it can be restored for 30 days. ${readers} read it today.`
})

function remove() {
  const row = target.value
  if (!row) return
  const record = removeAudience(row.id)
  if (record) trash(record)
  toast(`${row.name} moved to trash`)
  // `target` is deliberately NOT nulled: `deleteMessage` reads it, so clearing
  // it here blanks the dialog's sentence out while the dialog is still fading.
}

function restore(row) {
  const record = restoreFromTrash(row.id)
  if (!record) return
  restoreAudience(record)
  toast(`${row.name} restored`)
}

onMounted(() => {
  load()
  loadTrash()
  loadSecondary()
})
</script>
