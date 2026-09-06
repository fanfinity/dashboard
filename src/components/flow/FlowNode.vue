<template>
  <component
    :is="tag"
    v-bind="linkAttrs"
    :type="tag === 'button' ? 'button' : undefined"
    :class="rootClasses"
    @click="onClick"
  >
    <SfereIconChip size="sm" :on-dark="onDark">
      <FlowNodeIcon :kind="kind" :subtype="subtype" :size="18" />
    </SfereIconChip>

    <span class="min-w-0 flex-1">
      <span :class="nameClasses">{{ name }}</span>
      <span v-if="hint" :class="hintClasses">{{ hint }}</span>
      <span v-if="note" :class="noteClasses">{{ note }}</span>
    </span>

    <StatusBadge
      v-if="status"
      :tone="statusTone || statusMeta.tone"
      :label="statusLabel || statusMeta.label"
      class="shrink-0"
    />
  </component>
</template>

<script setup>
import { computed } from 'vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import FlowNodeIcon from './FlowNodeIcon.vue'
import { flowStatus } from './flowStatus'

// One box in a flow picture: a source, a destination, or the single node a
// FlowChain draws at each end. Mark, name, one line of detail, one status chip.
//
// IT IS THE ANCHOR THE CONNECTOR LINES MEASURE, which is the constraint that
// shapes it. FlowTopology reads each node's bounding box to decide where a curve
// starts, so this component must be a single element with a stable box — no
// wrapping fragment, no margin collapsing, and a fixed vertical rhythm so the
// column's boxes stay evenly spaced when one name wraps to two lines.
//
// `flex-nowrap!` is load-bearing rather than cosmetic. Quasar ships an unlayered
// `.flex { display:flex; flex-wrap:wrap }` and the layered `flex-nowrap` utility
// loses to it, so without the important suffix a long source name pushes the
// status chip onto a second line and the node grows a row — which moves the
// point the connector was drawn to. CLAUDE.md collision #4.
const props = defineProps({
  kind: {
    type: String,
    default: 'source',
    validator: v => ['source', 'destination'].includes(v)
  },
  // `source_type` / `destination_type`, for picking the mark.
  subtype: { type: String, default: '' },
  name: { type: String, required: true },
  // One line under the name: "Web SDK", "Powered by ClickHouse · Included".
  hint: { type: String, default: '' },
  // A second, quieter line. Only the included warehouse uses it today.
  note: { type: String, default: '' },
  // A Status5 string: healthy | degraded | failing | idle. Omit for a node with
  // nothing to report — a chip reading "Idle" on a node that was never measured
  // is a claim, not a blank.
  status: { type: String, default: '' },
  isEnabled: { type: Boolean, default: true },
  // Overrides the word on the chip without changing its colour, for a screen
  // whose vocabulary is narrower than the endpoint's ("No recent activity").
  statusLabel: { type: String, default: '' },
  // And the colour, for the narrower case still: a node the page knows is
  // waiting rather than stalled. `idle` is grey because "switched on and
  // receiving nothing" usually wants looking at — but on a workspace with no
  // source at all there is nothing for the destination to receive, so grey
  // reads as a fault the reader cannot fix. Pass a StatusBadge tone to say
  // what the page knows and the record does not. Never pass `success` for
  // something unmeasured; that is the claim the whole diagram avoids.
  statusTone: { type: String, default: '' },
  to: { type: [String, Object], default: null },
  // Draws the warn treatment regardless of status. For the one node a page is
  // pointing at.
  attention: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const statusMeta = computed(() => flowStatus(props.status, props.isEnabled))

// A node is a link when it has somewhere to go, a button when a parent wants
// the click, and a plain div otherwise — never a button that does nothing,
// which is focusable and announces itself as actionable.
const tag = computed(() => {
  if (props.to) return 'router-link'
  return 'div'
})

const linkAttrs = computed(() =>
  tag.value === 'router-link' ? { to: props.to } : {}
)

function onClick() {
  emit('select')
}

const attentionTone = computed(
  () => props.attention || statusMeta.value.tone === 'warn'
)

const rootClasses = computed(() => [
  'flex flex-nowrap w-full items-center gap-3 rounded-sfere-lg border px-3.5 py-3',
  'text-left transition duration-200 ease-sfere-ui',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-ink-raised'
    : attentionTone.value
      ? 'border-sfere-warn/40 bg-sfere-warn-soft'
      : 'border-sfere-line bg-sfere-surface',
  props.to &&
    (props.onDark
      ? 'hover:border-sfere-hairline-strong'
      : 'hover:-translate-y-0.5 hover:border-sfere-300 hover:shadow-sfere-soft'),
  props.to &&
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-brand focus-visible:ring-offset-2'
])

const nameClasses = computed(() => [
  'block truncate text-sfere-sm font-semibold',
  props.onDark ? 'text-sfere-dark-fg' : 'text-sfere-fg'
])

const hintClasses = computed(() => [
  'block truncate text-sfere-xs',
  props.onDark ? 'text-sfere-dark-fg-muted' : 'text-sfere-fg-muted'
])

const noteClasses = computed(() => [
  'block truncate text-sfere-xs',
  props.onDark ? 'text-sfere-dark-fg-muted/70' : 'text-sfere-fg-muted/75'
])
</script>
