<template>
  <q-page class="p-6">
    <PageHeader :title="destination?.name || 'Destination'">
      <template #subtitle>
        <span v-if="destination">{{
          destination.description ||
          `Delivers routed events to /${destination.slug}.`
        }}</span>
        <span v-else>Destination {{ id }}</span>
      </template>

      <!-- The noun is the <h1> beside them, so both state actions are drawn
           rather than spelled; SfereIconButton carries the phrase to the
           tooltip and to assistive tech. Each one asks before it acts. -->
      <template #actions>
        <template v-if="destination">
          <SfereIconButton
            :icon="destination.isEnabled ? 'pause' : 'play'"
            :label="
              destination.isEnabled ? 'Pause deliveries' : 'Enable deliveries'
            "
            @click="confirmToggle = true"
          />
          <SfereIconButton
            icon="trash"
            label="Delete this destination"
            variant="danger"
            @click="confirmDelete = true"
          />
        </template>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load this destination."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!destination"
      title="Destination not found"
      :description="`Nothing in this workspace has the id “${id}”. It may have been deleted.`"
    >
      <template #cta>
        <div class="flex items-center gap-2">
          <button
            class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
            @click="router.push({ name: 'destinations' })"
          >
            Back to destinations
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="router.push({ name: 'destinations-trash' })"
          >
            Check the trash
          </button>
        </div>
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-5">
      <!-- Template upgrade notice: only when the record is behind. -->
      <CardPanel v-if="hasUpgrade(destination)">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-ink">{{
              upgradeLabel(destination)
            }}</p>
            <p class="mt-1 text-xs text-muted"
              >This destination runs template version
              {{ destination.templateVersion }}. Upgrading replays the
              template's current configuration schema.</p
            >
          </div>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="upgrade"
          >
            Upgrade template
          </button>
        </div>
      </CardPanel>

      <!-- Every card here is measured, which is what took the row from four to
           three. `pipeCount`, `deliveryCountLastHour` and `version` are fields
           of `destinations.json` and of nothing else — the backend's
           `Destination` is nine keys and carries none of them — so on a real
           destination "Delivered (last hour)" reported a confident 0 and
           "Config version" printed the literal `vundefined`. The fourth,
           "Warehouse connections", counted a `warehouses` computed that the
           managed-warehouse rework had already deleted, so the whole screen
           threw at render; that story is told properly by the Managed warehouse
           panel below. Inbound pipes is now the same joined list the table
           beneath it shows, so the count and the rows can never disagree. -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Status"
          :value="destination.isEnabled ? 'Enabled' : 'Paused'"
          :hint="destinationTypeLabel"
        />
        <StatCard
          label="Inbound pipes"
          :value="pipeCountLabel"
          :hint="pipesHint"
        />
        <StatCard
          label="Created"
          :value="formatDate(destination.createdAt)"
          :hint="updatedHint"
        />
      </div>

      <TabNav v-model="tab" :tabs="tabs" />

      <!-- Connection test sits above the tabs' content rather than inside one:
           "does this destination still answer" is the question you have on
           arrival, whichever tab you then open. A FAILED test renders here as a
           red panel with the backend's own message — never as ErrorState, which
           the smoke gate reads as a broken screen. -->
      <CardPanel v-if="!isMock">
        <template #header>
          <div class="min-w-0 flex-1">
            <span class="text-sm font-semibold text-ink">Connection</span>
            <p class="mt-0.5! text-xs text-muted"
              >Checks the stored configuration against the warehouse. Reads
              nothing and writes nothing.</p
            >
          </div>
          <SfereButton
            class="shrink-0"
            size="sm"
            variant="secondary"
            :loading="testing"
            @click="onTest"
            >Test connection</SfereButton
          >
        </template>

        <p v-if="!testResult" class="text-sm text-muted"
          >Not tested in this session.</p
        >
        <NoticeBanner
          v-else-if="testResult.ok"
          tone="success"
          title="The connection works"
          :message="testMessage"
        />
        <NoticeBanner
          v-else
          tone="danger"
          title="The connection failed"
          :message="
            testResult.error ||
            'The warehouse refused the stored configuration and gave no reason.'
          "
        />
      </CardPanel>

      <DestinationTablesPanel
        v-if="tab === 'tables'"
        :tables="tables"
        :tables-loading="tablesLoading"
        :tables-error="tablesError"
        :tables-api-missing="tablesApiMissing"
        :selected-table="selectedTable"
        :rows-page="rowsPage"
        :rows-loading="rowsLoading"
        :rows-error="rowsError"
        :rows-api-missing="rowsApiMissing"
        @reload-tables="loadTables(destination.id)"
        @select-table="onSelectTable"
        @close-table="selectedTable = ''"
        @reload-rows="reloadRows"
        @page="onRowsPage"
      />

      <DestinationQueryPanel
        v-else-if="tab === 'query'"
        :result="queryResult"
        :querying="querying"
        :error="queryError"
        :api-missing="queryApiMissing"
        :tables="tables"
        @run="onRunQuery"
      />

      <div v-else class="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <!-- Inbound pipes: everything routing events into this destination. -->
        <section class="flex flex-col gap-3 xl:col-span-2">
          <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
            >Inbound pipes</h2
          >
          <DataTable
            :columns="pipeColumns"
            :rows="inboundPipes"
            :loading="pipesLoading"
            :error="pipesError"
            :api-missing="pipesApiMissing"
            row-key="id"
            clickable-rows
            empty-title="No pipes deliver here yet"
            empty-description="A pipe connects a source to this destination and decides which events reach it."
            empty-cta-label="New pipe"
            :empty-cta-to="{ name: 'pipes-new' }"
            @retry="loadPipes"
            @row-click="openPipe"
          >
            <template #cell-name="{ row }">
              <p class="font-medium text-ink">{{ row.name }}</p>
              <p class="text-xs text-subtle">{{ row.sourceName }}</p>
            </template>

            <template #cell-isEnabled="{ value }">
              <StatusBadge
                :tone="value ? 'success' : 'neutral'"
                :label="value ? 'Running' : 'Paused'"
              />
            </template>

            <template #cell-deliveryCountLastHour="{ value }">{{
              formatCount(value)
            }}</template>

            <template #cell-updatedAt="{ value }">{{
              formatDate(value)
            }}</template>
          </DataTable>
        </section>

        <!-- Configuration summary. -->
        <section class="flex flex-col gap-3">
          <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
            >Configuration</h2
          >

          <CardPanel>
            <DefinitionList :items="details" :columns="1">
              <template #value-status>
                <StatusBadge
                  :tone="destination.isEnabled ? 'success' : 'neutral'"
                  :label="destination.isEnabled ? 'Enabled' : 'Paused'"
                />
              </template>

              <template #value-template>
                <DestinationTemplateBadge
                  :record="destination"
                  class="justify-end"
                />
              </template>
            </DefinitionList>
          </CardPanel>

          <!-- The Sfere-managed warehouse, which is infrastructure we provision
               rather than a credentialled link the customer set up — those live
               on /dwh-connections and are a different noun. -->
          <CardPanel>
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-medium text-subtle">Managed warehouse</p>
              <StatusBadge
                v-if="warehouse?.state === 'ready'"
                tone="success"
                label="Provisioned"
              />
              <StatusBadge
                v-else-if="warehouse?.state === 'pending'"
                tone="neutral"
                label="Provisioning"
              />
            </div>

            <DefinitionList
              v-if="warehouse?.state === 'ready'"
              :items="warehouseDetails"
              :columns="1"
              class="mt-2"
            />

            <p
              v-else-if="warehouse?.state === 'pending'"
              class="mt-2 text-sm text-muted"
              >Sfere is still creating the ClickHouse database for this
              destination. It appears here once provisioning finishes.</p
            >

            <p v-else class="mt-2 text-sm text-muted"
              >Not known. This destination reports no managed warehouse.</p
            >
          </CardPanel>
        </section>
      </div>
    </div>

    <!-- The header icons carry no sentence of their own, so the dialog is where
         the consequence is written. Pausing deliveries is reversible, so it is
         deliberately not `destructive` — a red button on a routine confirm
         teaches people to click through red buttons. -->
    <ConfirmDialog
      v-if="destination"
      v-model="confirmToggle"
      :title="
        destination.isEnabled ? 'Pause deliveries?' : 'Enable deliveries?'
      "
      :message="toggleMessage"
      :confirm-label="destination.isEnabled ? 'Pause deliveries' : 'Enable'"
      @confirm="toggle"
    />

    <ConfirmDialog
      v-model="confirmDelete"
      title="Delete this destination?"
      :message="deleteMessage"
      confirm-label="Delete destination"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DataTable from '@/components/ui/DataTable.vue'
import TabNav from '@/components/ui/TabNav.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import DestinationTablesPanel from '@/components/destinations/DestinationTablesPanel.vue'
import DestinationQueryPanel from '@/components/destinations/DestinationQueryPanel.vue'
import { useDestinationBrowser } from '@/composables/useDestinationBrowser'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import DestinationTemplateBadge from '@/components/destinations/DestinationTemplateBadge.vue'
import { useTemplates } from '@/composables/useTemplates'
import {
  formatCount,
  formatDate,
  formatDateTime,
  useDestinations,
  useDestinationToasts
} from '@/composables/useDestinations'
import { usePipes } from '@/composables/usePipes'
import { notifyMutationResult } from '@/composables/useMutationFeedback'
import { useDataSource } from '@/composables/useDataSource'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const { hasUpgrade, upgradeLabel } = useTemplates()
const { toast } = useDestinationToasts()

const {
  destinations,
  loading,
  error,
  load: loadDestinations,
  setEnabled,
  remove: removeDestination
} = useDestinations()
// `usePipes()`, not the `useDestinationPipes()` wrapper this used to call: that
// one passed no `api`, so on a real account it reported `apiMissing` and handed
// back an empty array — an inbound-pipes table that said "No pipes deliver here
// yet" and a count that said 0, on a destination that may well have several.
// `usePipes()` reads the account's real `/pipelines`, aliases the backend's
// `destination_id` to the `eventDestinationId` this page filters on, and joins
// each pipe's two ends so `row.sourceName` under the pipe name resolves.
const {
  pipes,
  loading: pipesLoading,
  error: pipesError,
  apiMissing: pipesApiMissing,
  load: loadPipes
} = usePipes()

const confirmDelete = ref(false)
const confirmToggle = ref(false)

const id = computed(() => String(route.params.id ?? ''))

// A missing record is "empty", not "error": the fetch succeeded, this id just
// isn't in it. Only a failed fetch may reach ErrorState, which is what the
// smoke run treats as a broken screen.
const destination = computed(
  () => destinations.value.find(d => d.id === id.value) ?? null
)

// -------------------------------------------------- warehouse browser + test

// Four routes, all live as of backend PR #16: the table list, one table's rows,
// a read-only SELECT, and a connection test. They are what turn this screen from
// a record of a destination into a way of looking inside it — which is the
// question someone opening it usually has.
const { isMock } = useDataSource()

const {
  tables,
  tablesLoading,
  tablesError,
  tablesApiMissing,
  loadTables,
  rowsPage,
  rowsLoading,
  rowsError,
  rowsApiMissing,
  loadRows,
  queryResult,
  querying,
  queryError,
  queryApiMissing,
  runQuery,
  testResult,
  testing,
  testConnection
} = useDestinationBrowser()

const tab = ref('overview')
const selectedTable = ref('')

// The SQL console reads the table list as its schema tree, so both tabs need it
// and neither should fetch it twice. `listDestinationTables` returns columns as
// well as names, which is what makes one call enough.
const tabs = computed(() => [
  { key: 'overview', label: 'Overview' },
  {
    key: 'tables',
    label: 'Tables',
    count: tablesApiMissing.value ? undefined : tables.value.length
  },
  { key: 'query', label: 'SQL console' }
])

const testMessage = computed(() => {
  const r = testResult.value
  if (!r) return ''
  const latency =
    r.latencyMs == null
      ? 'The backend did not report a round-trip time.'
      : `Round trip ${formatCount(r.latencyMs)}ms.`
  return `Checked ${formatDateTime(r.checkedAt, NOT_KNOWN)}. ${latency}`
})

async function onTest() {
  const res = await testConnection(id.value)
  // Only a failed REQUEST reaches a toast. A failed TEST is reported in the
  // panel, with the warehouse's own reason.
  if (!res.ok) {
    notifyMutationResult($q, res, {
      success: '',
      apiMissing: "Can't test this connection yet."
    })
  }
}

function onSelectTable(name) {
  selectedTable.value = name
  loadRows(id.value, name, { page: 1 })
}

function reloadRows() {
  if (selectedTable.value) {
    loadRows(id.value, selectedTable.value, {
      page: rowsPage.value?.page ?? 1
    })
  }
}

function onRowsPage(page) {
  if (selectedTable.value) loadRows(id.value, selectedTable.value, { page })
}

async function onRunQuery({ sql, limit }) {
  const res = await runQuery(id.value, { sql, limit })
  // The query's own error renders on the field in the panel; a missing endpoint
  // is the only thing worth a toast here.
  if (!res?.ok && res?.apiMissing) {
    notifyMutationResult($q, res, {
      success: '',
      apiMissing: "Can't run a query yet."
    })
  }
}

// The table list backs two tabs, so it is read once the destination resolves
// rather than on entering a tab — otherwise the SQL console's schema tree is
// empty until someone has visited Tables first.
// Key this on the *resolved* destination, not the raw route id. The table list
// is a per-id read (`GET …/destinations/{id}/tables`), so firing it for an id
// that isn't in the account 404s — and `smoke.mjs` walks this route with a mock
// fixture id (`dst_snowflake`) in real mode, which is exactly such an id. The
// read awaits `waitForAccount()`, so its 404 resolves late enough to be logged
// against the *next* route in the walk (`/pipes/pipe_web_to_snowflake`), where
// it read as an unrelated failure. A real record carries an id that exists; a
// missing one is "empty" (see `destination` above), not a request to make.
watch(
  () => destination.value?.id,
  value => {
    selectedTable.value = ''
    if (value && !isMock.value) loadTables(value)
  },
  { immediate: true }
)

// The backend spells the type in snake_case (`event_destination`,
// `clickhouse`), which is a key, not something a stat card's hint should print.
// Only ClickHouse needs its capitalisation kept; anything else — including a
// type nobody here anticipated — comes out as sentence-cased words rather than
// as a raw identifier.
const DESTINATION_TYPE_LABELS = { clickhouse: 'ClickHouse' }

const destinationTypeLabel = computed(() => {
  const type = destination.value?.destinationType
  if (!type) return ''
  return (
    DESTINATION_TYPE_LABELS[type] ??
    type.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
  )
})

const inboundPipes = computed(() =>
  pipes.value.filter(p => p.eventDestinationId === id.value)
)

// An em dash while the pipes read is in flight, failed, or has no endpoint —
// `formatCount(0)` on an unread list is a measured-looking zero, which is the
// failure this row was rebuilt to stop.
const pipeCountLabel = computed(() =>
  pipesLoading.value || pipesError.value || pipesApiMissing.value
    ? NOT_KNOWN
    : formatCount(inboundPipes.value.length)
)

const pipesHint = computed(() => {
  if (pipesLoading.value || pipesError.value || pipesApiMissing.value) return ''
  const running = inboundPipes.value.filter(p => p.isEnabled).length
  return running ? `${formatCount(running)} running` : 'None running'
})

const updatedHint = computed(() =>
  destination.value?.updatedAt
    ? `Updated ${formatDate(destination.value.updatedAt)}`
    : ''
)

// The ClickHouse database the backend auto-provisions for this destination.
//
// This used to read `destination.warehouseConnections`, which is a field of the
// mock fixture and of nothing else — the real `Destination` schema has no such
// key. In the default real mode it was therefore always `[]`, and the panel
// below rendered "None. This destination delivers over the network rather than
// into a warehouse", which is the opposite of the truth for a ClickHouse
// destination. The real facts are `clickhouse_database` (camelized by
// `pageItems`) plus the `config` blob, which `camelizeKeys` leaves nested and
// unmangled, so `hosts` / `protocol` are read as the backend spells them.
//
// A null `clickhouseDatabase` means "provisioning is pending" per the schema's
// own description, which is not the same as "there is no warehouse" — hence
// three states rather than a present/absent pair.
const warehouse = computed(() => {
  const d = destination.value
  if (!d) return null

  const config = d.config ?? {}
  const hosts = Array.isArray(config.hosts) ? config.hosts : []

  if (d.clickhouseDatabase) {
    return {
      state: 'ready',
      database: d.clickhouseDatabase,
      hosts,
      protocol: config.protocol ?? null
    }
  }

  // Only a ClickHouse destination is one we provision, so only that type can be
  // mid-provisioning. Anything else (including every mock fixture record, which
  // carries `event_destination`) is a warehouse we know nothing about, and the
  // panel says so rather than guessing either way.
  return { state: d.destinationType === 'clickhouse' ? 'pending' : 'unknown' }
})

// `config.password` is always "***" in API responses and the username is not
// something a reader can act on, so neither is rendered — the database name and
// the host are what someone querying this warehouse actually needs.
const warehouseDetails = computed(() => {
  const w = warehouse.value
  if (w?.state !== 'ready') return []
  return [
    { label: 'Database', value: w.database },
    { label: 'Host', value: w.hosts.length ? w.hosts.join(', ') : 'Not known' },
    { label: 'Protocol', value: w.protocol ?? 'Not known' }
  ]
})

const pipeColumns = [
  { key: 'name', label: 'Pipe', sortable: true },
  { key: 'isEnabled', label: 'Status', sortable: true },
  {
    key: 'deliveryCountLastHour',
    label: 'Delivered (1h)',
    sortable: true,
    align: 'right'
  },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' }
]

// `Status` and `Template` are rendered as badges through DefinitionList's
// `#value-status` / `#value-template` slots; the rest fall through to `value`.
const details = computed(() => {
  const d = destination.value
  if (!d) return []
  return [
    { label: 'Status', value: d.isEnabled ? 'Enabled' : 'Paused' },
    { label: 'Template', value: d.templateId ?? 'Custom' },
    { label: 'Slug', value: `/${d.slug}` },
    { label: 'Destination ID', value: d.id },
    { label: 'Type', value: 'Event destination' },
    { label: 'Created', value: formatDateTime(d.createdAt) },
    { label: 'Last updated', value: formatDateTime(d.updatedAt) }
  ]
})

const toggleMessage = computed(() => {
  const d = destination.value
  if (!d) return ''
  return d.isEnabled
    ? `Pipes stop routing events into “${d.name}” straight away. Nothing already delivered is removed, and you can enable it again at any time.`
    : `Pipes start routing events into “${d.name}” again straight away.`
})

const deleteMessage = computed(() => {
  const d = destination.value
  if (!d) return ''
  const pipeLabel =
    d.pipeCount === 1 ? '1 pipe' : `${formatCount(d.pipeCount)} pipes`
  return `“${d.name}” moves to the trash and its ${pipeLabel} stop delivering. You can restore it for 30 days.`
})

// Both resources back one screen, so Retry has to re-run both.
function load() {
  loadDestinations()
  loadPipes()
}

async function toggle() {
  const d = destination.value
  const next = !d.isEnabled
  const res = await setEnabled(d.id, next)
  notifyMutationResult($q, res, {
    success: `“${d.name}” ${next ? 'enabled' : 'paused'}`,
    apiMissing: `Can't ${next ? 'enable' : 'pause'} “${d.name}” yet.`
  })
}

function upgrade() {
  const d = destination.value
  d.templateVersion = d.latestTemplateVersion
  toast(
    `“${d.name}” moved to template ${d.templateVersion}. Demo data, nothing was saved.`
  )
}

async function remove() {
  const name = destination.value.name
  const res = await removeDestination(id.value)
  notifyMutationResult($q, res, {
    success: `“${name}” deleted`,
    apiMissing: `Can't delete “${name}” yet.`
  })
  if (res.ok) router.push({ name: 'destinations' })
}

function openPipe(row) {
  router.push({ name: 'pipes-detail', params: { id: row.id } })
}

onMounted(load)
</script>
