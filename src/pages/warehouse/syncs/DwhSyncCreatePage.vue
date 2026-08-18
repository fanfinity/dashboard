<template>
  <q-page class="p-6">
    <PageHeader
      title="New DWH sync"
      subtitle="Copy collected events into a warehouse table on a schedule."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'dwh-syncs' })"
        >
          Cancel
        </button>
      </template>
    </PageHeader>

    <!-- The warehouse connections are the primary resource: without one there
         is nothing to create. The source catalog is secondary and degrades
         inside its own section. -->
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
          for-id="dwh-sync-name"
          :error="errors.name"
          hint="Shown everywhere this sync is referenced."
        >
          <input
            id="dwh-sync-name"
            v-model="form.name"
            type="text"
            :maxlength="NAME_MAX"
            placeholder="e.g. Matchday events to Snowflake"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Source"
        description="The event stream this sync reads from. Only events collected after the first run are copied."
      >
        <LoadingState v-if="sourcesLoading" variant="form" :rows="2" />

        <!-- A secondary failure stays inside its section with its own retry;
             only the connections escalate to a page-level error. -->
        <ErrorState
          v-else-if="sourcesError"
          title="Couldn't load the sources."
          :message="sourcesError"
          @retry="loadSources"
        />

        <EmptyState
          v-else-if="!sourceOptions.length"
          variant="inline"
          title="No sources yet"
          description="Connect a source first — there are no events for a sync to copy."
        />

        <FormField
          v-else
          label="Source"
          required
          :error="errors.sourceId"
          hint="Searchable — start typing to filter."
        >
          <q-select
            v-model="form.sourceId"
            dense
            outlined
            emit-value
            map-options
            options-dense
            use-input
            input-debounce="0"
            :options="filteredSourceOptions"
            placeholder="Select a source"
            class="bg-white"
            @filter="filterSources"
          />
        </FormField>

        <NoticeBanner
          v-if="selectedSource && !selectedSource.isEnabled"
          tone="warn"
          :title="`${selectedSource.name} is paused`"
          message="It is not collecting events right now, so the sync will run and copy nothing until the source is enabled again."
        />
      </FormSection>

      <FormSection
        title="Destination"
        description="The warehouse connection this sync writes into, and the table it writes to."
      >
        <FormField
          label="DWH connection"
          required
          :error="errors.dwhConnectionId"
        >
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SelectableCard
              v-for="c in connections"
              :key="c.id"
              :selected="form.dwhConnectionId === c.id"
              :disabled="!isConnectionHealthy(c)"
              @select="form.dwhConnectionId = c.id"
            >
              <div class="flex w-full items-start justify-between gap-2">
                <span class="text-sm font-medium text-ink">{{ c.name }}</span>
                <StatusBadge
                  :tone="isConnectionHealthy(c) ? 'success' : 'danger'"
                  :label="isConnectionHealthy(c) ? 'Connected' : 'Failing'"
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
          for-id="dwh-sync-table"
          :error="errors.targetTable"
          hint="Created on the first run if it does not exist. Fully qualified: database.schema.table."
        >
          <input
            id="dwh-sync-table"
            v-model="form.targetTable"
            type="text"
            placeholder="FAN_PROD.PUBLIC.MATCHDAY_EVENTS"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
            @input="tableTouched = true"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Columns"
        description="Which parts of the event envelope become columns in the target table."
      >
        <DwhSyncColumnMap
          v-model="form.columns"
          label="Event columns"
          required
          :items="columnItems"
          hint="The key columns are always written; the rest are yours to choose."
          empty-title="Nothing to map"
        />
      </FormSection>

      <FormSection
        title="Schedule"
        description="When the sync runs, and whether it starts running at all."
      >
        <DwhSyncScheduleFields
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
          @click="router.push({ name: 'dwh-syncs' })"
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
import DwhSyncColumnMap from '@/components/warehouse/syncs/DwhSyncColumnMap.vue'
import DwhSyncScheduleFields from '@/components/warehouse/syncs/DwhSyncScheduleFields.vue'
import {
  defaultEventColumns,
  EVENT_COLUMNS,
  isConnectionHealthy,
  isCronLike,
  scheduleLabel,
  suggestTargetTable,
  useDwhSyncConnections,
  useDwhSyncSources,
  useDwhSyncToasts
} from '@/composables/useDwhSyncs'

const router = useRouter()
const { toast } = useDwhSyncToasts()

const {
  connections,
  loading: connectionsLoading,
  error: connectionsError,
  load: loadConnections,
  findById: findConnection
} = useDwhSyncConnections()

const {
  sources,
  loading: sourcesLoading,
  error: sourcesError,
  load: loadSources,
  findById: findSource
} = useDwhSyncSources()

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
  sourceId: '',
  dwhConnectionId: '',
  targetTable: '',
  columns: defaultEventColumns(),
  schedule: '0 * * * *',
  isEnabled: true
})

const errors = reactive({
  name: '',
  sourceId: '',
  dwhConnectionId: '',
  targetTable: '',
  schedule: ''
})

const columnItems = EVENT_COLUMNS.map(c => ({ ...c, column: c.id }))

const sourceOptions = computed(() =>
  sources.value.map(s => ({
    value: s.id,
    label: s.isEnabled ? s.name : `${s.name} (paused)`
  }))
)

// q-select's `use-input` filters nothing on its own — the needle arrives via
// @filter and the options prop has to narrow. Kept as a ref rather than a
// computed over a query string because the update callback is what q-select
// hands us.
const filteredSourceOptions = ref([])

function filterSources(needle, update) {
  update(() => {
    const q = needle.trim().toLowerCase()
    filteredSourceOptions.value = q
      ? sourceOptions.value.filter(o => o.label.toLowerCase().includes(q))
      : sourceOptions.value
  })
}

watch(sourceOptions, options => {
  filteredSourceOptions.value = options
})

const selectedSource = computed(() =>
  form.sourceId ? findSource(form.sourceId) : null
)

const selectedConnection = computed(() =>
  form.dwhConnectionId ? findConnection(form.dwhConnectionId) : null
)

// Reads the whole form back in one sentence, because what a sync actually does
// is spread over four sections.
const summary = computed(() => {
  const source = selectedSource.value?.name ?? 'the selected source'
  const where = form.targetTable || 'the target table'
  const connection = selectedConnection.value?.name ?? 'the selected warehouse'
  const when = scheduleLabel(form.schedule).toLowerCase()
  const count = form.columns.length
  const state = form.isEnabled ? '' : ' Created paused, so it will not run yet.'
  return `Copies events collected by ${source} into ${where} on ${connection}, ${when}, writing ${count} column${count === 1 ? '' : 's'} per event.${state}`
})

function connectionHint(connection) {
  if (!isConnectionHealthy(connection)) {
    return connection.lastError || 'This connection is failing. Fix it first.'
  }
  return `${connection.type} · ${connection.tableCount} tables`
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

  errors.sourceId = form.sourceId ? '' : 'Pick the source to copy events from.'

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
  router.push({ name: 'dwh-syncs' })
}

onMounted(() => {
  loadConnections()
  loadSources()
})
</script>
