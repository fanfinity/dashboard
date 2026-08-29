<template>
  <q-page class="p-6">
    <PageHeader :title="pipe?.name || 'Pipe'" :subtitle="subtitle">
      <!-- The noun is the <h1> beside them, so both state actions are drawn
           rather than spelled; SfereIconButton carries the phrase to the
           tooltip and to assistive tech. Each one asks before it acts. -->
      <template v-if="pipe" #actions>
        <SfereIconButton
          :icon="pipe.isEnabled ? 'pause' : 'play'"
          :label="pipe.isEnabled ? 'Pause this pipe' : 'Enable this pipe'"
          @click="confirmToggle = true"
        />
        <SfereIconButton
          icon="trash"
          label="Delete this pipe"
          variant="danger"
          @click="confirmDelete = true"
        />
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
          :transform="pipe.hasFunctionCode === true"
          :transform-known="transformKnown"
        />
      </CardPanel>

      <!-- Three cards, not four: there was a "Version" one, and no pipeline,
           source or destination the backend returns has a version field. It
           was a `pipes.json` invention, so against a real pipe it rendered the
           literal string "vundefined". -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Deliveries (last hour)" :value="deliveriesValue" />
        <StatCard
          label="Status"
          :value="pipe.isEnabled ? 'Enabled' : 'Paused'"
        />
        <StatCard label="Created" :value="formatDate(pipe.createdAt)" />
      </div>

      <TabNav v-model="tab" :tabs="tabs" />

      <CardPanel v-if="tab === 'overview'">
        <template #header>
          <span class="text-sm font-medium text-ink">Details</span>
          <StatusBadge
            :tone="pipe.isEnabled ? 'success' : 'neutral'"
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
              :tone="pipe.hasFunctionCode ? 'brand' : 'neutral'"
              :label="transformLabel"
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

        <!-- The Jitsu transform functions attached to this pipe's connection.
             Self-hides unless real mode: functions live only on the backend. -->
        <PipeFunctionsPanel :pipeline-id="pipe.id" :api-available="isReal" />
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
            <StatusBadge tone="neutral" :label="item.reason" />
          </button>
        </div>

        <EmptyState v-else variant="inline" :title="relatedEmptyTitle" />
      </CardPanel>
    </div>

    <!-- The header icons carry no sentence of their own, so the dialog is where
         the consequence is written. Pausing is reversible, so it is deliberately
         not `destructive` — a red button on a routine confirm teaches people to
         click through red buttons. -->
    <ConfirmDialog
      v-if="pipe"
      v-model="confirmToggle"
      :title="pipe.isEnabled ? 'Pause this pipe?' : 'Enable this pipe?'"
      :message="toggleMessage"
      :confirm-label="pipe.isEnabled ? 'Pause pipe' : 'Enable pipe'"
      @confirm="toggle"
    />

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
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import PipeFlow from '@/components/pipes/PipeFlow.vue'
import PipeParams from '@/components/pipes/PipeParams.vue'
import PipeFunctionsPanel from '@/components/pipes/PipeFunctionsPanel.vue'
import { useDiagram } from '@/composables/useDiagram'
import { useDataSource } from '@/composables/useDataSource'
import {
  formatCount,
  formatDate,
  formatDateTime,
  usePipes
} from '@/composables/usePipes'
import { notifyMutationResult } from '@/composables/useMutationFeedback'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const { isReal } = useDataSource()

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
const confirmToggle = ref(false)

const routeId = computed(() => String(route.params.id ?? ''))

// A collection plus a lookup, not a per-id endpoint: `pipes.json` is the whole
// list, so an unknown id is a legitimate "not found", not a failed request.
const pipe = computed(
  () => pipes.value.find(p => p.id === routeId.value) ?? null
)

// Falls back to the id, then to the route id: an end whose source or
// destination has been deleted has no name to print, and "undefined → undefined"
// is a worse answer than the ids that are actually on the record.
const subtitle = computed(() => {
  const p = pipe.value
  if (!p) return routeId.value
  const from = p.sourceName || p.sourceId
  const to = p.eventDestinationName || p.eventDestinationId
  return from && to ? `${from} → ${to}` : routeId.value
})

const SOURCE_TYPES = {
  event_stream: 'Event stream',
  cloud_app: 'Cloud app'
}

const sourceTypeLabel = computed(
  () => SOURCE_TYPES[pipe.value?.sourceType] ?? pipe.value?.sourceType ?? '—'
)

// Both halves are optional against a real pipeline — the slug is joined in by
// `usePipes`, the type comes with it — so build the hint from what resolved
// rather than interpolating blindly. This used to render "undefined · —".
const sourceHint = computed(() => {
  const parts = [pipe.value?.sourceSlug]
  if (pipe.value?.sourceType) parts.push(sourceTypeLabel.value.toLowerCase())
  return parts.filter(Boolean).join(' · ')
})

// `deliveryCountLastHour`, like `version`, is a fixture field with no backend
// behind it. `formatCount` turns a missing one into "0" — the right call for a
// real measured zero, a fabricated fact here — so ask before formatting.
const deliveriesValue = computed(() =>
  pipe.value?.deliveryCountLastHour == null
    ? '—'
    : formatCount(pipe.value.deliveryCountLastHour)
)

// Same class of gap, and the loudest of the three: a pipe with no
// `hasFunctionCode` is not a pass-through pipe, it is a pipe we have not asked.
// The Configuration tab's PipeFunctionsPanel reads the real answer from
// `GET …/pipelines/{id}/functions`; until that answer reaches this summary,
// say "unknown" rather than assert the wrong one.
const transformKnown = computed(() => pipe.value?.hasFunctionCode != null)

const transformLabel = computed(() => {
  if (!transformKnown.value) return 'Not known'
  return pipe.value.hasFunctionCode ? 'Custom function' : 'Pass-through'
})

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

// Named ends when we have them, a generic sentence when we do not — the same
// reason `subtitle` falls back.
const relatedEmptyTitle = computed(() => {
  const p = pipe.value
  if (!p?.sourceName || !p?.eventDestinationName)
    return 'Nothing else shares either end of this pipe.'
  return `Nothing else reads from ${p.sourceName} or writes to ${p.eventDestinationName}.`
})

const transformCopy = computed(() => {
  if (!transformKnown.value)
    return 'Whether a function runs on this pipe is not part of the pipeline record. The functions attached to it are listed below.'
  return pipe.value.hasFunctionCode
    ? 'A custom function runs on every event this pipe carries, before the destination sees it. Events it drops are never delivered.'
    : 'Events reach the destination exactly as the source emitted them. Add a function to filter, enrich or reshape them.'
})

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

// The pipe's two ends are what the reader is actually deciding about, so the
// sentence names them rather than repeating the pipe's own name twice.
const toggleMessage = computed(() => {
  const p = pipe.value
  if (!p) return ''
  const to = p.eventDestinationName || p.eventDestinationId || 'its destination'
  return p.isEnabled
    ? `“${p.name}” stops delivering to ${to} straight away. Events keep arriving at the source; they just are not routed on. You can enable it again at any time.`
    : `“${p.name}” starts delivering to ${to} straight away.`
})

async function toggle() {
  const next = !pipe.value.isEnabled
  const res = await setEnabled(pipe.value.id, next)
  notifyMutationResult($q, res, {
    success: `“${pipe.value.name}” ${next ? 'enabled' : 'paused'}`,
    apiMissing: `Can't ${next ? 'enable' : 'pause'} “${pipe.value.name}” yet.`
  })
}

async function remove() {
  const name = pipe.value?.name
  const res = await removePipe(routeId.value)
  notifyMutationResult($q, res, {
    success: `“${name}” deleted`,
    apiMissing: `Can't delete “${name}” yet.`
  })
  if (res.ok) router.push({ name: 'pipes' })
}

// Related pipes navigate within the same route, which reuses this component
// instead of remounting it — reset the tab so the new pipe opens on Overview.
watch(routeId, () => {
  tab.value = 'overview'
})

onMounted(load)
</script>
