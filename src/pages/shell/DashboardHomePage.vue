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
          :to="primaryAction.to"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >{{ primaryAction.label }}</router-link
        >
      </template>
    </PageHeader>

    <!-- The setup tracker sits above every other state, including the loading
         and error branches below: it reads three list endpoints of its own, so
         it can be useful precisely when the dashboard aggregate is not. This is
         the canonical progress surface — Sources, Destinations and Pipes each
         show a one-line reminder pointing back here. -->
    <SetupProgressPanel
      v-if="setupVisible"
      class="mb-4"
      :steps="setupSteps"
      :done-count="setupDone"
      :total="setupTotal"
      :complete="setupComplete"
      :unavailable="setupUnavailable"
      @dismiss="dismissSetup"
    />

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

    <!-- 3. Empty — nothing configured yet. This is a first run, not a fault.
         The three-step call to action that used to live here is now
         SetupProgressPanel above, which knows which of the three are actually
         done; this says only what the *metrics* are waiting for. -->
    <EmptyState
      v-else-if="isEmpty"
      title="No data is flowing yet"
      :description="emptyDescription"
    />

    <!-- 4. Populated -->
    <div v-else class="flex flex-col gap-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          v-for="stat in stats"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :delta="stat.delta"
          :direction="stat.deltaDirection"
          :hint="stat.hint ?? ''"
        />
      </div>

      <!-- Enabled but not moving: the only thing on this page worth acting on
           immediately, so it sits directly under the headline numbers and above
           the persona-ordered blocks — its position is fixed for every reader,
           only its openness changes. NoticeBanner's layout was lifted from this
           block — use it, don't re-hand-roll it. -->
      <!-- Name on its own line, consequence under it. It used to be one line
           per row hinged on an em dash, and since a provisioned destination is
           itself named "Testing website — ClickHouse", a row read "Testing
           website — ClickHouse — Enabled, but no pipe delivers to it": three
           dashes doing two different jobs in a list meant to be scanned. -->
      <NoticeBanner
        v-if="attention.length"
        tone="warn"
        :title="attentionTitle"
        :collapsible="home.collapseAttention"
      >
        <ul class="grid gap-2">
          <li v-for="item in attention" :key="item.id" class="grid gap-0.5">
            <span class="text-sm font-medium text-ink">{{ item.title }}</span>
            <span class="text-sm text-muted">{{ item.detail }}</span>
          </li>
        </ul>
      </NoticeBanner>

      <!-- The persona-ordered blocks. One wrapper div per row so a row of two
           becomes a two-column grid and a row of one stays full width; the
           v-if/v-else-if chain names each block explicitly rather than going
           through `<component :is>` so every block keeps its own props at the
           call site. -->
      <template v-for="(row, rowIndex) in blockRows" :key="rowIndex">
        <div
          :class="row.length > 1 ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : ''"
        >
          <template v-for="id in row" :key="id">
            <ThroughputPanel
              v-if="id === 'throughput'"
              :labels="throughput.labels"
              :received="throughput.received"
              :delivered="throughput.delivered"
              :routing-rate="routingRate"
            />

            <PipelineFlowPanel v-else-if="id === 'flow'" :columns="columns" />

            <ActivityPanel
              v-else-if="id === 'errors'"
              title="Recent errors"
              :items="errorItems"
              empty-text="No failures logged in the last hour."
              link-label="View all"
              :link-to="{ name: 'errors' }"
            />

            <ActivityPanel
              v-else-if="id === 'events'"
              title="Latest events"
              :items="eventItems"
              empty-text="No events received yet."
              link-label="View sources"
              :link-to="{ name: 'sources' }"
            />

            <ProfilesPanel
              v-else-if="id === 'profiles'"
              :tiles="profileTiles"
              :items="profileItems"
              :description="profilesDescription"
            />

            <WarehouseHandoffStrip v-else-if="id === 'warehouse-handoff'" />
          </template>
        </div>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import ActivityPanel from '@/components/shell/ActivityPanel.vue'
import ProfilesPanel from '@/components/shell/ProfilesPanel.vue'
import SetupProgressPanel from '@/components/shell/SetupProgressPanel.vue'
import PipelineFlowPanel from '@/components/shell/PipelineFlowPanel.vue'
import ThroughputPanel from '@/components/shell/ThroughputPanel.vue'
import WarehouseHandoffStrip from '@/components/shell/WarehouseHandoffStrip.vue'
import {
  formatAgo,
  formatClock,
  formatNumber,
  useDashboardHome
} from '@/composables/useDashboardHome'
import { useSetupProgress } from '@/composables/useSetupProgress'
import { useOnboarding } from '@/composables/useOnboarding'
import { DEFAULT_HOME } from '@/config/personas'

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

// Setup progress is its own three reads, deliberately separate from the
// dashboard aggregate — see useSetupProgress for why it is derived rather than
// stored.
const {
  steps: setupSteps,
  doneCount: setupDone,
  total: setupTotal,
  complete: setupComplete,
  unavailable: setupUnavailable,
  loaded: setupLoaded,
  load: loadSetup
} = useSetupProgress()

// ------------------------------------------------------------------- persona

// WHAT THE PERSONA CHANGES HERE: the order of the blocks below the headline
// numbers, the subtitle, which primary action the header offers, whether the
// needs-attention list opens collapsed, and whether the setup tracker survives
// its own completion. WHAT IT DOES NOT CHANGE: which blocks exist. Every reader
// gets every block, in a different order — the same rule the sidebar follows,
// and for the same reason. See src/config/personas.js.
//
// A persona with no `home`, and no persona at all — unanswered or skipped —
// both resolve to DEFAULT_HOME, which is today's layout exactly. That fallback
// is load-bearing for the behavioural gate: scripts/smoke.mjs signs in as
// SMOKE_EMAIL with nothing in localStorage, so the unanswered path is the ONLY
// one it walks. If this defaulted to anything else, the gate would keep passing
// while covering a layout no user sees.
const { personaMeta } = useOnboarding()

const home = computed(() => personaMeta.value?.home ?? DEFAULT_HOME)

// Every entry normalised to a row, so the template has one shape to render: a
// bare id is a full-width row of one, a nested array is a row rendered side by
// side on large screens.
const blockRows = computed(() =>
  home.value.blocks.map(block => (Array.isArray(block) ? block : [block]))
)

const PRIMARY_ACTIONS = {
  'connect-source': {
    label: 'Connect a source',
    to: { name: 'sources-new' }
  },
  'search-profiles': {
    label: 'Search profiles',
    to: { name: 'profiles-search' }
  },
  'live-events': { label: 'Watch live events', to: { name: 'live-events' } }
}

// Until all three setup steps exist, EVERY reader's next move is the same one,
// whatever their role says — a marketer cannot search profiles that no source
// has produced. `setupComplete` is also false while the three reads are in
// flight and when they cannot be trusted, so both of those cases keep today's
// button rather than guessing at a persona-specific one.
const primaryAction = computed(() => {
  if (!setupComplete.value) return PRIMARY_ACTIONS['connect-source']
  return (
    PRIMARY_ACTIONS[home.value.primaryAction] ??
    PRIMARY_ACTIONS['connect-source']
  )
})

// "Needs attention" for a reader who wants the list; a count for one who wants
// the option of it. The count is in the title rather than a badge because when
// the banner is collapsed the title is the whole banner.
const attentionTitle = computed(() => {
  if (!home.value.collapseAttention) return 'Needs attention'
  const count = attention.value.length
  return count === 1
    ? '1 issue needs your attention'
    : `${count} issues need your attention`
})

// "Built from the events above" is a forward reference to nothing when this
// block is the first thing on the page, which is where a marketer gets it.
// Derived from the ordering rather than configured, so it cannot disagree with
// where the block actually landed.
const profilesDescription = computed(() =>
  blockRows.value[0]?.includes('profiles')
    ? 'Every fan Sfere has resolved from the events it has received.'
    : 'Resolved fans built from the events above.'
)

// --------------------------------------------------------------------- setup

// Dismissal is per-browser and only offered once setup is complete, so nobody
// can hide the tracker while it still has something to tell them. It is not
// per-account state worth a backend field: the panel is a nudge, and a nudge
// someone has read is a nudge they can put away.
const SETUP_DISMISS_KEY = 'sfere_setup_tracker_dismissed'
const setupDismissed = ref(localStorage.getItem(SETUP_DISMISS_KEY) === '1')

// `hideSetupWhenComplete` retires the panel for a reader it was never for,
// without ever hiding it while a step is outstanding — that is the "unless
// there is no data yet" half, and it is why the condition is on `setupComplete`
// and not on the persona alone.
const setupVisible = computed(
  () =>
    setupLoaded.value &&
    !setupUnavailable.value &&
    !(
      setupComplete.value &&
      (setupDismissed.value || home.value.hideSetupWhenComplete)
    )
)

function dismissSetup() {
  localStorage.setItem(SETUP_DISMISS_KEY, '1')
  setupDismissed.value = true
}

// The skeleton is for the first paint only — a manual refresh keeps the
// populated screen on-screen rather than collapsing it back to grey bars.
const loaded = ref(false)

const showSkeleton = computed(() => loading.value && !loaded.value)

async function refresh() {
  await Promise.all([load(), loadSetup()])
  loaded.value = true
}

// What the metrics are waiting for, which is not the same question the tracker
// answers: a workspace can have all three pieces and still be waiting for the
// first event to arrive.
const emptyDescription = computed(() =>
  setupComplete.value
    ? 'Your source, destination and pipe are all in place. This fills in as soon as the first events arrive.'
    : 'Finish the setup steps above and this screen fills in with live throughput, errors and profiles.'
)

const subtitle = computed(() => {
  const at = formatClock(updatedAt.value)
  const lead = home.value.subtitle
  return at ? `${lead} · last hour · updated ${at}` : `${lead} · last hour`
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
