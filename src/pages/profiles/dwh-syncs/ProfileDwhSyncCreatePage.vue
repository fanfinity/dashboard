<template>
  <q-page class="p-6">
    <PageHeader
      title="New profile DWH sync"
      subtitle="Write the resolved profile set into a warehouse table on a schedule."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'profile-dwh-syncs' })"
        >
          Cancel
        </button>
      </template>
    </PageHeader>

    <!-- The warehouse connections are the primary resource: without one there
         is nothing to create. The attribute and identifier catalogs are
         secondary and degrade inside their own section. -->
    <LoadingState v-if="connectionsLoading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="connectionsError"
      title="Couldn't load the warehouse connections."
      :message="connectionsError"
      @retry="loadConnections"
    />

    <EmptyState
      v-else-if="!connections.length"
      title="No warehouse connections yet"
      description="A sync writes into an existing warehouse connection, and this workspace has none. Connect a warehouse first, then come back."
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'dwh-connections' })"
        >
          Warehouse connections
        </button>
      </template>
    </EmptyState>

    <form v-else class="flex max-w-4xl flex-col gap-4" @submit.prevent="submit">
      <FormSection
        title="Basics"
        description="How this sync appears in lists and run logs."
      >
        <FormField
          label="Name"
          required
          for-id="sync-name"
          :error="errors.name"
          hint="Shown everywhere this sync is referenced."
        >
          <input
            id="sync-name"
            v-model="form.name"
            type="text"
            maxlength="255"
            placeholder="e.g. Current profiles to Snowflake"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Destination"
        description="The warehouse connection this sync writes into, and the table it writes to."
      >
        <FormField
          label="Warehouse connection"
          required
          :error="errors.dwhConnectionId"
        >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SelectableCard
              v-for="c in connections"
              :key="c.id"
              :selected="form.dwhConnectionId === c.id"
              :disabled="c.status !== 'connected'"
              @select="pickConnection(c)"
            >
              <div class="flex w-full items-start justify-between gap-2">
                <span class="text-sm font-medium text-ink">{{ c.name }}</span>
                <StatusBadge
                  :tone="c.status === 'connected' ? 'success' : 'danger'"
                  :label="c.status === 'connected' ? 'Connected' : 'Failing'"
                />
              </div>
              <p class="mt-1.5 font-mono text-xs text-subtle"
                >{{ c.database }}.{{ c.schema }}</p
              >
              <p class="mt-1 text-xs leading-5 text-muted">{{
                connectionHint(c)
              }}</p>
            </SelectableCard>
          </div>
        </FormField>

        <FormField
          label="Target table"
          required
          for-id="sync-table"
          :error="errors.targetTable"
          hint="Created on the first run if it does not exist. Fully qualified: database.schema.table."
        >
          <input
            id="sync-table"
            v-model="form.targetTable"
            type="text"
            placeholder="FAN_PROD.PUBLIC.PROFILES"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
            @input="tableTouched = true"
          />
        </FormField>

        <FormField
          label="Write mode"
          required
          hint="How each run treats the rows already in the table."
        >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectableCard
              v-for="mode in WRITE_MODES"
              :key="mode.value"
              :selected="form.writeMode === mode.value"
              @select="form.writeMode = mode.value"
            >
              <span class="text-sm font-medium text-ink">{{ mode.label }}</span>
              <p class="mt-1.5 text-xs leading-5 text-muted">{{
                mode.description
              }}</p>
            </SelectableCard>
          </div>
        </FormField>

        <NoticeBanner
          v-if="form.writeMode === 'replace'"
          tone="warn"
          title="Replace truncates the target table"
          message="Every run empties the table before writing. Point this at a table the sync owns, not one anything else writes to."
        />
      </FormSection>

      <FormSection
        title="Profile payload"
        description="Which attributes become columns, and which identifiers the rows are keyed on."
      >
        <LoadingState v-if="attributesLoading" variant="form" :rows="3" />

        <!-- A secondary failure stays inside its section with its own retry;
             only the connections escalate to a page-level error. -->
        <ErrorState
          v-else-if="attributesError"
          title="Couldn't load the attribute catalog."
          :message="attributesError"
          @retry="loadAttributes"
        />

        <ProfileDwhSyncColumnMap
          v-else
          v-model="form.attributes"
          label="Attributes"
          required
          :items="attributeItems"
          :error="errors.attributes"
          hint="One column per selected attribute."
          empty-title="No attributes defined yet"
          empty-description="Define a profile attribute first — there is nothing for a sync to write."
        />

        <LoadingState v-if="identifiersLoading" variant="form" :rows="3" />

        <ErrorState
          v-else-if="identifiersError"
          title="Couldn't load the identifier types."
          :message="identifiersError"
          @retry="loadIdentifiers"
        />

        <ProfileDwhSyncColumnMap
          v-else
          v-model="form.identifierTypes"
          label="Identifier columns"
          required
          :items="identifierItems"
          :error="errors.identifierTypes"
          hint="The keys a row is matched on. Profiles missing every selected identifier are skipped."
          empty-title="No identifier types available"
          empty-description="Identity resolution has no identifier types configured yet."
        />
      </FormSection>

      <FormSection
        title="Schedule"
        description="When the sync runs, and whether it starts running at all."
      >
        <ProfileDwhSyncScheduleFields
          v-model="form.schedule"
          :error="errors.schedule"
        />

        <FormField
          label="State on creation"
          hint="A paused sync keeps its configuration but never runs."
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

      <NoticeBanner tone="info" title="What this will do" :message="summary" />

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create sync' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'profile-dwh-syncs' })"
        >
          Cancel
        </button>
      </div>

      <p class="text-xs text-subtle"
        >No backend is connected to this screen yet — creating a sync updates
        this session only and is gone on reload.</p
      >
    </form>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ProfileDwhSyncColumnMap from '@/components/profiles/dwh-syncs/ProfileDwhSyncColumnMap.vue'
import ProfileDwhSyncScheduleFields from '@/components/profiles/dwh-syncs/ProfileDwhSyncScheduleFields.vue'
import {
  columnName,
  isCronLike,
  scheduleLabel,
  suggestTargetTable,
  useProfileDwhSyncAttributes,
  useProfileDwhSyncConnections,
  useProfileDwhSyncIdentifierTypes,
  useProfileDwhSyncToasts,
  writeModeLabel,
  WRITE_MODES
} from '@/composables/useProfileDwhSyncs'

const router = useRouter()
const { toast } = useProfileDwhSyncToasts()

const {
  connections,
  loading: connectionsLoading,
  error: connectionsError,
  load: loadConnections,
  findById: findConnection
} = useProfileDwhSyncConnections()

const {
  attributes,
  loading: attributesLoading,
  error: attributesError,
  load: loadAttributes
} = useProfileDwhSyncAttributes()

const {
  identifierTypes,
  loading: identifiersLoading,
  error: identifiersError,
  load: loadIdentifiers
} = useProfileDwhSyncIdentifierTypes()

const STATE_OPTIONS = [
  { label: 'Enabled', value: true },
  { label: 'Paused', value: false }
]

const NAME_MAX = 255

const saving = ref(false)
// The target table follows the name and the connection until the user edits it,
// then it is theirs.
const tableTouched = ref(false)

const form = reactive({
  name: '',
  dwhConnectionId: '',
  targetTable: '',
  writeMode: 'upsert',
  attributes: [],
  identifierTypes: [],
  schedule: '0 2 * * *',
  isEnabled: true
})

const errors = reactive({
  name: '',
  dwhConnectionId: '',
  targetTable: '',
  attributes: '',
  identifierTypes: '',
  schedule: ''
})

// An attribute's id is already the warehouse-safe form of its name, so the
// column it maps to needs no lookup — the same derivation the detail dialog
// uses, kept in the composable so both agree.
const attributeItems = computed(() =>
  attributes.value.map(a => ({
    id: a.id,
    label: a.name,
    column: columnName(a.id),
    description: a.dataModelName
      ? `${a.dataModelName} · ${a.type}`
      : `${a.type} attribute`
  }))
)

const identifierItems = computed(() =>
  identifierTypes.value.map(t => ({
    id: t.id,
    label: t.displayName || t.name,
    column: columnName(t.name),
    description:
      t.maxIdentifiers === 1
        ? 'One per profile — safe as a unique key.'
        : `Up to ${t.maxIdentifiers ?? 'many'} per profile.`
  }))
)

const selectedConnection = computed(() =>
  form.dwhConnectionId ? findConnection(form.dwhConnectionId) : null
)

// Reads back the whole form in one sentence, because the destructive part of a
// sync (write mode against a real table) is spread over three sections.
const summary = computed(() => {
  const columns = form.attributes.length + form.identifierTypes.length
  const where = form.targetTable || 'the target table'
  const connection = selectedConnection.value?.name ?? 'the selected warehouse'
  const mode = writeModeLabel(form.writeMode).toLowerCase()
  const when = scheduleLabel(form.schedule).toLowerCase()
  const state = form.isEnabled ? '' : ' Created paused, so it will not run yet.'
  return `Writes ${columns} column${columns === 1 ? '' : 's'} into ${where} on ${connection}, ${when}, in ${mode} mode.${state}`
})

function connectionHint(connection) {
  if (connection.status !== 'connected') {
    return connection.lastError || 'This connection is failing. Fix it first.'
  }
  return `${connection.type} · ${connection.tableCount} tables`
}

function pickConnection(connection) {
  form.dwhConnectionId = connection.id
}

// Suggest a fully-qualified table from whatever is known, until the user takes
// the field over.
watch([() => form.name, () => form.dwhConnectionId], () => {
  if (tableTouched.value) return
  form.targetTable = suggestTargetTable(selectedConnection.value, form.name)
})

function validate() {
  const name = form.name.trim()
  if (!name) {
    errors.name = 'A sync name is required.'
  } else if (name.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters.`
  } else {
    errors.name = ''
  }

  errors.dwhConnectionId = form.dwhConnectionId
    ? ''
    : 'Pick a warehouse connection.'

  const table = form.targetTable.trim()
  if (!table) {
    errors.targetTable = 'A target table is required.'
  } else if (!/^[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*){0,2}$/.test(table)) {
    errors.targetTable =
      'Use an unquoted name like schema.table or database.schema.table.'
  } else {
    errors.targetTable = ''
  }

  errors.attributes = form.attributes.length
    ? ''
    : 'Pick at least one attribute to write.'

  errors.identifierTypes = form.identifierTypes.length
    ? ''
    : 'Pick at least one identifier column — rows are matched on it.'

  if (!form.schedule.trim()) {
    errors.schedule = 'A schedule is required.'
  } else if (!isCronLike(form.schedule)) {
    errors.schedule = 'Enter a five-field cron expression, e.g. 0 3 * * *.'
  } else {
    errors.schedule = ''
  }

  return Object.values(errors).every(v => !v)
}

function submit() {
  if (!validate()) return
  saving.value = true

  // No POST to make. The sync is announced and the user is returned to the
  // list, which re-reads the mock JSON — so the new sync is deliberately not
  // there. Pretending otherwise would be the dishonest option.
  toast(`“${form.name.trim()}” configured`)

  saving.value = false
  router.push({ name: 'profile-dwh-syncs' })
}

onMounted(() => {
  loadConnections()
  loadAttributes()
  loadIdentifiers()
})
</script>
