<template>
  <q-page class="p-6">
    <PageHeader
      title="Demo Store"
      subtitle="A sample storefront that fires realistic fan-commerce events, so you can watch the pipeline work before wiring up a site of your own."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'demo-event-inspector' })"
        >
          Event Inspector
          <StatusBadge
            v-if="events.length"
            tone="brand"
            :label="formatCount(events.length)"
          />
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          :disabled="running || !source"
          @click="runJourney"
        >
          {{ running ? 'Firing…' : 'Run the full journey' }}
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="4" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the source this demo reports as."
      :message="error"
      @retry="load"
    />

    <!-- The source being absent is an answer, not a failure: the fetch worked
         and there is no Web SDK source in this workspace. -->
    <EmptyState
      v-else-if="!source"
      title="Demo source not configured"
      description="The Demo Store reports as the Web SDK source, and this workspace has none. Connect one and the store has somewhere to report from."
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'sources' })"
        >
          Connect a source
        </button>
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-5">
      <NoticeBanner
        tone="info"
        title="Nothing here is really ingested"
        message="Every event you fire is simulated in this browser tab and kept for this session only. No request leaves the page, nothing reaches an ingest endpoint, and a reload starts over."
      />

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Events fired"
          :value="formatCount(events.length)"
          hint="This session, in this tab only"
        />
        <StatCard
          label="Event types"
          :value="formatCount(eventNames.length)"
          :hint="eventNames.join(', ') || 'Nothing fired yet'"
        />
        <StatCard
          label="Basket"
          :value="formatPrice(basketValue)"
          :hint="`${formatCount(cart.length)} item(s)`"
        />
        <StatCard
          label="Reporting as"
          :value="source.name"
          :hint="`${source.slug} · ${identityLabel}`"
        />
      </div>

      <FormSection
        title="1 · Pick a product"
        description="Whatever is selected here is the product every event describes — its id, price and category all travel in the payload."
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DemoProductCard
            v-for="product in products"
            :key="product.id"
            :product="product"
            :selected="product.id === selectedId"
            @select="selectedId = product.id"
          />
        </div>
      </FormSection>

      <FormSection
        title="2 · Fire an event"
        :description="`Each one appends a single event for “${selected.name}” to the local log. Every button produces a different payload shape.`"
      >
        <ul class="flex flex-col divide-y divide-line">
          <li
            v-for="action in actions"
            :key="action.key"
            class="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium text-ink">{{ action.label }}</p>
                <StatusBadge tone="neutral" :label="action.eventName" />
              </div>
              <p class="mt-0.5 text-xs leading-5 text-muted">{{
                action.description
              }}</p>
            </div>
            <button
              class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
              :disabled="running"
              @click="fire(action)"
            >
              Fire
            </button>
          </li>
        </ul>
      </FormSection>

      <!-- `min-w-0` on both columns: a grid item defaults to `min-width: auto`,
           so the ingest panel's snippet <pre> would set the track's floor to its
           longest line and push the whole page into horizontal overflow. -->
      <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <!-- A plain block, not a flex column: a flex item's width is clamped
             to its own min-content, and the ingest panel's snippet <pre> would
             then push this card wider than its two tracks. A block child simply
             takes its parent's width and lets the <pre> scroll inside it. -->
        <div class="min-w-0 xl:col-span-2">
          <p class="mb-2 text-xs text-subtle">
            A real storefront would push to the endpoint below with this write
            key. The Demo Store only pretends to — it writes straight into the
            inspector instead.
          </p>
          <SourceIngestPanel :source="source" @copy="copyValue" />
        </div>

        <div class="flex min-w-0 flex-col gap-5">
          <CardPanel>
            <template #header>
              <span class="text-sm font-semibold text-ink"
                >Session activity</span
              >
              <router-link
                :to="{ name: 'demo-event-inspector' }"
                class="text-sm font-medium text-brand hover:underline"
                >Open the inspector</router-link
              >
            </template>

            <EmptyState
              v-if="!events.length"
              variant="inline"
              title="No events fired yet"
              description="Pick a product, then fire an event — it lands here and in the inspector."
            />

            <ol v-else class="flex flex-col divide-y divide-line">
              <li
                v-for="event in recent"
                :key="event.id"
                class="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div class="min-w-0">
                  <p class="truncate font-mono text-xs text-ink">{{
                    event.eventName
                  }}</p>
                  <p class="truncate text-xs text-subtle">{{
                    describe(event)
                  }}</p>
                </div>
                <span class="shrink-0 text-xs text-subtle">{{
                  formatEventTime(event.occurredAt)
                }}</span>
              </li>
            </ol>
          </CardPanel>

          <CardPanel>
            <template #header>
              <span class="text-sm font-semibold text-ink"
                >Where these would go</span
              >
              <StatusBadge
                v-if="!routingLoading && !routingError"
                tone="neutral"
                :label="`${formatCount(routes.length)} pipes`"
              />
            </template>

            <LoadingState v-if="routingLoading" variant="form" :rows="2" />

            <!-- Secondary to this screen: the store still fires events without
                 it, so the failure stays inside this panel. -->
            <ErrorState
              v-else-if="routingError"
              title="Couldn't load pipes and destinations."
              :message="routingError"
              @retry="loadRouting"
            />

            <EmptyState
              v-else-if="!routes.length"
              variant="inline"
              title="No pipe is listening"
              :description="`Nothing routes ${source.name} yet, so these events would be collected but not delivered.`"
            />

            <ul v-else class="flex flex-col divide-y divide-line">
              <li
                v-for="route in routes"
                :key="route.id"
                class="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm text-ink">{{ route.name }}</p>
                  <p class="truncate text-xs text-subtle"
                    >→ {{ route.destinationName }}</p
                  >
                </div>
                <StatusBadge
                  :tone="route.isEnabled ? 'success' : 'neutral'"
                  :label="route.isEnabled ? 'Enabled' : 'Paused'"
                />
              </li>
            </ul>
          </CardPanel>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import FormSection from '@/components/ui/FormSection.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import SourceIngestPanel from '@/components/sources/SourceIngestPanel.vue'
import DemoProductCard from '@/components/demo/DemoProductCard.vue'
import {
  DEMO_PROFILE_ID,
  formatCount,
  formatEventTime,
  useDemoEvents,
  useDemoRouting
} from '@/composables/useDemoEvents'
import {
  DEMO_ACTIONS,
  DEMO_JOURNEY,
  DEMO_PRODUCTS,
  cartValue,
  demoEventSpec,
  formatPrice,
  useDemoStoreSource
} from '@/composables/useDemoStorefront'

// The "try it now" half of the pair: this page produces events,
// /demo-event-inspector reads them. Both talk to the same module-level log in
// useDemoEvents, so a fired event is already there when the user navigates.
//
// Nothing is sent anywhere, and nothing here is a stand-in for something that
// does: the dashboard has no ingestion path at all. Sending an event is the
// backend's job, so this page simulates the payload rather than firing one,
// and the notice at the top of the screen says so.
const router = useRouter()
const $q = useQuasar()

// Primary resource: the source the store reports as.
const { source, loading, error, load } = useDemoStoreSource()

// Secondary: which pipes would pick these events up.
const {
  loading: routingLoading,
  error: routingError,
  load: loadRouting,
  routesFor
} = useDemoRouting()

const { events, eventNames, capture, identify } = useDemoEvents()

const products = DEMO_PRODUCTS
const actions = DEMO_ACTIONS

const selectedId = ref(DEMO_PRODUCTS[0].id)
const cart = ref([])
const running = ref(false)

let orderSequence = 0

const selected = computed(
  () => products.find(p => p.id === selectedId.value) ?? products[0]
)

const basketValue = computed(() => cartValue(cart.value))

const recent = computed(() => events.value.slice(0, 6))

const routes = computed(() =>
  source.value ? routesFor({ sourceId: source.value.id }) : []
)

const identityLabel = computed(() =>
  events.value.some(e => e.profileId)
    ? 'Identified visitor'
    : 'Anonymous visitor'
)

// A purchase with an empty basket would carry no line items, which reads as a
// bug rather than as a demo — fall back to whatever is selected.
const basket = computed(() =>
  cart.value.length ? cart.value : [selected.value]
)

function nextOrderId() {
  orderSequence += 1
  return `ord_demo_${String(orderSequence).padStart(4, '0')}`
}

function describe(event) {
  const body = event.payload.properties ?? event.payload.traits ?? {}
  return (
    body.name ?? body.title ?? body.email ?? body.orderId ?? event.sourceName
  )
}

// Fires one action for the selected product and folds its side effect (basket,
// identity) into the session.
function fire(action, { quiet = false } = {}) {
  const spec = demoEventSpec(action.key, selected.value, {
    cart: basket.value,
    orderId: action.key === 'purchase' ? nextOrderId() : null
  })

  if (action.key === 'identify') identify(DEMO_PROFILE_ID)

  const event = capture(spec)

  if (action.key === 'add_to_cart') cart.value = [...cart.value, selected.value]
  if (action.key === 'purchase') cart.value = []

  // `quiet` is for the journey: five toasts in two seconds stack up and cover
  // the product tiles, so the run reports once at the end instead.
  if (!quiet) notifyLocal(`${event.eventName} captured`)

  return event
}

// Nothing here persists or is sent — say so in the toast rather than implying
// an ingest happened.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Simulated locally — nothing was ingested.',
    color: 'dark',
    timeout: 2000
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// The whole funnel in order, paced so the inspector shows five distinct
// timestamps rather than five identical ones.
async function runJourney() {
  running.value = true
  let fired = 0
  try {
    for (const key of DEMO_JOURNEY) {
      const action = actions.find(a => a.key === key)
      if (!action) continue
      fire(action, { quiet: true })
      fired += 1
      await delay(220)
    }
  } finally {
    running.value = false
  }
  notifyLocal(`${formatCount(fired)} events captured`)
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
  $q.notify({ message, color: 'dark', timeout: 2500 })
}

onMounted(() => {
  load()
  loadRouting()
})
</script>
