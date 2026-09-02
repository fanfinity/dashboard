<template>
  <q-page class="p-6">
    <PageHeader
      title="Warehouse connections"
      subtitle="The credentialled links to your own data warehouses."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search connections..." />
        <SfereIconButton
          icon="trash"
          label="Trash"
          :to="{ name: 'dwh-connections-trash' }"
        />
        <SfereIconButton
          icon="plus"
          label="New connection"
          variant="primary"
          :to="{ name: 'dwh-connections-new' }"
        />
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && connections.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard
        label="Connections"
        :value="formatCount(connections.length)"
        :hint="primaryHint"
      />
      <StatCard
        label="Healthy"
        :value="`${connectedCount} of ${connections.length}`"
        :hint="
          failingCount
            ? 'A failing warehouse blocks everything reading from it.'
            : 'Every warehouse answered its last check.'
        "
      />
      <StatCard
        label="Tables catalogued"
        :value="formatCount(tableTotal)"
        hint="Across every connected warehouse."
      />
      <StatCard
        label="Reading from these"
        :value="usageError ? NOT_KNOWN : formatCount(usageTotal)"
        hint="Warehouse syncs, models and profile syncs."
      />
    </div>

    <!-- A failing warehouse is information about a working screen, so it is a
         notice; only a failed load escalates to an ErrorState. -->
    <NoticeBanner
      v-if="!loading && !error && failingCount"
      tone="warn"
      class="mb-4"
      title="Some warehouses are not accepting queries"
      :message="failingMessage"
    />

    <!-- Usage counts are secondary: the list works without them, so a failure
         degrades in place with its own retry. -->
    <NoticeBanner
      v-else-if="usageError"
      tone="info"
      class="mb-4"
      title="Couldn't count what reads from these connections"
      :message="usageError"
    >
      <button
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="loadUsage"
      >
        Retry count
      </button>
    </NoticeBanner>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      :api-missing="apiMissing"
      row-key="id"
      clickable-rows
      @retry="load"
      @row-click="inspect"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-2">
          <p class="font-medium text-ink">{{ row.name }}</p>
          <StatusBadge v-if="row.isPrimary" tone="brand" label="Primary" />
        </div>
        <code class="font-mono text-xs text-subtle"
          >{{ row.host }}:{{ row.port }}</code
        >
      </template>

      <template #cell-type="{ row }">
        <StatusBadge tone="neutral" :label="connectionTypeLabel(row.type)" />
        <p class="mt-1 font-mono text-xs text-subtle">{{ schemaPath(row) }}</p>
      </template>

      <template #cell-status="{ row }">
        <div class="flex items-center gap-2">
          <StatusBadge
            :tone="statusMeta(row.status).variant"
            :label="statusMeta(row.status).label"
          />
          <span class="text-xs text-subtle">{{
            formatDate(row.lastValidatedAt, NEVER)
          }}</span>
        </div>
        <p v-if="row.status === 'error'" class="mt-1 text-xs text-rose-600">{{
          formatConnectionError(row.lastError)
        }}</p>
      </template>

      <template #cell-tableCount="{ value }">
        {{ formatCount(value) }}
      </template>

      <template #cell-usage="{ row }">
        <p class="text-muted">{{ usageLabel(row) }}</p>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            :disabled="testingId === row.id"
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill disabled:opacity-50"
            @click.stop="test(row)"
          >
            {{ testingId === row.id ? 'Testing…' : 'Test' }}
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="ask(row)"
          >
            Delete
          </button>
        </div>
      </template>

      <!-- Two different "no rows" cases: nothing connected yet (offer the
           primary CTA) and nothing matching the filters (offer a way back). -->
      <template #empty>
        <EmptyState
          v-if="connections.length"
          title="No connections match your filters"
          description="Try a different search term, or switch back to the All tab."
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
          title="No warehouse connections yet"
          description="Connect Snowflake, BigQuery, Databricks or PostgreSQL to model your own tables alongside the fan graph and to sync resolved profiles back out."
        >
          <template #cta>
            <button
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'dwh-connections-new' })"
            >
              Connect your first warehouse
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <DwhConnectionDetailDialog
      v-model="showDetail"
      :connection="detailTarget"
      :usage-parts="detailUsageParts"
      @make-primary="promote"
    />

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move connection to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { NEVER, NOT_KNOWN } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DwhConnectionDetailDialog from '@/components/warehouse/connections/DwhConnectionDetailDialog.vue'
import {
  connectionTypeLabel,
  formatConnectionError,
  formatCount,
  formatDate,
  simulateConnectionTest,
  statusMeta,
  useDwhConnections,
  useDwhConnectionToasts,
  useDwhConnectionUsage
} from '@/composables/useDwhConnections'

const router = useRouter()
const { toast } = useDwhConnectionToasts()
const {
  connections,
  loading,
  error,
  apiMissing,
  load,
  setPrimary,
  applyTestResult,
  remove: removeConnection
} = useDwhConnections()
const {
  error: usageError,
  load: loadUsage,
  usageParts,
  totalDependants: usageTotal
} = useDwhConnectionUsage()

const query = ref('')
const tab = ref('all')
const showDetail = ref(false)
const detailTarget = ref(null)
const confirmDelete = ref(false)
const target = ref(null)
const testingId = ref('')

const columns = [
  { key: 'name', label: 'Connection', sortable: true },
  { key: 'type', label: 'Engine', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'tableCount', label: 'Tables', sortable: true, align: 'right' },
  { key: 'usage', label: 'In use by' },
  { key: 'actions', label: '', align: 'right', width: '180px' }
]

// Each tab is a predicate over a connection; 'all' has none.
const TAB_PREDICATES = {
  connected: c => c.status === 'connected',
  failing: c => c.status !== 'connected'
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: connections.value.length },
  {
    key: 'connected',
    label: 'Connected',
    count: connections.value.filter(TAB_PREDICATES.connected).length
  },
  {
    key: 'failing',
    label: 'Failing',
    count: connections.value.filter(TAB_PREDICATES.failing).length
  }
])

const SEARCH_FIELDS = ['name', 'id', 'type', 'host', 'database', 'username']

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return connections.value.filter(c => {
    if (predicate && !predicate(c)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(c[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const connectedCount = computed(
  () => connections.value.filter(TAB_PREDICATES.connected).length
)

const failingCount = computed(
  () => connections.value.filter(TAB_PREDICATES.failing).length
)

const failingMessage = computed(() => {
  const n = failingCount.value
  const subject = n === 1 ? 'connection is' : 'connections are'
  const object = n === 1 ? 'it' : 'them'
  return `${n} ${subject} failing. Anything reading from ${object} keeps its configuration but will not run until the credentials or the network path are fixed.`
})

const tableTotal = computed(() =>
  connections.value.reduce((sum, c) => sum + (Number(c.tableCount) || 0), 0)
)

const primaryHint = computed(() => {
  const primary = connections.value.find(c => c.isPrimary)
  return primary
    ? `${primary.name} is the modelling default.`
    : 'No primary connection set.'
})

function schemaPath(row) {
  return [row.database, row.schema].filter(Boolean).join('.')
}

// The usage counts come from three other packets' collections, so a failed
// count reads as "not known" rather than as "nothing".
function usageLabel(row) {
  if (usageError.value) return NOT_KNOWN
  const parts = usageParts(row.id)
  return parts.length ? parts.join(' · ') : 'Not in use'
}

const detailUsageParts = computed(() =>
  detailTarget.value && !usageError.value
    ? usageParts(detailTarget.value.id)
    : []
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

// There is no detail route for a connection — the manifest ships list, create
// and trash — so a row opens a read-only dialog instead of navigating.
function inspect(row) {
  detailTarget.value = row
  showDetail.value = true
}

function promote(row) {
  if (!row) return
  setPrimary(row.id)
  showDetail.value = false
  toast(`“${row.name}” is now the primary connection`)
}

// No socket is opened. The result is derived from the record and announced as a
// simulation; the short wait exists so the button's disabled state is visible,
// not to suggest work is being done.
function test(row) {
  testingId.value = row.id
  const result = simulateConnectionTest(row)
  window.setTimeout(() => {
    testingId.value = ''
    applyTestResult(row.id, result.ok)
    toast(
      `${row.name}: ${result.title.toLowerCase()}`,
      'Simulated locally. No connection was opened.'
    )
  }, 400)
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

const deleteMessage = computed(() => {
  const row = target.value
  if (!row) return ''
  const parts = usageError.value ? [] : usageParts(row.id)
  const dependants = parts.length
    ? ` ${parts.join(', ')} read from it and stop running until they are pointed at another warehouse.`
    : ' Nothing reads from it today.'
  return `“${row.name}” moves to the trash, where it can be restored for 30 days.${dependants}`
})

function remove() {
  const row = target.value
  if (!row) return
  removeConnection(row.id)
  toast(`“${row.name}” moved to trash`)
  target.value = null
}

onMounted(() => {
  load()
  loadUsage()
})
</script>
