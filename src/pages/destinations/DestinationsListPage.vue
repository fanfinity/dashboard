<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the band, the tabs and the table, so
         all four share a left AND a right edge. Same measure and the same
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
        subtitle="Where routed events are delivered: warehouses, ad platforms and webhooks."
      >
        <template #actions>
          <ToolbarSearch v-model="query" placeholder="Search destinations..." />
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

      <TabNav v-model="tab" :tabs="tabs" />

      <DataTable
        :columns="columns"
        :rows="filtered"
        :loading="loading"
        :error="error"
        :api-missing="apiMissing"
        row-key="id"
        clickable-rows
        @retry="load"
        @row-click="open"
      >
        <template #cell-name="{ row }">
          <div class="sfere-flush grid gap-0.5">
            <p class="font-medium text-sfere-fg">{{ row.name }}</p>
            <p class="text-sfere-xs text-sfere-fg-muted">{{
              row.description || `/${row.slug}`
            }}</p>
          </div>
        </template>

        <!-- `grid grid-flow-col`, not `flex`: Quasar ships an unlayered
             `.flex { flex-wrap: wrap }` and has no `.grid` of its own, so the
             mark and its label cannot be split across two lines by a long
             type name. CLAUDE.md collision #4. -->
        <template #cell-destinationType="{ value }">
          <span class="grid grid-flow-col items-center justify-start gap-2">
            <SfereIconChip size="sm">
              <FlowNodeIcon kind="destination" :subtype="value" :size="18" />
            </SfereIconChip>
            <span class="text-sfere-sm text-sfere-fg">{{
              typeLabel(value) || NOT_KNOWN
            }}</span>
          </span>
        </template>

        <template #cell-isEnabled="{ value }">
          <StatusBadge
            :tone="value ? 'success' : 'neutral'"
            :label="value ? 'Enabled' : 'Paused'"
          />
        </template>

        <template #cell-createdAt="{ value }">{{ formatDate(value) }}</template>

        <!-- A one-item menu, on purpose. This screen has only ever offered
             the pause toggle (there is no row-level delete here), but Sources,
             Destinations and Pipes are read as one set, and a bare text button
             on two of the three makes the same column mean something different
             per screen. Do not "simplify" it back to a button without changing
             all three. No wrapper element: the column is `align: 'right'`, so
             SfereTable's `text-right` already pushes RowActionsMenu's
             inline-grid root to the cell's right edge. -->
        <template #cell-actions="{ row }">
          <RowActionsMenu
            :label="`Actions for ${row.name}`"
            :actions="rowActions(row)"
            @select="onRowAction(row, $event)"
          />
        </template>

        <!-- Two different "no rows" situations: nothing exists yet (offer the
             primary action) versus a filter that matched nothing (offer a way
             back). Both go through EmptyState, so the smoke run still reads
             data-smoke="empty" rather than mistaking either for a failure.

             There is deliberately no "add a destination" row under the table:
             the header already carries that action, and a second one at the
             bottom of a list is a control that competes with the data. -->
        <template #empty>
          <EmptyState
            v-if="destinations.length"
            title="No destinations match your filters"
            :description="`None of the ${destinations.length} destinations match this search or tab.`"
          >
            <template #cta>
              <SfereButton variant="secondary" size="sm" @click="clearFilters"
                >Clear filters</SfereButton
              >
            </template>
          </EmptyState>

          <EmptyState
            v-else
            title="No destinations yet"
            description="Connect a website or store source and Sfere provisions one for you, or add a warehouse of your own."
          >
            <template #cta>
              <SfereButton size="sm" :to="{ name: 'destinations-new' }"
                >New destination</SfereButton
              >
            </template>
          </EmptyState>
        </template>
      </DataTable>

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
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import SetupReminderStrip from '@/components/shell/SetupReminderStrip.vue'
import { useSetupProgress } from '@/composables/useSetupProgress'
import IntroBand from '@/components/ui/IntroBand.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import FlowNodeIcon from '@/components/flow/FlowNodeIcon.vue'
import DestinationMarkCard from '@/components/destinations/DestinationMarkCard.vue'
import { destinationTypeLabel as typeLabel } from '@/components/destinations/destinationTypeLabels'
import { formatDate, useDestinations } from '@/composables/useDestinations'
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

const router = useRouter()
const $q = useQuasar()
const { destinations, loading, error, apiMissing, load, setEnabled } =
  useDestinations()

const query = ref('')
const tab = ref('all')

const INTRO_BODY =
  'Sfere provides the warehouse your customer activity lands in, powered by ClickHouse and covered by your Sfere account, so there is nothing to buy or provision before you start collecting. Connecting a website or store source creates one automatically and it appears in the list below.'

const INTRO_POINTS = [
  'Warehouse cost covered by Sfere',
  'Powered by ClickHouse',
  'Provisioned with your source',
  'Ready for your pipes'
]

// EVERY COLUMN HERE IS A FIELD OF THE BACKEND'S `Destination`, which is what
// took this table from six columns to four.
//
//   Pipes            `pipeCount` is a `destinations.json` invention. The same
//                    column was already deleted from the Sources list for
//                    exactly this reason; keeping it here made the app
//                    inconsistent with itself as well as wrong. The real count
//                    is on the detail screen, derived from usePipes().
//   Delivered (1h)   `deliveryCountLastHour`, same story, and worse: it went
//                    through formatCount, which prints a confident `0` for
//                    `undefined` — an assertion that nothing was delivered.
//   Template         `templateId` is fixture-only too, and the badge's fallback
//                    reads "Custom / hand-configured, not created from a
//                    template", which is false for every ClickHouse destination
//                    the backend provisions itself. `destination_type` is the
//                    real field and answers the same question better.
const columns = [
  { key: 'name', label: 'Destination', sortable: true },
  { key: 'destinationType', label: 'Type', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'createdAt', label: 'Created', sortable: true, align: 'right' },
  // 72px: SfereTable pads a cell `px-4` either side of a 36px kebab. The
  // 120px this held was measured for a text button, and keeping it would spend
  // the width this page just reclaimed on an empty gutter.
  { key: 'actions', label: '', align: 'right', width: '72px' }
]

const tabs = computed(() => [
  { key: 'all', label: 'All', count: destinations.value.length },
  {
    key: 'enabled',
    label: 'Enabled',
    count: destinations.value.filter(d => d.isEnabled).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: destinations.value.filter(d => !d.isEnabled).length
  }
])

const TAB_PREDICATES = {
  enabled: d => d.isEnabled,
  paused: d => !d.isEnabled
}

// Every field the user can read off the row, so searching "clickhouse" matches
// the type as well as the name.
const SEARCH_FIELDS = ['name', 'slug', 'description', 'destinationType']

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return destinations.value.filter(d => {
    if (predicate && !predicate(d)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(d[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function open(row) {
  router.push({ name: 'destinations-detail', params: { id: row.id } })
}

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
  // Deliberately not awaited alongside `load()`: the strip is secondary, and a
  // slow setup read must not hold the table's first paint.
  loadSetupProgress()
})
</script>
