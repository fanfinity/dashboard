<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the band and the rows, so all three
         share a left AND a right edge. Same measure and the same
         reasoning as DashboardHomePage.vue: 1400px is deliberately wider than
         `--container-sfere-page` (80rem), which is the marketing-site measure
         and left ~40% of a wide monitor empty here, and it sits on the page
         rather than in MainLayout because the layout is shared with screens
         that want the whole width. Literal, not a token: Tailwind v4 extracts
         class names from source text. A plain block div — `flex` here would be
         one of Quasar's unlayered wrapping containers. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Destinations"
        subtitle="Where your data is stored or delivered after it leaves a source."
      >
        <template #actions>
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

      <!-- The one thing somebody arriving here does not know: they do not have
           to go and buy a warehouse first.

           THE COPY IS DELIBERATELY NOT THE PROTOTYPE'S "Your Sfere Data
           Warehouse is already set up for you." Two things make that sentence
           false on a real account. It is singular, and the backend provisions a
           ClickHouse destination PER SOURCE — three web sources give three of
           them, not one. And it is past tense, so on a brand-new account it
           would sit directly above an empty table claiming a warehouse that
           does not exist yet. "Sfere sets up your data warehouse for you" is
           true at zero destinations and at five, and the mechanic that makes it
           plural is stated in the body rather than papered over. -->
      <IntroBand
        class="mb-5"
        tone="brand"
        storage-key="destinations-intro"
        eyebrow="Included from day one"
        title="Sfere sets up your data warehouse for you."
        :body="INTRO_BODY"
        :points="INTRO_POINTS"
      >
        <template #aside>
          <DestinationMarkCard
            subtype="clickhouse"
            title="Sfere Data Warehouse"
            subtitle="Powered by ClickHouse"
            badge="Included with Sfere"
          />
        </template>
      </IntroBand>

      <!-- `grid gap-1`, never `mt-*` on the `<p>`: every paragraph in this
           repo carries Quasar's unlayered `margin: 0 0 16px`, so a layered
           `mt-1` computes to zero and the pair renders on a flat 16px rhythm
           (collision #5). `sfere-flush` zeroes the bottom margin the same rule
           would otherwise leave under the last line. -->
      <div class="sfere-flush mb-3 grid gap-1">
        <h2 class="font-sfere-display text-sfere-h4! font-bold text-sfere-fg"
          >Your destinations</h2
        >
        <p class="text-sfere-xs text-sfere-fg-muted"
          >Destinations currently available to your pipes.</p
        >
      </div>

      <!-- The four states DataTable used to own. Hand-composed here because the
           rows are cards rather than a table, but out of the SAME kit
           components — `ErrorState` and `EmptyState` carry the only two
           `data-smoke` attributes in the repo, and scripts/smoke.mjs has
           nothing to assert on if a screen hand-rolls its own. -->
      <LoadingState v-if="loading" variant="table" :rows="4" />

      <ErrorState v-else-if="error" :message="error" @retry="load" />

      <EmptyState
        v-else-if="apiMissing"
        title="No API yet"
        description="This screen doesn't have a live backend endpoint yet. Switch back to demo data in Settings, or check back once it ships."
      />

      <!-- There is deliberately no "add a destination" row under the list: the
           header already carries that action, and a second one at the bottom
           competes with the data. An EmptyState `#cta` is the exception, and
           only because it renders when there is no data to compete with. -->
      <EmptyState
        v-else-if="!destinations.length"
        title="No destinations yet"
        description="Connect a website or store source and Sfere provisions one for you, or add a warehouse of your own."
      >
        <template #cta>
          <SfereButton
            variant="primary"
            size="sm"
            :to="{ name: 'destinations-new' }"
            >New destination</SfereButton
          >
        </template>
      </EmptyState>

      <!-- `@container` here and the queries on the ROW, because a container
           query is answered by a container's descendants and never by the
           container itself. Viewport breakpoints would be the wrong question:
           the sidebar collapses without changing the viewport, so one 1024px
           window has two content widths (collision #6).

           `grid gap-2.5` and not `flex flex-col`: Quasar's unlayered `.flex` is
           a WRAPPING flex, so a column of cards would wrap into a second column
           rather than growing (collision #4). -->
      <div v-else class="@container grid gap-2.5">
        <DestinationInstanceRow
          v-for="destination in destinations"
          :key="destination.id"
          :destination="destination"
          :activity="activityByDestinationId.get(destination.id) ?? null"
          :actions="rowActions(destination)"
          @action="onRowAction(destination, $event)"
        />
      </div>

      <ConfirmDialog
        v-model="confirmToggle"
        :title="toggleTitle"
        :message="toggleMessage"
        :confirm-label="toggleConfirmLabel"
        @confirm="toggle"
      />
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import SetupReminderStrip from '@/components/shell/SetupReminderStrip.vue'
import { useSetupProgress } from '@/composables/useSetupProgress'
import IntroBand from '@/components/ui/IntroBand.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import DestinationMarkCard from '@/components/destinations/DestinationMarkCard.vue'
import DestinationInstanceRow from '@/components/destinations/DestinationInstanceRow.vue'
import { useDestinations } from '@/composables/useDestinations'
import { useFlowActivity } from '@/composables/useFlowActivity'
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

const $q = useQuasar()
const { destinations, loading, error, apiMissing, load, setEnabled } =
  useDestinations()

// Pipes and delivery counts for the two cells the `Destination` record itself
// cannot fill. Its failures are deliberately NOT wired into `loading` or
// `error` above: this is the secondary layer on a screen whose subject is the
// destination list, so a missing aggregate degrades a couple of cells to
// "Not known" rather than taking the list down.
const { byDestinationId: activityByDestinationId, load: loadActivity } =
  useFlowActivity()

const INTRO_BODY =
  'Sfere provides the warehouse your customer activity lands in, powered by ClickHouse and covered by your Sfere account, so there is nothing to buy or provision before you start collecting. Connecting a website or store source creates one automatically and it appears in the list below.'

const INTRO_POINTS = [
  'Warehouse cost covered by Sfere',
  'Powered by ClickHouse',
  'Provisioned with your source',
  'Ready for your pipes'
]

// FOUR THINGS CAME OFF THIS SCREEN, and they are the same four the Sources list
// lost in the same pass, for the same reason: the prototype has none of them,
// and each was chrome standing between the reader and the list.
//
// - The All / Enabled / Paused filter tabs. A destination's state is on its own
//   card now, in a chip; a control above the list to hide two of three states is
//   for a list long enough to need one.
// - The search box. Same reason, and the same thing to revisit first if an
//   account ever carries enough destinations to scroll.
// - The four sortable columns. What survived of them is on the card: Type is the
//   line under the name, Status is the chip, and Created is dropped outright —
//   the prototype's third cell is who provisioned the warehouse, which answers a
//   question somebody actually has, and a creation date on a record you did not
//   create yourself answers none.
// - `DataTable` itself. The prototype's cell is a two-line pair, so a table
//   would need eight columns to say what four pairs say.
//
// THE PIPE COUNT IS BACK, and it is a different field rather than a reprieve for
// the one this table dropped. `destinations.json`'s `pipeCount` is still a
// fixture invention with nothing behind it on the backend's `Destination`;
// `DashboardDestinationStat.pipe_count` is real, and `useFlowActivity()` reads
// it out of the same aggregate call the Sources list uses. `deliveryCountLastHour`
// stays gone for its own reason: `events_delivered` is explicitly null when the
// analytics store is unavailable, so it can only appear where null and zero are
// told apart — which is the row's amber state, not a printed number.

// Built per row rather than hoisted to a module constant: the label depends on
// `row.isEnabled`. It reads "deliveries", not "destination", because that is
// what the confirm dialog below names — the menu item and the button that
// carries it out must not describe the same action two ways.
function rowActions(row) {
  return [
    row.isEnabled
      ? { key: 'toggle', label: 'Pause deliveries', icon: 'pause' }
      : { key: 'toggle', label: 'Enable deliveries', icon: 'play' }
  ]
}

// The menu never acts, so this lands on the confirm the old row button opened —
// which still asks in BOTH directions.
function onRowAction(row, key) {
  if (key === 'toggle') askToggle(row)
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
  // Neither of these is awaited alongside `load()`: both are secondary, and a
  // slow read on either must not hold the list's first paint.
  loadSetupProgress()
  loadActivity()
})
</script>
