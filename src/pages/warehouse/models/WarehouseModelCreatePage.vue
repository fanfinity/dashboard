<template>
  <q-page class="p-6">
    <PageHeader
      title="New warehouse model"
      subtitle="Name a select against one warehouse, map the columns that identify a fan, and choose how often it re-runs."
    />

    <LoadingState v-if="loading" variant="form" :rows="6" />

    <!-- The connections are this screen's primary resource: a model cannot be
         described without the warehouse it reads. The existing models are
         secondary and only power the duplicate-name check, below. -->
    <ErrorState
      v-else-if="connectionsError"
      title="Couldn't load the warehouse connections."
      :message="connectionsError"
      @retry="load"
    />

    <EmptyState
      v-else-if="!connections.length"
      title="No warehouse connection yet"
      description="A model reads from a warehouse, so there has to be one connected before you can define one."
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'dwh-connections-new' })"
        >
          Connect a warehouse
        </button>
      </template>
    </EmptyState>

    <form v-else class="grid max-w-4xl gap-4" @submit.prevent="submit">
      <FormSection
        title="Connection"
        description="Where the query runs. A model reads from exactly one warehouse."
      >
        <NoticeBanner
          v-if="unreachable.length"
          tone="warn"
          title="Some connections cannot be used right now"
          :message="unreachableMessage"
        />

        <EmptyState
          v-if="!usable.length"
          variant="inline"
          title="No connection is reachable"
          description="Every warehouse in this workspace failed its last check, so a new model has nothing to read from."
        >
          <template #cta>
            <button
              type="button"
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="router.push({ name: 'dwh-connections' })"
            >
              Review connections
            </button>
          </template>
        </EmptyState>

        <template v-else>
          <WarehouseModelConnectionPicker
            v-model="form.dwhConnectionId"
            :connections="connections"
          />
          <p v-if="errors.dwhConnectionId" class="text-xs text-rose-500">{{
            errors.dwhConnectionId
          }}</p>
        </template>
      </FormSection>

      <FormSection
        title="Basics"
        description="How the model is referenced by attributes, identifier types and syncs."
      >
        <FormField
          label="Name"
          required
          for-id="model-name"
          :error="errors.name"
          :hint="idHint"
        >
          <input
            id="model-name"
            v-model="form.name"
            type="text"
            maxlength="255"
            placeholder="e.g. Fan orders"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          label="Description"
          for-id="model-description"
          hint="Optional. One line on what a row means — whoever writes the next attribute reads this."
        >
          <textarea
            id="model-description"
            v-model="form.description"
            rows="2"
            placeholder="One row per merchandise order, joined to the resolved profile id."
            class="rounded-lg border border-line2 bg-white px-2.5 py-2 text-sm text-ink outline-none placeholder:text-subtle"
          ></textarea>
        </FormField>
      </FormSection>

      <FormSection title="Query" :description="queryDescription">
        <WarehouseModelSqlField
          v-model="form.query"
          :dialect="dialect"
          :error="errors.query"
          @validate="validateQuery"
        />

        <NoticeBanner
          v-if="check"
          :tone="checkVariant"
          :title="checkTitle"
          :message="checkMessage"
        />

        <WarehouseModelColumns
          :columns="parsedColumns"
          :roles="roles"
          :checked-at="checkedAt"
        />
      </FormSection>

      <FormSection
        title="Mapping"
        description="Which column uniquely identifies a row, which one ties it to a fan, and which one orders it in time."
      >
        <WarehouseModelColumnSelect
          v-model="form.primaryKeyColumn"
          :columns="parsedColumns"
          label="Primary key column"
          required
          id="model-primary-key"
          :error="errors.primaryKeyColumn"
          hint="Has to be unique per row. Used to reconcile a refresh against the previous one."
        />

        <WarehouseModelColumnSelect
          v-model="form.identifierColumn"
          :columns="parsedColumns"
          label="Identifier column"
          required
          id="model-identifier"
          :error="errors.identifierColumn"
          hint="The value matched against the fan graph — a resolved profile id, an email, a ticket reference."
        />

        <WarehouseModelColumnSelect
          v-model="form.timestampColumn"
          :columns="parsedColumns"
          label="Timestamp column"
          id="model-timestamp"
          :error="errors.timestampColumn"
          hint="Optional. Lets an attribute over this model ask for the newest row per fan."
        />
      </FormSection>

      <FormSection
        title="Refresh"
        description="A refresh re-runs the select and rebuilds the model's table. Attributes over it recompute afterwards."
      >
        <WarehouseModelScheduleField
          v-model="form.refreshCron"
          :error="errors.refreshCron"
        />

        <FormField
          label="State on creation"
          hint="A paused model keeps its definition but never refreshes."
        >
          <div class="flex items-center gap-2">
            <button
              v-for="opt in STATE_OPTIONS"
              :key="opt.label"
              type="button"
              class="rounded-lg border px-3 py-1.5 text-sm"
              :class="
                form.isEnabled === opt.value
                  ? 'border-brand/40 bg-brand/5 font-medium text-brand'
                  : 'border-line2 bg-white text-muted hover:bg-fill'
              "
              @click="form.isEnabled = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </FormField>
      </FormSection>

      <StickyActionBar>
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create model' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'warehouse-models' })"
        >
          Cancel
        </button>
        <p class="text-xs text-subtle"
          >Nothing is persisted yet — there is no backend behind this form.</p
        >
      </StickyActionBar>
    </form>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
import WarehouseModelConnectionPicker from '@/components/warehouse/models/WarehouseModelConnectionPicker.vue'
import WarehouseModelSqlField from '@/components/warehouse/models/WarehouseModelSqlField.vue'
import WarehouseModelColumns from '@/components/warehouse/models/WarehouseModelColumns.vue'
import WarehouseModelColumnSelect from '@/components/warehouse/models/WarehouseModelColumnSelect.vue'
import WarehouseModelScheduleField from '@/components/warehouse/models/WarehouseModelScheduleField.vue'
import { useMockResource } from '@/composables/useMockResource'
import {
  connectionTypeLabel,
  isConnectionHealthy,
  isValidCron,
  makeModelId,
  parseModelColumns,
  suggestColumnRoles,
  useWarehouseModels,
  validateModelSql
} from '@/composables/useWarehouseModels'

const router = useRouter()
const $q = useQuasar()

const STATE_OPTIONS = [
  { label: 'Active', value: true },
  { label: 'Paused', value: false }
]

const {
  data: connections,
  loading: connectionsLoading,
  error: connectionsError,
  load: loadConnections
} = useMockResource('dwh-connections')

// Loaded for one reason only: to refuse a name that is already taken before the
// user submits it. If it fails, the check is skipped rather than blocking the
// form — the backend would be the real authority anyway.
const {
  models,
  loading: modelsLoading,
  load: loadModels
} = useWarehouseModels()

const loading = computed(() => connectionsLoading.value || modelsLoading.value)

async function load() {
  await Promise.all([loadConnections(), loadModels()])
}

const saving = ref(false)
// The result of the last local check, and the clock time it happened at.
const check = ref(null)
const checkedAt = ref('')

const form = reactive({
  dwhConnectionId: '',
  name: '',
  description: '',
  query: '',
  primaryKeyColumn: '',
  identifierColumn: '',
  timestampColumn: '',
  refreshCron: '0 3 * * *',
  isEnabled: true
})

const errors = reactive({
  dwhConnectionId: '',
  name: '',
  query: '',
  primaryKeyColumn: '',
  identifierColumn: '',
  timestampColumn: '',
  refreshCron: ''
})

const usable = computed(() => connections.value.filter(isConnectionHealthy))

const unreachable = computed(() =>
  connections.value.filter(c => !isConnectionHealthy(c))
)

const unreachableMessage = computed(() =>
  unreachable.value
    .map(c => `${c.name}: ${c.lastError || 'last check failed'}.`)
    .join(' ')
)

const selectedConnection = computed(
  () => connections.value.find(c => c.id === form.dwhConnectionId) ?? null
)

const dialect = computed(() =>
  selectedConnection.value
    ? connectionTypeLabel(selectedConnection.value.type)
    : 'SQL'
)

const queryDescription = computed(() =>
  selectedConnection.value
    ? `Runs as ${selectedConnection.value.username} against ${selectedConnection.value.database}.${selectedConnection.value.schema}.`
    : 'Pick a connection above and the query is read in that warehouse’s dialect.'
)

const idHint = computed(() => {
  const id = makeModelId(form.name)
  return id
    ? `Referenced as “${id}” by attributes, identifier types and syncs.`
    : 'Shown wherever this model is referenced.'
})

// Parsed live rather than only on the validate press, so the mapping fields
// below always offer the columns the query currently produces.
const parsedColumns = computed(() => parseModelColumns(form.query))

const roles = computed(() => ({
  primaryKey: form.primaryKeyColumn,
  identifier: form.identifierColumn,
  timestamp: form.timestampColumn
}))

const checkVariant = computed(() => {
  if (!check.value) return 'info'
  if (check.value.errors.length) return 'danger'
  return check.value.warnings.length ? 'warn' : 'info'
})

const checkTitle = computed(() => {
  if (!check.value) return ''
  if (check.value.errors.length) return 'That is not a query a model can run'
  const n = check.value.columns.filter(c => c.name).length
  return `Query reads ${n} named column${n === 1 ? '' : 's'}`
})

// Every path through this says the same thing: the check is a parse, not a run.
const checkMessage = computed(() => {
  if (!check.value) return ''
  const detail = check.value.errors.length
    ? check.value.errors.join(' ')
    : check.value.warnings.join(' ')
  const where = selectedConnection.value?.name ?? 'the warehouse'
  const preamble = `Checked in the browser — nothing was sent to ${where}, so row counts and column types appear only after the first refresh.`
  return detail ? `${detail} ${preamble}` : preamble
})

// The workspace's primary warehouse is the answer for most models, so it starts
// selected — the picker still shows every other one.
watch(usable, list => {
  if (form.dwhConnectionId || !list.length) return
  form.dwhConnectionId = (list.find(c => c.isPrimary) ?? list[0]).id
})

// Naming the columns seeds the mapping, but never overwrites a field the user
// has already filled in.
watch(parsedColumns, columns => {
  const suggested = suggestColumnRoles(columns)
  if (!form.primaryKeyColumn) form.primaryKeyColumn = suggested.primaryKey
  if (!form.identifierColumn) form.identifierColumn = suggested.identifier
  if (!form.timestampColumn) form.timestampColumn = suggested.timestamp
})

function validateQuery() {
  const result = validateModelSql(form.query)
  check.value = result
  checkedAt.value = `${new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  })} UTC`
  errors.query = result.errors[0] ?? ''
}

function validate() {
  for (const key of Object.keys(errors)) errors[key] = ''

  if (!form.dwhConnectionId) {
    errors.dwhConnectionId = 'Pick the warehouse this model reads from.'
  } else if (!isConnectionHealthy(selectedConnection.value)) {
    errors.dwhConnectionId = 'That connection failed its last check.'
  }

  const name = form.name.trim()
  if (!name) {
    errors.name = 'A model name is required.'
  } else if (
    models.value.some(
      m =>
        m.name.toLowerCase() === name.toLowerCase() ||
        m.id === makeModelId(name)
    )
  ) {
    errors.name = 'A model with that name already exists.'
  }

  const sql = validateModelSql(form.query)
  if (!sql.ok) errors.query = sql.errors[0]

  // The named columns are only authoritative when the parse produced some; a
  // star query is checked for presence, not for membership.
  const named = parsedColumns.value.map(c => c.name).filter(Boolean)
  const knowsColumns = named.length > 0

  if (!form.primaryKeyColumn.trim()) {
    errors.primaryKeyColumn = 'Name the column that is unique per row.'
  } else if (knowsColumns && !named.includes(form.primaryKeyColumn.trim())) {
    errors.primaryKeyColumn = 'The select does not produce that column.'
  }

  if (!form.identifierColumn.trim()) {
    errors.identifierColumn = 'Name the column that ties a row to a fan.'
  } else if (knowsColumns && !named.includes(form.identifierColumn.trim())) {
    errors.identifierColumn = 'The select does not produce that column.'
  }

  const timestamp = form.timestampColumn.trim()
  if (timestamp && knowsColumns && !named.includes(timestamp)) {
    errors.timestampColumn = 'The select does not produce that column.'
  }

  if (form.refreshCron && !isValidCron(form.refreshCron)) {
    errors.refreshCron =
      'A cron expression has five whitespace-separated fields.'
  }

  return !Object.values(errors).some(Boolean)
}

function submit() {
  if (!validate()) return
  saving.value = true

  // No POST to make. The model is announced and the user is returned to the
  // list, which re-reads the mock JSON — so the new model is deliberately not
  // there. Pretending otherwise would be the dishonest option.
  $q.notify({
    message: `“${form.name.trim()}” configured`,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })

  saving.value = false
  router.push({ name: 'warehouse-models' })
}

onMounted(load)
</script>
