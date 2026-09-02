<template>
  <q-page class="p-6">
    <PageHeader title="Reporting" :subtitle="subtitle">
      <template #actions>
        <router-link
          :to="{ name: 'dashboard-home' }"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          >Live dashboard</router-link
        >
        <button
          :disabled="loading"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="refresh"
        >
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <!-- 1. Loading -->
    <div v-if="showSkeleton" class="flex flex-col gap-4">
      <LoadingState variant="grid" :rows="4" />
      <LoadingState variant="table" :rows="6" />
    </div>

    <!-- 2. Error -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load the volume report."
      :message="error"
      @retry="refresh"
    />

    <!-- 3. Empty — a quiet window, not a fault. -->
    <EmptyState
      v-else-if="isEmpty"
      title="No volume in this window"
      description="Nothing was ingested or routed in the reporting period. Connect a source and this report fills in from the first event."
    >
      <template #cta>
        <router-link
          :to="{ name: 'sources-new' }"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >Connect a source</router-link
        >
      </template>
    </EmptyState>

    <!-- 4. Populated -->
    <div v-else class="flex flex-col gap-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          v-for="stat in statCards"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :hint="stat.hint"
        />
      </div>

      <CardPanel>
        <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
              >Volume over time</h2
            >
            <p class="mt-0.5 text-xs text-muted"
              >Events ingested from sources against events routed to
              destinations, one point per day.</p
            >
          </div>
          <p v-if="peakDay" class="text-xs text-subtle"
            >Busiest day
            <span class="font-medium text-ink"
              >{{ peakDay.label }} · {{ peakDay.value }}</span
            ></p
          >
        </div>

        <VolumeChart
          :categories="volume.categories"
          :ingested="volume.ingested"
          :routed="volume.routed"
        />
      </CardPanel>

      <!-- The last hour, read verbatim off the same payload the dashboard home
           screen uses, so the two screens cannot drift apart. Secondary: if it
           fails, it degrades here and the 30-day report is untouched. -->
      <CardPanel>
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
              >Right now</h2
            >
            <p class="mt-0.5 text-xs text-muted"
              >The last hour, as reported on the dashboard.</p
            >
          </div>
          <router-link
            :to="{ name: 'dashboard-home' }"
            class="text-xs font-medium text-brand hover:underline"
            >Open dashboard</router-link
          >
        </div>

        <ErrorState
          v-if="liveError"
          title="Couldn't load the last-hour figures."
          :message="liveError"
          @retry="loadDashboard"
        />
        <LoadingState v-else-if="liveLoading" variant="table" :rows="2" />
        <dl v-else class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div v-for="tile in lastHour" :key="tile.label">
            <dt class="text-xs text-subtle">{{ tile.label }}</dt>
            <dd class="mt-0.5 text-lg font-semibold tabular-nums text-ink">{{
              tile.value
            }}</dd>
          </div>
        </dl>
      </CardPanel>

      <TabNav v-model="breakdown" :tabs="breakdownTabs" />

      <CardPanel>
        <div class="mb-2">
          <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink">{{
            chartTitle
          }}</h2>
          <p class="mt-0.5 text-xs text-muted">{{ chartHint }}</p>
        </div>

        <RollupBarChart
          v-if="rollupChart.categories.length"
          :categories="rollupChart.categories"
          :data="rollupChart.data"
          :label="rollupChart.label"
        />
        <EmptyState
          v-else
          variant="inline"
          title="Nothing carried volume in this window"
        />
      </CardPanel>

      <DataTable
        :columns="rollupColumns"
        :rows="rollupRows"
        row-key="id"
        :empty-title="emptyTitle"
        empty-description="Volume appears here once events start moving."
      >
        <template #cell-name="{ row }">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-ink">{{ row.name }}</span>
            <StatusBadge v-if="!row.volume" tone="neutral" label="Idle" />
          </div>
          <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
        </template>

        <template #cell-volume="{ row }">
          <span class="tabular-nums text-ink">{{ row.volumeLabel }}</span>
        </template>

        <template #cell-shareLabel="{ row }">
          <span class="tabular-nums">{{ row.shareLabel }}</span>
        </template>

        <template #cell-failures="{ row }">
          <span
            class="tabular-nums"
            :class="row.failures ? 'text-rose-600' : 'text-subtle'"
            >{{ row.failures ? row.failuresLabel : NOT_KNOWN }}</span
          >
        </template>

        <template #cell-rateLabel="{ row }">
          <span class="tabular-nums">{{ row.rateLabel }}</span>
        </template>
      </DataTable>

      <p v-if="idleCount" class="text-xs text-subtle"
        >{{ idleCount }} of {{ rollupRows.length }} carried no volume in this
        window, so they are paused, or connected but not yet sending.</p
      >
    </div>
  </q-page>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import RollupBarChart from '@/components/monitoring/RollupBarChart.vue'
import VolumeChart from '@/components/monitoring/VolumeChart.vue'
import { useMonitoringReporting } from '@/composables/useMonitoringReporting'

const {
  loading,
  error,
  load,
  liveLoading,
  liveError,
  loadDashboard,
  statCards,
  volume,
  peakDay,
  breakdown,
  breakdownTabs,
  rollupRows,
  rollupColumns,
  rollupChart,
  idleCount,
  lastHour,
  rangeLabel,
  updatedAtLabel,
  isEmpty
} = useMonitoringReporting()

// First paint only — a refresh keeps the populated screen up.
const loaded = ref(false)
const showSkeleton = computed(() => loading.value && !loaded.value)

const subtitle = computed(() => {
  const range = rangeLabel.value
  const updated = updatedAtLabel.value
  if (!range) return 'Volume by source, destination and pipe.'
  return updated === NOT_KNOWN ? range : `${range} · updated ${updated}`
})

const TITLES = {
  source: 'Events by source',
  destination: 'Deliveries by destination',
  pipe: 'Deliveries by pipe'
}

const HINTS = {
  source: 'Where fan signals entered the platform over the window.',
  destination: 'Where they were activated, and how much each one took.',
  pipe: 'One row per source-to-destination route.'
}

const EMPTY_TITLES = {
  source: 'No sources reported volume',
  destination: 'No destinations reported volume',
  pipe: 'No pipes reported volume'
}

const chartTitle = computed(() => TITLES[breakdown.value])
const chartHint = computed(() => HINTS[breakdown.value])
const emptyTitle = computed(() => EMPTY_TITLES[breakdown.value])

async function refresh() {
  await load()
  loaded.value = true
}

onMounted(refresh)
</script>
