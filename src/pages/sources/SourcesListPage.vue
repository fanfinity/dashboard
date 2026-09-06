<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the bands and the rows, so all three
         share a left AND a right edge. Same measure and the same reasoning as
         DashboardHomePage.vue: 1400px is deliberately wider than
         `--container-sfere-page` (80rem), which is the marketing-site measure
         and left ~40% of a wide monitor empty here, and it sits on the page
         rather than in MainLayout because the layout is shared with screens
         that want the whole width. Literal, not a token: Tailwind v4 extracts
         class names from source text. A plain block div — `flex` here would be
         one of Quasar's unlayered wrapping containers. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Sources"
        subtitle="The places where customer activity enters Sfere."
      >
        <template #actions>
          <SfereIconButton
            icon="plus"
            label="New source"
            variant="primary"
            :to="{ name: 'sources-new' }"
          />
        </template>
      </PageHeader>

      <!-- Where this screen sits in first-run setup. One line only; the
           full tracker is on the Dashboard, deliberately in one place. -->
      <SetupReminderStrip
        step="source"
        :steps="setupSteps"
        :total="setupTotal"
        :complete="setupComplete"
        :unavailable="setupUnavailable"
      />

      <!-- What a source IS, for somebody who has not met the word before.
           DISMISSIBLE, and that is the whole reason it can exist: this sentence
           is worth a lot on the first visit and nothing on the hundredth, and a
           permanent band would tax every later visit to pay for the first one.
           `IntroBand` remembers the dismissal per browser. -->
      <IntroBand
        class="mb-6"
        storage-key="sources-intro"
        eyebrow="Start with where activity happens"
        title="A source connects customer activity to Sfere."
        body="Your website, online store, or mobile app can each be a source.
          You can connect more than one of the same type, for example two
          websites or multiple stores. Each connection becomes its own source
          and can have its own pipe."
      >
        <!-- The aside answers the question the body provokes: "and then what?".
             It is the same promise the first-run overlay makes, said again where
             somebody who skipped that overlay will meet it. -->
        <template #aside>
          <div
            class="sfere-flush grid max-w-[26rem] gap-1.5 rounded-sfere-lg border border-sfere-line bg-sfere-fill p-4"
          >
            <p class="text-sfere-sm font-semibold text-sfere-fg"
              >What happens after you add one?</p
            >
            <p class="text-sfere-xs text-sfere-fg-muted"
              >Sfere receives the activity, prepares your included Sfere Data
              Warehouse powered by ClickHouse, and creates the first data flow.
              You can add or change destinations and pipes later.</p
            >
          </div>
        </template>
      </IntroBand>

      <!-- `grid gap-1`, never `mt-*` on the `<p>`: every paragraph in this repo
           carries Quasar's unlayered `margin: 0 0 16px`, so a layered `mt-1`
           computes to zero and the pair renders on a flat 16px rhythm
           (collision #5). `sfere-flush` zeroes the bottom margin the same rule
           would otherwise leave under the last line. -->
      <div class="sfere-flush mb-3 grid gap-1">
        <h2 class="font-sfere-display text-sfere-h4! font-bold text-sfere-fg"
          >Your sources</h2
        >
        <p class="text-sfere-xs text-sfere-fg-muted"
          >Every connected instance appears separately, even when two sources
          are the same type.</p
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

      <EmptyState
        v-else-if="!sources.length"
        title="No sources yet"
        description="Connect a website, an online store or a mobile app to start collecting customer activity."
      >
        <template #cta>
          <SfereButton variant="primary" size="sm" :to="{ name: 'sources-new' }"
            >Connect your first source</SfereButton
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
        <SourceInstanceRow
          v-for="source in sources"
          :key="source.id"
          :source="source"
          :activity="activityBySourceId.get(source.id) ?? null"
          :actions="rowActions(source)"
          @action="onRowAction(source, $event)"
        />
      </div>

      <!-- Same verb and the same sentence as the detail screen's confirm: one
           action told two ways is how "Delete" and "Move to trash" ended up
           describing the same 204. -->
      <ConfirmDialog
        v-model="confirmDelete"
        :title="deleteTitle"
        :message="deleteMessage"
        confirm-label="Delete source"
        destructive
        @confirm="remove"
      />
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
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SetupReminderStrip from '@/components/shell/SetupReminderStrip.vue'
import IntroBand from '@/components/ui/IntroBand.vue'
import SourceInstanceRow from '@/components/sources/SourceInstanceRow.vue'
import { useSetupProgress } from '@/composables/useSetupProgress'
import { useSources } from '@/composables/useSources'
import { useFlowActivity } from '@/composables/useFlowActivity'
import { notifyMutationResult } from '@/composables/useMutationFeedback'

// THE SCREEN IS THE PROTOTYPE'S: a header, two teaching cards, "Your sources",
// and one bordered card per connected instance. Four things it used to carry
// are gone, and the reasoning is the same for all four — the prototype has none
// of them and each was chrome standing between the reader and the list.
//
// - Event streams / Connectors tabs. The catalog is a screen again at
//   `/connectors`, a SUB-screen of this one, so it keeps a back link and stays
//   off the sidebar. See ConnectorsPage.vue.
// - Zid stores / Salla stores tabs. `ZidConnectionsPanel.vue` and
//   `SallaConnectionsPanel.vue` are left in place unreferenced, the same way
//   `PipeFlow.vue` and the ten `*TrashPage.vue` files were. Authorising a store
//   is unaffected: `ZidAuthorizePanel` is still on the create form and
//   `ZidSetupWizard` is still on the source detail screen, which is where a
//   merchant meets both.
// - The All / Enabled / Paused pill row. A source's state is on its own card
//   now, in a chip that says which of three things is true; a filter above the
//   list to hide two of them is a control for a list long enough to need one.
// - The search box. Same reason, and the same thing to revisit first if an
//   account ever carries enough sources to scroll.

const {
  steps: setupSteps,
  total: setupTotal,
  complete: setupComplete,
  unavailable: setupUnavailable,
  load: loadSetupProgress
} = useSetupProgress()

const $q = useQuasar()
const {
  sources,
  loading,
  error,
  apiMissing,
  load,
  setEnabled,
  remove: removeSource
} = useSources()

// Pipes, destinations and event counts for the three cells the `Source` record
// itself cannot fill. Its failures are deliberately NOT wired into `loading` or
// `error` above: this is the secondary layer on a screen whose subject is the
// source list, so a missing aggregate degrades three cells to "Not known"
// rather than taking the table down — the rule `PipeFunctionChips` follows for
// its own library read.
const { bySourceId: activityBySourceId, load: loadActivity } = useFlowActivity()

const confirmDelete = ref(false)
const target = ref(null)

// Built per row rather than hoisted to a module constant: the first label
// depends on `row.isEnabled`. Each label is word for word the matching
// ConfirmDialog's confirm button, so the menu item and the button that carries
// it out never describe the same action two ways.
function rowActions(row) {
  return [
    row.isEnabled
      ? { key: 'toggle', label: 'Pause source', icon: 'pause' }
      : { key: 'toggle', label: 'Enable source', icon: 'play' },
    {
      key: 'delete',
      label: 'Delete source',
      icon: 'trash',
      tone: 'destructive'
    }
  ]
}

// The menu never acts, so both branches land on a confirm — Pause included,
// which still asks in BOTH directions.
function onRowAction(row, key) {
  if (key === 'toggle') askToggle(row)
  else if (key === 'delete') ask(row)
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
  toggleTarget.value?.isEnabled ? 'Pause this source?' : 'Enable this source?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause source' : 'Enable source'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops collecting events straight away. Anything already delivered stays where it is, and you can enable it again at any time.`
    : `“${row.name}” starts collecting events again straight away.`
})

async function toggle() {
  const row = toggleTarget.value
  if (!row) return
  const wasEnabled = row.isEnabled
  const res = await setEnabled(row.id, !wasEnabled)
  notifyMutationResult($q, res, {
    success: `${row.name} ${wasEnabled ? 'paused' : 'enabled'}`,
    apiMissing: `Can't ${wasEnabled ? 'pause' : 'enable'} ${row.name} yet.`
  })
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

const deleteTitle = computed(() =>
  target.value ? `Delete “${target.value.name}”?` : 'Delete this source?'
)

// The closing sentence is interim, and it is the honest one: the backend's
// DELETE is a hard 204 with no soft delete, no trash listing and no restore, so
// "restorable for 30 days" was a promise nothing kept.
const deleteMessage = computed(() =>
  target.value
    ? `“${target.value.name}” stops collecting events straight away, and any pipe reading from it stops delivering. Events already written to a destination are untouched; they live in the warehouse, not here. Restoring from trash is not available yet, so this cannot be undone.`
    : ''
)

async function remove() {
  const row = target.value
  if (!row) return
  // `target` is deliberately NOT nulled: `deleteTitle` and `deleteMessage` both
  // read it, and this one awaits — so clearing it here blanked the dialog's
  // heading AND its sentence for the whole length of the request, not just for
  // the fade. `ask()` overwrites `target` before reopening, so nothing goes
  // stale.
  const res = await removeSource(row.id)
  notifyMutationResult($q, res, {
    success: `${row.name} deleted`,
    apiMissing: `Can't delete ${row.name} yet.`
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
