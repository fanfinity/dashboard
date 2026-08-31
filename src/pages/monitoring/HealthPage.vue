<template>
  <q-page class="p-6">
    <PageHeader title="Health" :subtitle="subtitle">
      <template #actions>
        <router-link
          :to="{ name: 'errors' }"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          >View errors</router-link
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
      <LoadingState variant="grid" :rows="4" />
    </div>

    <!-- 2. Error — only a failed fetch. A backed-up queue is a finding, and it
         renders as a NoticeBanner and a badge, not as ErrorState. -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load pipeline health."
      :message="error"
      @retry="refresh"
    />

    <!-- 3. Empty — nothing is running yet. A first run, not a fault. -->
    <EmptyState
      v-else-if="isEmpty"
      title="No pipeline stages are reporting"
      description="Queue depth and worker checks appear here once a source is connected and events start moving."
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

      <!-- Only rendered when there is something to say. A banner that is always
           on screen is a banner nobody reads. -->
      <NoticeBanner
        v-if="notice"
        :tone="notice.variant"
        :title="notice.title"
        :message="notice.message"
      />

      <section class="flex flex-col gap-3">
        <div>
          <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
            >Pipeline stages</h2
          >
          <p class="mt-0.5 text-xs text-muted"
            >One event's journey, in order. Each stage shows how much is
            waiting, how fast it is being drained, and how far behind real time
            the oldest item sits.</p
          >
        </div>

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <QueueStepCard
            v-for="stage in stages"
            :key="stage.id"
            :stage="stage"
          />
        </div>
      </section>

      <CardPanel>
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
              >Worker checks</h2
            >
            <p class="mt-0.5 text-xs text-muted"
              >The hourly heartbeat: a worker reads the pipeline and writes back
              what it found.</p
            >
          </div>
          <p v-if="hasMoreRuns" class="text-xs text-subtle"
            >Showing the {{ runs.length }} most recent</p
          >
        </div>

        <HeartbeatRunList :runs="runs" />
      </CardPanel>
    </div>
  </q-page>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import HeartbeatRunList from '@/components/monitoring/HeartbeatRunList.vue'
import QueueStepCard from '@/components/monitoring/QueueStepCard.vue'
import { useMonitoringHealth } from '@/composables/useMonitoringHealth'

const {
  loading,
  error,
  load,
  stages,
  runs,
  hasMoreRuns,
  statCards,
  notice,
  updatedAtLabel,
  isEmpty
} = useMonitoringHealth()

// First paint only — a refresh keeps the populated screen up.
const loaded = ref(false)
const showSkeleton = computed(() => loading.value && !loaded.value)

const subtitle = computed(() =>
  updatedAtLabel.value === NOT_KNOWN
    ? 'Queue depth and worker checks across the pipeline.'
    : `Queue depth and worker checks · updated ${updatedAtLabel.value}`
)

async function refresh() {
  await load()
  loaded.value = true
}

onMounted(refresh)
</script>
