<template>
  <dl :class="listClass">
    <div v-for="(item, i) in items" :key="item.label ?? i" :class="rowClass">
      <dt class="text-xs font-medium text-subtle">{{ item.label }}</dt>
      <dd :class="valueClass">
        <!-- `value-<label-slug>` lets a row render a StatusBadge, a router-link
             or anything else in place of the plain string. -->
        <slot
          :name="`value-${slug(item.label)}`"
          :item="item"
          :value="item.value"
          :slug="slug(item.label)"
        >
          <span :class="isBlank(item.value) ? 'text-subtle' : ''">{{
            display(item.value)
          }}</span>
        </slot>
        <p v-if="item.hint" class="mt-0.5 text-xs text-subtle">{{
          item.hint
        }}</p>
      </dd>
    </div>
  </dl>
</template>

<script setup>
import { computed } from 'vue'

// The label -> value read-out every detail screen needs. Before this existed,
// SourceDetailPage, DestinationDetailPage, PipeDetailPage and PipeParams each
// carried their own <dl>; the class strings below are lifted verbatim from
// those, so a converted screen looks byte-identical to what shipped.
//
//   columns=1  the stacked, baseline-aligned, divide-y rows from PipeDetailPage
//              and PipeParams: label left, value right, one per line.
//   columns=2  the responsive grid from SourceDetailPage: label above value,
//              two per row from `sm` up, one per row below it.
//
// Rows are separated with `divide-line` in both shapes. In the 1-column case
// that is container-level `divide-y`; in the 2-column case each cell carries its
// own `border-t` instead, because a grid's last row is not its last child and
// `divide-y` would strand a border under the second-to-last cell.
const props = defineProps({
  // [{ label, value, hint? }] — `value` is pre-formatted; this component does
  // no number/date formatting, matching StatCard.
  items: { type: Array, default: () => [] },
  columns: {
    type: Number,
    default: 2,
    validator: v => v === 1 || v === 2
  }
})

const twoUp = computed(() => props.columns === 2)

const listClass = computed(() =>
  twoUp.value
    ? 'grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8'
    : 'flex flex-col divide-y divide-line'
)

const rowClass = computed(() =>
  twoUp.value
    ? 'min-w-0 border-t border-line py-2.5 first:border-t-0 first:pt-0 sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(2)]:pt-0'
    : 'flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0 last:pb-0'
)

const valueClass = computed(() =>
  twoUp.value
    ? 'mt-0.5 min-w-0 break-words text-sm text-ink'
    : 'min-w-0 break-words text-sm text-ink'
)

// A row with nothing in it still needs to occupy its line — a blank <dd> reads
// as a rendering bug rather than as "not set". Same em dash PipeParams uses.
function isBlank(value) {
  return value === null || value === undefined || value === ''
}

function display(value) {
  if (isBlank(value)) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// "Pipe ID" -> "pipe-id", so the slot is `#value-pipe-id`.
function slug(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
</script>
