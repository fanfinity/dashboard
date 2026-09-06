<template>
  <q-page class="p-6">
    <!-- One cap for the header, the route strip, the stats and whichever tab is
         open, so the right edge does not step as the tab changes. Literal, not
         a token: Tailwind v4 extracts class names from source text. -->
    <div class="mx-auto w-full max-w-[1400px]">
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
        :description="`No pipe with the id “${routeId}” exists. It may have been deleted — deleting a pipe is permanent, so there is nothing to restore.`"
      >
        <template #cta>
          <SfereButton variant="secondary" :to="{ name: 'pipes' }"
            >Back to pipes</SfereButton
          >
        </template>
      </EmptyState>

      <!-- A grid, not `flex flex-col`: Quasar's unlayered `.flex` forces
           `flex-wrap: wrap`, which stretches block children into a second
           column under a height cap. Grid `gap` has no Quasar counterpart. -->
      <div v-else class="grid gap-5">
        <CardPanel>
          <FlowChain
            :source="chainSource"
            :destination="chainDestination"
            :status="pipeStatus"
            :is-enabled="pipe.isEnabled !== false"
          />
        </CardPanel>

        <!-- Only measured numbers. There is no "Events / hr", no "Last
             activity" and no "Success rate": the pipeline record carries no
             counters and the diagram's per-window ones are literal zeros until
             ClickHouse is behind them, so each would be a fact nobody
             measured. -->
        <div class="grid grid-cols-1 gap-4" :class="statColumns">
          <StatCard
            v-for="stat in stats"
            :key="stat.label"
            :label="stat.label"
            :value="stat.value"
            :hint="stat.hint"
          />
        </div>

        <TabNav v-model="tab" :tabs="tabs" />

        <!-- OVERVIEW -->
        <template v-if="tab === 'overview'">
          <CardPanel>
            <template #header>
              <span class="text-sm font-medium text-ink">About this pipe</span>
              <StatusBadge
                :tone="pipe.isEnabled ? 'success' : 'neutral'"
                :label="pipe.isEnabled ? 'Enabled' : 'Paused'"
              />
            </template>
            <p class="text-sm text-muted">{{ aboutCopy }}</p>
          </CardPanel>

          <CardPanel>
            <template #header>
              <span class="text-sm font-medium text-ink">Details</span>
            </template>

            <DefinitionList :items="details" :columns="1">
              <template #value-source>
                <router-link
                  class="font-medium text-brand hover:underline"
                  :to="{
                    name: 'sources-detail',
                    params: { id: pipe.sourceId }
                  }"
                  >{{ pipe.sourceName || pipe.sourceId }}</router-link
                >
              </template>

              <template #value-destination>
                <router-link
                  class="font-medium text-brand hover:underline"
                  :to="{
                    name: 'destinations-detail',
                    params: { id: pipe.eventDestinationId }
                  }"
                  >{{
                    pipe.eventDestinationName || pipe.eventDestinationId
                  }}</router-link
                >
              </template>
            </DefinitionList>
          </CardPanel>

          <CardPanel :padded="false">
            <template #header>
              <span class="text-sm font-medium text-ink"
                >Shares an endpoint</span
              >
              <span class="text-xs text-subtle"
                >{{ related.length }}
                {{ related.length === 1 ? 'pipe' : 'pipes' }}</span
              >
            </template>

            <div v-if="related.length" class="grid gap-2 p-4">
              <router-link
                v-for="item in related"
                :key="item.pipe.id"
                class="flex flex-nowrap items-center gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-surface px-3 py-2.5 text-left hover:bg-sfere-fill"
                :to="{ name: 'pipes-detail', params: { id: item.pipe.id } }"
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
              </router-link>
            </div>

            <EmptyState v-else variant="inline" :title="relatedEmptyTitle" />
          </CardPanel>
        </template>

        <!-- FUNCTIONS -->
        <template v-else-if="tab === 'functions'">
          <PipeFunctionsPanel :pipeline-id="pipe.id" :api-available="isReal" />

          <!-- PipeFunctionsPanel renders nothing without a backend, and a blank
               tab reads as a broken screen rather than as a missing endpoint. -->
          <CardPanel v-if="!isReal">
            <template #header>
              <span class="text-sm font-medium text-ink">Functions</span>
            </template>
            <p class="text-sm text-muted">
              The functions attached to a pipe are read from the backend, so
              this tab is empty in Demo data mode. Switch to real data in
              Settings to attach, reorder and edit them.
            </p>
          </CardPanel>
        </template>

        <!-- ACTIVITY -->
        <PipeSourceActivityPanel
          v-else-if="tab === 'activity'"
          :source-id="pipe.sourceId"
          :source-name="pipe.sourceName"
          :api-available="isReal"
        />

        <!-- ERRORS -->
        <CardPanel v-else-if="tab === 'errors'">
          <template #header>
            <span class="text-sm font-medium text-ink">Delivery errors</span>
          </template>
          <!-- Deliberately not "No errors": nothing counts a pipe's failed
               deliveries, so a green all-clear here would be the confident zero
               this screen removed everywhere else. -->
          <p class="text-sm text-muted">
            Delivery errors are not recorded per pipe yet. There is no
            per-pipeline error endpoint, and the diagram's error counter is
            reported as zero for every route regardless of what happened, so
            nothing on this screen can tell you a pipe is healthy. Health is the
            account-wide picture and is read from the backend.
          </p>
          <div>
            <SfereButton size="sm" variant="secondary" :to="{ name: 'health' }"
              >Open Health</SfereButton
            >
          </div>
        </CardPanel>

        <!-- SETTINGS -->
        <template v-else>
          <NoticeBanner
            tone="info"
            title="Renaming and re-routing are not available yet"
            message="The backend accepts one change to an existing pipe: whether it is enabled. To send the same source somewhere else, create a second pipe and pause this one."
          />

          <CardPanel>
            <template #header>
              <span class="text-sm font-medium text-ink">Route</span>
              <StatusBadge
                :tone="pipe.isEnabled ? 'success' : 'neutral'"
                :label="pipe.isEnabled ? 'Enabled' : 'Paused'"
              />
            </template>

            <DefinitionList :items="settingsItems" :columns="1" />

            <div class="mt-4 flex flex-wrap items-center gap-3">
              <SfereButton
                size="sm"
                variant="secondary"
                @click="confirmToggle = true"
                >{{
                  pipe.isEnabled ? 'Pause pipe' : 'Enable pipe'
                }}</SfereButton
              >
              <SfereButton size="sm" variant="ghost" @click="tab = 'functions'"
                >Manage functions</SfereButton
              >
            </div>
          </CardPanel>

          <CardPanel>
            <template #header>
              <span class="text-sm font-medium text-ink">Delete pipe</span>
            </template>
            <p class="text-sm text-muted">
              Deleting this pipe stops the route from delivering new events. It
              leaves the source and the destination alone. Deleting is
              permanent: there is no trash for a pipe and restoring is not
              available yet.
            </p>
            <div>
              <SfereButton
                size="sm"
                variant="danger"
                @click="confirmDelete = true"
                >Delete pipe</SfereButton
              >
            </div>
          </CardPanel>
        </template>
      </div>

      <!-- The header icons carry no sentence of their own, so the dialog is
           where the consequence is written. Pausing is reversible, so it is
           deliberately not `destructive` — a red button on a routine confirm
           teaches people to click through red buttons. Its own target state,
           and it asks in BOTH directions. -->
      <ConfirmDialog
        v-if="pipe"
        v-model="confirmToggle"
        :title="pipe.isEnabled ? 'Pause this pipe?' : 'Enable this pipe?'"
        :message="toggleMessage"
        :confirm-label="pipe.isEnabled ? 'Pause pipe' : 'Enable pipe'"
        @confirm="toggle"
      />

      <!-- No trash promise. `DELETE …/pipelines/{id}` is a hard 204: no soft
           delete, no restore, no listing. The copy says what actually
           happens. -->
      <ConfirmDialog
        v-if="pipe"
        v-model="confirmDelete"
        title="Delete this pipe?"
        :message="deleteMessage"
        confirm-label="Delete pipe"
        destructive
        @confirm="remove"
      />
    </div>
  </q-page>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import FlowChain from '@/components/flow/FlowChain.vue'
import PipeFunctionsPanel from '@/components/pipes/PipeFunctionsPanel.vue'
import PipeSourceActivityPanel from '@/components/pipes/PipeSourceActivityPanel.vue'
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

// A collection plus a lookup, not a per-id endpoint: the pipes call is the whole
// list, so an unknown id is a legitimate "not found", not a failed request.
const pipe = computed(
  () => pipes.value.find(p => p.id === routeId.value) ?? null
)

// The diagram's own copy of this route, which is where the Status5 words and
// the real `functionCount` live. Absent in Demo mode, and every read of it is
// guarded rather than defaulted.
const link = computed(
  () => nodes.value.links.find(l => l.pipe.id === routeId.value) ?? null
)

const pipeStatus = computed(() => link.value?.pipe.status ?? '')

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
  cloud_app: 'Cloud app',
  web: 'Website',
  zid: 'Zid store'
}

const sourceTypeLabel = computed(
  () =>
    SOURCE_TYPES[pipe.value?.sourceType] ?? pipe.value?.sourceType ?? NOT_KNOWN
)

// Both halves are optional against a real pipeline — the slug is joined in by
// `usePipes`, the type comes with it — so build the hint from what resolved
// rather than interpolating blindly. This used to render "undefined · —".
const sourceHint = computed(() => {
  const parts = [pipe.value?.sourceSlug]
  if (pipe.value?.sourceType) parts.push(sourceTypeLabel.value.toLowerCase())
  return parts.filter(Boolean).join(' · ')
})

const chainSource = computed(() => ({
  name: pipe.value?.sourceName || pipe.value?.sourceId || NOT_KNOWN,
  hint: sourceHint.value,
  subtype: pipe.value?.sourceType ?? '',
  status: link.value?.source.status ?? '',
  isEnabled: link.value ? link.value.source.isEnabled !== false : true,
  to: pipe.value?.sourceId
    ? { name: 'sources-detail', params: { id: pipe.value.sourceId } }
    : null
}))

const chainDestination = computed(() => ({
  name:
    pipe.value?.eventDestinationName ||
    pipe.value?.eventDestinationId ||
    NOT_KNOWN,
  hint: pipe.value?.eventDestinationSlug || '',
  subtype: link.value?.destination.destinationType ?? '',
  status: link.value?.destination.status ?? '',
  isEnabled: link.value ? link.value.destination.isEnabled !== false : true,
  to: pipe.value?.eventDestinationId
    ? {
        name: 'destinations-detail',
        params: { id: pipe.value.eventDestinationId }
      }
    : null
}))

// `function_count` on a diagram edge is real (it counts the pipeline's attached
// functions), unlike the event and error counters beside it. Absent in Demo
// mode, where the card is simply not rendered.
const functionCount = computed(() => link.value?.pipe.functionCount ?? null)

const stats = computed(() => {
  const p = pipe.value
  if (!p) return []
  const out = [
    {
      label: 'Status',
      value: p.isEnabled ? 'Enabled' : 'Paused',
      hint: p.isEnabled ? 'Delivering when events arrive' : 'Delivering nothing'
    }
  ]
  if (functionCount.value != null) {
    out.push({
      label: 'Functions',
      value: formatCount(functionCount.value),
      hint: 'Run in order before delivery'
    })
  }
  out.push({ label: 'Created', value: formatDate(p.createdAt) })
  return out
})

// Literals rather than a built string: Tailwind v4 extracts class names from
// source text, so `sm:grid-cols-${n}` would never be emitted.
const STAT_COLUMNS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }

const statColumns = computed(
  () => STAT_COLUMNS[stats.value.length] ?? 'sm:grid-cols-2'
)

const aboutCopy = computed(() => {
  const p = pipe.value
  if (!p) return ''
  const from = p.sourceName || 'its source'
  const to = p.eventDestinationName || 'its destination'
  const base = `This pipe carries customer activity from ${from} into ${to}. Functions attached to it run in order, before the destination sees the event.`
  return p.isEnabled
    ? base
    : `${base} It is paused, so events keep arriving at the source and nothing is routed on.`
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

const settingsItems = computed(() => {
  const p = pipe.value
  if (!p) return []
  return [
    { label: 'Status', value: p.isEnabled ? 'Enabled' : 'Paused' },
    {
      label: 'Source',
      value: p.sourceName || p.sourceId,
      hint: 'Fixed for the life of the pipe'
    },
    {
      label: 'Destination',
      value: p.eventDestinationName || p.eventDestinationId,
      hint: 'Fixed for the life of the pipe'
    },
    { label: 'Name', value: p.name, hint: 'Renaming is not available yet' }
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
  functionCount.value != null
    ? { key: 'functions', label: 'Functions', count: functionCount.value }
    : { key: 'functions', label: 'Functions' },
  { key: 'activity', label: 'Activity' },
  { key: 'errors', label: 'Errors' },
  { key: 'settings', label: 'Settings' }
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

const deleteMessage = computed(() => {
  const p = pipe.value
  if (!p) return ''
  const from = p.sourceName || 'its source'
  const to = p.eventDestinationName || 'its destination'
  return `“${p.name}” stops delivering immediately and is removed for good. ${from} and ${to} are left alone, and events keep arriving at the source. There is no trash for a pipe, so restoring it is not available yet.`
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
