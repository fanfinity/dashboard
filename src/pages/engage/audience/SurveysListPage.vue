<template>
  <q-page class="p-6">
    <PageHeader
      title="Surveys"
      subtitle="In-product questionnaires. Answers land on the resolved fan profile as attributes, so anything else can target them."
    >
      <template v-if="surveys.length" #actions>
        <ToolbarSearch v-model="query" placeholder="Search surveys..." />
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && surveys.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard label="Surveys" :value="formatCount(surveys.length)" />
      <StatCard label="Live" :value="formatCount(liveCount)" />
      <StatCard label="Responses" :value="formatCount(totalResponses)" />
      <StatCard
        label="Completion rate"
        :value="formatPercent(completionRate)"
        hint="Finished, of everyone who started."
      />
    </div>

    <!-- The reason this screen is empty on every tenant, said plainly. The
         collection loaded fine, so this is a notice and not an ErrorState. -->
    <NoticeBanner
      variant="info"
      class="mb-4"
      title="The fan-facing survey widget is still in design"
      message="The data layer that would store responses is live; the widget that collects them is not built yet, so no workspace has surveys today."
    />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      empty-title="No surveys yet"
      @retry="load"
    >
      <template #cell-status="{ value }">
        <StatusBadge
          :variant="surveyStatusMeta(value).variant"
          :label="surveyStatusMeta(value).label"
        />
      </template>

      <template #cell-responseCount="{ value }">
        {{ formatCount(value) }}
      </template>

      <template #cell-updatedAt="{ value }">
        {{ formatDateTime(value) }}
      </template>

      <!-- Two "no rows" cases. The second one is not an edge case here — it is
           what every workspace sees — so it explains what a survey is and hands
           over the one next step that exists, rather than apologising. There is
           no create route for a survey in the manifest. -->
      <template #empty>
        <EmptyState
          v-if="surveys.length"
          title="No surveys match your search"
          description="Try a different term to see the rest."
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
          title="No surveys yet"
          description="A survey asks one audience a short question in-product — a renewal reason, a favourite player, a shirt size — and writes the answer back to the fan's profile."
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

    <!-- Shown only while there is nothing to list: once a workspace has
         surveys, the table is the thing worth the space. -->
    <div
      v-if="!loading && !error && !surveys.length"
      class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <CardPanel v-for="step in steps" :key="step.title" class="min-w-0">
        <span
          class="inline-flex size-6 items-center justify-center rounded-md bg-brand/10 text-xs font-semibold text-brand"
          >{{ step.number }}</span
        >
        <p class="mt-2.5 text-sm font-semibold text-ink">{{ step.title }}</p>
        <p class="mt-1 text-sm leading-6 text-muted">{{ step.body }}</p>
      </CardPanel>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import {
  surveyStatusMeta,
  useEngageAudienceSurveys
} from '@/composables/useEngageAudienceSurveys'
import {
  formatCount,
  formatDateTime,
  formatPercent
} from '@/composables/useEngageAudienceFormat'

// `public/data/surveys.json` is empty by design, and the load succeeds — so the
// screen's normal state is the empty one. It must therefore be `EmptyState`:
// `ErrorState` carries `data-smoke="error"` and would have the smoke gate
// report this working screen as broken.
//
// Rows are deliberately not clickable and there is no detail dialog: with no
// records to inspect, a dialog would be markup nobody can ever open or verify.
const router = useRouter()
const { surveys, loading, error, load } = useEngageAudienceSurveys()

const query = ref('')

const columns = [
  { key: 'name', label: 'Survey', sortable: true },
  { key: 'audienceName', label: 'Audience', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'responseCount', label: 'Responses', sortable: true, align: 'right' },
  { key: 'updatedAt', label: 'Last updated', sortable: true, align: 'right' }
]

const SEARCH_FIELDS = ['id', 'name', 'audienceName', 'status']

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return surveys.value
  return surveys.value.filter(s =>
    SEARCH_FIELDS.some(f =>
      String(s[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  )
})

const steps = [
  {
    number: '1',
    title: 'Pick an audience',
    body: 'A survey is shown to exactly one audience, so only the fans you meant to ask are ever interrupted.'
  },
  {
    number: '2',
    title: 'Ask one or two questions',
    body: 'Short, in-product and answerable in a tap. Each response arrives as an event the moment a fan gives it.'
  },
  {
    number: '3',
    title: 'Answers become attributes',
    body: 'Responses land on the resolved fan profile, so audiences, goals and journeys can target them like any other attribute.'
  }
]

const liveCount = computed(
  () => surveys.value.filter(s => s.status === 'live').length
)

const totalResponses = computed(() =>
  surveys.value.reduce((sum, s) => sum + (Number(s.responseCount) || 0), 0)
)

const completionRate = computed(() => {
  const started = surveys.value.reduce(
    (sum, s) => sum + (Number(s.startedCount) || 0),
    0
  )
  const completed = surveys.value.reduce(
    (sum, s) => sum + (Number(s.completedCount) || 0),
    0
  )
  return started ? completed / started : 0
})

function clearFilters() {
  query.value = ''
}

onMounted(load)
</script>
