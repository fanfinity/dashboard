<template>
  <!-- One card per source, NOT a table row. The prototype's `.instance-row` is
       a bordered card with two-line cells, and the two-line cell is the reason:
       a table would need eight columns to say what four stacked pairs say, and
       the pairs are what make "1 pipe / Sfere Data Warehouse" read as one fact
       instead of two.

       `grid`, never `flex`: Quasar's unlayered `.flex` is `display:flex;
       flex-wrap:wrap`, so every flex container in this repo wraps and a cell
       whose label got longer would jump onto its own line (collision #4). -->
  <div
    :class="[
      'grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3',
      'rounded-sfere-lg border p-4 transition-colors duration-150',
      '@min-[48rem]:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto_auto]',
      // Amber card for a source that is switched on and has received nothing
      // in the window — the prototype's `.warning-row`, and the one row state
      // worth colouring, because it is the only one somebody has to act on.
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
        kind="source"
        :subtype="source.sourceType"
        :size="18"
        class="shrink-0 text-sfere-fg-muted"
      />
      <div class="sfere-flush min-w-0 flex-1">
        <router-link
          :to="detailRoute"
          class="block truncate text-sfere-sm font-semibold text-sfere-fg hover:text-sfere-brand-text focus-visible:outline-none focus-visible:underline"
          >{{ source.name }}</router-link
        >
        <p class="truncate text-sfere-xs text-sfere-fg-muted">{{ typeLine }}</p>
      </div>
    </div>

    <!-- PIPES + where they deliver. -->
    <div
      class="sfere-flush min-w-0 @max-[48rem]:col-start-1 @max-[48rem]:row-start-2"
    >
      <p class="truncate text-sfere-xs font-semibold text-sfere-fg">{{
        pipeLine
      }}</p>
      <p class="truncate text-sfere-xs text-sfere-fg-muted">{{
        destinationLine
      }}</p>
    </div>

    <!-- ACTIVITY. The prototype prints "8 sec ago / Last activity"; nothing on
         any endpoint measures a per-source last-event timestamp, so this says
         the thing that IS measured — incoming events in the dashboard's
         window — in the same two-line shape. `NOT_KNOWN`, never `0`, when the
         aggregate had nothing to say about this source. -->
    <div
      class="sfere-flush min-w-0 @max-[48rem]:col-start-1 @max-[48rem]:row-start-3"
    >
      <p class="truncate text-sfere-xs font-semibold text-sfere-fg">{{
        eventLine
      }}</p>
      <p class="truncate text-sfere-xs text-sfere-fg-muted">{{
        eventSubLine
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
        :label="`Actions for ${source.name}`"
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
import { formatCount, sourceTypeLabel } from '@/composables/useSources'

// One row of `/sources`, ported from the prototype's `.instance-row`.
//
// It takes `activity` as a prop rather than reading `useFlowActivity()`
// itself: fourteen rows each firing the dashboard aggregate is fourteen calls
// for one screen's worth of numbers, and the composable's own contract — a
// missing entry means "not known" — is easier to honour in one place.
const props = defineProps({
  // A source as `useSources()` returns it.
  source: { type: Object, required: true },
  // The matching `useFlowActivity().bySourceId` entry, or null when the
  // aggregate did not describe this source (it failed, it is not deployed
  // here, or the source is newer than the window). Null is a first-class
  // state: every cell below prints NOT_KNOWN rather than a confident zero.
  activity: { type: Object, default: null },
  actions: { type: Array, default: () => [] }
})

const emit = defineEmits(['action'])

const router = useRouter()

const detailRoute = computed(() => ({
  name: 'sources-detail',
  params: { id: props.source.id }
}))

// The second line under the name: what kind of thing this is. The prototype
// writes a category and a platform ("Website · Web SDK"); the record carries
// one type string, so the type label and the slug are the honest pair — the
// slug is what the install snippet and every URL use, so it is the half a
// reader actually needs to tell two websites apart.
const typeLine = computed(() =>
  [sourceTypeLabel(props.source.sourceType), props.source.slug]
    .filter(Boolean)
    .join(' · ')
)

const pipeLine = computed(() => {
  if (!props.activity) return NOT_KNOWN
  const n = props.activity.pipeCount
  if (!n) return 'No pipes'
  return n === 1 ? '1 pipe' : `${n} pipes`
})

const destinationLine = computed(() => {
  if (!props.activity) return 'Pipes'
  const names = props.activity.destinationNames
  if (!names.length) return 'Not delivering anywhere yet'
  if (names.length === 1) return names[0]
  // Two names side by side is already wider than the cell; the count is the
  // honest summary and the detail screen lists them.
  return `${names.length} destinations`
})

const eventLine = computed(() => {
  if (!props.activity) return NOT_KNOWN
  const n = props.activity.eventCount
  return n === 1 ? '1 event' : `${formatCount(n)} events`
})

const eventSubLine = computed(() =>
  props.activity ? 'Last 60 min' : 'Events received'
)

// Enabled, and the window counted zero. Not the same as "we have no count":
// that is what `activity` being null means, and it must not colour the card.
const needsAttention = computed(
  () => props.source.isEnabled && props.activity?.eventCount === 0
)

// The chip's precision tracks the data's, deliberately. With a count in hand
// it can say Active or No recent activity, which is what the prototype shows.
// Without one, the only thing true of the record is its own switch — so it
// says Enabled, and does not imply traffic nobody measured.
const status = computed(() => {
  if (!props.source.isEnabled) return { tone: 'neutral', label: 'Paused' }
  if (!props.activity) return { tone: 'success', label: 'Enabled' }
  return props.activity.eventCount > 0
    ? { tone: 'success', label: 'Active' }
    : { tone: 'warn', label: 'No recent activity' }
})

// The card is clickable for the pointer; the name link is the accessible path.
// Clicks that started on a control of the row's own — the link, the kebab, an
// item inside the teleported menu — are already handled by that control.
function onRowClick(event) {
  if (event.target.closest('a, button')) return
  router.push(detailRoute.value)
}
</script>
