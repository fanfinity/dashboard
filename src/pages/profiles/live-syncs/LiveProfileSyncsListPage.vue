<template>
  <q-page class="p-6">
    <PageHeader
      title="Live profile syncs"
      subtitle="Each sync pushes the resolved profiles in one audience to one destination, continuously, as they change."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search live syncs..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'live-profile-syncs-trash' })"
        >
          Trash
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'live-profile-syncs-new' })"
        >
          New live sync
        </button>
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
          <StatusBadge variant="neutral" :label="modeLabel(row.mode)" />
        </div>
        <p class="text-xs text-subtle">{{ row.id }}</p>
      </template>

      <template #cell-audienceName="{ row }">
        <p class="text-ink">{{ row.audienceName }}</p>
        <p class="text-xs text-subtle">Keyed on {{ row.identifierTypeName }}</p>
      </template>

      <template #cell-isEnabled="{ value }">
        <StatusBadge :enabled="value" :label="value ? 'Live' : 'Paused'" />
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

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move live sync to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
      destructive
      @confirm="remove"
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
// clickable — everything a row can do is a button in the actions column.
//
// Seven columns is the ceiling here: an eighth squeezed the actions cell until
// its two buttons wrapped onto separate lines, so the identifier the sync is
// keyed on rides under the audience name rather than taking a column of its own.
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
  { key: 'actions', label: '', align: 'right', width: '190px' }
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
  return `${paused} paused — configuration kept, nothing delivered`
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

function toggle(row) {
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
  target.value = null
}

onMounted(load)
</script>
