<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the toolbar and the table, so all
         three share a left AND a right edge. Same measure and the same
         reasoning as DashboardHomePage.vue: 1400px is deliberately wider than
         `--container-sfere-page` (80rem), which is the marketing-site measure
         and left ~40% of a wide monitor empty here, and it sits on the page
         rather than in MainLayout because the layout is shared with screens
         that want the whole width. Literal, not a token: Tailwind v4 extracts
         class names from source text. A plain block div — `flex` here would be
         one of Quasar's unlayered wrapping containers. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Pipes"
        subtitle="Each pipe joins one source to one destination, and can transform events on the way through."
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

      <div
        v-if="!loading && !error && pipes.length"
        class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard label="Pipes" :value="formatCount(pipes.length)" />
        <StatCard
          label="Enabled"
          :value="`${enabledCount} of ${pipes.length}`"
        />
        <StatCard
          label="Deliveries (last hour)"
          :value="formatCount(deliveriesLastHour)"
        />
        <StatCard
          label="With a transform"
          :value="formatCount(transformCount)"
        />
      </div>

      <TabNav v-model="view" :tabs="tabs" />

      <DataTable
        v-if="view === 'list'"
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
          <div class="flex items-center gap-2">
            <p class="font-medium text-ink">{{ row.name }}</p>
            <StatusBadge
              v-if="row.hasFunctionCode"
              tone="brand"
              label="Transform"
            />
          </div>
          <p class="text-xs text-subtle">{{ row.id }}</p>
        </template>

        <!-- `usePipes` joins both names in from Sources and Destinations; the
             backend's pipeline record carries only the two ids. An end that has
             since been deleted has neither, hence the em dash. -->
        <template #cell-route="{ row }">
          <span class="text-ink">{{ row.sourceName || NOT_KNOWN }}</span>
          <span class="px-1.5 text-subtle">→</span>
          <span class="text-ink">{{
            row.eventDestinationName || NOT_KNOWN
          }}</span>
        </template>

        <!-- `formatCount` reads a missing count as 0, which is right for a real
             measured zero and wrong here: the pipeline record has no delivery
             counter at all, so a live pipe would report "0 deliveries / hr" as
             a fact. -->
        <template #cell-deliveryCountLastHour="{ value }">
          {{ value == null ? NOT_KNOWN : formatCount(value) }}
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

        <template #empty>
          <EmptyState
            :title="query ? 'No pipes match your search' : 'No pipes yet'"
            :description="
              query
                ? 'Nothing matched that name, source or destination.'
                : 'Create a pipe to start moving events from a source into a destination.'
            "
          >
            <template #cta>
              <button
                v-if="query"
                class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
                @click="query = ''"
              >
                Clear search
              </button>
              <button
                v-else
                class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
                @click="router.push({ name: 'pipes-new' })"
              >
                New pipe
              </button>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <template v-else>
        <LoadingState v-if="loading" variant="grid" :rows="3" />

        <ErrorState
          v-else-if="error"
          title="Couldn't load the pipe topology."
          :message="error"
          @retry="load"
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
          <template #cta>
            <button
              v-if="query"
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="query = ''"
            >
              Clear search
            </button>
            <button
              v-else
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'pipes-new' })"
            >
              New pipe
            </button>
          </template>
        </EmptyState>

        <PipeTopology
          v-else
          :links="filteredLinks"
          :sources="diagram.sources"
          :destinations="diagram.eventDestinations"
          @select="open"
        />
      </template>
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
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import PipeTopology from '@/components/pipes/PipeTopology.vue'
import { useDiagram } from '@/composables/useDiagram'
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
  transformCount,
  deliveriesLastHour,
  setEnabled
} = usePipes()

const {
  diagram,
  nodes,
  loading: diagramLoading,
  error: diagramError,
  load: loadDiagram
} = useDiagram()

// Two files, one origin: they fail together, so the screen shows one ErrorState
// with one Retry rather than two competing failure surfaces.
const loading = computed(() => pipesLoading.value || diagramLoading.value)
const error = computed(() => pipesError.value || diagramError.value)

async function load() {
  await Promise.all([loadPipes(), loadDiagram()])
}

const query = ref('')
const view = ref('list')

const columns = [
  { key: 'name', label: 'Pipe', sortable: true },
  { key: 'route', label: 'Route' },
  {
    key: 'deliveryCountLastHour',
    label: 'Deliveries / hr',
    sortable: true,
    align: 'right'
  },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' },
  // 72px: SfereTable pads a cell `px-4` either side of a 36px kebab. The
  // 110px this held was measured for a text button, and keeping it would spend
  // the width this page just reclaimed on an empty gutter.
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

const tabs = computed(() => [
  { key: 'list', label: 'Pipes', count: filteredPipes.value.length },
  { key: 'topology', label: 'Topology', count: filteredLinks.value.length }
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
// Its own ref rather than sharing `target` with the delete flow: two dialogs
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
  // The topology tab renders the diagram's own copy of the pipe, so it has to
  // move with the table or the two tabs disagree about the same record.
  const mirrored = diagram.value.pipes.find(p => p.id === pipe.id)
  if (mirrored) mirrored.isEnabled = next
}

onMounted(() => {
  load()
  // Deliberately not awaited alongside `load()`: the strip is secondary, and a
  // slow setup read must not hold the table's first paint.
  loadSetupProgress()
})
</script>
