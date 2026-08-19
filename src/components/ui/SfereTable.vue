<template>
  <div :class="frameClasses">
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-left">
        <thead>
          <tr :class="headRowClasses">
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :aria-sort="col.ariaSort || undefined"
              :style="col.width ? { width: col.width } : undefined"
              :class="headCellClasses(col)"
            >
              <slot :name="`head-${col.key}`" :col="col">{{ col.label }}</slot>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="(row, i) in rows"
            :key="row[rowKey] ?? i"
            :class="bodyRowClasses"
            @click="clickableRows && emit('row-click', row)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              :class="bodyCellClasses(col)"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="!rows.length" :class="emptyClasses">
      <slot name="empty">Nothing to show yet.</slot>
    </div>

    <div v-if="$slots.footer" :class="footerClasses">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// A hand-rolled <table>, not a grid of divs — sorting, screen readers and
// browser find-in-page all depend on real table semantics.
//
// This is presentation only: no sorting, no paging, no fetching. Those belong
// to the page, which already knows how much data there is and where it came
// from. Column headers are mono uppercase micro-labels, which is what keeps a
// dense table from reading as a wall of same-sized text.
//
// Two slots exist so DataTable can COMPOSE on this rather than re-implement
// a second <table>: `head-<key>` replaces a header cell's label (that is where
// the sort caret goes) and `footer` adds a bar inside the same bordered frame
// (that is where pagination goes). Both are additive — a table that sets
// neither renders exactly as it did before they existed.
const props = defineProps({
  // [{ key, label, align?: 'left'|'center'|'right', width?: CSS length,
  //    ariaSort?: 'ascending'|'descending'|'none' }]
  //
  // `ariaSort` lands on the <th>, which is where the ARIA spec puts it — on the
  // columnheader, not on a button inside it. This table does not sort, so it
  // never sets the value itself; DataTable, which does, hands down a
  // column list with it filled in.
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  rowKey: { type: String, default: 'id' },
  clickableRows: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['row-click'])

const ALIGN = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
}

const frameClasses = computed(() => [
  'overflow-hidden rounded-sfere-xl border',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-ink-raised'
    : 'border-sfere-line bg-sfere-surface'
])

const headRowClasses = computed(() => [
  'border-b',
  props.onDark
    ? 'border-sfere-hairline bg-white/[0.03]'
    : 'border-sfere-line bg-sfere-fill/60'
])

function headCellClasses(col) {
  return [
    'whitespace-nowrap px-4 py-2.5 font-sfere-mono text-sfere-label uppercase',
    ALIGN[col.align || 'left'],
    props.onDark ? 'text-white/45' : 'text-sfere-fg-muted'
  ]
}

const bodyRowClasses = computed(() => [
  'border-b last:border-0 transition-colors duration-150',
  props.onDark
    ? 'border-sfere-hairline hover:bg-white/[0.04]'
    : 'border-sfere-line hover:bg-sfere-fill/70',
  props.clickableRows && 'cursor-pointer'
])

function bodyCellClasses(col) {
  return [
    'px-4 py-3 text-sfere-sm align-middle',
    ALIGN[col.align || 'left'],
    props.onDark ? 'text-white/80' : 'text-sfere-fg'
  ]
}

const footerClasses = computed(() => [
  'flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-sfere-xs',
  props.onDark
    ? 'border-sfere-hairline bg-white/[0.02] text-white/55'
    : 'border-sfere-line bg-sfere-fill/40 text-sfere-fg-muted'
])

const emptyClasses = computed(() => [
  'px-4 py-10 text-center text-sfere-sm',
  props.onDark ? 'text-white/50' : 'text-sfere-fg-muted'
])
</script>
