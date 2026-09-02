<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the toolbar and the table, so all
         three share a left AND a right edge. Same measure and same string as
         DashboardHomePage's wrapper — 1400px, deliberately wider than
         `--container-sfere-page` (80rem), which left ~40% of a wide monitor
         empty. It sits on the page rather than in MainLayout because the layout
         is shared with screens that want the whole width, and the dialogs below
         stay outside it since q-dialog teleports anyway. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Warehouse models"
        subtitle="Each one is a select against a warehouse connection whose result the fan graph can build on."
      >
        <template #actions>
          <ToolbarSearch v-model="query" placeholder="Search models..." />
          <SfereIconButton
            icon="plus"
            label="New model"
            variant="primary"
            :to="{ name: 'warehouse-models-new' }"
          />
        </template>
      </PageHeader>

      <div
        v-if="!loading && !error && models.length"
        class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Models"
          :value="formatCount(models.length)"
          :hint="`${formatCount(stats.paused)} paused`"
        />
        <StatCard
          label="Rows modelled"
          :value="formatCount(stats.rows)"
          hint="As of the last refresh of each model"
        />
        <StatCard
          label="Columns exposed"
          :value="formatCount(stats.columns)"
          hint="What attributes and syncs can read"
        />
        <StatCard
          label="Derived attributes"
          :value="formatCount(stats.attributes)"
          :hint="`Feeding ${formatCount(stats.audiences)} audiences`"
        />
      </div>

      <!-- Secondary resources: connection health, and the records that depend on
           each model. Their failure degrades this panel and nothing else — the
           table below is driven by the models themselves and keeps working. -->
      <div v-if="contextError" class="mb-5">
        <ErrorState
          title="Couldn't load connections and dependants."
          :message="contextError"
          @retry="loadContext"
        />
      </div>

      <NoticeBanner
        v-else-if="attention.length"
        tone="warn"
        class="mb-5"
        :title="attentionTitle"
        :message="attentionMessage"
      />

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
          <div class="flex items-center gap-2">
            <p class="font-medium text-ink">{{ row.name }}</p>
            <StatusBadge
              v-if="row.connectionBroken"
              tone="danger"
              label="Connection down"
            />
          </div>
          <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
        </template>

        <template #cell-dwhConnectionName="{ row }">
          <p class="text-ink">{{ row.dwhConnectionName }}</p>
          <p class="text-xs text-subtle">{{ row.connectionDetail }}</p>
        </template>

        <template #cell-columnCount="{ row }">
          <p class="whitespace-nowrap text-ink">{{ row.shapeLabel }}</p>
          <p class="whitespace-nowrap font-mono text-xs text-subtle">{{
            row.keyLabel
          }}</p>
        </template>

        <template #cell-lastRefreshedAt="{ row }">
          <p class="whitespace-nowrap text-muted">{{ row.refreshedLabel }}</p>
          <div class="mt-1">
            <StatusBadge
              :tone="refreshStatusVariant(row.lastRefreshStatus)"
              :label="refreshStatusLabel(row.lastRefreshStatus)"
            />
          </div>
          <!-- The detail of a warning is a sentence, so it goes under the pill
               rather than inside it. -->
          <p v-if="row.lastRefreshMessage" class="mt-1 text-xs text-subtle">{{
            row.lastRefreshMessage
          }}</p>
        </template>

        <template #cell-usedByAttributeCount="{ row }">
          <p class="whitespace-nowrap text-ink">{{ row.usedByLabel }}</p>
          <p class="whitespace-nowrap text-xs text-subtle">{{
            row.audienceLabel
          }}</p>
        </template>

        <template #cell-isEnabled="{ value }">
          <StatusBadge
            :tone="value ? 'success' : 'neutral'"
            :label="value ? 'Active' : 'Paused'"
          />
        </template>

        <!-- No flex wrapper: the column is `align: 'right'`, which SfereTable
             renders as `text-align: right` on the <td>, and RowActionsMenu's root
             is `inline-grid` — an inline-level box, so it lands on the right edge
             on its own. A wrapper here would only re-open Quasar's unlayered
             wrapping `.flex` (collision #4) for no gain. -->
        <template #cell-actions="{ row }">
          <RowActionsMenu
            :label="`Actions for ${row.name}`"
            :actions="rowActions(row)"
            @select="key => onRowAction(key, row)"
          />
        </template>

        <!-- Two different "no rows" cases: nothing modelled yet (offer the primary
             CTA) and nothing matching the filters (offer a way back). -->
        <template #empty>
          <EmptyState :title="emptyTitle" :description="emptyDescription">
            <template #cta>
              <button
                v-if="!models.length"
                class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
                @click="router.push({ name: 'warehouse-models-new' })"
              >
                Build your first model
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
    </div>

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move model to trash?"
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
import { NEVER } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import {
  connectionTypeLabel,
  describeDependants,
  formatCount,
  formatDateTime,
  isConnectionHealthy,
  refreshStatusLabel,
  refreshStatusVariant,
  useWarehouseModelContext,
  useWarehouseModels
} from '@/composables/useWarehouseModels'

const router = useRouter()
const $q = useQuasar()
const {
  models,
  loading,
  error,
  load,
  setEnabled,
  remove: removeModel
} = useWarehouseModels()

const {
  error: contextError,
  load: loadContext,
  connectionFor,
  dependantsFor
} = useWarehouseModelContext()

const query = ref('')
const tab = ref('all')
const confirmDelete = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Model', sortable: true },
  { key: 'dwhConnectionName', label: 'Connection', sortable: true },
  {
    key: 'columnCount',
    label: 'Shape',
    sortable: true,
    align: 'right',
    width: '160px'
  },
  { key: 'lastRefreshedAt', label: 'Last refresh', sortable: true },
  {
    key: 'usedByAttributeCount',
    label: 'Used by',
    sortable: true,
    align: 'right',
    width: '140px'
  },
  { key: 'isEnabled', label: 'Status', sortable: true },
  // Sized for one 36px kebab plus the cell's own px-4, not for the two text
  // buttons this replaced — a 215px column of whitespace is exactly what makes
  // the data columns feel cramped on a wide window.
  { key: 'actions', label: '', align: 'right', width: '76px' }
]

// The table sorts on `row[key]`, so anything a column shows has to exist as a
// field on the row. Derived text is computed once here, not in a cell slot.
const rows = computed(() =>
  models.value.map(model => {
    const connection = connectionFor(model)
    const attributes = model.usedByAttributeCount ?? 0
    const audiences = model.usedByAudienceCount ?? 0
    return {
      ...model,
      connectionBroken: Boolean(connection) && !isConnectionHealthy(connection),
      connectionDetail: connection
        ? `${connectionTypeLabel(connection.type)} · ${connection.database}.${connection.schema}`
        : 'Connection details unavailable',
      shapeLabel: `${formatCount(model.columnCount)} columns`,
      keyLabel: model.identifierColumn
        ? `keyed on ${model.identifierColumn}`
        : 'no identifier column',
      refreshedLabel: formatDateTime(model.lastRefreshedAt, NEVER),
      refreshStatusLabel:
        model.lastRefreshMessage || refreshStatusLabel(model.lastRefreshStatus),
      usedByLabel: `${formatCount(attributes)} attribute${attributes === 1 ? '' : 's'}`,
      audienceLabel: `${formatCount(audiences)} audience${audiences === 1 ? '' : 's'}`
    }
  })
)

// A model needs attention when its own refresh reported something, or when the
// warehouse under it is unreachable — either way it is serving stale columns.
function needsAttention(row) {
  return row.connectionBroken || row.lastRefreshStatus !== 'success'
}

const TAB_PREDICATES = {
  active: m => m.isEnabled,
  paused: m => !m.isEnabled,
  attention: needsAttention
}

const tabs = computed(() => [
  { key: 'all', label: 'All', count: rows.value.length },
  {
    key: 'active',
    label: 'Active',
    count: rows.value.filter(TAB_PREDICATES.active).length
  },
  {
    key: 'paused',
    label: 'Paused',
    count: rows.value.filter(TAB_PREDICATES.paused).length
  },
  {
    key: 'attention',
    label: 'Needs attention',
    count: rows.value.filter(TAB_PREDICATES.attention).length
  }
])

const SEARCH_FIELDS = [
  'name',
  'id',
  'description',
  'dwhConnectionName',
  'query',
  'identifierColumn'
]

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return rows.value.filter(m => {
    if (predicate && !predicate(m)) return false
    if (!q) return true
    return SEARCH_FIELDS.some(f =>
      String(m[f] ?? '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const stats = computed(() => ({
  paused: models.value.filter(m => !m.isEnabled).length,
  rows: models.value.reduce((total, m) => total + (m.rowCount ?? 0), 0),
  columns: models.value.reduce((total, m) => total + (m.columnCount ?? 0), 0),
  attributes: models.value.reduce(
    (total, m) => total + (m.usedByAttributeCount ?? 0),
    0
  ),
  audiences: models.value.reduce(
    (total, m) => total + (m.usedByAudienceCount ?? 0),
    0
  )
}))

const attention = computed(() => rows.value.filter(needsAttention))

const attentionTitle = computed(() => {
  const n = attention.value.length
  return `${n} model${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} a look`
})

const attentionMessage = computed(() =>
  attention.value.map(m => `${m.name}: ${m.refreshStatusLabel}.`).join(' ')
)

const emptyTitle = computed(() =>
  models.value.length ? 'No models match your filters' : 'No models yet'
)

const emptyDescription = computed(() =>
  models.value.length
    ? 'Try a different search term, or switch back to the All tab.'
    : 'A model turns a warehouse table into something the fan graph can read: orders, season tickets, turnstile scans.'
)

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only. No backend is connected yet.',
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
  toggleTarget.value?.isEnabled ? 'Pause this model?' : 'Resume this model?'
)

const toggleConfirmLabel = computed(() =>
  toggleTarget.value?.isEnabled ? 'Pause model' : 'Resume model'
)

const toggleMessage = computed(() => {
  const row = toggleTarget.value
  if (!row) return ''
  return row.isEnabled
    ? `“${row.name}” stops refreshing against ${row.dwhConnectionName}. Whatever reads it keeps the rows from its last refresh until you resume it.`
    : `“${row.name}” starts refreshing against ${row.dwhConnectionName} again on its next run.`
})

function toggle() {
  const row = toggleTarget.value
  if (!row) return
  setEnabled(row.id, !row.isEnabled)
  notifyLocal(`${row.name} ${row.isEnabled ? 'paused' : 'resumed'}`)
}

function ask(row) {
  target.value = row
  confirmDelete.value = true
}

// The menu reports a key and does nothing else — both branches still open the
// screen's own ConfirmDialog, against its own target ref. The labels carry the
// noun ("Pause model") because the trigger's aria-label names the ROW, so the
// item is the only place the verb's object appears.
function rowActions(row) {
  return [
    {
      key: 'toggle',
      label: row.isEnabled ? 'Pause model' : 'Resume model',
      icon: row.isEnabled ? 'pause' : 'play'
    },
    // "Move to trash", not "Delete": it has to say the same thing the confirm
    // it opens says, and that dialog is titled "Move model to trash?".
    {
      key: 'delete',
      label: 'Move to trash',
      icon: 'trash',
      tone: 'destructive'
    }
  ]
}

function onRowAction(key, row) {
  if (key === 'toggle') askToggle(row)
  else if (key === 'delete') ask(row)
}

// A model with attributes hanging off it is not a safe delete, so the dialog
// names what breaks rather than asking a generic "are you sure". When the
// dependants failed to load, the model's own counters still carry the number.
const deleteMessage = computed(() => {
  const row = target.value
  if (!row) return ''
  const named = describeDependants(dependantsFor(row))
  const attributes = row.usedByAttributeCount ?? 0
  const fallback = attributes
    ? `${attributes} attribute${attributes === 1 ? '' : 's'} read it and will stop being computed.`
    : 'Nothing reads it today.'
  return `“${row.name}” stops refreshing and moves to the trash, where it can be restored for 30 days. ${named || fallback} The table in the warehouse is left untouched.`
})

function remove() {
  const row = target.value
  if (!row) return
  removeModel(row.id)
  notifyLocal(`${row.name} moved to trash`)
  // `target` is deliberately NOT nulled: `deleteMessage` reads it, so clearing it
  // here blanks the dialog's sentence out while the dialog is still fading. The
  // dialog's open state is its own ref, and `ask()` overwrites `target` before
  // reopening, so nothing goes stale.
}

onMounted(() => {
  load()
  loadContext()
})
</script>
