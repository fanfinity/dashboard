<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the band, the stats, the tabs and every
         panel the tabs swap in — or the right edge visibly steps in and out as
         the tab changes. Literal rather than a token: Tailwind v4 extracts class
         names from source text. See DestinationsListPage.vue. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader :title="destination?.name || 'Destination'">
        <template #subtitle>
          <span v-if="destination">{{ subtitle }}</span>
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
        :description="`Nothing in this workspace has the id “${id}”. Deleting a destination is permanent, so a deleted one does not come back.`"
      >
        <template #cta>
          <SfereButton size="sm" :to="{ name: 'destinations' }"
            >Back to destinations</SfereButton
          >
        </template>
      </EmptyState>

      <!-- `grid gap-5`, never `flex flex-col gap-5`: Quasar's unlayered
           `.flex { flex-wrap: wrap }` beats the layered `flex-nowrap`, and a
           wrapping column stretches its block children into a second column
           instead of stacking them. CLAUDE.md collision #4. -->
      <div v-else class="grid gap-5">
        <!-- The record's own hero. Not dismissible — IntroBand renders no close
             control without a `storageKey` — because this is a sentence about
             THIS destination rather than a lesson about the noun, and the two
             branches say different things. -->
        <IntroBand
          tone="brand"
          eyebrow="Destination"
          :title="heroTitle"
          :body="heroBody"
        >
          <template #aside>
            <DestinationMarkCard
              :subtype="destination.destinationType"
              :title="typeLabel(destination.destinationType) || 'Destination'"
              :subtitle="heroAsideSubtitle"
              :badge="heroAsideBadge"
              :badge-tone="managed ? 'brand' : 'neutral'"
            />
          </template>
        </IntroBand>

        <!-- Four cards, and every one of them reads a field the backend
             actually sends. `pipeCount`, `deliveryCountLastHour` and `version`
             are fields of `destinations.json` and of nothing else — the
             backend's `Destination` is nine keys and carries none of them — so
             "Delivered (last hour)" reported a confident 0 and "Config version"
             printed the literal `vundefined`. Inbound pipes is the count of the
             same joined list the table below shows, so the number and the rows
             can never disagree.

             The fourth card is "Provisioning", not the prototype's
             "Availability / Included". "Included" is a billing claim and
             nothing on the record measures billing; `clickhouse_database`
             ("auto-provisioned ClickHouse database name") measures exactly who
             built this warehouse, which is the honest half of the same
             sentence. The cost promise stays in the band's editorial copy on
             the list screen, where it is a statement about the product rather
             than a reading of a row. -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Status"
            :value="destination.isEnabled ? 'Enabled' : 'Paused'"
            :hint="
              destination.isEnabled
                ? 'Ready to receive routed events'
                : 'Pipes are not delivering here'
            "
            :tone="destination.isEnabled ? 'neutral' : 'warn'"
          />

          <StatCard
            label="Inbound pipes"
            :value="pipeCountLabel"
            :hint="pipesHint"
          />

          <StatCard label="Type" :hint="`/${destination.slug}`">
            <!-- A word, not a figure: StatCard sets 3xl on the value and a
                 label like "Google Ads Offline Conversions" is a paragraph at
                 that size. The span carries its own size, so the two utilities
                 sit on different elements and there is no cascade race. -->
            <span class="text-xl">{{
              typeLabel(destination.destinationType) || NOT_KNOWN
            }}</span>
          </StatCard>

          <StatCard label="Provisioning" :hint="provisioningHint">
            <span class="text-xl">{{ provisioningLabel }}</span>
          </StatCard>
        </div>

        <TabNav v-model="tab" :tabs="tabs" />

        <!-- ---------------------------------------------------------- overview -->
        <div v-if="tab === 'overview'" class="grid gap-5">
          <!-- One column in Demo mode, where there is no connection to test and
               a half-width About card would sit beside a gap. -->
          <div :class="['grid gap-5', !isMock && 'xl:grid-cols-2']">
            <!-- "Does this destination still answer?" is the question you
                 arrive with, so it leads the overview. A FAILED test renders
                 here as a red NoticeBanner carrying the backend's own message —
                 never as ErrorState, which the smoke gate reads as a broken
                 screen. Hidden in Demo mode, where there is nothing to test. -->
            <CardPanel v-if="!isMock">
              <template #header>
                <div class="min-w-0 flex-1">
                  <span class="text-sfere-sm font-semibold text-sfere-fg"
                    >Connection</span
                  >
                  <p class="text-sfere-xs text-sfere-fg-muted"
                    >Checks the stored configuration against the warehouse.
                    Reads nothing and writes nothing.</p
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

              <p v-if="!testResult" class="text-sfere-sm text-sfere-fg-muted"
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

            <CardPanel>
              <template #header>
                <span class="text-sfere-sm font-semibold text-sfere-fg"
                  >About this destination</span
                >
              </template>
              <DefinitionList :items="about" :columns="1" />
            </CardPanel>
          </div>

          <section class="grid gap-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
                >Inbound pipes</h2
              >
              <SfereButton
                v-if="inboundPipes.length > PREVIEW_ROWS"
                size="sm"
                variant="secondary"
                @click="tab = 'pipes'"
                >See all {{ inboundPipes.length }}</SfereButton
              >
            </div>

            <DestinationPipesTable
              :rows="pipesPreview"
              :loading="pipesLoading"
              :error="pipesError"
              :api-missing="pipesApiMissing"
              @retry="loadPipes"
              @row-click="openPipe"
            />
          </section>
        </div>

        <!-- ------------------------------------------------------------- pipes -->
        <section v-else-if="tab === 'pipes'" class="grid gap-3">
          <p class="text-sfere-sm text-sfere-fg-muted"
            >Every pipe delivering into this destination. Open one to inspect
            its route, its functions and its errors.</p
          >
          <DestinationPipesTable
            :rows="inboundPipes"
            :loading="pipesLoading"
            :error="pipesError"
            :api-missing="pipesApiMissing"
            @retry="loadPipes"
            @row-click="openPipe"
          />
        </section>

        <!-- ----------------------------------------------------- configuration -->
        <div v-else-if="tab === 'configuration'" class="grid gap-5">
          <CardPanel>
            <template #header>
              <div class="min-w-0 flex-1">
                <span class="text-sfere-sm font-semibold text-sfere-fg"
                  >Configuration</span
                >
                <p class="text-sfere-xs text-sfere-fg-muted">{{
                  configurationIntro
                }}</p>
              </div>
            </template>
            <DefinitionList :items="configurationItems" :columns="2" />
          </CardPanel>

          <!-- Two different truths, so two different sentences. Neither
               promises an edit this screen cannot make: `DestinationUpdate`
               does accept `name` and `config`, but no form here sends one, and
               a control that opens an apology is worse than an absence. -->
          <NoticeBanner
            v-if="managed"
            tone="info"
            title="Sfere manages this warehouse"
            message="Credentials and infrastructure settings belong to the warehouse Sfere provisions for you, so there is nothing here to configure or maintain."
          />
          <NoticeBanner
            v-else
            tone="info"
            title="Read-only for now"
            message="This is the configuration stored on the destination, with every credential field masked by the API. Editing a destination's name or connection details is not available on this screen yet."
          />
        </div>

        <!-- ------------------------------------------------------------ tables -->
        <DestinationTablesPanel
          v-else-if="tab === 'tables'"
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

        <!-- ------------------------------------------------------- SQL console -->
        <DestinationQueryPanel
          v-else-if="tab === 'query'"
          :result="queryResult"
          :querying="querying"
          :error="queryError"
          :api-missing="queryApiMissing"
          :tables="tables"
          @run="onRunQuery"
        />
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
import IntroBand from '@/components/ui/IntroBand.vue'
import TabNav from '@/components/ui/TabNav.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import DestinationTablesPanel from '@/components/destinations/DestinationTablesPanel.vue'
import DestinationQueryPanel from '@/components/destinations/DestinationQueryPanel.vue'
import DestinationPipesTable from '@/components/destinations/DestinationPipesTable.vue'
import DestinationMarkCard from '@/components/destinations/DestinationMarkCard.vue'
import { destinationTypeLabel as typeLabel } from '@/components/destinations/destinationTypeLabels'
import { useDestinationBrowser } from '@/composables/useDestinationBrowser'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatCard from '@/components/ui/StatCard.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import {
  formatCount,
  formatDateTime,
  useDestinations
} from '@/composables/useDestinations'
import { usePipes } from '@/composables/usePipes'
import { notifyMutationResult } from '@/composables/useMutationFeedback'
import { useDataSource } from '@/composables/useDataSource'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

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

// Overview / Pipes / Configuration are the prototype's three; Tables and SQL
// console are folded into the same bar rather than left as a second row of
// controls, because all five swap the same region of the screen.
const tabs = computed(() => [
  { key: 'overview', label: 'Overview' },
  { key: 'pipes', label: 'Pipes', count: pipeTabCount.value },
  { key: 'configuration', label: 'Configuration' },
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
// empty until someone has visited Tables first, and the Tables tab's count is
// unknowable until it has been opened.
// Key this on the *resolved* destination, not the raw route id. The table list
// is a per-id read (`GET …/destinations/{id}/tables`), so firing it for an id
// that isn't in the account 404s — and `smoke.mjs` walks this route with a mock
// fixture id (`dst_snowflake`) in real mode, which is exactly such an id. The
// read awaits `waitForAccount()`, so its 404 resolves late enough to be logged
// against the *next* route in the walk (`/pipes/pipe_web_to_snowflake`), where
// it read as an unrelated failure. A real record carries an id that exists; a
// missing one is "empty" (see `destination` above), not a request to make.
// DO NOT make this lazy on the tab — that is the same bug wearing a new hat.
watch(
  () => destination.value?.id,
  value => {
    selectedTable.value = ''
    if (value && !isMock.value) loadTables(value)
  },
  { immediate: true }
)

// ------------------------------------------------------------- who built this

// `clickhouse_database` is the backend's own answer to "did we provision this?"
// — its schema description is "auto-provisioned ClickHouse database name, null
// while provisioning is pending". So a name present means Sfere built it; a
// ClickHouse destination without one is mid-provisioning; anything else is a
// warehouse or endpoint somebody connected themselves.
//
// Type alone is NOT the discriminator, deliberately: `DestinationConfig.database`
// says the backend provisions a fresh database only "when this is omitted", so a
// customer's own ClickHouse cluster is also `destination_type: clickhouse`.
const provisioning = computed(() => {
  const d = destination.value
  if (!d) return 'unknown'
  if (d.clickhouseDatabase) return 'sfere'
  if (d.destinationType === 'clickhouse') return 'pending'
  return 'self'
})

const managed = computed(() => provisioning.value === 'sfere')

const PROVISIONING_LABELS = {
  sfere: 'Sfere managed',
  pending: 'In progress',
  self: 'Your own',
  unknown: NOT_KNOWN
}

const PROVISIONING_HINTS = {
  sfere: 'Sfere created the ClickHouse database',
  pending: 'Sfere is still creating the database',
  self: 'Not provisioned by Sfere',
  unknown: ''
}

const provisioningLabel = computed(
  () => PROVISIONING_LABELS[provisioning.value]
)
const provisioningHint = computed(() => PROVISIONING_HINTS[provisioning.value])

const subtitle = computed(() => {
  const d = destination.value
  if (!d) return ''
  const type = typeLabel(d.destinationType)
  return type ? `${type} · /${d.slug}` : `/${d.slug}`
})

const heroTitle = computed(() =>
  managed.value
    ? 'Sfere provisioned this warehouse for you.'
    : 'A destination you connected.'
)

const heroBody = computed(() => {
  if (managed.value) {
    return 'Sfere created the ClickHouse database behind this destination and manages its credentials and infrastructure, so your pipes can deliver into it without anything for you to set up or maintain.'
  }
  if (provisioning.value === 'pending') {
    return 'Sfere is still creating the ClickHouse database behind this destination. It appears under Configuration once provisioning finishes.'
  }
  return 'Pipes deliver routed events here using the connection details stored on this destination. Credential fields are held by the backend and never returned, so they are masked wherever they appear.'
})

const heroAsideSubtitle = computed(() =>
  managed.value ? 'Provisioned by Sfere' : 'Connected by your team'
)

const heroAsideBadge = computed(() =>
  managed.value ? 'Managed by Sfere' : 'Self-managed'
)

// ---------------------------------------------------------------- inbound pipes

const PREVIEW_ROWS = 5

const inboundPipes = computed(() =>
  pipes.value.filter(p => p.eventDestinationId === id.value)
)

const pipesPreview = computed(() => inboundPipes.value.slice(0, PREVIEW_ROWS))

// The pipes read has to have SUCCEEDED before a count means anything: while it
// is in flight, failed, or has no endpoint, `formatCount(0)` on an unread list
// is a measured-looking zero — the failure this row was rebuilt to stop.
const pipesCounted = computed(
  () => !pipesLoading.value && !pipesError.value && !pipesApiMissing.value
)

const pipeCountLabel = computed(() =>
  pipesCounted.value ? formatCount(inboundPipes.value.length) : NOT_KNOWN
)

// `undefined` rather than 0 for the same reason: TabNav hides a count it is not
// given, and a "Pipes 0" tab on an unread list is an assertion.
const pipeTabCount = computed(() =>
  pipesCounted.value ? inboundPipes.value.length : undefined
)

const pipesHint = computed(() => {
  if (!pipesCounted.value) return ''
  const running = inboundPipes.value.filter(p => p.isEnabled).length
  return running ? `${formatCount(running)} running` : 'None running'
})

// ------------------------------------------------------------------ read-outs

// Only fields the backend's `Destination` actually carries. `templateId` and
// `latestTemplateVersion` used to appear here through DestinationTemplateBadge;
// both are `destinations.json` inventions, and the badge's fallback reads
// "Custom — hand-configured, not created from a template", which is false for
// every destination the backend provisions itself.
const about = computed(() => {
  const d = destination.value
  if (!d) return []
  return [
    { label: 'Name', value: d.name },
    { label: 'Provider', value: typeLabel(d.destinationType) },
    { label: 'Provisioning', value: provisioningLabel.value },
    { label: 'Slug', value: `/${d.slug}` },
    { label: 'Destination ID', value: d.id },
    { label: 'Created', value: formatDateTime(d.createdAt) },
    { label: 'Last updated', value: formatDateTime(d.updatedAt) }
  ]
})

const configurationIntro = computed(() =>
  managed.value
    ? 'Sfere manages this configuration for you.'
    : 'The connection details stored on this destination.'
)

// Built by presence rather than by a fixed shape: `config` is a union typed by
// `destination_type` (a webhook has a `url` and no `database`; S3 has a bucket
// and no `protocol`), so a fixed row list would print "Not known" for fields
// that do not exist on this kind of destination at all. Secrets are never
// included — the API masks them to "***", and a row reading "***" teaches
// nothing.
const configurationItems = computed(() => {
  const d = destination.value
  if (!d) return []

  const config = d.config ?? {}
  const items = [
    { label: 'Provider', value: typeLabel(d.destinationType) },
    { label: 'Management', value: provisioningLabel.value }
  ]

  const database = d.clickhouseDatabase || config.database
  if (database) items.push({ label: 'Database', value: database })
  if (config.protocol) items.push({ label: 'Protocol', value: config.protocol })
  if (Array.isArray(config.hosts) && config.hosts.length) {
    items.push({ label: 'Hosts', value: config.hosts.join(', ') })
  }
  if (config.cluster) items.push({ label: 'Cluster', value: config.cluster })
  if (config.url) items.push({ label: 'Endpoint', value: config.url })
  if (config.bucket) items.push({ label: 'Bucket', value: config.bucket })
  if (config.region) items.push({ label: 'Region', value: config.region })

  const parameters = config.parameters
  if (parameters && Object.keys(parameters).length) {
    items.push({
      label: 'Parameters',
      value: Object.entries(parameters)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')
    })
  }

  return items
})

const toggleMessage = computed(() => {
  const d = destination.value
  if (!d) return ''
  return d.isEnabled
    ? `Pipes stop routing events into “${d.name}” straight away. Nothing already delivered is removed, and you can enable it again at any time.`
    : `Pipes start routing events into “${d.name}” again straight away.`
})

// THIS USED TO PROMISE A TRASH THAT CANNOT HOLD THE RECORD. `DELETE
// /v1/accounts/{account}/destinations/{id}` is a hard 204: no soft delete, no
// listing, no restore call — so "moves to the trash, restorable for 30 days"
// sent people to a screen that could not have their destination. It also piped
// the fixture-only `pipeCount` through `formatCount`, which prints a confident
// "0 pipes" for `undefined`. The count is the real joined one now, and only
// stated when the pipes read succeeded.
const deleteMessage = computed(() => {
  const d = destination.value
  if (!d) return ''
  const n = inboundPipes.value.length
  const pipeLine = !pipesCounted.value
    ? 'Any pipe delivering into it stops.'
    : n === 0
      ? 'No pipe delivers into it.'
      : n === 1
        ? '1 pipe delivers into it and stops.'
        : `${formatCount(n)} pipes deliver into it and stop.`
  return `“${d.name}” is deleted permanently. ${pipeLine} Restoring a destination is not available yet, so this cannot be undone.`
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
