<template>
  <q-page class="p-6">
    <PageHeader title="Dashboard" :subtitle="subtitle">
      <template #actions>
        <button
          :disabled="loading"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
          @click="refresh"
        >
          <svg
            viewBox="0 0 16 16"
            class="size-4"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M13 8a5 5 0 1 1-1.46-3.54M13 3v3h-3"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
        <router-link
          :to="{ name: 'sources-new' }"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >Connect a source</router-link
        >
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
      title="Couldn't load the pipeline overview."
      :message="error"
      @retry="refresh"
    />

    <!-- 3. Empty — nothing configured yet. This is a first run, not a fault. -->
    <EmptyState
      v-else-if="isEmpty"
      title="No data is flowing yet"
      description="Fanfinity collects fan signals from a source, routes them through a pipe, and delivers them to a destination. Set up the three and this screen fills in."
    >
      <template #cta>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <router-link
            :to="{ name: 'sources-new' }"
            class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >1. Connect a source</router-link
          >
          <router-link
            :to="{ name: 'destinations-new' }"
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
            >2. Add a destination</router-link
          >
          <router-link
            :to="{ name: 'pipes-new' }"
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
            >3. Create a pipe</router-link
          >
        </div>
      </template>
    </EmptyState>

    <!-- 4. Populated -->
    <div v-else class="flex flex-col gap-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          v-for="stat in stats"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :delta="stat.delta"
          :delta-direction="stat.deltaDirection"
        />
      </div>

      <!-- Enabled but not moving: the only thing on this page worth acting on
           immediately, so it sits directly under the headline numbers. -->
      <CardPanel v-if="attention.length">
        <div class="flex items-start gap-3">
          <span
            class="mt-1 size-2 shrink-0 rounded-full bg-amber-500"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
              >Needs attention</h2
            >
            <ul class="mt-2 flex flex-col gap-1">
              <li
                v-for="item in attention"
                :key="item.id"
                class="text-sm text-muted"
              >
                <span class="font-medium text-ink">{{ item.title }}</span>
                — {{ item.detail }}
              </li>
            </ul>
          </div>
        </div>
      </CardPanel>

      <CardPanel>
        <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
              >Events in and out</h2
            >
            <p class="mt-0.5 text-xs text-muted"
              >Received from sources vs. delivered to destinations, per minute
              for the last hour.</p
            >
          </div>
          <p class="text-xs text-subtle"
            >Fan-out
            <span class="font-medium text-ink">{{ routingRate }}×</span></p
          >
        </div>
        <ThroughputChart
          :labels="throughput.labels"
          :received="throughput.received"
          :delivered="throughput.delivered"
        />
      </CardPanel>

      <PipelineFlowPanel :columns="columns" />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardPanel>
          <div class="mb-3 flex items-baseline justify-between gap-2">
            <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
              >Recent errors</h2
            >
            <router-link
              :to="{ name: 'errors' }"
              class="text-xs font-medium text-brand hover:underline"
              >View all</router-link
            >
          </div>
          <ActivityList
            :items="errorItems"
            empty-text="No failures logged in the last hour."
          />
        </CardPanel>

        <CardPanel>
          <div class="mb-3 flex items-baseline justify-between gap-2">
            <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
              >Latest events</h2
            >
            <router-link
              :to="{ name: 'sources' }"
              class="text-xs font-medium text-brand hover:underline"
              >View sources</router-link
            >
          </div>
          <ActivityList
            :items="eventItems"
            empty-text="No events received yet."
          />
        </CardPanel>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardPanel>
          <div class="mb-3 flex items-baseline justify-between gap-2">
            <div>
              <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
                >Fan profiles</h2
              >
              <p class="mt-0.5 text-xs text-muted"
                >Resolved fans built from the events above.</p
              >
            </div>
            <router-link
              :to="{ name: 'profiles-search' }"
              class="shrink-0 text-xs font-medium text-brand hover:underline"
              >Search profiles</router-link
            >
          </div>

          <dl class="mb-4 grid grid-cols-3 gap-3">
            <div v-for="tile in profileTiles" :key="tile.label">
              <dt class="text-xs text-subtle">{{ tile.label }}</dt>
              <dd class="mt-0.5 text-lg font-semibold text-ink">{{
                tile.value
              }}</dd>
            </div>
          </dl>

          <p
            class="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
            >Recently updated</p
          >
          <ActivityList
            :items="profileItems"
            empty-text="No profiles resolved yet."
          />
        </CardPanel>

        <AudienceValuePanel />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import ActivityList from '@/components/shell/ActivityList.vue'
import AudienceValuePanel from '@/components/shell/AudienceValuePanel.vue'
import PipelineFlowPanel from '@/components/shell/PipelineFlowPanel.vue'
import ThroughputChart from '@/components/shell/ThroughputChart.vue'
import {
  formatAgo,
  formatClock,
  formatNumber,
  useDashboardHome
} from '@/composables/useDashboardHome'

const {
  loading,
  error,
  load,
  stats,
  throughput,
  columns,
  attention,
  recentEvents,
  recentProfiles,
  topErrors,
  profileStats,
  routingRate,
  updatedAt,
  isEmpty
} = useDashboardHome()

// The skeleton is for the first paint only — a manual refresh keeps the
// populated screen on-screen rather than collapsing it back to grey bars.
const loaded = ref(false)

const showSkeleton = computed(() => loading.value && !loaded.value)

async function refresh() {
  await load()
  loaded.value = true
}

const subtitle = computed(() => {
  const at = formatClock(updatedAt.value)
  return at
    ? `Fan data pipeline · last hour · updated ${at}`
    : 'Fan data pipeline · last hour'
})

const errorItems = computed(() =>
  topErrors.value.map(e => ({
    id: e.id,
    title: e.entityName || e.code,
    meta: e.message,
    right: formatAgo(e.occurredAt),
    badge: {
      variant: e.severity === 'error' ? 'danger' : 'warn',
      label: e.severity === 'error' ? 'Error' : 'Warning'
    }
  }))
)

const eventItems = computed(() =>
  recentEvents.value.map(e => ({
    id: e.id,
    title: e.eventName,
    meta: e.sourceName,
    right: formatAgo(e.occurredAt)
  }))
)

const profileItems = computed(() =>
  recentProfiles.value.map(p => ({
    id: p.id,
    title: p.displayName,
    meta: p.id,
    right: formatAgo(p.updatedAt)
  }))
)

const profileTiles = computed(() => [
  { label: 'Refreshed', value: formatNumber(profileStats.value.refreshed) },
  { label: 'Routed', value: formatNumber(profileStats.value.routed) },
  { label: 'Live syncs', value: formatNumber(profileStats.value.liveSyncs) }
])

onMounted(refresh)
</script>
