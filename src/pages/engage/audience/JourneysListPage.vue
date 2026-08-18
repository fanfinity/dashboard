<template>
  <q-page class="p-6">
    <PageHeader
      title="Journeys"
      subtitle="Multi-step orchestration over an audience — wait, branch, send — measured against a goal."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search journeys..." />
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && journeys.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        label="Journeys"
        :value="formatCount(journeys.length)"
        :hint="statusHint"
      />
      <StatCard
        label="Fans enrolled"
        :value="formatCount(totalEnrolled)"
        hint="Everyone who has ever entered a journey."
      />
      <StatCard
        label="In progress"
        :value="formatCount(totalActive)"
        hint="Sitting in a wait or branch step right now."
      />
      <StatCard
        label="Completion rate"
        :value="formatPercent(completionRate)"
        :hint="completionHint"
      />
    </div>

    <!-- A journey stores only `goalId`, so the goal catalog is what turns that
         into a name. Its failure costs one column, not the screen. -->
    <NoticeBanner
      v-if="goalsError"
      tone="warn"
      class="mb-4"
      title="Goal names are unavailable"
      message="The goal catalog could not be loaded, so journeys show their goal id instead."
    >
      <button
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="loadGoals"
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
        <p class="text-xs text-subtle">{{
          pluralize(row.stepCount, 'step')
        }}</p>
      </template>

      <template #cell-entryAudienceName="{ row }">
        <p class="text-ink">{{ row.entryAudienceName }}</p>
        <p class="font-mono text-xs text-subtle">{{ row.entryAudienceId }}</p>
      </template>

      <template #cell-goalId="{ row }">
        <span v-if="goalName(row)" class="text-muted">{{ goalName(row) }}</span>
        <span v-else class="text-subtle">No goal</span>
      </template>

      <template #cell-status="{ value }">
        <StatusBadge
          :tone="journeyStatusMeta(value).variant"
          :label="journeyStatusMeta(value).label"
        />
      </template>

      <template #cell-enrolledCount="{ row }">
        <p>{{ formatCount(row.enrolledCount) }}</p>
        <p v-if="row.activeCount" class="text-xs text-subtle">
          {{ formatCount(row.activeCount) }} in progress
        </p>
      </template>

      <!-- Date only: the full timestamp wrapped its "UTC" onto a second line
           in this column, and the dialog carries the exact time. -->
      <template #cell-updatedAt="{ value }">
        {{ formatDate(value) }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            v-if="journeyAction(row.status)"
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="apply(row)"
          >
            {{ journeyAction(row.status).label }}
          </button>
          <!-- An archived journey is read-only, and the manifest has no
               duplicate or create route to offer instead. -->
          <span v-else class="text-xs text-subtle">Read-only</span>
        </div>
      </template>

      <!-- Two different "no rows" cases: nothing matched the filters, and no
           journeys at all. There is no create route in the manifest, so the
           second points at the audiences a journey would enter fans from. -->
      <template #empty>
        <EmptyState
          v-if="journeys.length"
          title="No journeys match your filters"
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
          title="No journeys yet"
          description="A journey enters fans from one audience and walks them through waits, branches and sends until they complete it or stop matching."
        >
          <template #cta>
            <button
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'audiences' })"
            >
              Browse audiences
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <JourneyDetailDialog
      v-model="showDetail"
      :journey="detailTarget"
      :goal-name="detailGoalName"
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
import JourneyDetailDialog from '@/components/engage/audience/JourneyDetailDialog.vue'
import {
  journeyAction,
  journeyStatusMeta,
  useEngageAudienceJourneyGoals,
  useEngageAudienceJourneys
} from '@/composables/useEngageAudienceJourneys'
import {
  formatCount,
  formatDate,
  formatPercent,
  pluralize,
  useEngageAudienceToasts
} from '@/composables/useEngageAudienceFormat'

const router = useRouter()
const { toast } = useEngageAudienceToasts()
const { journeys, loading, error, load, setStatus } =
  useEngageAudienceJourneys()

// Secondary: names for the Goal column and the dialog. The list is readable
// without it.
const {
  goals,
  error: goalsError,
  load: loadGoals
} = useEngageAudienceJourneyGoals()

const query = ref('')
const tab = ref('all')
const showDetail = ref(false)
const detailTarget = ref(null)

const columns = [
  { key: 'name', label: 'Journey', sortable: true },
  { key: 'entryAudienceName', label: 'Entry audience', sortable: true },
  { key: 'goalId', label: 'Goal', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'enrolledCount', label: 'Enrolled', sortable: true, align: 'right' },
  { key: 'updatedAt', label: 'Last updated', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '130px' }
]

// Each tab is a predicate over a journey; 'all' has none.
const TAB_PREDICATES = {
  live: j => j.status === 'live',
  paused: j => j.status === 'paused',
  draft: j => j.status === 'draft',
  archived: j => j.status === 'archived'
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: journeys.value.length },
  {
    key: 'live',
    label: 'Live',
    count: journeys.value.filter(TAB_PREDICATES.live).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: journeys.value.filter(TAB_PREDICATES.paused).length
  },
  {
    key: 'draft',
    label: 'Draft',
    count: journeys.value.filter(TAB_PREDICATES.draft).length
  },
  {
    key: 'archived',
    label: 'Archived',
    count: journeys.value.filter(TAB_PREDICATES.archived).length
  }
])

const SEARCH_FIELDS = [
  'id',
  'name',
  'description',
  'entryAudienceName',
  'status'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return journeys.value.filter(j => {
    if (predicate && !predicate(j)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(j[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const goalsById = computed(() =>
  Object.fromEntries(goals.value.map(g => [g.id, g]))
)

// Falls back to the raw id when the catalog is missing: a journey optimising
// for something unnamed is still worth saying out loud.
function goalName(journey) {
  if (!journey?.goalId) return ''
  return goalsById.value[journey.goalId]?.name ?? journey.goalId
}

const detailGoalName = computed(() => goalName(detailTarget.value))

const statusHint = computed(() => {
  const live = journeys.value.filter(TAB_PREDICATES.live).length
  const draft = journeys.value.filter(TAB_PREDICATES.draft).length
  return `${live} live · ${draft} draft`
})

function sumOf(key) {
  return journeys.value.reduce((sum, j) => sum + (Number(j[key]) || 0), 0)
}

const totalEnrolled = computed(() => sumOf('enrolledCount'))
const totalActive = computed(() => sumOf('activeCount'))
const totalCompleted = computed(() => sumOf('completedCount'))

const completionRate = computed(() =>
  totalEnrolled.value ? totalCompleted.value / totalEnrolled.value : 0
)

const completionHint = computed(() =>
  totalEnrolled.value
    ? `${formatCount(totalCompleted.value)} of ${formatCount(totalEnrolled.value)} fans`
    : 'Nobody has entered a journey yet.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function inspect(row) {
  detailTarget.value = row
  showDetail.value = true
}

function apply(row) {
  const action = journeyAction(row.status)
  if (!action) return
  setStatus(row.id, action.next)
  toast(`${row.name} ${action.verb}`)
}

onMounted(() => {
  load()
  loadGoals()
})
</script>
