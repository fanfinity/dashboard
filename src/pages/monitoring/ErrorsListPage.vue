<template>
  <q-page class="p-6">
    <PageHeader title="Errors" :subtitle="subtitle">
      <template #actions>
        <router-link
          :to="{ name: 'health' }"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          >Pipeline health</router-link
        >
        <button
          :disabled="loading"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="refresh"
        >
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <!-- 1. Loading -->
    <div v-if="showSkeleton" class="flex flex-col gap-4">
      <LoadingState variant="grid" :rows="4" />
      <LoadingState variant="table" :rows="6" />
    </div>

    <!-- 2. Error — the *fetch* failed. Logged failures are not this state: a
         screen listing eight broken deliveries is a screen doing its job, and
         ErrorState's data-smoke="error" would report it as broken. -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load the error log."
      :message="error"
      @retry="refresh"
    />

    <!-- 3. Empty — nothing has failed. The good outcome, so no call to action. -->
    <EmptyState
      v-else-if="isEmpty"
      title="Nothing is failing"
      description="No delivery or transform failures have been logged. Errors appear here the moment a source, pipe or destination rejects something."
    />

    <!-- 4. Populated -->
    <div v-else class="flex flex-col gap-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          v-for="stat in statCards"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :hint="stat.hint"
        />
      </div>

      <CardPanel>
        <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
              >Failures by entity kind</h2
            >
            <p class="mt-0.5 text-xs text-muted"
              >Hourly, for the last 24 hours. Stacked, so a column's height is
              that hour's total.</p
            >
          </div>
        </div>

        <!-- The trend is a secondary resource: it degrades inside its own panel
             with its own retry, and the log below keeps working. -->
        <ErrorState
          v-if="statsError"
          title="Couldn't load the error trend."
          :message="statsError"
          @retry="loadStats"
        />
        <LoadingState v-else-if="statsLoading" variant="table" :rows="4" />
        <ErrorTrendChart
          v-else
          :categories="trend.categories"
          :series="trend.series"
          :colors="trend.colors"
        />
      </CardPanel>

      <TabNav v-model="view" :tabs="viewTabs" />

      <!-- Grouped view: which thing is broken, rather than what went wrong. -->
      <DataTable
        v-if="view === 'entity'"
        :columns="entityColumns"
        :rows="entityRows"
        row-key="id"
        clickable-rows
        empty-title="Nothing is failing"
        empty-description="No entity has logged a failure."
        @row-click="focusEntity"
      >
        <template #cell-entityName="{ row }">
          <p class="font-medium text-ink">{{ row.entityName }}</p>
          <p class="text-xs text-subtle"
            >{{ row.entityTypeLabel }} · {{ row.id }}</p
          >
        </template>

        <template #cell-categoryLabel="{ value }">
          <StatusBadge tone="neutral" :label="value" />
        </template>

        <template #cell-errors="{ row }">
          <div class="flex flex-wrap items-center justify-end gap-1.5">
            <StatusBadge
              v-if="row.errors"
              tone="danger"
              :label="`${row.errors} error${row.errors === 1 ? '' : 's'}`"
            />
            <StatusBadge
              v-if="row.warnings"
              tone="warn"
              :label="`${row.warnings} warning${row.warnings === 1 ? '' : 's'}`"
            />
          </div>
        </template>

        <template #cell-occurrences="{ row }">
          <span class="tabular-nums text-ink">{{ row.occurrencesLabel }}</span>
        </template>

        <template #cell-lastSeen="{ row }">
          <span class="whitespace-nowrap">{{ row.lastSeenLabel }}</span>
          <p class="font-mono text-xs text-subtle">{{ row.lastCode }}</p>
        </template>
      </DataTable>

      <!-- Flat view: one row per logged failure, expandable to its message. -->
      <DataTable
        v-else
        :columns="columns"
        :rows="filteredRows"
        row-key="id"
        clickable-rows
        @row-click="toggleRow"
      >
        <template #toolbar>
          <ToolbarSearch
            v-model="query"
            placeholder="Search message, code or entity..."
          />
          <q-select
            v-model="severity"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="severityOptions"
            class="w-[180px] bg-white"
          />
          <q-select
            v-model="category"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="categoryOptions"
            class="w-[220px] bg-white"
          />
          <button
            v-if="entityFilterLabel"
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-fill px-3 text-sm text-ink hover:bg-white"
            @click="entityId = ''"
          >
            {{ entityFilterLabel }}
            <span class="text-subtle" aria-hidden="true">×</span>
            <span class="sr-only">Remove entity filter</span>
          </button>
          <button
            v-if="hasFilters"
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </template>

        <template #cell-occurredAt="{ row }">
          <span class="whitespace-nowrap text-ink">{{
            row.occurredAtLabel
          }}</span>
        </template>

        <template #cell-severity="{ row }">
          <div class="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              :tone="row.severityVariant"
              :label="row.severityLabel"
            />
            <StatusBadge
              v-if="isAcknowledged(row.id)"
              tone="neutral"
              label="Acknowledged"
            />
          </div>
        </template>

        <template #cell-entityName="{ row }">
          <p class="font-medium text-ink">{{ row.entityName }}</p>
          <p class="text-xs text-subtle">{{ row.categoryLabel }}</p>
        </template>

        <!-- `flex-nowrap!` is load-bearing, important suffix and all: Quasar ships
             its own `.flex` rule carrying `flex-wrap: wrap`, at the same
             specificity as Tailwind's `.flex` and later in the cascade. Without
             the suffix the caret wraps onto its own line above the code. -->
        <template #cell-code="{ row }">
          <div class="flex flex-nowrap! items-start gap-2">
            <svg
              viewBox="0 0 16 16"
              class="mt-1 size-3 shrink-0 text-subtle"
              :class="expandedId === row.id ? 'rotate-90' : ''"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <div class="min-w-0">
              <p class="font-mono text-xs text-ink">{{ row.code }}</p>
              <p
                class="mt-0.5 text-sm text-muted"
                :class="expandedId === row.id ? '' : 'line-clamp-1'"
                >{{ row.message }}</p
              >
            </div>
          </div>

          <ErrorRowDetail v-if="expandedId === row.id" :row="row" />
        </template>

        <template #cell-count="{ row }">
          <span class="tabular-nums text-ink">{{ row.countLabel }}</span>
        </template>

        <template #cell-actions="{ row }">
          <div class="flex flex-nowrap! items-center justify-end gap-2">
            <button
              v-if="row.canRetry"
              class="shrink-0 rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click.stop="retry(row)"
            >
              Retry
            </button>
            <button
              class="shrink-0 rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill disabled:opacity-50"
              :disabled="isAcknowledged(row.id)"
              @click.stop="acknowledgeRow(row)"
            >
              {{ isAcknowledged(row.id) ? 'Acknowledged' : 'Acknowledge' }}
            </button>
          </div>
        </template>

        <!-- Two empty states: a filter that matched nothing is a different
             situation from a log with nothing in it. -->
        <template #empty>
          <EmptyState
            v-if="hasFilters"
            title="No errors match your filters"
            description="Nothing in the log matches that search, severity or entity kind."
          >
            <template #cta>
              <button
                class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
                @click="clearFilters"
              >
                Clear filters
              </button>
            </template>
          </EmptyState>

          <EmptyState
            v-else
            title="Nothing is failing"
            description="No delivery or transform failures have been logged in this window."
          />
        </template>
      </DataTable>

      <p v-if="hasMore && view === 'all'" class="text-xs text-subtle"
        >Older failures are trimmed from this view. The full log is retained
        upstream for 30 days.</p
      >
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ErrorRowDetail from '@/components/monitoring/ErrorRowDetail.vue'
import ErrorTrendChart from '@/components/monitoring/ErrorTrendChart.vue'
import {
  useMonitoringErrors,
  useMonitoringToasts
} from '@/composables/useMonitoringErrors'

const {
  loading,
  error,
  load,
  statsLoading,
  statsError,
  loadStats,
  rows,
  filteredRows,
  entityRows,
  statCards,
  trend,
  hasMore,
  updatedAt,
  isEmpty,
  query,
  severity,
  category,
  entityId,
  entityFilterLabel,
  severityTabs,
  categoryOptions,
  hasFilters,
  clearFilters,
  acknowledge,
  isAcknowledged
} = useMonitoringErrors()

const { toast } = useMonitoringToasts()

// First paint only. A manual refresh keeps the populated screen up rather than
// collapsing it back to grey bars.
const loaded = ref(false)
const showSkeleton = computed(() => loading.value && !loaded.value)

const view = ref('all')
const expandedId = ref('')

const viewTabs = computed(() => [
  { key: 'all', label: 'All errors', count: rows.value.length },
  { key: 'entity', label: 'By entity', count: entityRows.value.length }
])

const severityOptions = computed(() =>
  severityTabs.value.map(t => ({
    label: t.key === 'all' ? 'All severities' : `${t.label} (${t.count})`,
    value: t.key
  }))
)

const UPDATED = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC'
})

const subtitle = computed(() => {
  const d = new Date(updatedAt.value)
  if (Number.isNaN(d.getTime())) {
    return 'Delivery and transform failures across the pipeline.'
  }
  return `Delivery and transform failures · last 24 hours · updated ${UPDATED.format(d)} UTC`
})

async function refresh() {
  await load()
  loaded.value = true
}

function toggleRow(row) {
  expandedId.value = expandedId.value === row.id ? '' : row.id
}

/** Jump from the grouped view into the flat log, filtered to one entity. */
function focusEntity(row) {
  entityId.value = row.id
  view.value = 'all'
  expandedId.value = ''
}

function acknowledgeRow(row) {
  acknowledge(row.id)
  toast(`Acknowledged ${row.code} on ${row.entityName}`)
}

function retry(row) {
  toast(`Retry queued for ${row.entityName}`)
}

// Widths are tuned so the Issue column — the one that grows when a row is
// expanded — keeps the largest share of the table.
const columns = [
  { key: 'occurredAt', label: 'Occurred', sortable: true, width: '170px' },
  { key: 'severity', label: 'Severity', width: '130px' },
  { key: 'entityName', label: 'Entity', sortable: true, width: '190px' },
  { key: 'code', label: 'Issue' },
  {
    key: 'count',
    label: 'Occurrences',
    sortable: true,
    align: 'right',
    width: '110px'
  },
  { key: 'actions', label: '', align: 'right', width: '245px' }
]

const entityColumns = [
  { key: 'entityName', label: 'Entity', sortable: true },
  { key: 'categoryLabel', label: 'Kind', width: '180px' },
  { key: 'errors', label: 'Severity', align: 'right', width: '240px' },
  {
    key: 'occurrences',
    label: 'Occurrences',
    sortable: true,
    align: 'right',
    width: '140px'
  },
  { key: 'lastSeen', label: 'Last seen', sortable: true, width: '200px' }
]

onMounted(refresh)
</script>
