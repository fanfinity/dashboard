<template>
  <q-page class="p-6">
    <!-- One content cap for the header AND everything under it, so the <h1> and
         the cards share both edges. It sits here rather than in MainLayout on
         purpose: the layout is shared with every other screen, several of which
         want the whole width. 1400px is deliberately wider than
         `--container-sfere-page` (80rem / 1280px) — that token is the
         marketing-site measure and left ~40% of a wide monitor empty here. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Dashboard"
        subtitle="See how customer activity moves through Sfere, from your sources to your destinations"
      >
        <!-- THE ONE PIECE OF WARMTH ON THE SCREEN, and it is a <p> above the
             <h1> rather than part of it: scripts/smoke.mjs asserts on the first
             heading, and "Hello Anas 👋" is not the name of this screen. It is
             deliberately NOT the mono uppercase `eyebrow` prop — that voice is
             for section labels — hence the slot on PageHeader. The name is read
             off `/v1/me` and the greeting drops it rather than guessing when
             there is nothing name-shaped to read; see `friendlyName`. -->
        <template #eyebrow>
          <p class="text-sfere-sm font-medium text-sfere-fg-muted">{{
            greeting
          }}</p>
        </template>

        <template #actions>
          <!-- THE CLOCK BELONGS TO REFRESH, NOT TO THE SUBTITLE. It used to be
               appended to the purpose sentence as `… to your destinations ·
               updated 17:10`, which pushed that sentence just past
               PageHeader's `max-w-2xl` measure and wrapped the time onto a line
               of its own under the <h1> — a two-line subtitle whose second line
               was four characters. It is a reading of the data rather than a
               statement of what the screen is for, so it sits beside the
               control that takes it again. A <span>, not a <p>: Quasar's
               unlayered `p { margin: 0 0 16px }` would push it off the row's
               baseline (CLAUDE.md collision #5). -->
          <span v-if="updatedLabel" class="text-sfere-xs text-sfere-fg-muted">{{
            updatedLabel
          }}</span>
          <!-- Default size, deliberately. These two shipped at `size="sm"` and
               were the only header actions in the app at that size, drawing the
               Dashboard's verbs as a squatter, wider pill than Sources or Pipes
               draw theirs. `md` is the kit default and is the house row height
               — 40px, the same as SfereIconButton `md` (`size-10`) and the
               `h-10` input ToolbarSearch wraps; `sm` is 36px and `lg` is 44px.
               Those are pinned in SfereButton's own `min-h-*` ramp now rather
               than falling out of the padding, which is what let a bordered
               `secondary` stand 2px taller than a borderless `primary` in this
               very row and draw its label a weight lighter besides. See
               CLAUDE.md collision #9 — nothing on this page works around it. -->
          <SfereButton
            variant="secondary"
            :loading="loading"
            @click="refresh"
            >{{ loading ? 'Refreshing…' : 'Refresh' }}</SfereButton
          >
          <!-- ONE PRIMARY AT A TIME. The header carries this on every
               populated state, which is the convention on all fourteen list
               screens and the reason neither empty column in the topology used
               to have a button of its own. When a band is up, though, that band
               IS the call to action — bigger, with the sentence explaining it —
               and a second identical pill 40px above it just makes the reader
               check whether the two do the same thing. Refresh stays either
               way. -->
          <SfereButton v-if="!bandVisible" :to="{ name: 'sources-new' }"
            >Connect a source</SfereButton
          >
        </template>
      </PageHeader>

      <!-- The door back into a parked arrival, and the only setup surface on
           this screen: the three-step tracker that used to sit under it is
           gone, so Sources, Destinations and Pipes carry the one-line
           `SetupReminderStrip` and this band answers "you left the welcome flow
           part-way" for the one reader who did. It removes itself the moment a
           source exists — see `resumeVisible`. -->
      <SetupResumeBand
        v-if="resumeVisible"
        :intent="onboardingIntent ?? ''"
        @resume="requestResume"
      />

      <!-- No source on the account at all — whatever anybody did or did not do
           during sign-up. Mutually exclusive with the band above (that one is
           about a parked arrival, this one about the account) and it removes
           itself the moment a source exists, so neither is dismissible. -->
      <WorkspaceReadyBand
        v-else-if="workspaceReadyVisible"
        :has-warehouse="hasWarehouse"
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

      <template v-else>
        <!-- 3. The aggregate has no endpoint. Distinct from "nothing is flowing"
             and it has to stay distinct: a 404 and an idle workspace look
             identical in the data and mean opposite things to the reader. -->
        <EmptyState
          v-if="apiMissing"
          title="No API yet"
          description="The dashboard overview endpoint is not available for this
            account, so there is nothing to summarise. Sources, Destinations and
            Pipes each still read their own endpoint."
        />

        <!-- 4. Anything else — including an account with nothing on it at all.
             THERE USED TO BE A FIFTH BRANCH HERE and its removal is a
             considered reversal. An `isEmpty` guard sent a workspace with no
             source, destination or pipe to a bare `EmptyState`, on the stated
             grounds that `flow.*.total` is `items.length` on an array that is
             empty both when the workspace is empty and when the read never
             happened. The second half of that is answered one branch up: with
             `apiMissing` and `error` both false the read succeeded, so a zero
             here was counted rather than missed, which is precisely the
             distinction `src/lib/emptyValue.js` exists to let a screen make.

             What it cost was the one reader who most needed a picture. A new
             account got a sentence in the middle of an empty card, while the
             topology — two dashed placeholders, the hub, and the rail between
             them — says the same thing and also says what the shape of the
             answer will be. The band above names the next step, and the counts
             below are four honest zeroes. -->

        <!-- 5. Populated.
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
                     header already carries `Connect a source`, so one here
                     would sit a few hundred pixels below an identical control.
                     Every add affordance on this app lives in the header; a
                     second copy inside the content is the duplicate row this
                     port was asked to keep out. The copy still names the next
                     step, and the control for it is the one already on
                     screen. -->
                <template #sources-empty>
                  <div
                    class="flex flex-nowrap! items-center justify-between gap-4 rounded-sfere-lg border border-dashed border-sfere-line bg-sfere-fill p-4"
                  >
                    <div class="sfere-flush grid min-w-0 flex-1 gap-1.5">
                      <p class="text-sfere-sm font-semibold text-sfere-fg"
                        >No sources connected yet</p
                      >
                      <p class="text-sfere-xs text-sfere-fg-muted"
                        >A website, an online store, a mobile app or your own
                        backend.</p
                      >
                    </div>
                    <!-- THIS REVERSES "NO BUTTON IN EITHER EMPTY COLUMN", and
                         only for the sources one. The old rule was right about
                         its reason — the header carries `Connect a source`, so
                         a second copy a few hundred pixels below it is the
                         duplicate row this port was asked to keep out — and the
                         header's copy is now hidden whenever a band is up,
                         which is exactly when this placeholder renders. So
                         there is no duplicate to avoid; there is an empty slot
                         in a picture, and the thing that fills it. The
                         DESTINATIONS placeholder still has none, because
                         nothing the reader can press fills it: a warehouse
                         arrives with the first source. -->
                    <SfereButton
                      class="shrink-0"
                      size="sm"
                      :to="{ name: 'sources-new' }"
                    >
                      <template #icon>
                        <SfereIcon name="plus" size="sm" />
                      </template>
                      Add source
                    </SfereButton>
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
import { computed, onMounted, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
import StatCard from '@/components/ui/StatCard.vue'
import FlowTopology from '@/components/flow/FlowTopology.vue'
import SetupResumeBand from '@/components/shell/SetupResumeBand.vue'
import WorkspaceReadyBand from '@/components/shell/WorkspaceReadyBand.vue'
import {
  formatClock,
  formatNumber,
  useDashboardHome
} from '@/composables/useDashboardHome'
import { useSetupProgress } from '@/composables/useSetupProgress'
import { useOnboarding } from '@/composables/useOnboarding'
import { me } from '@/composables/useMe'
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
  updatedAt
} = useDashboardHome()

// Setup progress is its own three reads, deliberately separate from the
// dashboard aggregate — see useSetupProgress for why it is derived rather than
// stored.
const {
  doneCount: setupDone,
  unavailable: setupUnavailable,
  loaded: setupLoaded,
  load: loadSetup
} = useSetupProgress()

// A refetch that the arrival triggered is a FIRST paint, not a manual refresh,
// and every count-derived branch on this page has to treat it as one. Until it
// lands, the counts on screen were taken before the arrival ran, so a reader who
// just watched it provision a source would see the resume band that belongs to
// the account as it was at sign-up. `setupKnown` is what those branches read
// instead of `setupLoaded`.
const settling = ref(false)

const setupKnown = computed(() => setupLoaded.value && !settling.value)

// ------------------------------------------------------- the empty workspace

/**
 * No source on the account. Not "nothing is flowing" and not "the read failed":
 * this branch is only ever reached with `apiMissing` and `error` both false, so
 * the zero was counted.
 */
const noSources = computed(() => flow.value.sources.total === 0)

// Whether there is a warehouse to describe. Read off the record rather than
// assumed from "registration provisions one": that is true today and is a
// backend behaviour this screen does not own, and the band's sentence is the
// only place on the Dashboard that says a warehouse exists. `subtype` is the
// aggregate's own `destination_type`.
const hasWarehouse = computed(() =>
  topology.value.destinations.some(d => d.subtype === 'clickhouse')
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
      // No hint at zero. "0 enabled" under a 0 restates the figure in words,
      // and on the one screen where every card reads 0 that is four lines of
      // nothing said twice.
      hint: !sources.total
        ? ''
        : sources.flowing === sources.total
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
      hint: destinations.total ? `${destinations.enabled} enabled` : ''
    },
    // THE FOURTH SLOT ANSWERS WHICHEVER QUESTION THE ACCOUNT IS ACTUALLY ON.
    // A delivery percentage is the right thing to show a working workspace and
    // the wrong thing to show one that has never received an event — over no
    // attempts it is NOT_KNOWN, which is honest and also the least useful
    // sentence on a first-run screen. With no source, the card names the step
    // instead. `Needs attention` still wins where there is something to act on,
    // and it cannot collide with this one: `attention` is empty by definition
    // before the first source exists.
    noSources.value
      ? {
          label: 'Source setup',
          value: 'Not started',
          hint: 'Connect your first source'
        }
      : attentionCount
        ? {
            label: 'Needs attention',
            value: formatNumber(attentionCount),
            hint:
              attentionCount === 1 ? 'One thing to check' : 'Things to check',
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
// `setupKnown && !setupUnavailable` because with the three list reads
// unanswered, `setupDone` is 0 because nothing has been counted, not because
// nothing exists.
const {
  paused: onboardingPaused,
  intent: onboardingIntent,
  sourceId: onboardingSourceId,
  arrivalClosedCount,
  requestResume
} = useOnboarding()

// `setupDone === 0 || the arrival made a source` — and the second half is what
// the seven-beat rebuild owes this gate. The count rule was written when the
// arrival's last question was the category and it created nothing, so any
// progress the tracker could see had to have come from somewhere else. The
// arrival creates a real source at its fifth beat now, so parking on connect,
// verify or setup — the three most likely beats to walk away from — makes
// `setupDone` at least 1 by the reader's own hand, and the band that is their
// only way back would remove itself for the work they just did. Keying the
// exception on the RECORDED source id keeps the original guarantee intact:
// somebody who parked at the category beat and built a source from the Sources
// screen an hour later has no `sourceId`, so the band still goes.
const resumeVisible = computed(
  () =>
    onboardingPaused.value &&
    setupKnown.value &&
    !setupUnavailable.value &&
    (setupDone.value === 0 || Boolean(onboardingSourceId.value))
)

// The skeleton is for the first paint only — a manual refresh keeps the
// populated screen on-screen rather than collapsing it back to grey bars.
const loaded = ref(false)

const showSkeleton = computed(
  () => (loading.value && !loaded.value) || settling.value
)

// ------------------------------------------------------------------ greeting

/**
 * The signed-in person's first name, or '' when there is nothing name-shaped to
 * read.
 *
 * `display_name` is optional on the backend `User`, so the fallback is the email
 * local part — but only when it looks like a name. `anas@…` becomes `Anas`;
 * `m.anas`, `billing`, `no-reply` and `a1b2c3` do not, because "Hello No-reply
 * 👋" is worse than no greeting at all and the whole point of the line is that
 * it sounds like a person wrote it. Returning '' is a supported answer, not a
 * failure — see `greeting`.
 */
function friendlyName(user) {
  const display = (user?.display_name ?? '').trim()
  if (display) return display.split(/\s+/)[0]

  const local = (user?.email ?? '').split('@')[0] ?? ''
  if (!/^[a-z]{2,20}$/i.test(local)) return ''
  return local[0].toUpperCase() + local.slice(1).toLowerCase()
}

const greeting = computed(() => {
  const name = friendlyName(me.value)
  return name ? `Hello ${name} 👋` : 'Welcome back 👋'
})

// The parked arrival wins where there is one: it can resume a half-finished
// flow, which is strictly more than this band's link into the create form. Both
// are gated on the same `setupKnown` as the resume band — until the three list
// reads land, `setupDone` is 0 because nothing has been counted rather than
// because nothing exists, and a band that appears and then vanishes on the same
// screen is worse than one that arrives a beat late.
const workspaceReadyVisible = computed(
  () =>
    noSources.value &&
    setupKnown.value &&
    !setupUnavailable.value &&
    !showSkeleton.value &&
    !error.value &&
    !apiMissing.value
)

// What the header reads to stand its own primary action down.
const bandVisible = computed(
  () => resumeVisible.value || workspaceReadyVisible.value
)

async function refresh() {
  await Promise.all([load(), loadSetup()])
  loaded.value = true
}

// THE ARRIVAL CLOSED OVER THIS PAGE, so everything on it is out of date.
//
// `onMounted` is not enough and cannot be: the arrival is a surface over a
// fully-rendered Home rather than a route, deliberately (a `/welcome` route
// would replace MainLayout and take `[data-smoke="nav"]` with it), so this page
// mounts BEFORE the first beat and nothing remounts it when the last one
// closes. Its reads therefore describe the account as it was at sign-up: no
// source, no destination, no pipe. That is what put a reader who had just
// watched the arrival provision all three on "Let's get your activity data
// flowing · 0 / 3 done".
//
// Refetching rather than trusting what the arrival built is the same rule
// `useSetupProgress` is built on — the tracker is derived from three list reads
// and never from a stored flag, so the way to bring it up to date is to read
// again, not to tell it what happened.
async function refreshAfterArrival() {
  settling.value = true
  try {
    await refresh()
  } finally {
    settling.value = false
  }
}

watch(arrivalClosedCount, refreshAfterArrival)

// When these numbers were taken, next to the control that takes them again.
// Absent rather than "Not known" when the aggregate carries no timestamp: this
// is chrome on a refresh button, not a measurement the screen owes the reader.
const updatedLabel = computed(() => {
  const at = formatClock(updatedAt.value)
  return at ? `Updated ${at}` : ''
})

onMounted(refresh)
</script>
