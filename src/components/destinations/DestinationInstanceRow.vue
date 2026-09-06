<template>
  <!-- One card per destination, NOT a table row — the prototype's
       `.resource-row`, which is `.instance-row` on the Sources screen with the
       same five cells and near-identical tracks (1.3fr .72fr .72fr .62fr auto
       against 1.2fr .7fr .7fr .55fr auto). Kept as two components rather than
       one generic `ResourceRow`: the cells differ in what they mean, not just in
       what they hold, and a shared component would take five slots and a props
       object and be longer than both.

       `grid`, never `flex`: Quasar's unlayered `.flex` is `display:flex;
       flex-wrap:wrap`, so every flex container in this repo wraps and a cell
       whose label got longer would jump onto its own line (collision #4). -->
  <div
    :class="[
      'grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3',
      'rounded-sfere-lg border p-4 transition-colors duration-150',
      '@min-[48rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto_auto]',
      needsAttention
        ? 'border-sfere-warn/40 bg-sfere-warn-soft hover:border-sfere-warn/70'
        : 'border-sfere-line bg-sfere-surface hover:border-sfere-300'
    ]"
    @click="onRowClick"
  >
    <!-- NAME. The link is what makes the card keyboard-reachable and
         middle-clickable; the card's own @click is pointer convenience on top
         of it, and skips anything that came from a control of its own. -->
    <div
      class="flex items-center gap-2.5 @max-[48rem]:col-start-1 @max-[48rem]:row-start-1"
    >
      <FlowNodeIcon
        kind="destination"
        :subtype="destination.destinationType"
        :size="18"
        class="shrink-0 text-sfere-fg-muted"
      />
      <div class="sfere-flush min-w-0 flex-1">
        <router-link
          :to="detailRoute"
          class="block truncate text-sfere-sm font-semibold text-sfere-fg hover:text-sfere-brand-text focus-visible:outline-none focus-visible:underline"
          >{{ destination.name }}</router-link
        >
        <p class="truncate text-sfere-xs text-sfere-fg-muted">{{ typeLine }}</p>
      </div>
    </div>

    <!-- PIPES delivering here. -->
    <div
      class="sfere-flush min-w-0 @max-[48rem]:col-start-1 @max-[48rem]:row-start-2"
    >
      <p class="truncate text-sfere-xs font-semibold text-sfere-fg">{{
        pipeLine
      }}</p>
      <p class="truncate text-sfere-xs text-sfere-fg-muted">{{
        pipeSubLine
      }}</p>
    </div>

    <!-- WHO BUILT IT. The prototype prints "Included / Sfere covers the
         warehouse", which is a billing claim nothing on the record measures;
         this says who created the database, which is the honest half of the
         same sentence and the exact wording the detail screen's Provisioning
         card uses. See destinationProvisioning.js. -->
    <div
      class="sfere-flush min-w-0 @max-[48rem]:col-start-1 @max-[48rem]:row-start-3"
    >
      <p class="truncate text-sfere-xs font-semibold text-sfere-fg">{{
        provisioningLabel
      }}</p>
      <p class="truncate text-sfere-xs text-sfere-fg-muted">{{
        provisioningHint
      }}</p>
    </div>

    <div
      class="@max-[48rem]:col-start-2 @max-[48rem]:row-start-2 @max-[48rem]:justify-self-end"
    >
      <StatusBadge :tone="status.tone" :label="status.label" dot />
    </div>

    <div
      class="justify-self-end @max-[48rem]:col-start-2 @max-[48rem]:row-start-1"
    >
      <RowActionsMenu
        :label="`Actions for ${destination.name}`"
        :actions="actions"
        @select="key => emit('action', key)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import FlowNodeIcon from '@/components/flow/FlowNodeIcon.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import { NOT_KNOWN } from '@/lib/emptyValue'
import { destinationTypeLabel } from '@/components/destinations/destinationTypeLabels'
import {
  destinationProvisioning,
  PROVISIONING_LABELS,
  PROVISIONING_HINTS
} from '@/components/destinations/destinationProvisioning'

// One row of `/destinations`, ported from the prototype's `.resource-row`.
//
// It takes `activity` as a prop rather than reading `useFlowActivity()` itself,
// for `SourceInstanceRow`'s reason: a row per record each firing the dashboard
// aggregate is one call per row for one screen's worth of numbers.
const props = defineProps({
  // A destination as `useDestinations()` returns it.
  destination: { type: Object, required: true },
  // The matching `useFlowActivity().byDestinationId` entry, or null when the
  // aggregate did not describe it. Null is a first-class state: the cells below
  // print NOT_KNOWN rather than a confident zero.
  activity: { type: Object, default: null },
  actions: { type: Array, default: () => [] }
})

const emit = defineEmits(['action'])

const router = useRouter()

const detailRoute = computed(() => ({
  name: 'destinations-detail',
  params: { id: props.destination.id }
}))

// Type label and slug, the same pair the Sources row draws under a name, so
// the two screens read as one set. `destinationTypeLabel` degrades an
// unanticipated type to sentence-cased words rather than leaking a raw key.
const typeLine = computed(() =>
  [
    destinationTypeLabel(props.destination.destinationType),
    props.destination.slug
  ]
    .filter(Boolean)
    .join(' · ')
)

const pipeLine = computed(() => {
  if (!props.activity) return NOT_KNOWN
  const n = props.activity.pipeCount
  if (!n) return 'No pipes'
  return n === 1 ? '1 pipe' : `${n} pipes`
})

const pipeSubLine = computed(() => {
  if (!props.activity) return 'Pipes'
  return props.activity.pipeCount
    ? 'Using this destination'
    : 'Nothing delivers here yet'
})

const provisioningState = computed(() =>
  destinationProvisioning(props.destination)
)
const provisioningLabel = computed(
  () => PROVISIONING_LABELS[provisioningState.value]
)
const provisioningHint = computed(
  () => PROVISIONING_HINTS[provisioningState.value]
)

// Enabled, something is actually pointed at it, and the window counted zero
// rows written. All three halves are needed, and each drops a different false
// positive: a paused destination is not "failing", a destination with no pipe
// delivers nothing by definition, and `events_delivered` is explicitly null
// when the analytics store did not answer — which is not the same fact as a
// counted zero and must never colour the card.
const needsAttention = computed(
  () =>
    props.destination.isEnabled &&
    (props.activity?.pipeCount ?? 0) > 0 &&
    props.activity?.eventsDelivered === 0
)

// The chip's precision tracks the data's, the same rule the Sources row
// follows: it only says "No recent deliveries" where a delivery count was
// really taken, and otherwise reports the one thing the record itself asserts.
const status = computed(() => {
  if (!props.destination.isEnabled) return { tone: 'neutral', label: 'Paused' }
  if (needsAttention.value)
    return { tone: 'warn', label: 'No recent deliveries' }
  return { tone: 'success', label: 'Enabled' }
})

// The card is clickable for the pointer; the name link is the accessible path.
// Clicks that started on a control of the row's own — the link, the kebab, an
// item inside the teleported menu — are already handled by that control.
function onRowClick(event) {
  if (event.target.closest('a, button')) return
  router.push(detailRoute.value)
}
</script>
