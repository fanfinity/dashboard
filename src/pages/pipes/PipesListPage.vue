<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the band, the stats, the tabs and
         whichever view the tabs swap in, so the right edge does not step in and
         out as the view changes. Literal, not a token: Tailwind v4 extracts
         class names from source text. A plain block div — `flex` here would be
         one of Quasar's unlayered wrapping containers. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Pipes"
        subtitle="The routes that move customer activity from your sources to your destinations."
      >
        <template #actions>
          <ToolbarSearch v-model="query" placeholder="Search pipes..." />
          <SfereIconButton
            icon="plus"
            label="New pipe"
            variant="primary"
            :to="{ name: 'pipes-new' }"
          />
        </template>
      </PageHeader>

      <!-- Where this screen sits in first-run setup. One line only; the
           full tracker is on the Dashboard, deliberately in one place. -->
      <SetupReminderStrip
        step="pipe"
        :steps="setupSteps"
        :total="setupTotal"
        :complete="setupComplete"
        :unavailable="setupUnavailable"
      />

      <IntroBand
        class="mb-5"
        storage-key="pipes-intro"
        eyebrow="Connect your data flow"
        title="A pipe moves activity from a source to a destination."
        body="Each pipe defines where customer activity comes from, where it is delivered, and which functions run along the way. Your first pipe to the Sfere Data Warehouse is created automatically when you connect a source."
      />

      <!-- Only cards whose number was actually measured. There is deliberately
           no "Deliveries / hr" and no "Success rate": the backend's per-window
           counters are literal zeros until ClickHouse is behind them
           (`countsMeasured`), and a confident 0 under a live pipe is worse than
           an absent card. Same reason there is no "Default destination" — every
           web/zid source create provisions its own ClickHouse destination, so
           "the" default is not something this data can name. -->
      <div
        v-if="statsVisible"
        class="mb-5 grid grid-cols-1 gap-4"
        :class="statColumns"
      >
        <StatCard
          v-for="stat in stats"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :hint="stat.hint"
          :tone="stat.tone || 'neutral'"
        />
      </div>

      <TabNav v-model="view" :tabs="tabs" />

      <!-- VISUAL -->
      <template v-if="view === 'visual'">
        <LoadingState v-if="loading" variant="grid" :rows="3" />

        <ErrorState
          v-else-if="error"
          title="Couldn't load the pipe topology."
          :message="error"
          @retry="load"
        />

        <!-- Real mode with no diagram endpoint behind it. Says so, rather than
             reporting "nothing is connected" about a read nobody made. -->
        <EmptyState
          v-else-if="diagramApiMissing"
          title="No API yet"
          description="This view is drawn from the pipeline diagram endpoint, which this account's backend does not answer yet. The List view reads the pipes themselves."
        />

        <EmptyState
          v-else-if="!filteredLinks.length"
          :title="
            query ? 'No pipes match your search' : 'Nothing is connected yet'
          "
          :description="
            query
              ? 'Nothing matched that name, source or destination.'
              : 'Once a pipe joins a source to a destination it appears here as a route.'
          "
        >
          <template v-if="query" #cta>
            <SfereButton size="sm" variant="secondary" @click="query = ''"
              >Clear search</SfereButton
            >
          </template>
        </EmptyState>

        <CardPanel v-else>
          <FlowTopology
            :sources="topology.sources"
            :destinations="topology.destinations"
            :links="topology.links"
            sources-subtitle="Where each pipe starts"
            destinations-subtitle="Where each pipe delivers"
            :sources-to="{ name: 'sources' }"
            :destinations-to="{ name: 'destinations' }"
          />
        </CardPanel>
      </template>

      <!-- LIST -->
      <DataTable
        v-else
        :columns="columns"
        :rows="filteredPipes"
        :loading="loading"
        :error="error"
        :api-missing="apiMissing"
        row-key="id"
        clickable-rows
        @retry="load"
        @row-click="open"
      >
        <template #cell-name="{ row }">
          <p class="font-medium text-ink">{{ row.name }}</p>
          <p class="text-xs text-subtle">{{ row.id }}</p>
        </template>

        <!-- `usePipes` joins both names in from Sources and Destinations; the
             backend's pipeline record carries only the two ids. An end that has
             since been deleted has neither — that is a genuinely missing value,
             not an unmeasured one, so it keeps its word. -->
        <template #cell-route="{ row }">
          <span class="text-ink">{{ row.sourceName || NOT_KNOWN }}</span>
          <span class="px-1.5 text-subtle">→</span>
          <span class="text-ink">{{
            row.eventDestinationName || NOT_KNOWN
          }}</span>
        </template>

        <template #cell-functions="{ row }">
          <PipeFunctionChips
            :names="functionNamesByPipe[row.id] || []"
            :known="functionsKnown"
          />
        </template>

        <template #cell-isEnabled="{ value }">
          <StatusBadge
            :tone="value ? 'success' : 'neutral'"
            :label="value ? 'Enabled' : 'Paused'"
          />
        </template>

        <template #cell-updatedAt="{ value }">
          {{ formatDate(value) }}
        </template>

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

        <!-- No "New pipe" button in here: PageHeader renders one in every state
             on this screen, and two add affordances on one page is one too
             many. Clearing a search is the only thing this state can offer that
             the header cannot. -->
        <template #empty>
          <EmptyState
            :title="query ? 'No pipes match your search' : 'No pipes yet'"
            :description="
              query
                ? 'Nothing matched that name, source or destination.'
                : 'A pipe carries events from one source into one destination. Connect a source and the first pipe is built for you.'
            "
          >
            <template v-if="query" #cta>
              <SfereButton size="sm" variant="secondary" @click="query = ''"
                >Clear search</SfereButton
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
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import IntroBand from '@/components/ui/IntroBand.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import FlowTopology from '@/components/flow/FlowTopology.vue'
import PipeFunctionChips from '@/components/pipes/PipeFunctionChips.vue'
import { useDiagram } from '@/composables/useDiagram'
import { useFunctions } from '@/composables/useFunctions'
import { formatCount, formatDate, usePipes } from '@/composables/usePipes'
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

const {
  pipes,
  loading: pipesLoading,
  error: pipesError,
  apiMissing,
  load: loadPipes,
  enabledCount,
  setEnabled
} = usePipes()

const {
  diagram,
  nodes,
  loading: diagramLoading,
  error: diagramError,
  apiMissing: diagramApiMissing,
  load: loadDiagram
} = useDiagram()

// The account's function library, read ONCE for the whole table.
// `FunctionDefinition.attached_pipeline_ids` is a real backend field, so this
// inverts to pipe → function names without one request per row. Deliberately
// not folded into `error` below: the chips are an extra on the row, and a
// failed library read must not take the pipe list down with it.
const {
  functions: functionLibrary,
  error: functionsError,
  apiMissing: functionsApiMissing,
  load: loadFunctions
} = useFunctions()

// Two files, one origin: they fail together, so the screen shows one ErrorState
// with one Retry rather than two competing failure surfaces.
const loading = computed(() => pipesLoading.value || diagramLoading.value)
const error = computed(() => pipesError.value || diagramError.value)

async function load() {
  await Promise.all([loadPipes(), loadDiagram()])
}

const query = ref('')
// Visual first, as the prototype has it: the shape of the flow is the answer
// most people open this screen for, and the table is the detail behind it.
const view = ref('visual')

const columns = [
  { key: 'name', label: 'Pipe', sortable: true },
  { key: 'route', label: 'Route' },
  { key: 'functions', label: 'Functions' },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' },
  // 72px: SfereTable pads a cell `px-4` either side of a 36px kebab.
  { key: 'actions', label: '', align: 'right', width: '72px' }
]

// The search box matches a pipe by its own name or by either end of its route —
// "snowflake" should find every pipe pointing at Snowflake, not only the one
// whose name happens to contain the word.
function matches(name, sourceName, destinationName) {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  return [name, sourceName, destinationName].some(v =>
    String(v ?? '')
      .toLowerCase()
      .includes(q)
  )
}

const filteredPipes = computed(() =>
  pipes.value.filter(p => matches(p.name, p.sourceName, p.eventDestinationName))
)

const filteredLinks = computed(() =>
  nodes.value.links.filter(l =>
    matches(l.pipe.name, l.source.name, l.destination.name)
  )
)

const functionsKnown = computed(
  () => !functionsApiMissing.value && !functionsError.value
)

/** pipe id → the names of the functions attached to it. */
const functionNamesByPipe = computed(() => {
  const out = {}
  for (const fn of functionLibrary.value) {
    for (const pipelineId of fn.attachedPipelineIds ?? []) {
      if (!out[pipelineId]) out[pipelineId] = []
      out[pipelineId].push(fn.name)
    }
  }
  return out
})

// `status` on a diagram edge is the backend's own Status5 and is real — but the
// Demo fixture carries none, so a "0 need attention" card there would be a
// measurement nobody took. One string anywhere is what makes the count real.
const statusKnown = computed(() => diagram.value.pipes.some(p => p.status))

const attentionCount = computed(
  () =>
    diagram.value.pipes.filter(
      p => p.isEnabled && (p.status === 'degraded' || p.status === 'failing')
    ).length
)

// Distinct destinations the pipes actually deliver into — derived from the
// links already on screen, so it is measured wherever the picture is.
const destinationsInUse = computed(
  () => new Set(nodes.value.links.map(l => l.destination.id)).size
)

const stats = computed(() => {
  const out = [
    {
      label: 'Total pipes',
      value: formatCount(pipes.value.length),
      hint: 'All configured routes'
    },
    {
      label: 'Active',
      value: `${enabledCount.value} of ${pipes.value.length}`,
      hint: 'Enabled right now'
    }
  ]

  if (statusKnown.value) {
    out.push({
      label: 'Needs attention',
      value: formatCount(attentionCount.value),
      hint: 'Reported degraded or failing',
      tone: attentionCount.value > 0 ? 'warn' : 'neutral'
    })
  }

  if (nodes.value.links.length) {
    out.push({
      label: 'Destinations in use',
      value: formatCount(destinationsInUse.value),
      hint: 'Receiving from at least one pipe'
    })
  }

  return out
})

const statsVisible = computed(
  () => !loading.value && !error.value && pipes.value.length > 0
)

// Written as literals rather than built from the count: Tailwind v4 extracts
// class names from source text, so `xl:grid-cols-${n}` would never be emitted.
const STAT_COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 xl:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4'
}

const statColumns = computed(
  () => STAT_COLUMNS[stats.value.length] ?? 'sm:grid-cols-2'
)

/**
 * The three arrays FlowTopology draws.
 *
 * `status` is passed through only where the endpoint sent one — FlowNode omits
 * its chip on an empty string, which is the honest answer for a fixture that
 * reports no health at all. `hint` is a pipe count, which is measured
 * everywhere; there is deliberately no "24.5K events/hr" under a node.
 */
const topology = computed(() => {
  const links = filteredLinks.value
  const filtering = Boolean(query.value.trim())
  const keptSources = new Set(links.map(l => l.source.id))
  const keptDestinations = new Set(links.map(l => l.destination.id))

  const sources = nodes.value.sources
    .filter(s => !filtering || keptSources.has(s.id))
    .map(s => ({
      id: s.id,
      name: s.name,
      subtype: s.sourceType ?? '',
      hint: `${s.pipes.length} pipe${s.pipes.length === 1 ? '' : 's'}`,
      status: s.status ?? '',
      isEnabled: s.isEnabled !== false,
      to: { name: 'sources-detail', params: { id: s.id } }
    }))

  const destinations = nodes.value.destinations
    .filter(d => !filtering || keptDestinations.has(d.id))
    .map(d => ({
      id: d.id,
      name: d.name,
      subtype: d.destinationType ?? '',
      hint: `${d.pipes.length} pipe${d.pipes.length === 1 ? '' : 's'}`,
      status: d.status ?? '',
      isEnabled: d.isEnabled !== false,
      to: { name: 'destinations-detail', params: { id: d.id } }
    }))

  return {
    sources,
    destinations,
    links: links.map(({ pipe, source, destination }) => ({
      id: pipe.id,
      sourceId: source.id,
      destinationId: destination.id,
      status: pipe.status ?? '',
      isEnabled: pipe.isEnabled !== false
    }))
  }
})

const tabs = computed(() => [
  { key: 'visual', label: 'Visual' },
  { key: 'list', label: 'List', count: filteredPipes.value.length }
])

function open(pipe) {
  router.push({ name: 'pipes-detail', params: { id: pipe.id } })
}

// Built per row rather than hoisted to a module constant: the label depends on
// `row.isEnabled`. Each label is word for word the matching ConfirmDialog's
// confirm button, so the menu item and the button that carries it out never
// describe the same action two ways.
function rowActions(row) {
  return [
    row.isEnabled
      ? { key: 'toggle', label: 'Pause pipe', icon: 'pause' }
      : { key: 'toggle', label: 'Enable pipe', icon: 'play' }
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
// Its own ref rather than sharing a target with any other flow: two dialogs
// reading one row is how a confirm ends up acting on the wrong record. The row
// is left in place after the confirm rather than nulled, so the message does
// not blank out while the dialog fades.
function askToggle(row) {
  toggleTarget.value = row
  confirmToggle.value = true
}

const toggleTitle = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause this pipe?' : 'Enable this pipe?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause pipe' : 'Enable pipe'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops delivering to ${row.eventDestinationName || row.eventDestinationId || 'its destination'} straight away. Events keep arriving at the source; they just are not routed on.`
    : `“${row.name}” starts delivering to ${row.eventDestinationName || row.eventDestinationId || 'its destination'} again straight away.`
})

async function toggle() {
  const pipe = toggleTarget.value
  if (!pipe) return
  const next = !pipe.isEnabled
  const res = await setEnabled(pipe.id, next)
  notifyMutationResult($q, res, {
    success: `“${pipe.name}” ${next ? 'enabled' : 'paused'}`,
    apiMissing: `Can't ${next ? 'enable' : 'pause'} “${pipe.name}” yet.`
  })
  if (!res.ok) return
  // The Visual view renders the diagram's own copy of the pipe, so it has to
  // move with the table or the two views disagree about the same record.
  const mirrored = diagram.value.pipes.find(p => p.id === pipe.id)
  if (mirrored) mirrored.isEnabled = next
}

onMounted(() => {
  load()
  // Deliberately not awaited alongside `load()`: neither the strip nor the
  // function chips may hold the first paint, and neither failing is a failure
  // of this screen.
  loadSetupProgress()
  loadFunctions()
})
</script>
