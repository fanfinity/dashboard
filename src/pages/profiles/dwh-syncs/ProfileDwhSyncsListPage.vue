<template>
  <q-page class="p-6">
    <PageHeader
      title="Profile DWH syncs"
      subtitle="Scheduled writes of the resolved profile set into your data warehouses."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search syncs..." />
        <SfereIconButton
          icon="trash"
          label="Trash"
          :to="{ name: 'profile-dwh-syncs-trash' }"
        />
        <SfereIconButton
          icon="plus"
          label="New sync"
          variant="primary"
          :to="{ name: 'profile-dwh-syncs-new' }"
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
        label="Profiles written (last run)"
        :value="formatCount(profilesLastRun)"
        hint="Across every sync that has run."
      />
      <StatCard
        label="Failing"
        :value="formatCount(failingCount)"
        :hint="
          failingCount ? 'Last run ended in an error.' : 'All runs healthy.'
        "
      />
    </div>

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
        <p class="font-medium text-ink">{{ row.name }}</p>
        <code class="font-mono text-xs text-subtle">{{ row.targetTable }}</code>
      </template>

      <template #cell-dwhConnectionName="{ row }">
        <p class="text-muted">{{ row.dwhConnectionName }}</p>
        <p class="text-xs text-subtle">{{ writeModeLabel(row.writeMode) }}</p>
      </template>

      <template #cell-payload="{ row }">
        <p class="text-muted">{{ payloadLabel(row) }}</p>
      </template>

      <template #cell-schedule="{ row }">
        <p class="text-muted">{{ scheduleLabel(row.schedule) }}</p>
        <p class="text-xs text-subtle">Next: {{ formatDate(row.nextRunAt) }}</p>
      </template>

      <template #cell-lastRunAt="{ row }">
        <div class="flex items-center gap-2">
          <StatusBadge
            :tone="runStatusMeta(row.lastRunStatus).variant"
            :label="runStatusMeta(row.lastRunStatus).label"
          />
          <span class="text-xs text-subtle">{{
            formatDate(row.lastRunAt)
          }}</span>
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
            @click.stop="askToggle(row)"
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
          title="No profile DWH syncs yet"
          description="A sync writes the resolved profile set into a warehouse table on a schedule, so analysts query the same fans your campaigns target."
        >
          <template #cta>
            <button
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'profile-dwh-syncs-new' })"
            >
              Create your first sync
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ProfileDwhSyncDetailDialog v-model="showDetail" :sync="detailTarget" />

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
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ProfileDwhSyncDetailDialog from '@/components/profiles/dwh-syncs/ProfileDwhSyncDetailDialog.vue'
import {
  formatCount,
  formatDate,
  formatDateTime,
  runStatusMeta,
  scheduleLabel,
  useProfileDwhSyncs,
  useProfileDwhSyncToasts,
  writeModeLabel
} from '@/composables/useProfileDwhSyncs'

const router = useRouter()
const { toast } = useProfileDwhSyncToasts()
const {
  syncs,
  loading,
  error,
  load,
  setEnabled,
  remove: removeSync
} = useProfileDwhSyncs()

const query = ref('')
const tab = ref('all')
const showDetail = ref(false)
const detailTarget = ref(null)
const confirmDelete = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Sync', sortable: true },
  { key: 'dwhConnectionName', label: 'Warehouse', sortable: true },
  { key: 'payload', label: 'Writes' },
  { key: 'schedule', label: 'Schedule', sortable: true },
  { key: 'lastRunAt', label: 'Last run', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '190px' }
]

// Each tab is a predicate over a sync; 'all' has none.
const TAB_PREDICATES = {
  enabled: s => s.isEnabled,
  paused: s => !s.isEnabled,
  failing: s => s.lastRunStatus === 'failed'
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
    key: 'failing',
    label: 'Failing',
    count: syncs.value.filter(TAB_PREDICATES.failing).length
  }
])

const SEARCH_FIELDS = [
  'name',
  'id',
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

const failingCount = computed(
  () => syncs.value.filter(TAB_PREDICATES.failing).length
)

const profilesLastRun = computed(() =>
  syncs.value.reduce((sum, s) => sum + (Number(s.lastRunProfileCount) || 0), 0)
)

// The soonest scheduled run across every enabled sync, so the card says
// something more useful than a repeat of the count. ISO-8601 sorts
// lexicographically, so no date parsing is needed to find the earliest.
const nextRunHint = computed(() => {
  const next = syncs.value
    .map(s => s.nextRunAt)
    .filter(Boolean)
    .sort()[0]
  return next ? `Next run ${formatDateTime(next)}` : 'Nothing is scheduled.'
})

function payloadLabel(row) {
  const attributes = row.attributes?.length ?? 0
  const identifiers = row.identifierTypes?.length ?? 0
  const attributeWord = attributes === 1 ? 'attribute' : 'attributes'
  const identifierWord = identifiers === 1 ? 'identifier' : 'identifiers'
  return `${attributes} ${attributeWord} · ${identifiers} ${identifierWord}`
}

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

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
    ? `“${row.name}” stops writing to ${row.dwhConnectionName} — no scheduled run starts while it is paused. Rows it has already written are left alone.`
    : `“${row.name}” goes back on its schedule and writes to ${row.dwhConnectionName} on its next run.`
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

const deleteMessage = computed(() =>
  target.value
    ? `“${target.value.name}” stops writing to ${target.value.dwhConnectionName} and moves to the trash, where it can be restored for 30 days. Rows it has already written are left alone.`
    : ''
)

function remove() {
  const row = target.value
  if (!row) return
  removeSync(row.id)
  toast(`“${row.name}” moved to trash`)
  target.value = null
}

onMounted(load)
</script>
