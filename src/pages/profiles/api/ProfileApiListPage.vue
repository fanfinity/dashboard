<template>
  <q-page class="p-6">
    <PageHeader
      title="Profile API"
      subtitle="REST endpoints other systems call to look a fan up and read back agreed attributes."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search endpoints..." />
        <SfereIconButton
          icon="trash"
          label="Trash"
          :to="{ name: 'profile-api-endpoints-trash' }"
        />
        <SfereIconButton
          icon="plus"
          label="New endpoint"
          variant="primary"
          :to="{ name: 'profile-api-endpoints-new' }"
        />
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && endpoints.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard label="Endpoints" :value="formatCount(endpoints.length)" />
      <StatCard
        label="Live"
        :value="`${liveCount} of ${endpoints.length}`"
        :hint="liveCount === endpoints.length ? 'All serving' : 'Some paused'"
      />
      <StatCard
        label="Requests (last hour)"
        :value="formatCount(requestsLastHour)"
      />
      <StatCard
        label="Slowest p95"
        :value="formatLatency(slowestP95)"
        :hint="slowestP95Name"
      />
    </div>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      @retry="load"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="font-mono text-xs text-subtle"
          >{{ row.method }} {{ row.path }}</p
        >
      </template>

      <template #cell-identifierTypeName="{ value }">
        <StatusBadge tone="neutral" :label="value" />
      </template>

      <template #cell-attributes="{ row }">
        <p class="text-muted">{{ attributeCount(row) }}</p>
        <p class="truncate font-mono text-xs text-subtle">{{
          attributeList(row)
        }}</p>
      </template>

      <template #cell-isEnabled="{ value }">
        <StatusBadge
          :tone="value ? 'success' : 'neutral'"
          :label="value ? 'Live' : 'Paused'"
        />
      </template>

      <template #cell-requestCountLastHour="{ value }">
        {{ formatCount(value) }}
      </template>

      <template #cell-p95LatencyMs="{ value }">
        {{ formatLatency(value) }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="askToggle(row)"
          >
            {{ row.isEnabled ? 'Pause' : 'Enable' }}
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="ask(row)"
          >
            Delete
          </button>
        </div>
      </template>

      <!-- Two different "no rows" cases: nothing configured yet (offer the
           primary CTA) and nothing matching the filters (offer a way back). -->
      <template #empty>
        <EmptyState :title="emptyTitle" :description="emptyDescription">
          <template #cta>
            <button
              v-if="!endpoints.length"
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="router.push({ name: 'profile-api-endpoints-new' })"
            >
              Create your first endpoint
            </button>
            <button
              v-else
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="clearFilters"
            >
              Clear filters
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <div
      v-if="!loading && !error && endpoints.length"
      class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3"
    >
      <ProfileApiAccessPanel
        class="min-w-0 xl:col-span-2"
        :endpoints="endpoints"
        @copy="copyValue"
      />
      <ProfileApiTokensPanel
        :tokens="readTokens"
        :loading="tokensLoading"
        :error="tokensError"
        @retry="loadTokens"
      />
    </div>

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move endpoint to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
      destructive
      @confirm="remove"
    />
    <ConfirmDialog
      v-model="confirmToggle"
      :title="toggleTitle"
      :message="toggleMessage"
      :confirm-label="toggleConfirmLabel"
      @confirm="toggle"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ProfileApiAccessPanel from '@/components/profiles/api/ProfileApiAccessPanel.vue'
import ProfileApiTokensPanel from '@/components/profiles/api/ProfileApiTokensPanel.vue'
import {
  formatCount,
  formatLatency,
  profileReadTokens,
  useProfileApiEndpoints,
  useProfileApiTokens
} from '@/composables/useProfileApi'

const router = useRouter()
const $q = useQuasar()

const {
  endpoints,
  loading,
  error,
  load,
  setEnabled,
  remove: removeEndpoint
} = useProfileApiEndpoints()

// Tokens are supporting detail: their failure degrades one card rather than the
// page, so they carry their own loading/error and their own retry.
const {
  tokens,
  loading: tokensLoading,
  error: tokensError,
  load: loadTokens
} = useProfileApiTokens()

const query = ref('')
const tab = ref('all')
const confirmDelete = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Endpoint', sortable: true },
  { key: 'identifierTypeName', label: 'Looks up by', sortable: true },
  { key: 'attributes', label: 'Returns' },
  { key: 'isEnabled', label: 'Status', sortable: true },
  {
    key: 'requestCountLastHour',
    label: 'Requests / hour',
    sortable: true,
    align: 'right'
  },
  { key: 'p95LatencyMs', label: 'p95', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '190px' }
]

// Each tab is a predicate over an endpoint; 'all' has none.
const TAB_PREDICATES = {
  live: e => e.isEnabled,
  paused: e => !e.isEnabled
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: endpoints.value.length },
  {
    key: 'live',
    label: 'Live',
    count: endpoints.value.filter(TAB_PREDICATES.live).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: endpoints.value.filter(TAB_PREDICATES.paused).length
  }
])

const SEARCH_FIELDS = [
  'name',
  'slug',
  'path',
  'description',
  'identifierTypeName'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return endpoints.value.filter(e => {
    if (predicate && !predicate(e)) return false
    if (!q) return true
    if ((e.attributes ?? []).some(a => a.toLowerCase().includes(q))) return true
    return SEARCH_FIELDS.some(f =>
      String(e[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const readTokens = computed(() => profileReadTokens(tokens.value))

const liveCount = computed(
  () => endpoints.value.filter(e => e.isEnabled).length
)

const requestsLastHour = computed(() =>
  endpoints.value.reduce((sum, e) => sum + (e.requestCountLastHour ?? 0), 0)
)

// The slowest endpoint is the one worth naming — an average p95 across
// endpoints serving wildly different volumes would mean nothing.
const slowest = computed(() =>
  endpoints.value.reduce(
    (worst, e) =>
      (e.p95LatencyMs ?? -1) > (worst?.p95LatencyMs ?? -1) ? e : worst,
    null
  )
)

const slowestP95 = computed(() => slowest.value?.p95LatencyMs ?? null)
const slowestP95Name = computed(() => slowest.value?.name ?? '')

function attributeCount(row) {
  const n = (row.attributes ?? []).length
  return `${n} attribute${n === 1 ? '' : 's'}`
}

// The raw ids, not display names: they are the JSON keys a caller reads back,
// so they are the useful thing to show on an API screen.
function attributeList(row) {
  return (row.attributes ?? []).join(', ')
}

const emptyTitle = computed(() =>
  endpoints.value.length
    ? 'No endpoints match your filters'
    : 'No Profile API endpoints yet'
)

const emptyDescription = computed(() =>
  endpoints.value.length
    ? 'Try a different search term, or switch back to the All tab.'
    : 'Create an endpoint to expose resolved fan profiles to a CRM, a kiosk or your website.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })
}

const confirmToggle = ref(false)
const toggleTarget = ref(null)

// Pausing asks first, the same as it does on the detail screens: a row action
// carries no sentence of its own, so the dialog is where the consequence is
// written and where the record gets named. Not `destructive` — pausing is
// reversible, and a red button on a routine confirm teaches people to click
// through red buttons.
//
// Its own ref rather than sharing `target` with the delete flow: two dialogs
// reading one row is how a confirm ends up acting on the wrong record. The row
// is left in place after the confirm rather than nulled, so the message does
// not blank out while the dialog fades.
function askToggle(row) {
  toggleTarget.value = row
  confirmToggle.value = true
}

const toggleTitle = computed(() =>
  toggleTarget.value?.isEnabled
    ? 'Pause this endpoint?'
    : 'Enable this endpoint?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause endpoint' : 'Enable endpoint'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops answering at ${row.path} straight away — callers get nothing back until it is enabled again.`
    : `“${row.name}” starts answering at ${row.path} again straight away.`
})

function toggle() {
  const row = toggleTarget.value
  if (!row) return
  setEnabled(row.id, !row.isEnabled)
  notifyLocal(`${row.name} ${row.isEnabled ? 'paused' : 'enabled'}`)
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

const deleteMessage = computed(() =>
  target.value
    ? `“${target.value.name}” stops answering at ${target.value.path} and moves to the trash, where it can be restored for 30 days.`
    : ''
)

function remove() {
  const row = target.value
  if (!row) return
  removeEndpoint(row.id)
  notifyLocal(`${row.name} moved to trash`)
  target.value = null
}

// Clipboard access is permission-gated and unavailable outside a secure
// context, so a failure has to be reported rather than thrown.
async function copyValue({ label, value }) {
  let message = `${label} copied to clipboard`
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    message = `Couldn't copy the ${label.toLowerCase()} — select it and copy by hand.`
  }
  $q.notify({ message, color: 'dark', timeout: 2500 })
}

onMounted(() => {
  load()
  loadTokens()
})
</script>
