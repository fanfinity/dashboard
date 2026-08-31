<template>
  <div class="flex flex-col gap-4">
    <!-- Connection test. A FAILED test is a result, not a fetch error: the
         request succeeded in telling us the credential is bad. So it renders as
         a red panel carrying the backend's own message and never as ErrorState,
         which the smoke gate reads as "this screen is broken". -->
    <CardPanel>
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink">Connection</span>
          <p class="mt-0.5! text-xs text-muted"
            >Checks the stored credential against the upstream system, without
            pulling anything.</p
          >
        </div>
        <SfereButton
          class="shrink-0"
          size="sm"
          variant="secondary"
          :loading="testing"
          @click="emit('test')"
          >Test connection</SfereButton
        >
      </template>

      <p v-if="!testResult" class="text-sm text-muted"
        >Not tested in this session. A test does not change anything and is safe
        to run at any time.</p
      >

      <NoticeBanner
        v-else-if="testResult.ok"
        tone="success"
        title="The connection works"
        :message="testSuccessMessage"
      />

      <NoticeBanner
        v-else
        tone="danger"
        title="The connection failed"
        :message="
          testResult.error ||
          'The upstream system refused the stored credential and gave no reason.'
        "
      />
    </CardPanel>

    <!-- Sync schedule -->
    <CardPanel>
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink">Sync schedule</span>
          <p class="mt-0.5! text-xs text-muted"
            >When Sfere pulls from this source on its own. Running a sync by
            hand below is always available regardless.</p
          >
        </div>
        <StatusBadge
          v-if="schedule"
          class="shrink-0"
          :tone="scheduleDraft.isEnabled ? 'success' : 'neutral'"
          :label="scheduleDraft.isEnabled ? 'Scheduled' : 'Manual only'"
        />
      </template>

      <LoadingState v-if="scheduleLoading" variant="form" :rows="3" />

      <ErrorState
        v-else-if="scheduleError"
        title="Couldn't load the sync schedule."
        :message="scheduleError"
        @retry="emit('reload-schedule')"
      />

      <NoticeBanner
        v-else-if="scheduleApiMissing"
        tone="info"
        title="No API yet"
        message="The sync schedule is live as of backend PR #16, and Demo data mode has no fixture for it. Switch Settings → Data source to Real API to edit it."
      />

      <div v-else class="flex flex-col gap-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-ink">Run on a schedule</p>
            <p class="mt-1! max-w-2xl text-sm text-muted">
              Off means this source is only ever pulled when someone asks. That
              is a reasonable setting for a one-off import and a bad one for a
              live store.
            </p>
          </div>
          <SfereToggle
            v-model="scheduleDraft.isEnabled"
            class="shrink-0"
            label="Run on a schedule"
          />
        </div>

        <FormField
          label="Cron expression"
          for-id="sync-cron"
          :optional="!scheduleDraft.isEnabled"
          hint="Standard five-field cron, in the time zone below. Left blank, the backend picks its own cadence."
          :error="errors.cron"
        >
          <SfereInput
            id="sync-cron"
            v-model="scheduleDraft.cron"
            placeholder="0 */6 * * *"
            autocomplete="off"
          />
        </FormField>

        <FormField
          label="Time zone"
          for-id="sync-timezone"
          hint="What the cron expression is read in."
        >
          <SfereInput
            id="sync-timezone"
            v-model="scheduleDraft.timezone"
            placeholder="UTC"
            autocomplete="off"
          />
        </FormField>

        <FormField
          label="Mode"
          for-id="sync-mode"
          hint="What each scheduled run pulls."
        >
          <SfereSelect
            id="sync-mode"
            v-model="scheduleDraft.mode"
            :options="modeOptions"
          />
        </FormField>

        <DefinitionList :items="scheduleFacts" :columns="2" />

        <div class="flex flex-wrap items-center gap-3">
          <SfereButton
            size="sm"
            :loading="scheduleSaving"
            :disabled="!scheduleDirty"
            @click="save"
            >Save schedule</SfereButton
          >
          <p v-if="errors.form" class="min-w-0 flex-1 text-xs text-rose-600">{{
            errors.form
          }}</p>
        </div>
      </div>
    </CardPanel>

    <!-- Catalog -->
    <CardPanel>
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink">What to pull</span>
          <p class="mt-0.5! text-xs text-muted"
            >The entities this connector exposes. Only the selected ones are
            synced.</p
          >
        </div>
        <SfereButton
          class="shrink-0"
          size="sm"
          variant="secondary"
          :loading="discovering"
          @click="emit('discover')"
          >{{ catalog ? 'Re-discover' : 'Discover' }}</SfereButton
        >
      </template>

      <!-- `pending` is a LOADING state, not an empty one. An empty entity list
           under a true `pending` means nobody has finished asking the connector
           — rendering it as "this connector exposes nothing" would tell someone
           their store has no tables. -->
      <LoadingState
        v-if="catalogLoading || catalogPending"
        variant="grid"
        :rows="3"
      />

      <ErrorState
        v-else-if="catalogError"
        title="Couldn't load this source's catalog."
        :message="catalogError"
        @retry="emit('reload-catalog')"
      />

      <NoticeBanner
        v-else-if="catalogApiMissing"
        tone="info"
        title="No API yet"
        message="Catalog discovery is live as of backend PR #16, and Demo data mode has no fixture for it. Switch Settings → Data source to Real API to use it."
      />

      <!-- The connector's own error, surfaced rather than swallowed. A failed
           discovery is a result with a reason attached. -->
      <NoticeBanner
        v-else-if="catalog?.error"
        tone="danger"
        title="Discovery failed"
        :message="catalog.error"
      />

      <EmptyState
        v-else-if="!entities.length"
        title="Nothing discovered yet"
        description="Ask the connector what it can pull. Discovery reads schemas only; it moves no data."
      >
        <template #cta>
          <SfereButton
            size="sm"
            :loading="discovering"
            @click="emit('discover')"
            >Discover entities</SfereButton
          >
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-3">
        <p class="text-xs text-subtle"
          >Discovered {{ formatDateTime(catalog.discoveredAt, NOT_KNOWN) }}.</p
        >

        <div class="flex flex-col gap-2">
          <label
            v-for="entity in entities"
            :key="entity.key"
            class="flex cursor-pointer items-start gap-2.5 rounded-sfere-lg border border-sfere-line bg-white px-3 py-2.5 hover:bg-sfere-fill"
          >
            <input
              v-model="selectedKeys"
              type="checkbox"
              :value="entity.key"
              class="mt-0.5 size-4 shrink-0 accent-sfere-500"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-sfere-fg">{{
                entity.name
              }}</span>
              <span class="block text-xs text-sfere-fg-muted">
                <code class="font-sfere-mono">{{ entity.key }}</code>
                · {{ modeSummary(entity) }} · {{ rowSummary(entity) }}
              </span>
            </span>
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <SfereButton
            size="sm"
            :disabled="!selectionDirty"
            @click="emit('save-selection', [...selectedKeys])"
            >Save selection</SfereButton
          >
          <p v-if="selectionDirty" class="min-w-0 flex-1 text-xs text-subtle"
            >The endpoint takes the whole selection, so unticking is how you
            stop pulling something.</p
          >
        </div>
      </div>
    </CardPanel>
  </div>
</template>

<script setup>
import { NOT_KNOWN, NEVER, NOT_SET } from '@/lib/emptyValue'
import { computed, reactive, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereSelect from '@/components/ui/SfereSelect.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { SYNC_MODES } from '@/composables/useSourceCatalogAPI'
import { formatCount, formatDateTime } from '@/composables/useSources'

// Everything you set up before a pull-based source can sync: does the credential
// work, how often should it run, and which of the connector's entities matter.
//
// All four endpoints behind this went live in backend PR #16
// (`POST …/test`, `POST …/discover`, `GET/PUT …/catalog`,
// `GET/PUT …/sync-schedule`). It sits above the run history rather than beside
// it because the history is the consequence of these three settings.
const props = defineProps({
  testResult: { type: Object, default: null },
  testing: { type: Boolean, default: false },

  schedule: { type: Object, default: null },
  scheduleLoading: { type: Boolean, default: false },
  scheduleSaving: { type: Boolean, default: false },
  scheduleError: { type: String, default: null },
  scheduleApiMissing: { type: Boolean, default: false },

  catalog: { type: Object, default: null },
  catalogLoading: { type: Boolean, default: false },
  catalogPending: { type: Boolean, default: false },
  catalogError: { type: String, default: null },
  catalogApiMissing: { type: Boolean, default: false },
  discovering: { type: Boolean, default: false }
})

const emit = defineEmits([
  'test',
  'discover',
  'save-schedule',
  'save-selection',
  'reload-schedule',
  'reload-catalog'
])

const modeOptions = SYNC_MODES.map(m => ({ value: m.value, label: m.label }))

// ------------------------------------------------------------------ test

const testSuccessMessage = computed(() => {
  const r = props.testResult
  if (!r) return ''
  const latency =
    r.latencyMs == null
      ? 'The backend did not report a round-trip time.'
      : `Round trip ${formatCount(r.latencyMs)}ms.`
  return `Checked ${formatDateTime(r.checkedAt, NOT_KNOWN)}. ${latency}`
})

// -------------------------------------------------------------- schedule

const scheduleDraft = reactive({
  isEnabled: false,
  cron: '',
  timezone: 'UTC',
  mode: 'incremental'
})
const errors = reactive({ cron: '', form: '' })

function seedSchedule() {
  const s = props.schedule
  scheduleDraft.isEnabled = Boolean(s?.isEnabled)
  scheduleDraft.cron = s?.cron ?? ''
  scheduleDraft.timezone = s?.timezone || 'UTC'
  scheduleDraft.mode = s?.mode || 'incremental'
  errors.cron = ''
  errors.form = ''
}

watch(() => props.schedule, seedSchedule, { immediate: true })

const scheduleDirty = computed(() => {
  const s = props.schedule
  if (!s) return false
  return (
    scheduleDraft.isEnabled !== s.isEnabled ||
    (scheduleDraft.cron || '') !== (s.cron || '') ||
    scheduleDraft.timezone !== s.timezone ||
    scheduleDraft.mode !== s.mode
  )
})

const scheduleFacts = computed(() => {
  const s = props.schedule
  return [
    // `NOT_SET` rather than `NEVER`: a next run that is absent because nothing
    // is scheduled is an unfilled field the user can fix, not an event that
    // will not happen.
    {
      label: 'Next run',
      value: formatDateTime(s?.nextRunAt, NOT_SET)
    },
    // `NEVER` is right here — a source that has not synced yet genuinely has
    // no last run.
    {
      label: 'Last run',
      value: formatDateTime(s?.lastRunAt, NEVER)
    }
  ]
})

function save() {
  errors.cron = ''
  errors.form = ''
  const cron = scheduleDraft.cron.trim()
  // Five fields, loosely checked. Refusing an obviously wrong expression here
  // beats a 422 whose message is about a field name.
  if (cron && cron.split(/\s+/).length !== 5) {
    errors.cron = 'A cron expression has five space-separated fields.'
    errors.form =
      'Fix the cron expression, or clear it to let the backend choose.'
    return
  }
  emit('save-schedule', {
    isEnabled: scheduleDraft.isEnabled,
    cron: cron || null,
    timezone: scheduleDraft.timezone.trim() || 'UTC',
    mode: scheduleDraft.mode
  })
}

// --------------------------------------------------------------- catalog

const entities = computed(() => props.catalog?.entities ?? [])

const selectedKeys = ref([])

watch(
  entities,
  list => {
    selectedKeys.value = list.filter(e => e.selected).map(e => e.key)
  },
  { immediate: true }
)

const selectionDirty = computed(() => {
  const current = entities.value
    .filter(e => e.selected)
    .map(e => e.key)
    .sort()
    .join(',')
  return [...selectedKeys.value].sort().join(',') !== current
})

function modeSummary(entity) {
  if (!entity.supportedModes.length) return `Modes ${NOT_KNOWN}`
  return entity.supportedModes
    .map(m => SYNC_MODES.find(s => s.value === m)?.label ?? m)
    .join(' / ')
}

// NOT `formatCount(0)`. An estimate the connector did not supply is unknown, and
// "0 rows" about a table nobody counted is a measurement nobody took.
function rowSummary(entity) {
  return entity.recordCountEstimate == null
    ? `Rows ${NOT_KNOWN}`
    : `~${formatCount(entity.recordCountEstimate)} rows`
}
</script>
