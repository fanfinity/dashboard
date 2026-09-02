<template>
  <div class="flex flex-col gap-4">
    <CardPanel>
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink">Tables</span>
          <p class="mt-0.5! text-xs text-muted"
            >What this destination actually holds. Read straight from the
            warehouse, not from anything Sfere records about it.</p
          >
        </div>
        <StatusBadge
          v-if="!tablesApiMissing"
          class="shrink-0"
          tone="neutral"
          :label="`${tables.length} table${tables.length === 1 ? '' : 's'}`"
        />
      </template>

      <LoadingState v-if="tablesLoading" variant="table" :rows="5" />

      <ErrorState
        v-else-if="tablesError"
        title="Couldn't list this destination's tables."
        :message="tablesError"
        @retry="emit('reload-tables')"
      />

      <NoticeBanner
        v-else-if="tablesApiMissing"
        tone="info"
        title="No API yet"
        message="Browsing a destination's tables is live as of backend PR #16, and Demo data mode has no fixture for it. Switch Settings → Data source to Real API to read them."
      />

      <EmptyState
        v-else-if="!tables.length"
        title="No tables yet"
        description="The warehouse is provisioned and empty. Tables appear the first time a pipe delivers into it."
      />

      <DataTable
        v-else
        :columns="tableColumns"
        :rows="tables"
        row-key="name"
        @row-click="row => emit('select-table', row.name)"
      >
        <template #cell-name="{ row }">
          <code class="font-sfere-mono text-sm text-ink">{{ row.name }}</code>
        </template>
        <template #cell-engine="{ value }">
          <span class="text-muted">{{ value || NOT_KNOWN }}</span>
        </template>
        <!-- NOT `formatCount(0)`. A row count the warehouse did not report is
             unknown; printing a confident 0 asserts a count nobody took. -->
        <template #cell-rows="{ value }">
          <span class="text-muted">{{
            value == null ? NOT_KNOWN : formatCount(value)
          }}</span>
        </template>
        <template #cell-columns="{ row }">
          <span class="text-muted">{{
            row.columns.length
              ? `${row.columns.length} column${row.columns.length === 1 ? '' : 's'}`
              : NOT_KNOWN
          }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex items-center justify-end">
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill"
              @click.stop="emit('select-table', row.name)"
            >
              Browse rows
            </button>
          </div>
        </template>
      </DataTable>
    </CardPanel>

    <!-- The row browser. Opens below the table list rather than in a dialog: a
         warehouse row is wide, and a 560px-capped q-dialog is the wrong shape
         for something whose content is a horizontally-scrolling grid. -->
    <CardPanel v-if="selectedTable">
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink"
            >Rows in
            <code class="font-sfere-mono">{{ selectedTable }}</code></span
          >
          <p class="mt-0.5! text-xs text-muted">{{ rowsSummary }}</p>
        </div>
        <SfereButton
          class="shrink-0"
          variant="ghost"
          size="sm"
          @click="emit('close-table')"
          >Close</SfereButton
        >
      </template>

      <LoadingState v-if="rowsLoading" variant="table" :rows="6" />

      <ErrorState
        v-else-if="rowsError"
        title="Couldn't read this table."
        :message="rowsError"
        @retry="emit('reload-rows')"
      />

      <NoticeBanner
        v-else-if="rowsApiMissing"
        tone="info"
        title="No API yet"
        message="Reading a table's rows needs the live endpoint."
      />

      <EmptyState
        v-else-if="!rowsPage?.rows.length"
        title="This table is empty"
        description="It exists and holds no rows yet."
      />

      <!-- overflow-x-auto on its own container, so a wide result scrolls inside
           the card rather than making the page scroll sideways. -->
      <div v-else class="flex flex-col gap-3">
        <div class="overflow-x-auto">
          <table class="w-full min-w-max border-collapse text-left">
            <thead>
              <tr class="border-b border-sfere-line">
                <th
                  v-for="column in rowsPage.columns"
                  :key="column.name"
                  class="px-3 py-2 text-xs font-semibold text-subtle"
                >
                  <span class="block font-sfere-mono text-ink">{{
                    column.name
                  }}</span>
                  <span class="block font-normal">{{ column.type }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in rowsPage.rows"
                :key="index"
                class="border-b border-sfere-line/60"
              >
                <td
                  v-for="column in rowsPage.columns"
                  :key="column.name"
                  class="max-w-[320px] truncate px-3 py-2 font-sfere-mono text-xs text-ink"
                  :title="cellText(row[column.name])"
                >
                  {{ cellText(row[column.name]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-subtle">{{ pageLabel }}</p>
          <div class="flex shrink-0 items-center gap-2">
            <SfereButton
              variant="secondary"
              size="sm"
              :disabled="rowsPage.page <= 1"
              @click="emit('page', rowsPage.page - 1)"
              >Previous</SfereButton
            >
            <SfereButton
              variant="secondary"
              size="sm"
              :disabled="rowsPage.page >= rowsPage.pages"
              @click="emit('page', rowsPage.page + 1)"
              >Next</SfereButton
            >
          </div>
        </div>
      </div>
    </CardPanel>
  </div>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { cellText } from '@/composables/useDestinationBrowser'
import { formatCount } from '@/composables/useSources'

// `GET …/destinations/{id}/tables` and
// `GET …/destinations/{id}/tables/{table}/rows`, both live as of backend PR #16.
//
// The rows grid is a hand-rolled `<table>` rather than `DataTable`, and that is
// deliberate: DataTable takes a fixed column list declared in code, and these
// columns are whatever the warehouse happens to hold. Nothing about a
// user-defined schema is sortable, filterable or clickable in the way DataTable
// exists to make it. The table LIST above is a real DataTable, because its four
// columns are known.
const props = defineProps({
  tables: { type: Array, default: () => [] },
  tablesLoading: { type: Boolean, default: false },
  tablesError: { type: String, default: null },
  tablesApiMissing: { type: Boolean, default: false },

  selectedTable: { type: String, default: '' },
  rowsPage: { type: Object, default: null },
  rowsLoading: { type: Boolean, default: false },
  rowsError: { type: String, default: null },
  rowsApiMissing: { type: Boolean, default: false }
})

const emit = defineEmits([
  'reload-tables',
  'select-table',
  'close-table',
  'reload-rows',
  'page'
])

const tableColumns = [
  { key: 'name', label: 'Table', sortable: true },
  { key: 'engine', label: 'Engine' },
  { key: 'rows', label: 'Rows', align: 'right', sortable: true },
  { key: 'columns', label: 'Schema' },
  { key: 'actions', label: '', align: 'right', width: '140px' }
]

const rowsSummary = computed(() => {
  const p = props.rowsPage
  if (!p) return 'Reading…'
  return `${formatCount(p.total)} row${p.total === 1 ? '' : 's'} · ${p.columns.length} column${p.columns.length === 1 ? '' : 's'}`
})

const pageLabel = computed(() => {
  const p = props.rowsPage
  if (!p || !p.pages) return ''
  return `Page ${p.page} of ${p.pages}`
})
</script>
