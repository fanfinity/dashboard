<template>
  <q-page class="p-6">
    <PageHeader
      title="Goals"
      subtitle="The outcome a journey optimises for, measured over a fan attribute inside a rolling window."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search goals..." />
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && goals.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        label="Goals"
        :value="formatCount(goals.length)"
        :hint="enabledHint"
      />
      <StatCard
        label="On track or better"
        :value="`${healthyCount} of ${goals.length}`"
        hint="Achieved or tracking to hit the target in this window."
      />
      <StatCard
        label="Needs attention"
        :value="formatCount(attentionCount)"
        :hint="attentionHint"
      />
      <StatCard
        label="Attached journeys"
        :value="formatCount(attachedCount)"
        :hint="attachedHint"
      />
    </div>

    <!-- Both catalogs only enrich the detail dialog, so their failure is a
         notice with its own retry rather than a page-level ErrorState. -->
    <NoticeBanner
      v-if="secondaryError"
      variant="warn"
      class="mb-4"
      title="Some goal details are unavailable"
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
      :loading="loading"
      :error="error"
      row-key="id"
      clickable-rows
      @retry="load"
      @row-click="inspect"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle"
          >{{ pluralize(row.windowDays, 'day') }} window</p
        >
      </template>

      <template #cell-attributeName="{ row }">
        <span v-if="row.attributeName" class="text-muted">{{
          row.attributeName
        }}</span>
        <span v-else class="text-subtle">Tracked manually</span>
      </template>

      <template #cell-metric="{ value }">
        <StatusBadge variant="neutral" :label="metricLabel(value)" />
      </template>

      <template #cell-progress="{ row }">
        <GoalProgressBar :goal="row" />
      </template>

      <template #cell-status="{ row }">
        <div class="flex flex-col items-start gap-1">
          <StatusBadge
            :variant="goalStatusMeta(row.status).variant"
            :label="goalStatusMeta(row.status).label"
          />
          <span v-if="!row.isEnabled" class="text-xs text-subtle"
            >Not being measured</span
          >
        </div>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="toggle(row)"
          >
            {{ row.isEnabled ? 'Pause' : 'Enable' }}
          </button>
        </div>
      </template>

      <!-- Two different "no rows" cases. There is no create route for a goal in
           the manifest, so "nothing yet" points at the attributes a goal is
           measured over. -->
      <template #empty>
        <EmptyState
          v-if="goals.length"
          title="No goals match your filters"
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
          title="No goals yet"
          description="A goal turns an attribute into a target — how much merch revenue, how many renewals — so a journey has something to optimise for."
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

    <GoalDetailDialog
      v-model="showDetail"
      :goal="detailTarget"
      :all-journeys="journeys"
      :attribute="detailAttribute"
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
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import GoalDetailDialog from '@/components/engage/audience/GoalDetailDialog.vue'
import GoalProgressBar from '@/components/engage/audience/GoalProgressBar.vue'
import {
  goalStatusMeta,
  metricLabel,
  useEngageAudienceGoalAttributes,
  useEngageAudienceGoalJourneys,
  useEngageAudienceGoals
} from '@/composables/useEngageAudienceGoals'
import {
  formatCount,
  pluralize,
  useEngageAudienceToasts
} from '@/composables/useEngageAudienceFormat'

const router = useRouter()
const { toast } = useEngageAudienceToasts()
const { goals, loading, error, load, setEnabled } = useEngageAudienceGoals()

// Secondary: which journeys are attached, and what kind of attribute the goal
// is measured over. Both only enrich the dialog.
const {
  journeys,
  error: journeysError,
  load: loadJourneys
} = useEngageAudienceGoalJourneys()

const {
  attributes,
  error: attributesError,
  load: loadAttributes
} = useEngageAudienceGoalAttributes()

const query = ref('')
const tab = ref('all')
const showDetail = ref(false)
const detailTarget = ref(null)

// Progress carries the current value, the target and the unit in one cell, so
// three columns collapse into one and the row stays readable.
const columns = [
  { key: 'name', label: 'Goal', sortable: true },
  { key: 'attributeName', label: 'Measured over', sortable: true },
  { key: 'metric', label: 'Metric', sortable: true },
  { key: 'progress', label: 'Progress', sortable: true, width: '260px' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '120px' }
]

// Each tab is a predicate over a goal; 'all' has none.
const TAB_PREDICATES = {
  healthy: g => g.status === 'achieved' || g.status === 'on_track',
  attention: g => g.status === 'at_risk' || g.status === 'off_track',
  paused: g => !g.isEnabled
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: goals.value.length },
  {
    key: 'healthy',
    label: 'On track',
    count: goals.value.filter(TAB_PREDICATES.healthy).length
  },
  {
    key: 'attention',
    label: 'Needs attention',
    count: goals.value.filter(TAB_PREDICATES.attention).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: goals.value.filter(TAB_PREDICATES.paused).length
  }
])

const SEARCH_FIELDS = ['id', 'name', 'description', 'attributeName', 'unit']

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return goals.value.filter(g => {
    if (predicate && !predicate(g)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(g[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const attributesById = computed(() =>
  Object.fromEntries(attributes.value.map(a => [a.id, a]))
)

const detailAttribute = computed(
  () => attributesById.value[detailTarget.value?.attributeId] ?? null
)

const secondaryError = computed(() => {
  const failed = []
  if (journeysError.value) failed.push('the journeys attached to each goal')
  if (attributesError.value) failed.push('the attribute catalog')
  if (!failed.length) return ''
  return `Progress and targets are unaffected — ${failed.join(' and ')} could not be loaded.`
})

function loadSecondary() {
  loadJourneys()
  loadAttributes()
}

const enabledCount = computed(() => goals.value.filter(g => g.isEnabled).length)

const enabledHint = computed(() =>
  enabledCount.value === goals.value.length
    ? 'All being measured continuously.'
    : `${goals.value.length - enabledCount.value} paused`
)

const healthyCount = computed(
  () => goals.value.filter(TAB_PREDICATES.healthy).length
)

const attentionCount = computed(
  () => goals.value.filter(TAB_PREDICATES.attention).length
)

const attentionHint = computed(() =>
  attentionCount.value
    ? 'At risk or off track for this window.'
    : 'Every goal is tracking to its target.'
)

const attachedCount = computed(() =>
  goals.value.reduce((sum, g) => sum + (Number(g.attachmentCount) || 0), 0)
)

const attachedHint = computed(() => {
  const unattached = goals.value.filter(g => !g.attachmentCount).length
  if (!unattached) return 'Every goal has a journey optimising for it.'
  return `${pluralize(unattached, 'goal')} with nothing optimising for it`
})

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function inspect(row) {
  detailTarget.value = row
  showDetail.value = true
}

function toggle(row) {
  setEnabled(row.id, !row.isEnabled)
  toast(`${row.name} ${row.isEnabled ? 'paused' : 'enabled'}`)
}

onMounted(() => {
  load()
  loadSecondary()
})
</script>
