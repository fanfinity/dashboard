<template>
  <q-page class="p-6">
    <PageHeader
      title="Pipes"
      subtitle="Each pipe joins one source to one destination, and can transform events on the way through."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search pipes..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'pipes-trash' })"
        >
          Trash
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'pipes-new' })"
        >
          New pipe
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && pipes.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard label="Pipes" :value="formatCount(pipes.length)" />
      <StatCard label="Enabled" :value="`${enabledCount} of ${pipes.length}`" />
      <StatCard
        label="Deliveries (last hour)"
        :value="formatCount(deliveriesLastHour)"
      />
      <StatCard label="With a transform" :value="formatCount(transformCount)" />
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

      <template #cell-route="{ row }">
        <span class="text-ink">{{ row.sourceName }}</span>
        <span class="px-1.5 text-subtle">→</span>
        <span class="text-ink">{{ row.eventDestinationName }}</span>
      </template>

      <template #cell-deliveryCountLastHour="{ value }">
        {{ formatCount(value) }}
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

      <template #cell-actions="{ row }">
        <button
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click.stop="toggle(row)"
        >
          {{ row.isEnabled ? 'Pause' : 'Enable' }}
        </button>
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
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import PipeTopology from '@/components/pipes/PipeTopology.vue'
import { useDiagram } from '@/composables/useDiagram'
import { formatCount, formatDate, usePipes } from '@/composables/usePipes'

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
  { key: 'actions', label: '', align: 'right', width: '110px' }
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

function toggle(pipe) {
  const next = !pipe.isEnabled
  setEnabled(pipe.id, next)
  // The topology tab renders the diagram's own copy of the pipe, so it has to
  // move with the table or the two tabs disagree about the same record.
  const mirrored = diagram.value.pipes.find(p => p.id === pipe.id)
  if (mirrored) mirrored.isEnabled = next
  $q.notify({
    message: `“${pipe.name}” ${next ? 'enabled' : 'paused'} — nothing was saved, this preview has no backend.`,
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}

onMounted(load)
</script>
