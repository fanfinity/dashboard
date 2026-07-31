<template>
  <q-page class="p-6">
    <PageHeader
      title="New pipe"
      subtitle="Pick the source to read from and the destination to write to. A pipe carries one to the other."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'pipes' })"
        >
          All pipes
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load sources and destinations."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!canBuild"
      :title="emptyTitle"
      :description="emptyDescription"
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="
            router.push({ name: sources.length ? 'destinations' : 'sources' })
          "
        >
          {{ sources.length ? 'Go to destinations' : 'Go to sources' }}
        </button>
      </template>
    </EmptyState>

    <!-- Created: there is no backend, so the new pipe cannot be opened on the
         detail screen. Confirming it here is honest and keeps the user moving. -->
    <div v-else-if="created" class="flex max-w-3xl flex-col gap-4">
      <CardPanel>
        <template #header>
          <span class="text-sm font-medium text-ink">{{ created.name }}</span>
          <StatusBadge
            :enabled="created.isEnabled"
            :label="created.isEnabled ? 'Enabled' : 'Paused'"
          />
        </template>

        <PipeFlow
          :source-label="created.sourceName"
          :source-hint="created.sourceSlug"
          :destination-label="created.eventDestinationName"
          :destination-hint="created.eventDestinationSlug"
          :transform="created.hasFunctionCode"
        />

        <p class="mt-4 text-sm text-muted"
          >Created in this session only. There is no backend behind this screen,
          so the pipe is not stored and will not appear in the list.</p
        >
      </CardPanel>

      <div class="flex items-center gap-2">
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="createAnother"
        >
          Create another
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'pipes' })"
        >
          Back to pipes
        </button>
      </div>
    </div>

    <form v-else class="flex max-w-3xl flex-col gap-4" @submit.prevent="submit">
      <FormSection
        title="Basics"
        description="How this pipe appears in the list and in monitoring."
      >
        <FormField
          label="Name"
          required
          for="pipe-name"
          :error="errors.name"
          hint="Something a teammate can recognise, e.g. “Web SDK to Snowflake”."
        >
          <input
            id="pipe-name"
            v-model="form.name"
            type="text"
            placeholder="e.g. Ticketing to BigQuery"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField hint="A paused pipe is created but delivers nothing.">
          <label class="flex items-center gap-2 text-sm text-ink">
            <input
              v-model="form.isEnabled"
              type="checkbox"
              class="size-4 accent-brand"
            />
            Enable this pipe straight away
          </label>
        </FormField>
      </FormSection>

      <FormSection
        title="Route"
        description="One source in, one destination out. A source and destination pair can only be joined once."
      >
        <FormField
          label="Source"
          required
          :error="errors.sourceId"
          :hint="sourceHint"
        >
          <q-select
            v-model="form.sourceId"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="sourceOptions"
            class="bg-white"
          />
        </FormField>

        <FormField
          label="Destination"
          required
          :error="errors.eventDestinationId"
          :hint="destinationHint"
        >
          <q-select
            v-model="form.eventDestinationId"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="destinationOptions"
            class="bg-white"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Transformation"
        description="Optional. Filter, enrich or reshape events between the two ends."
      >
        <FormField
          hint="The function itself is edited on the pipe once it exists."
        >
          <label class="flex items-center gap-2 text-sm text-ink">
            <input
              v-model="form.hasFunctionCode"
              type="checkbox"
              class="size-4 accent-brand"
            />
            Run a custom function on every event
          </label>
        </FormField>

        <FormField
          label="Destination parameters"
          for="pipe-params"
          :error="errors.destinationParams"
          hint='A JSON object handed to the destination, e.g. {"table": "raw_web_events"}. Leave blank to use its defaults.'
        >
          <textarea
            id="pipe-params"
            v-model="form.destinationParams"
            rows="4"
            placeholder='{ "table": "raw_web_events" }'
            class="min-h-[96px] rounded-lg border border-line2 bg-white px-2.5 py-2 font-mono text-sm text-ink outline-none placeholder:text-subtle"
          ></textarea>
        </FormField>
      </FormSection>

      <CardPanel>
        <template #header>
          <span class="text-sm font-medium text-ink">Preview</span>
        </template>
        <PipeFlow
          :source-label="selectedSource?.name || ''"
          :source-hint="selectedSource?.slug || ''"
          :destination-label="selectedDestination?.name || ''"
          :destination-hint="selectedDestination?.slug || ''"
          :transform="form.hasFunctionCode"
        />
      </CardPanel>

      <div class="flex items-center gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create pipe' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'pipes' })"
        >
          Cancel
        </button>
      </div>
    </form>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import FormField from '@/components/ui/FormField.vue'
import FormSection from '@/components/ui/FormSection.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import PipeFlow from '@/components/pipes/PipeFlow.vue'
import { useMockResource } from '@/composables/useMockResource'
import { makePipeId, usePipes } from '@/composables/usePipes'

const router = useRouter()
const $q = useQuasar()

const {
  data: sources,
  loading: sourcesLoading,
  error: sourcesError,
  load: loadSources
} = useMockResource('sources')

const {
  data: destinations,
  loading: destinationsLoading,
  error: destinationsError,
  load: loadDestinations
} = useMockResource('destinations')

// Loaded for one reason only: to refuse a duplicate route before the user
// submits one.
const {
  loading: pipesLoading,
  error: pipesError,
  load: loadPipes,
  findRoute,
  addPipe
} = usePipes()

const loading = computed(
  () => sourcesLoading.value || destinationsLoading.value || pipesLoading.value
)
const error = computed(
  () => sourcesError.value || destinationsError.value || pipesError.value
)

async function load() {
  await Promise.all([loadSources(), loadDestinations(), loadPipes()])
}

const blank = () => ({
  name: '',
  sourceId: '',
  eventDestinationId: '',
  hasFunctionCode: false,
  isEnabled: true,
  destinationParams: ''
})

const form = reactive(blank())
const errors = reactive({
  name: '',
  sourceId: '',
  eventDestinationId: '',
  destinationParams: ''
})
const saving = ref(false)
const created = ref(null)

// A pipe needs both ends, so either collection being empty is the same dead end.
const canBuild = computed(
  () => sources.value.length > 0 && destinations.value.length > 0
)

const emptyTitle = computed(() =>
  sources.value.length ? 'No destinations yet' : 'No sources yet'
)

const emptyDescription = computed(() =>
  sources.value.length
    ? 'A pipe needs somewhere to deliver to. Connect a destination first, then come back.'
    : 'A pipe needs something to read from. Connect a source first, then come back.'
)

const sourceOptions = computed(() =>
  sources.value.map(s => ({
    label: s.isEnabled ? s.name : `${s.name} (paused)`,
    value: s.id
  }))
)

const destinationOptions = computed(() =>
  destinations.value.map(d => ({
    label: d.isEnabled ? d.name : `${d.name} (paused)`,
    value: d.id
  }))
)

const selectedSource = computed(
  () => sources.value.find(s => s.id === form.sourceId) ?? null
)

const selectedDestination = computed(
  () => destinations.value.find(d => d.id === form.eventDestinationId) ?? null
)

// A paused endpoint is a legal choice — it just will not move anything yet, and
// saying so up front is cheaper than a support ticket about a silent pipe.
const sourceHint = computed(() =>
  selectedSource.value && !selectedSource.value.isEnabled
    ? 'This source is paused, so the pipe will sit idle until it is enabled.'
    : 'Where the events come from.'
)

const destinationHint = computed(() =>
  selectedDestination.value && !selectedDestination.value.isEnabled
    ? 'This destination is paused, so deliveries will queue until it is enabled.'
    : 'Where the events are delivered.'
)

function parseParams() {
  const raw = form.destinationParams.trim()
  if (!raw) return {}
  const parsed = JSON.parse(raw)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('object')
  }
  return parsed
}

function validate() {
  errors.name = ''
  errors.sourceId = ''
  errors.eventDestinationId = ''
  errors.destinationParams = ''

  if (!form.name.trim()) {
    errors.name = 'Give the pipe a name.'
  } else if (form.name.trim().length < 3) {
    errors.name = 'Use at least 3 characters.'
  }

  if (!form.sourceId) errors.sourceId = 'Pick a source.'
  if (!form.eventDestinationId) {
    errors.eventDestinationId = 'Pick a destination.'
  } else if (
    form.sourceId &&
    findRoute(form.sourceId, form.eventDestinationId)
  ) {
    errors.eventDestinationId =
      'A pipe already joins this source to this destination.'
  }

  try {
    parseParams()
  } catch {
    errors.destinationParams =
      'Enter a valid JSON object, or leave the field blank.'
  }

  return !Object.values(errors).some(Boolean)
}

async function submit() {
  if (!validate()) return
  saving.value = true

  const source = selectedSource.value
  const destination = selectedDestination.value
  const now = new Date().toISOString()

  const pipe = {
    id: makePipeId(form.name),
    name: form.name.trim(),
    sourceId: source.id,
    sourceName: source.name,
    sourceSlug: source.slug,
    sourceType: source.sourceType,
    eventDestinationId: destination.id,
    eventDestinationName: destination.name,
    eventDestinationSlug: destination.slug,
    isEnabled: form.isEnabled,
    version: 1,
    hasFunctionCode: form.hasFunctionCode,
    destinationParams: parseParams(),
    createdAt: now,
    updatedAt: now,
    deliveryCountLastHour: 0
  }

  addPipe(pipe)
  created.value = pipe
  saving.value = false

  $q.notify({
    message: `“${pipe.name}” created — nothing was saved, this preview has no backend.`,
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}

function createAnother() {
  Object.assign(form, blank())
  created.value = null
}

onMounted(load)
</script>
