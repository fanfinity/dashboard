<template>
  <q-page class="p-6">
    <PageHeader
      title="Destinations"
      subtitle="Where routed events are delivered: warehouses, ad platforms and webhooks."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search destinations..." />
        <SfereIconButton
          icon="trash"
          label="Trash"
          :to="{ name: 'destinations-trash' }"
        />
        <SfereIconButton
          icon="plus"
          label="New destination"
          variant="primary"
          :to="{ name: 'destinations-new' }"
        />
      </template>
    </PageHeader>

    <!-- Where this screen sits in first-run setup. One line only; the
         full tracker is on the Dashboard, deliberately in one place. -->
    <SetupReminderStrip
      step="destination"
      :steps="setupSteps"
      :total="setupTotal"
      :complete="setupComplete"
      :unavailable="setupUnavailable"
    />

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="filtered"
      :loading="loading"
      :error="error"
      :api-missing="apiMissing"
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
        <StatusBadge
          :tone="value ? 'success' : 'neutral'"
          :label="value ? 'Enabled' : 'Paused'"
        />
      </template>

      <template #cell-pipeCount="{ value }">{{ formatCount(value) }}</template>

      <template #cell-deliveryCountLastHour="{ value }">{{
        formatCount(value)
      }}</template>

      <template #cell-createdAt="{ value }">{{ formatDate(value) }}</template>

      <template #cell-actions="{ row }">
        <button
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click.stop="askToggle(row)"
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
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import SetupReminderStrip from '@/components/shell/SetupReminderStrip.vue'
import { useSetupProgress } from '@/composables/useSetupProgress'
import TabNav from '@/components/ui/TabNav.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import DestinationTemplateBadge from '@/components/destinations/DestinationTemplateBadge.vue'
import {
  formatCount,
  formatDate,
  useDestinations
} from '@/composables/useDestinations'
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
const $q = useQuasar()
const { destinations, loading, error, apiMissing, load, setEnabled } =
  useDestinations()

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
  toggleTarget.value?.isEnabled ? 'Pause deliveries?' : 'Enable deliveries?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause deliveries' : 'Enable'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `Pipes stop routing events into “${row.name}” straight away. Nothing already delivered is removed, and you can enable it again at any time.`
    : `Pipes start routing events into “${row.name}” again straight away.`
})

async function toggle() {
  const row = toggleTarget.value
  if (!row) return
  const next = !row.isEnabled
  const res = await setEnabled(row.id, next)
  notifyMutationResult($q, res, {
    success: `“${row.name}” ${next ? 'enabled' : 'paused'}`,
    apiMissing: `Can't ${next ? 'enable' : 'pause'} “${row.name}” yet.`
  })
}

onMounted(() => {
  load()
  // Deliberately not awaited alongside `load()`: the strip is secondary, and a
  // slow setup read must not hold the table's first paint.
  loadSetupProgress()
})
</script>
