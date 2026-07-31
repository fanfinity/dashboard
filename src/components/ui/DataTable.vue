<template>
  <div>
    <!-- Toolbar (search / filters / actions) sits above every state. -->
    <div v-if="$slots.toolbar" class="mb-4 flex flex-wrap items-center gap-2">
      <slot name="toolbar" />
    </div>

    <LoadingState v-if="loading" variant="table" :rows="6" />

    <ErrorState v-else-if="error" :message="error" @retry="emit('retry')" />

    <slot v-else-if="!rows.length" name="empty">
      <EmptyState :title="emptyTitle" :description="emptyDescription" />
    </slot>

    <div
      v-else
      class="overflow-hidden rounded-xl border border-line2 bg-white shadow-sm"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left">
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              :class="[
                alignClass(col),
                col.sortable ? 'cursor-pointer select-none hover:text-ink' : ''
              ]"
              :style="col.width ? { width: col.width } : undefined"
              @click="col.sortable && toggleSort(col.key)"
            >
              <span
                class="inline-flex items-center gap-1"
                :class="col.align === 'right' ? 'flex-row-reverse' : ''"
              >
                {{ col.label }}
                <span
                  v-if="col.sortable"
                  class="text-[8px] leading-none"
                  :class="
                    sortKey === col.key ? 'text-brand' : 'text-transparent'
                  "
                  >{{
                    sortKey === col.key && sortDir === 'desc' ? '▼' : '▲'
                  }}</span
                >
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in pagedRows"
            :key="row[rowKey] ?? i"
            class="border-b border-line last:border-0 hover:bg-sidebar"
            :class="clickableRows ? 'cursor-pointer' : ''"
            @click="clickableRows && emit('row-click', row)"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-5 py-3.5 text-muted"
              :class="alignClass(col)"
            >
              <slot
                :name="`cell-${col.key}`"
                :row="row"
                :value="row[col.key]"
                >{{ row[col.key] }}</slot
              >
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination footer -->
      <div
        class="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted"
      >
        <span
          >Showing {{ rangeStart }}–{{ rangeEnd }} of
          {{ rows.length.toLocaleString() }}</span
        >
        <div class="flex items-center gap-1">
          <button
            class="rounded-md border border-line2 bg-white px-2.5 py-1 hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page <= 1"
            @click="page--"
            >Prev</button
          >
          <span class="px-1">Page {{ page }} of {{ pageCount }}</span>
          <button
            class="rounded-md border border-line2 bg-white px-2.5 py-1 hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page >= pageCount"
            @click="page++"
            >Next</button
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

// Hand-rolled table — never q-table. Every class string here is lifted verbatim
// from ContactsPage: the card shell, the <th> treatment and its sort caret, the
// row hover/border rules, and the pagination footer. Loading / error / empty are
// delegated to the three state primitives rather than re-implemented, so the
// smoke test's single `[data-smoke="error"]` hook covers every list screen.
//
// Sorting and paging are internal: pass the full `rows` array and let the
// component slice it. Cells render `row[col.key]` by default; override any one
// of them with a `cell-<key>` scoped slot receiving `{ row, value }`.
const props = defineProps({
  // [{ key, label, sortable?, align?: 'left'|'center'|'right', width?: string }]
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  rowKey: { type: String, default: 'id' },
  emptyTitle: { type: String, default: 'Nothing here yet' },
  emptyDescription: { type: String, default: '' },
  perPage: { type: Number, default: 25 },
  clickableRows: { type: Boolean, default: false }
})
const emit = defineEmits(['row-click', 'retry'])

const ALIGN = {
  right: 'text-right',
  center: 'text-center'
}
function alignClass(col) {
  return ALIGN[col.align] ?? ''
}

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

function sortValue(row, key) {
  const v = row[key]
  return typeof v === 'string' ? v.toLowerCase() : v
}

const sortedRows = computed(() => {
  if (!sortKey.value) return props.rows
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const av = sortValue(a, sortKey.value)
    const bv = sortValue(b, sortKey.value)
    if (av == null && bv == null) return 0
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

// A filtered-down result set must not strand the user on a page that no longer
// exists — clamp back into range whenever the row count changes.
watch(
  () => props.rows.length,
  () => {
    if (page.value > pageCount.value) page.value = 1
  }
)
</script>
