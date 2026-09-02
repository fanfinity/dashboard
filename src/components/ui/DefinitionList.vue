<template>
  <dl :class="listClasses">
    <div v-for="(item, i) in items" :key="item.label ?? i" :class="rowClasses">
      <dt :class="labelClasses">{{ item.label }}</dt>
      <dd :class="valueClasses">
        <!-- `value-<label-slug>` lets one row render a StatusBadge, a link or a
             copy button in place of the plain string. -->
        <slot
          :name="`value-${slug(item.label)}`"
          :item="item"
          :value="item.value"
          :slug="slug(item.label)"
        >
          <span :class="isBlank(item.value) ? mutedClass : ''">{{
            display(item.value)
          }}</span>
        </slot>
        <p v-if="item.hint" :class="['mt-0.5 text-sfere-xs', mutedClass]">{{
          item.hint
        }}</p>
      </dd>
    </div>
  </dl>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'

// The label -> value read-out every detail screen needs. The props and the
// `value-<slug>` slot names are carried over verbatim from the component this
// replaced, which is why the detail screens did not have to be touched when the
// kit moved onto the Sfere tokens.
//
//   columns=1  stacked rows, label left and value right, one per line. For a
//              narrow column or a card body.
//   columns=2  label above value, two per row from `sm` up. For the wide
//              summary block at the top of a detail page.
//
// In the 2-up shape each cell carries its own `border-t` rather than the
// container carrying `divide-y`: a grid's last row is not its last child, so
// `divide-y` would strand a border under the second-to-last cell.
//
// Values are pre-formatted by the page. This component does no number or date
// formatting, matching StatCard.
const props = defineProps({
  // [{ label, value, hint? }]
  items: { type: Array, default: () => [] },
  columns: {
    type: Number,
    default: 2,
    validator: v => v === 1 || v === 2
  },
  onDark: { type: Boolean, default: false }
})

const twoUp = computed(() => props.columns === 2)

const mutedClass = computed(() =>
  props.onDark ? 'text-white/50' : 'text-sfere-fg-muted'
)

const divider = computed(() =>
  props.onDark ? 'border-sfere-hairline' : 'border-sfere-line'
)

const listClasses = computed(() =>
  twoUp.value ? 'grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8' : 'flex flex-col'
)

const rowClasses = computed(() =>
  twoUp.value
    ? [
        'min-w-0 border-t py-3 first:border-t-0 first:pt-0 sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(2)]:pt-0',
        divider.value
      ]
    : [
        'flex flex-wrap items-baseline justify-between gap-2 border-t py-3 first:border-t-0 first:pt-0 last:pb-0',
        divider.value
      ]
)

const labelClasses = computed(() => [
  'font-sfere-mono text-sfere-label uppercase',
  props.onDark ? 'text-white/45' : 'text-sfere-fg-muted'
])

const valueClasses = computed(() => [
  'min-w-0 break-words text-sfere-sm',
  twoUp.value && 'mt-1',
  props.onDark ? 'text-white/85' : 'text-sfere-fg'
])

// A row with nothing in it still has to occupy its line — a blank <dd> reads as
// a rendering bug rather than as "not set".
function isBlank(value) {
  return value === null || value === undefined || value === ''
}

function display(value) {
  if (isBlank(value)) return NOT_KNOWN
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// "Pipe ID" -> "pipe-id", so the slot reads `#value-pipe-id`.
function slug(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
</script>
