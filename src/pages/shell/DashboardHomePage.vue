<template>
  <q-page class="p-6">
    <!-- One content cap for the header AND everything under it, so the <h1> and
         the cards share both edges. It sits here rather than in MainLayout on
         purpose: the layout is shared with every other screen, several of which
         want the whole width. 1400px is deliberately wider than
         `--container-sfere-page` (80rem / 1280px) — that token is the
         marketing-site measure and left ~40% of a wide monitor empty here. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <!-- On the first run the <h1> IS the headline. EmptyState draws its title
           at 14px semibold, so a welcome put there would be a label above a
           button while the biggest text on the screen still read "Dashboard".
           PageHeader renders 24px in the display face, it is the one <h1> the
           smoke gate asserts on, and there is no dashboard here yet to label. -->
      <PageHeader :title="title" :subtitle="subtitle">
        <!-- No actions at all on the first run: the one thing that can be done
             is the button in the setup diagram below, and a header CTA saying
             the same words is a duplicate. Gated on `setupLoaded` as well as
             `!firstRun` so a fresh account never paints the pair and then drops
             them a moment later — a button that appears and vanishes reads as a
             bug, an absence that fills in reads as loading. -->
        <template v-if="setupLoaded && !firstRun" #actions>
          <SfereButton
            variant="secondary"
            size="sm"
            :loading="loading"
            @click="refresh"
            >{{ loading ? 'Refreshing…' : 'Refresh' }}</SfereButton
          >
          <SfereButton size="sm" :to="{ name: 'sources-new' }"
            >Connect a source</SfereButton
          >
        </template>
      </PageHeader>

      <!-- The door back into a parked arrival. Above the tracker because it is
           the more specific of the two: the tracker answers "how far is this
           workspace?" for everybody at 0 of 3, this answers "you left the
           welcome flow part-way" for the one reader who did. It removes itself
           the moment a source exists — see `resumeVisible`. -->
      <SetupResumeBand
        v-if="resumeVisible"
        :intent="onboardingIntent ?? ''"
        @resume="requestResume"
      />

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
      <div v-if="showSkeleton" class="grid gap-4">
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

      <!-- 3. First run — no source, no destination, no pipe. THE SETUP DIAGRAM
           ABOVE IS THIS SCREEN, so nothing renders here.

           What a brand-new account needs first is the SHAPE of the work — three
           steps, in a fixed order, each gated by the one before it — and a
           topology of an empty workspace would be two column headings and a
           blank. Losing `data-smoke="empty"` on this branch is safe: it is not a
           failure condition for scripts/smoke.mjs, and PageHeader still renders
           the one non-empty <h1> the gate asserts on. Nothing invents a third
           data-smoke attribute to compensate.

           The skeleton and error branches above deliberately still win over
           this: a dashboard aggregate that failed has to say so even on a
           workspace with nothing set up, because the setup reads are three
           different endpoints and their success is no evidence about this one. -->
      <template v-else-if="!firstRun">
        <!-- 4. The aggregate has no endpoint. Distinct from "nothing is flowing"
             and it has to stay distinct: a 404 and an idle workspace look
             identical in the data and mean opposite things to the reader. -->
        <EmptyState
          v-if="apiMissing"
          title="No API yet"
          description="The dashboard overview endpoint is not available for this
            account, so there is nothing to summarise. Sources, Destinations and
            Pipes each still read their own endpoint."
        />

        <!-- 5. Nothing is configured at all — and note this branch is reached
             only when `firstRun` could NOT be established, i.e. when the three
             setup reads failed or have no endpoint. So it must not render the
             topology or the counts: `flow.*.total` is `items.length` on an array
             that is empty both when the workspace is empty and when the read
             never happened, and `formatNumber(0)` prints a confident `0` for
             both. Mutually exclusive with the populated branch on purpose — an
             empty picture over four zeroes beside a "no data yet" notice is
             three surfaces asserting a measurement nobody took. -->
        <EmptyState
          v-else-if="isEmpty"
          title="No data is flowing yet"
          :description="emptyDescription"
        />

        <!-- 6. Populated.
             `grid`, not `flex flex-col`. Quasar ships an unlayered
             `.flex { display:flex; flex-wrap: wrap }` and the layered
             `flex-nowrap` utility loses to it, so a column of blocks here is a
             WRAPPING column — which stretched the topology card to the height of
             the whole stack and left ~700px of white inside it. `grid` has no
             Quasar counterpart, so `gap` and auto rows both apply.
             CLAUDE.md collision #4. -->
        <div v-else class="grid gap-4">
          <!-- THE TOPOLOGY IS THE SCREEN. It replaced a stack of persona-ordered
               panels — a throughput chart, two activity lists and a profiles
               summary — for one reason worth stating: none of them answered the
               question somebody opens a CDP dashboard to ask, which is "is my
               data getting from where it comes from to where it goes?". A line
               chart answers "how much", and only once you already trust the
               path. The picture answers the path.

               `:padded="false"` and its own inner padding because the connector
               curves are drawn in an SVG positioned against the topology's own
               box — a card's padding would clip the ends of the wires. -->
          <CardPanel :padded="false">
            <div class="p-5">
              <FlowTopology
                :sources="topology.sources"
                :destinations="topology.destinations"
                :links="topology.links"
                :sources-to="{ name: 'sources' }"
                :destinations-to="{ name: 'destinations' }"
              >
                <!-- NO BUTTON IN EITHER EMPTY COLUMN, deliberately. The
                     topology only renders in the populated branch, which is
                     reached with `setupLoaded && !firstRun` — and that is
                     exactly the condition the header's own actions are gated
                     on, so a `Connect a source` here would sit a few hundred
                     pixels below an identical one in the top right. Every add
                     affordance on this app lives in the header; a second copy
                     inside the content is the duplicate row this port was asked
                     to keep out. The copy still names the next step, and the
                     control for it is the one already on screen. -->
                <template #sources-empty>
                  <div
                    class="sfere-flush grid gap-1.5 rounded-sfere-lg border border-dashed border-sfere-line bg-sfere-fill p-4"
                  >
                    <p class="text-sfere-sm font-semibold text-sfere-fg"
                      >No sources connected yet</p
                    >
                    <p class="text-sfere-xs text-sfere-fg-muted"
                      >Connect a website, an online store, a mobile app or your
                      own backend, and activity starts arriving here.</p
                    >
                  </div>
                </template>

                <template #destinations-empty>
                  <div
                    class="sfere-flush grid gap-1.5 rounded-sfere-lg border border-dashed border-sfere-line bg-sfere-fill p-4"
                  >
                    <p class="text-sfere-sm font-semibold text-sfere-fg"
                      >Your warehouse arrives with your first source</p
                    >
                    <p class="text-sfere-xs text-sfere-fg-muted"
                      >Connect a website or an online store and Sfere provisions
                      the storage and the pipe into it in the same step.</p
                    >
                  </div>
                </template>
              </FlowTopology>
            </div>
          </CardPanel>

          <!-- Enabled but not moving: the only thing on this page worth acting
               on immediately, so it sits directly under the picture that shows
               it and above the numbers. Name on its own line, consequence under
               it — it used to be one line per row hinged on an em dash, and
               since a provisioned destination is itself named "Testing website —
               ClickHouse", a row read "Testing website — ClickHouse — Enabled,
               but no pipe delivers to it": three dashes doing two different jobs
               in a list meant to be scanned. -->
          <NoticeBanner
            v-if="attention.length"
            tone="warn"
            :title="attentionTitle"
          >
            <ul class="grid gap-2">
              <li v-for="item in attention" :key="item.id" class="grid gap-0.5">
                <span class="text-sm font-medium text-ink">{{
                  item.title
                }}</span>
                <span class="text-sm text-muted">{{ item.detail }}</span>
              </li>
            </ul>
          </NoticeBanner>

          <!-- The counts, under the picture rather than over it. Four, and every
               one of them measured: `DashboardTotals` carries sources,
               destinations, pipes/pipes_enabled and events_received; delivery
               success is the ratio of two of those. Nothing here prints a
               per-pipe "last activity" or a per-source "success rate" — the
               prototype had both and the backend measures neither. -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              v-for="stat in summaryStats"
              :key="stat.label"
              :label="stat.label"
              :value="stat.value"
              :hint="stat.hint ?? ''"
              :tone="stat.tone ?? 'neutral'"
            />
          </div>
        </div>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import StatCard from '@/components/ui/StatCard.vue'
import FlowTopology from '@/components/flow/FlowTopology.vue'
import SetupProgressPanel from '@/components/shell/SetupProgressPanel.vue'
import SetupResumeBand from '@/components/shell/SetupResumeBand.vue'
import {
  formatClock,
  formatNumber,
  useDashboardHome
} from '@/composables/useDashboardHome'
import { useSetupProgress } from '@/composables/useSetupProgress'
import { useOnboarding } from '@/composables/useOnboarding'
import { NOT_KNOWN } from '@/lib/emptyValue'

// Home, as one picture and four numbers.
//
// WHAT THIS REPLACED, and why. The page used to be a stack of panels whose order
// was chosen by the role somebody picked on their first sign-in: a throughput
// chart, a three-column flow summary, Recent errors, Latest events, a profiles
// panel and a warehouse signpost. Two problems, and the ordering was the smaller
// one. The larger is that none of those answers the question a person opens a
// CDP dashboard to ask — "is my data getting from where it comes from to where
// it goes?" — and six panels that each answer a narrower question read as a
// report rather than as an answer. The topology answers it directly, and the
// four counts under it are the frame around that answer.
//
// The retired blocks are not deleted from the repo: `ThroughputPanel`,
// `ActivityPanel`, `ProfilesPanel`, `PipelineFlowPanel` and
// `WarehouseHandoffStrip` are still in src/components/shell/ and still render
// correctly. They have no call site here any more, and the screens that want a
// throughput chart or an error list — Monitoring, Live events — are where they
// belong next.
const {
  loading,
  error,
  apiMissing,
  load,
  topology,
  attention,
  flow,
  deliverySuccess,
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

// ------------------------------------------------------------------ first run

// "This workspace has nothing at all" — and it has to be KNOWN to be that, not
// merely unmeasured. `setupUnavailable` is the load-bearing half: any of the
// three reads failing or having no endpoint makes the counts a guess, and a
// welcome screen built on a guess would tell someone with a full pipeline that
// they have not started. Those cases fall through to the populated branch, which
// claims nothing about configuration.
const firstRun = computed(
  () => setupLoaded.value && !setupUnavailable.value && setupDone.value === 0
)

// ---------------------------------------------------------------- stat cards

// Four counts, chosen so that every one of them is measured. `stats` from the
// composable is the older set — events received, events delivered, active pipes,
// error rate — and two of those are now said better by the picture above, so
// this row answers "how big is my setup, and is it delivering?" instead.
//
// DELIVERY SUCCESS IS GUARDED, not defaulted. `DashboardTotals.events_delivered`
// is explicitly nullable — "null when the analytics store is unavailable" — so a
// bare ratio would print `0.0%` on a healthy account whose ClickHouse read
// failed, which is a measured-sounding claim that delivery is broken. Absent
// beats wrong: the card renders NOT_KNOWN and says why in its hint.
const summaryStats = computed(() => {
  const sources = flow.value.sources
  const pipes = flow.value.pipes
  const destinations = flow.value.destinations
  const attentionCount = attention.value.length

  return [
    // `flowing`, not `enabled`. A source can be switched on and receiving
    // nothing, which is exactly the state the attention banner is about — so a
    // hint reading "3 sending" beside a banner naming one of them as silent
    // contradicts the screen it is on. `flowing` counts sources whose measured
    // `events_received` is above zero.
    {
      label: 'Sources',
      value: formatNumber(sources.total),
      hint:
        sources.flowing === sources.total
          ? `${sources.enabled} enabled`
          : `${sources.flowing} of ${sources.total} sending`
    },
    {
      label: 'Active pipes',
      value: formatNumber(pipes.enabled),
      hint: pipes.total === pipes.enabled ? '' : `of ${pipes.total} configured`
    },
    {
      label: 'Destinations',
      value: formatNumber(destinations.total),
      hint: `${destinations.enabled} enabled`
    },
    attentionCount
      ? {
          label: 'Needs attention',
          value: formatNumber(attentionCount),
          hint: attentionCount === 1 ? 'One thing to check' : 'Things to check',
          tone: 'warn'
        }
      : {
          label: 'Delivery success',
          value: deliveryLabel.value,
          hint: deliveryHint.value
        }
  ]
})

// NOT_KNOWN rather than a dash: the four words in src/lib/emptyValue.js exist so
// a reader can tell "nothing measures this" from "this is genuinely zero", and a
// bare em dash cannot say which it is.
const deliveryLabel = computed(() =>
  deliverySuccess.value == null
    ? NOT_KNOWN
    : `${deliverySuccess.value.toFixed(1)}%`
)

const deliveryHint = computed(() =>
  deliverySuccess.value == null ? 'No deliveries measured yet' : 'Last hour'
)

// "Needs attention" for a reader who wants the list. The count is in the title
// because the list under it is the detail, and a bare "Needs attention" over
// four rows makes the reader count them.
const attentionTitle = computed(() => {
  const count = attention.value.length
  return count === 1
    ? '1 thing needs your attention'
    : `${count} things need your attention`
})

// --------------------------------------------------------------------- setup

// Dismissal is per-browser and only offered once setup is complete, so nobody
// can hide the tracker while it still has something to tell them. It is not
// per-account state worth a backend field: the panel is a nudge, and a nudge
// someone has read is a nudge they can put away.
const SETUP_DISMISS_KEY = 'sfere_setup_tracker_dismissed'
const setupDismissed = ref(localStorage.getItem(SETUP_DISMISS_KEY) === '1')

const setupVisible = computed(
  () =>
    setupLoaded.value &&
    !setupUnavailable.value &&
    !(setupComplete.value && setupDismissed.value)
)

// The parked arrival, if there is one.
//
// GATED ON `setupDone === 0`, NOT ON THE RECORD ALONE, and that is what keeps it
// from outliving its own point. Somebody can park the arrival and then connect a
// source from the Sources screen an hour later; the record still says "paused"
// because nothing writes a completion, and it deliberately does not — a stored
// `setupComplete` flag is exactly the thing `useSetupProgress` exists to avoid,
// since it can disagree with reality the moment somebody deletes their only
// source. Deriving the visibility from the count instead means the band is
// correct in both directions with nothing to keep in step.
//
// `setupLoaded && !setupUnavailable` for the same reason `firstRun` carries it:
// with the three list reads unanswered, `setupDone` is 0 because nothing has
// been counted, not because nothing exists.
const {
  paused: onboardingPaused,
  intent: onboardingIntent,
  requestResume
} = useOnboarding()

const resumeVisible = computed(
  () =>
    onboardingPaused.value &&
    setupLoaded.value &&
    !setupUnavailable.value &&
    setupDone.value === 0
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
    : 'Finish the setup steps above and this screen fills in with live activity.'
)

const title = computed(() =>
  firstRun.value ? "Let's get your activity data flowing" : 'Dashboard'
)

const subtitle = computed(() => {
  // Nothing under the headline on the first run: "last hour · updated 10:32"
  // frames a measurement, and on the first run there is none to frame —
  // printing it would be the confident-zero mistake in sentence form.
  if (firstRun.value) return ''
  const lead =
    'See how customer activity moves through Sfere, from your sources to your destinations'
  const at = formatClock(updatedAt.value)
  return at ? `${lead} · updated ${at}` : lead
})

onMounted(refresh)
</script>
