<template>
  <div>
    <!-- Toolbar (search / filters / actions) sits above every state, so it does
         not disappear the moment a filter empties the list and strand the user
         with no way to undo the filter. -->
    <div v-if="$slots.toolbar" class="mb-4 flex flex-wrap items-center gap-2">
      <slot name="toolbar" />
    </div>

    <LoadingState v-if="loading" variant="table" :rows="6" :on-dark="onDark" />

    <ErrorState
      v-else-if="error"
      :message="error"
      :on-dark="onDark"
      @retry="emit('retry')"
    />

    <!-- A list has two empty states and they need different copy: filters
         matched nothing -> "No X match your search" + Clear filters, versus
         nothing exists yet -> the create action. The props below cover the
         second, common case; a page needing both overrides `empty` wholesale. -->
    <slot v-else-if="!rows.length" name="empty">
      <EmptyState
        :title="emptyTitle"
        :description="emptyDescription"
        :on-dark="onDark"
      >
        <template
          v-if="$slots['empty-cta'] || (emptyCtaLabel && emptyCtaTo)"
          #cta
        >
          <slot name="empty-cta">
            <SfereButton
              :variant="onDark ? 'white' : 'primary'"
              size="sm"
              :to="emptyCtaTo"
              >{{ emptyCtaLabel }}</SfereButton
            >
          </slot>
        </template>
      </EmptyState>
    </slot>

    <SfereTable
      v-else
      :columns="tableColumns"
      :rows="pagedRows"
      :row-key="rowKey"
      :clickable-rows="clickableRows"
      :on-dark="onDark"
      @row-click="row => emit('row-click', row)"
    >
      <!-- Sortable headers become real buttons. The caret holds its space when
           a column is unsorted (`opacity-0`, not `hidden`) so the header row
           does not reflow by a few pixels every time the sort changes. -->
      <template
        v-for="col in sortableColumns"
        :key="`head-${col.key}`"
        #[`head-${col.key}`]
      >
        <button
          type="button"
          class="inline-flex items-center gap-1 uppercase transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60"
          :class="[
            col.align === 'right' ? 'flex-row-reverse' : '',
            onDark ? 'hover:text-white' : 'hover:text-sfere-fg'
          ]"
          @click="toggleSort(col.key)"
        >
          {{ col.label }}
          <span
            aria-hidden="true"
            class="text-[0.5rem] leading-none"
            :class="
              sortKey === col.key
                ? onDark
                  ? 'text-sfere-300'
                  : 'text-sfere-brand-text'
                : 'opacity-0'
            "
            >{{ sortKey === col.key && sortDir === 'desc' ? '▼' : '▲' }}</span
          >
        </button>
      </template>

      <!-- Every cell slot is forwarded through with the same fallback SfereTable
           already renders, so a page's `#cell-status` reaches the <td> and a
           column with no slot still prints row[col.key]. -->
      <template
        v-for="col in columns"
        :key="`cell-${col.key}`"
        #[`cell-${col.key}`]="cell"
      >
        <slot :name="`cell-${col.key}`" v-bind="cell">{{ cell.value }}</slot>
      </template>

      <!-- Always rendered, even for a single page. "Showing 1-5 of 5" is the
           answer to "is this everything?", which a list owes the reader whether
           or not it happens to paginate. -->
      <template #footer>
        <span
          >Showing {{ rangeStart }}–{{ rangeEnd }} of
          {{ rows.length.toLocaleString('en-GB') }}</span
        >
        <div class="flex items-center gap-1.5">
          <SfereButton
            variant="secondary"
            size="sm"
            :disabled="page <= 1"
            @click="page--"
            >Prev</SfereButton
          >
          <span class="px-1 font-sfere-mono tabular-nums"
            >{{ page }} / {{ pageCount }}</span
          >
          <SfereButton
            variant="secondary"
            size="sm"
            :disabled="page >= pageCount"
            @click="page++"
            >Next</SfereButton
          >
        </div>
      </template>
    </SfereTable>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import SfereButton from './SfereButton.vue'
import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import LoadingState from './LoadingState.vue'
import SfereTable from './SfereTable.vue'

// The list screen, as one component. SfereTable stays presentation-only — this
// is the layer that owns the four states a real list has (loading, failed,
// empty, populated) plus sorting and paging, and it COMPOSES on SfereTable
// through its `head-<key>` and `footer` slots rather than growing a second
// <table>. One set of table styles, two entry points.
//
// The props and slot names are carried over verbatim from the table this
// replaced, so the ~30 list screens did not change when the kit did. Note
// `error` is a STRING (the message), not a boolean — every page that passes
// `:error="error"` straight from useMockResource relies on that.
//
// Sorting and paging are internal: hand down the whole `rows` array and let this
// slice it. Filtering stays with the page, because only the page knows which
// fields are searchable and what "Clear filters" should reset.
const props = defineProps({
  // [{ key, label, sortable?, align?: 'left'|'center'|'right', width? }]
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  rowKey: { type: String, default: 'id' },
  emptyTitle: { type: String, default: 'Nothing here yet' },
  emptyDescription: { type: String, default: '' },
  // One-CTA shortcut for the default empty state. Both must be set for the
  // button to render; anything richer goes in `empty-cta`, and the two-case
  // pattern goes in `empty`.
  emptyCtaLabel: { type: String, default: '' },
  // A router location, e.g. { name: 'sources-new' }. Declarative only — this
  // stays a dumb primitive and never reads the router.
  emptyCtaTo: { type: [Object, String], default: null },
  perPage: { type: Number, default: 25 },
  clickableRows: { type: Boolean, default: false },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['row-click', 'retry'])

const sortableColumns = computed(() => props.columns.filter(c => c.sortable))

// The sort state reaches the <th> through the column list rather than through
// the header slot, because `aria-sort` belongs on the columnheader and a slot
// cannot put an attribute on the element that hosts it. SfereTable stays dumb:
// it renders whatever the column says.
const tableColumns = computed(() =>
  props.columns.map(col =>
    col.sortable ? { ...col, ariaSort: ariaSort(col.key) } : col
  )
)

const sortKey = ref('')
const sortDir = ref('asc')
const page = ref(1)

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function ariaSort(key) {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

function sortValue(row, key) {
  const v = row[key]
  return typeof v === 'string' ? v.toLowerCase() : v
}

// Sort the whole set, then slice — sorting the visible page only would reorder
// rows within a page and leave the pages themselves in the original order.
const sortedRows = computed(() => {
  if (!sortKey.value) return props.rows
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const av = sortValue(a, sortKey.value)
    const bv = sortValue(b, sortKey.value)
    if (av == null && bv == null) return 0
    // Blanks sort last in either direction. A column of empty cells at the top
    // is never the answer someone clicked a header looking for.
    if (av == null) return dir
    if (bv == null) return -dir
    if (av < bv) return -dir
    if (av > bv) return dir
    return 0
  })
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(props.rows.length / props.perPage))
)

const pagedRows = computed(() => {
  const start = (page.value - 1) * props.perPage
  return sortedRows.value.slice(start, start + props.perPage)
})

const rangeStart = computed(() =>
  props.rows.length ? (page.value - 1) * props.perPage + 1 : 0
)

const rangeEnd = computed(() =>
  Math.min(page.value * props.perPage, props.rows.length)
)

// A filter that shrinks the set must not strand the user on a page that no
// longer exists — clamp back into range whenever the row count changes.
watch(
  () => props.rows.length,
  () => {
    if (page.value > pageCount.value) page.value = 1
  }
)
</script>
