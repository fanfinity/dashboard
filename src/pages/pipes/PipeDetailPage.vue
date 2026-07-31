<template>
  <q-page class="p-6">
    <PageHeader :title="pipe?.name || 'Pipe'" :subtitle="subtitle">
      <template v-if="pipe" #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'pipes' })"
        >
          All pipes
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="toggle"
        >
          {{ pipe.isEnabled ? 'Pause pipe' : 'Enable pipe' }}
        </button>
        <button
          class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="confirmDelete = true"
        >
          Delete
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load this pipe."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!pipe"
      title="Pipe not found"
      :description="`No pipe with the id “${routeId}” exists. It may have been deleted.`"
    >
      <template #cta>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="router.push({ name: 'pipes' })"
          >
            Back to pipes
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="router.push({ name: 'pipes-trash' })"
          >
            Check the trash
          </button>
        </div>
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-5">
      <CardPanel>
        <PipeFlow
          :source-label="pipe.sourceName"
          :source-hint="sourceHint"
          :destination-label="pipe.eventDestinationName"
          :destination-hint="pipe.eventDestinationSlug"
          :transform="pipe.hasFunctionCode"
        />
      </CardPanel>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Deliveries (last hour)"
          :value="formatCount(pipe.deliveryCountLastHour)"
        />
        <StatCard
          label="Status"
          :value="pipe.isEnabled ? 'Enabled' : 'Paused'"
        />
        <StatCard label="Version" :value="`v${pipe.version}`" />
        <StatCard label="Created" :value="formatDate(pipe.createdAt)" />
      </div>

      <TabNav v-model="tab" :tabs="tabs" />

      <CardPanel v-if="tab === 'overview'">
        <template #header>
          <span class="text-sm font-medium text-ink">Details</span>
          <StatusBadge
            :enabled="pipe.isEnabled"
            :label="pipe.isEnabled ? 'Enabled' : 'Paused'"
          />
        </template>

        <DefinitionList :items="details" :columns="1">
          <template #value-source>
            <button
              class="font-medium text-brand hover:underline"
              @click="
                router.push({
                  name: 'sources-detail',
                  params: { id: pipe.sourceId }
                })
              "
            >
              {{ pipe.sourceName }}
            </button>
          </template>

          <template #value-destination>
            <button
              class="font-medium text-brand hover:underline"
              @click="
                router.push({
                  name: 'destinations-detail',
                  params: { id: pipe.eventDestinationId }
                })
              "
            >
              {{ pipe.eventDestinationName }}
            </button>
          </template>
        </DefinitionList>
      </CardPanel>

      <template v-else-if="tab === 'configuration'">
        <CardPanel>
          <template #header>
            <span class="text-sm font-medium text-ink">Transformation</span>
            <StatusBadge
              :variant="pipe.hasFunctionCode ? 'brand' : 'neutral'"
              :label="pipe.hasFunctionCode ? 'Custom function' : 'Pass-through'"
            />
          </template>
          <p class="text-sm text-muted">{{ transformCopy }}</p>
        </CardPanel>

        <CardPanel>
          <template #header>
            <span class="text-sm font-medium text-ink"
              >Destination parameters</span
            >
            <span class="text-xs text-subtle">{{
              pipe.eventDestinationName
            }}</span>
          </template>
          <PipeParams
            :params="pipe.destinationParams"
            empty-text="This pipe passes no parameters to its destination — the destination's own defaults apply."
          />
        </CardPanel>
      </template>

      <CardPanel v-else :padded="false">
        <template #header>
          <span class="text-sm font-medium text-ink">Shares an endpoint</span>
          <span class="text-xs text-subtle"
            >{{ related.length }} other
            {{ related.length === 1 ? 'pipe' : 'pipes' }}</span
          >
        </template>

        <div v-if="related.length" class="flex flex-col gap-2 p-4">
          <button
            v-for="item in related"
            :key="item.pipe.id"
            class="flex w-full items-center gap-3 rounded-lg border border-line2 bg-white px-3 py-2.5 text-left hover:bg-fill"
            @click="
              router.push({
                name: 'pipes-detail',
                params: { id: item.pipe.id }
              })
            "
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-ink">{{
                item.pipe.name
              }}</span>
              <span class="block text-xs text-subtle"
                >{{ item.source.name }} → {{ item.destination.name }}</span
              >
            </span>
            <StatusBadge variant="neutral" :label="item.reason" />
          </button>
        </div>

        <p v-else class="p-4 text-sm text-muted"
          >Nothing else reads from {{ pipe.sourceName }} or writes to
          {{ pipe.eventDestinationName }}.</p
        >
      </CardPanel>
    </div>

    <ConfirmDialog
      v-if="pipe"
      v-model="confirmDelete"
      title="Delete this pipe?"
      :message="`“${pipe.name}” stops delivering immediately and moves to the trash, where it can be restored.`"
      confirm-label="Delete pipe"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import PipeFlow from '@/components/pipes/PipeFlow.vue'
import PipeParams from '@/components/pipes/PipeParams.vue'
import { useDiagram } from '@/composables/useDiagram'
import {
  formatCount,
  formatDate,
  formatDateTime,
  usePipes
} from '@/composables/usePipes'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const {
  pipes,
  loading: pipesLoading,
  error: pipesError,
  load: loadPipes,
  setEnabled,
  removePipe
} = usePipes()

const {
  nodes,
  loading: diagramLoading,
  error: diagramError,
  load: loadDiagram
} = useDiagram()

const loading = computed(() => pipesLoading.value || diagramLoading.value)
const error = computed(() => pipesError.value || diagramError.value)

async function load() {
  await Promise.all([loadPipes(), loadDiagram()])
}

const tab = ref('overview')
const confirmDelete = ref(false)

const routeId = computed(() => String(route.params.id ?? ''))

// A collection plus a lookup, not a per-id endpoint: `pipes.json` is the whole
// list, so an unknown id is a legitimate "not found", not a failed request.
const pipe = computed(
  () => pipes.value.find(p => p.id === routeId.value) ?? null
)

const subtitle = computed(() =>
  pipe.value
    ? `${pipe.value.sourceName} → ${pipe.value.eventDestinationName}`
    : routeId.value
)

const SOURCE_TYPES = {
  event_stream: 'Event stream',
  cloud_app: 'Cloud app'
}

const sourceTypeLabel = computed(
  () => SOURCE_TYPES[pipe.value?.sourceType] ?? pipe.value?.sourceType ?? '—'
)

const sourceHint = computed(
  () => `${pipe.value?.sourceSlug} · ${sourceTypeLabel.value.toLowerCase()}`
)

// `Source` and `Destination` are re-rendered as links by the matching
// `#value-…` slots; every other row falls through to its formatted `value`.
const details = computed(() => {
  const p = pipe.value
  if (!p) return []
  return [
    { label: 'Pipe ID', value: p.id },
    { label: 'Source', value: p.sourceName },
    { label: 'Source type', value: sourceTypeLabel.value },
    { label: 'Destination', value: p.eventDestinationName },
    { label: 'Created', value: formatDateTime(p.createdAt) },
    { label: 'Last updated', value: formatDateTime(p.updatedAt) }
  ]
})

const transformCopy = computed(() =>
  pipe.value?.hasFunctionCode
    ? 'A custom function runs on every event this pipe carries, before the destination sees it. Events it drops are never delivered.'
    : 'Events reach the destination exactly as the source emitted them. Add a function to filter, enrich or reshape them.'
)

// Every other pipe touching either end of this one — the blast radius of a
// change here, which is the question a detail page is usually opened to answer.
const related = computed(() => {
  const current = pipe.value
  if (!current) return []
  return nodes.value.links
    .filter(l => l.pipe.id !== current.id)
    .map(l => {
      const sharesSource = l.source.id === current.sourceId
      const sharesDestination = l.destination.id === current.eventDestinationId
      if (!sharesSource && !sharesDestination) return null
      return {
        ...l,
        reason: sharesSource ? 'Same source' : 'Same destination'
      }
    })
    .filter(Boolean)
})

const tabs = computed(() => [
  { key: 'overview', label: 'Overview' },
  { key: 'configuration', label: 'Configuration' },
  { key: 'related', label: 'Related', count: related.value.length }
])

function toggle() {
  const next = !pipe.value.isEnabled
  setEnabled(pipe.value.id, next)
  $q.notify({
    message: `“${pipe.value.name}” ${next ? 'enabled' : 'paused'} — nothing was saved, this preview has no backend.`,
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}

function remove() {
  const name = pipe.value?.name
  removePipe(routeId.value)
  $q.notify({
    message: `“${name}” deleted — nothing was saved, this preview has no backend.`,
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
  router.push({ name: 'pipes' })
}

// Related pipes navigate within the same route, which reuses this component
// instead of remounting it — reset the tab so the new pipe opens on Overview.
watch(routeId, () => {
  tab.value = 'overview'
})

onMounted(load)
</script>
