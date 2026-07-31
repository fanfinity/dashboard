<template>
  <q-page class="p-6">
    <PageHeader
      title="Demo Event Inspector"
      subtitle="Every event the Demo Store fires, read back exactly as the pipeline would see it — raw payload, source, matched pipes and delivery."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search events..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
          :disabled="!events.length"
          @click="confirmClear = true"
        >
          Clear log
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'demo-store' })"
        >
          Open the Demo Store
        </button>
      </template>
    </PageHeader>

    <div class="flex flex-col gap-5">
      <NoticeBanner
        variant="info"
        title="Local capture only"
        message="These events were simulated by the Demo Store in this browser tab. Nothing was ingested, no pipe actually ran, and the log is cleared on reload."
      />

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Events captured"
          :value="formatCount(events.length)"
          hint="This session, in this tab only"
        />
        <StatCard
          label="Event types"
          :value="formatCount(eventNames.length)"
          :hint="eventNames.join(', ') || 'Nothing captured yet'"
        />
        <StatCard
          label="Pipes matched"
          :value="formatCount(matchedPipeCount)"
          hint="Distinct pipes across the log"
        />
        <StatCard
          label="Would be delivered"
          :value="formatCount(deliveryCount)"
          hint="One per enabled pipe, per event"
        />
      </div>

      <LoadingState v-if="routingLoading" variant="table" :rows="6" />

      <ErrorState
        v-else-if="routingError"
        title="Couldn't load pipes and destinations."
        :message="routingError"
        @retry="loadRouting"
      />

      <!-- `min-w-0` on both columns: a grid item defaults to `min-width: auto`,
           so the payload <pre> below would set the track's floor to its longest
           line and push the whole page into horizontal overflow. -->
      <div v-else class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div class="min-w-0 xl:col-span-2">
          <DataTable
            :columns="columns"
            :rows="filtered"
            row-key="id"
            clickable-rows
            :per-page="15"
            @row-click="select"
          >
            <template #cell-eventName="{ row }">
              <p class="font-mono text-xs font-medium text-ink">{{
                row.eventName
              }}</p>
              <p class="text-xs text-subtle">{{ row.callType }} call</p>
            </template>

            <template #cell-sourceName="{ row }">
              <p class="text-sm text-ink">{{ row.sourceName }}</p>
              <p class="font-mono text-[11px] text-subtle">{{
                row.sourceId
              }}</p>
            </template>

            <template #cell-profileId="{ value }">
              <StatusBadge
                v-if="value"
                variant="success"
                :label="String(value)"
              />
              <StatusBadge v-else variant="neutral" label="Anonymous" />
            </template>

            <template #cell-routing="{ row }">
              <StatusBadge
                :variant="deliveredCount(row) ? 'success' : 'warn'"
                :label="routingLabel(row)"
              />
            </template>

            <template #cell-occurredAt="{ value }">
              <span class="text-xs text-subtle">{{
                formatEventTime(value)
              }}</span>
            </template>

            <!-- clickable-rows means this button's click would bubble up and
                 re-select the row underneath it. -->
            <template #cell-actions="{ row }">
              <button
                class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
                @click.stop="copyPayload(row)"
              >
                Copy JSON
              </button>
            </template>

            <!-- An inspector with nothing in it is working, not broken: both
                 branches are EmptyState, never ErrorState. -->
            <template #empty>
              <EmptyState
                v-if="events.length"
                title="No events match your search"
                :description="`Nothing in the ${formatCount(events.length)} captured events matches “${query}”.`"
              >
                <template #cta>
                  <button
                    class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
                    @click="query = ''"
                  >
                    Clear search
                  </button>
                </template>
              </EmptyState>

              <EmptyState
                v-else
                title="No events yet"
                description="Open the Demo Store and fire an event — it appears here immediately, with its payload and its routing. Or replay one of the recent events on the right."
              >
                <template #cta>
                  <button
                    class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
                    @click="router.push({ name: 'demo-store' })"
                  >
                    Open the Demo Store
                  </button>
                </template>
              </EmptyState>
            </template>
          </DataTable>
        </div>

        <div class="flex min-w-0 flex-col gap-5">
          <DemoEventDetail
            :event="selected"
            :routes="selectedRoutes"
            @copy="copyValue"
          />

          <CardPanel>
            <template #header>
              <span class="text-sm font-semibold text-ink"
                >Replay a sample</span
              >
              <StatusBadge
                v-if="!samplesLoading && !samplesError"
                variant="neutral"
                :label="`${formatCount(samples.length)} recent`"
              />
            </template>

            <p class="text-xs leading-5 text-muted">
              Events already collected on this account. Replaying one copies it
              into the log above with a fresh timestamp — it is not re-ingested.
            </p>

            <LoadingState
              v-if="samplesLoading"
              variant="form"
              :rows="3"
              class="mt-3"
            />

            <!-- Secondary to this screen: the log still reads without the
                 samples, so the failure stays inside this panel. -->
            <ErrorState
              v-else-if="samplesError"
              title="Couldn't load the recent events."
              :message="samplesError"
              @retry="loadSamples"
            />

            <EmptyState
              v-else-if="!samples.length"
              variant="inline"
              title="No recent events"
              description="Nothing has been collected on this account yet."
            />

            <ul v-else class="mt-2 flex flex-col divide-y divide-line">
              <li
                v-for="sample in samples"
                :key="sample.id"
                class="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div class="min-w-0">
                  <p class="truncate font-mono text-xs text-ink">{{
                    sample.eventName
                  }}</p>
                  <p class="truncate text-xs text-subtle">{{
                    sample.sourceName
                  }}</p>
                </div>
                <button
                  class="shrink-0 rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
                  @click="replay(sample)"
                >
                  Replay
                </button>
              </li>
            </ul>
          </CardPanel>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmClear"
      title="Clear the demo log?"
      :message="clearMessage"
      confirm-label="Clear log"
      destructive
      @confirm="clearLog"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import DemoEventDetail from '@/components/demo/DemoEventDetail.vue'
import {
  formatCount,
  formatEventTime,
  useDemoEvents,
  useDemoRouting,
  useDemoSampleEvents
} from '@/composables/useDemoEvents'

// The read-back half of the demo pair. The log itself is the module-level state
// in useDemoEvents, shared with /demo-store — so an event fired there is already
// here, with no fetch and no backend.
//
// The default state of this screen is therefore EMPTY, and empty is correct:
// nothing has been fired yet. It renders EmptyState (data-smoke="empty"), never
// ErrorState — the inspector having nothing to show is the inspector working.
const router = useRouter()
const $q = useQuasar()

const { events, eventNames, capture, reset } = useDemoEvents()

// Primary resource: without pipes and destinations the screen cannot answer
// "which pipes matched, and where did it go", which is half its job.
const {
  loading: routingLoading,
  error: routingError,
  load: loadRouting,
  routesFor
} = useDemoRouting()

// Secondary: something to replay when the store has not been opened yet.
const {
  samples,
  loading: samplesLoading,
  error: samplesError,
  load: loadSamples
} = useDemoSampleEvents()

const query = ref('')
const selectedId = ref(null)
const confirmClear = ref(false)

const columns = [
  { key: 'eventName', label: 'Event', sortable: true },
  { key: 'sourceName', label: 'Source', sortable: true },
  { key: 'profileId', label: 'Profile' },
  { key: 'routing', label: 'Routing' },
  { key: 'occurredAt', label: 'Received', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '130px' }
]

const SEARCH_FIELDS = ['eventName', 'sourceName', 'sourceId', 'profileId', 'id']

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return events.value
  return events.value.filter(
    e =>
      SEARCH_FIELDS.some(f =>
        String(e[f] ?? '')
          .toLowerCase()
          .includes(q)
      ) || JSON.stringify(e.payload).toLowerCase().includes(q)
  )
})

// The selection is held by id rather than by object so it survives the log
// array being replaced on every capture.
const selected = computed(
  () => events.value.find(e => e.id === selectedId.value) ?? null
)

const selectedRoutes = computed(() => routesFor(selected.value))

function deliveredCount(event) {
  return routesFor(event).filter(r => r.delivered).length
}

function routingLabel(event) {
  const routes = routesFor(event)
  const delivered = routes.filter(r => r.delivered).length
  if (!routes.length) return 'No pipe matched'
  return `${delivered}/${routes.length} delivered`
}

const matchedPipeCount = computed(() => {
  const ids = new Set()
  for (const event of events.value) {
    for (const route of routesFor(event)) ids.add(route.id)
  }
  return ids.size
})

const deliveryCount = computed(() =>
  events.value.reduce((total, event) => total + deliveredCount(event), 0)
)

const clearMessage = computed(
  () =>
    `${formatCount(events.value.length)} simulated events will be removed. Nothing was ingested, so there is nothing to delete anywhere else.`
)

function select(row) {
  selectedId.value = row.id
}

// A replay is a fresh arrival of an event this account saw earlier: same name,
// same source, same profile, new timestamp — so it sorts with the live log
// rather than jumping to the bottom of it.
function replay(sample) {
  const event = capture({
    eventName: sample.eventName,
    sourceId: sample.sourceId,
    sourceName: sample.sourceName,
    profileId: sample.profileId,
    origin: 'sample',
    replayOf: sample.id
  })
  selectedId.value = event.id
  $q.notify({
    message: `${event.eventName} replayed`,
    caption: 'Simulated locally — nothing was ingested.',
    color: 'dark',
    position: 'bottom',
    timeout: 2000
  })
}

function clearLog() {
  reset()
  selectedId.value = null
}

function copyPayload(row) {
  copyValue({ label: 'Payload', value: JSON.stringify(row.payload, null, 2) })
}

// Clipboard access is permission-gated and unavailable outside a secure
// context, so a failure is reported rather than thrown.
async function copyValue({ label, value }) {
  let message = `${label} copied to clipboard`
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    message = `Couldn't copy the ${label.toLowerCase()} — select it and copy by hand.`
  }
  $q.notify({ message, color: 'dark', position: 'bottom', timeout: 2500 })
}

// Keep the detail panel pointed at the newest event until the user picks one.
onMounted(() => {
  loadRouting()
  loadSamples()
  if (!selectedId.value && events.value.length) {
    selectedId.value = events.value[0].id
  }
})
</script>
