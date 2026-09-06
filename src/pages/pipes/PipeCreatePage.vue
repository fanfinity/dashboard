<template>
  <q-page class="p-6">
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="New pipe"
        subtitle="Connect a source to a destination. A pipe carries one to the other, and functions can run in between."
      />

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
          <SfereButton
            :to="{ name: sources.length ? 'destinations' : 'sources' }"
            >{{
              sources.length ? 'Go to destinations' : 'Go to sources'
            }}</SfereButton
          >
        </template>
      </EmptyState>

      <!-- Demo data mode: nothing was written, so the screen says so instead of
           sending the reader to a detail page for a record that does not
           exist. -->
      <div v-else-if="created" class="grid max-w-3xl gap-4">
        <CardPanel>
          <template #header>
            <span class="text-sm font-medium text-ink">{{ created.name }}</span>
            <StatusBadge
              :tone="created.isEnabled ? 'success' : 'neutral'"
              :label="created.isEnabled ? 'Enabled' : 'Paused'"
            />
          </template>

          <FlowChain
            :source="previewSource"
            :destination="previewDestination"
            :is-enabled="created.isEnabled"
          />

          <p class="mt-4! text-sm text-muted"
            >Created in this session only. Demo data mode has no backend behind
            it, so the pipe is not stored and will not appear in the list.</p
          >
        </CardPanel>

        <div class="flex flex-wrap items-center gap-3">
          <SfereButton @click="createAnother">Create another</SfereButton>
          <SfereButton variant="secondary" :to="{ name: 'pipes' }"
            >Back to pipes</SfereButton
          >
        </div>
      </div>

      <!-- A grid, not `flex flex-col`: Quasar's unlayered `.flex` forces
           `flex-wrap: wrap`, which stretches block children. `max-w-3xl` inside
           the page's 1400px cap on purpose — a wide page is not a licence for
           1300px-wide text inputs. -->
      <form v-else class="grid max-w-3xl gap-4" @submit.prevent="submit">
        <FormSection
          title="Basics"
          description="Give this pipe a recognisable name and decide whether it should start straight away."
        >
          <FormField
            label="Name"
            required
            for-id="pipe-name"
            :error="errors.name"
            hint="This is how the pipe appears in the list and in monitoring."
          >
            <SfereInput
              id="pipe-name"
              v-model="form.name"
              placeholder="e.g. Marketing website to Sfere Data Warehouse"
              :invalid="Boolean(errors.name)"
              described-by="pipe-name-error"
            />
          </FormField>

          <FormField
            hint="A paused pipe is created but delivers nothing until you enable it."
          >
            <SfereCheckbox
              v-model="form.isEnabled"
              label="Enable this pipe straight away"
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Route"
          description="One source in, one destination out. A source and destination pair can only be joined once."
        >
          <FormField
            label="Source"
            required
            for-id="pipe-source"
            :error="errors.sourceId"
            :hint="sourceHint"
          >
            <SfereSelect
              id="pipe-source"
              v-model="form.sourceId"
              :options="sourceOptions"
              placeholder="Choose a source"
            />
          </FormField>

          <FormField
            label="Destination"
            required
            for-id="pipe-destination"
            :error="errors.eventDestinationId"
            :hint="destinationHint"
          >
            <SfereSelect
              id="pipe-destination"
              v-model="form.eventDestinationId"
              :options="destinationOptions"
              placeholder="Choose a destination"
            />
          </FormField>

          <!-- The route as it will be, redrawn on every change. Same component
               the pipe's own screen uses, so the preview and the record look
               like the same thing. -->
          <div
            class="rounded-sfere-xl border border-sfere-line bg-sfere-fill p-4"
          >
            <FlowChain
              :source="previewSource"
              :destination="previewDestination"
              :is-enabled="form.isEnabled"
            />
          </div>
        </FormSection>

        <!-- No function picker here, and that is the backend's shape rather
             than a shortcut: `PipelineCreate` is name, source and destination
             and nothing else, and functions are attached through a separate
             endpoint that needs the pipe to exist first. Saying so beats a
             picker whose choices are silently dropped on submit. -->
        <FormSection
          title="Functions"
          description="Optional, and added after the pipe exists."
        >
          <p class="text-sm text-muted">
            Functions filter, enrich or reshape events on the way through. They
            are attached on the pipe's own screen, under its Functions tab, once
            it has been created — a pipe has to exist before anything can run on
            it.
          </p>
        </FormSection>

        <StickyActionBar>
          <SfereButton type="submit" :loading="saving">{{
            saving ? 'Creating…' : 'Create pipe'
          }}</SfereButton>
          <SfereButton variant="secondary" :to="{ name: 'pipes' }"
            >Cancel</SfereButton
          >
        </StickyActionBar>
      </form>
    </div>
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
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereCheckbox from '@/components/ui/SfereCheckbox.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereSelect from '@/components/ui/SfereSelect.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
import FlowChain from '@/components/flow/FlowChain.vue'
import { makePipeId, usePipes } from '@/composables/usePipes'
import { useSources } from '@/composables/useSources'
import { useDestinations } from '@/composables/useDestinations'
import { usePipelinesAPI } from '@/composables/usePipelinesAPI'
import { useDataSource } from '@/composables/useDataSource'

const router = useRouter()
const $q = useQuasar()

// The wired composables, so the source/destination pickers show real records
// in real mode (and mock JSON otherwise) — a pipe must join two real ends.
const {
  sources,
  loading: sourcesLoading,
  error: sourcesError,
  load: loadSources
} = useSources()

const {
  destinations,
  loading: destinationsLoading,
  error: destinationsError,
  load: loadDestinations
} = useDestinations()

const { isReal } = useDataSource()
const { create: createPipelineReal } = usePipelinesAPI()

// Loaded to refuse a duplicate route before the user submits one — and, on the
// "create it paused" path, to make the new pipe present locally before
// `setEnabled` patches it.
const {
  loading: pipesLoading,
  error: pipesError,
  load: loadPipes,
  findRoute,
  addPipe,
  setEnabled
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
  isEnabled: true
})

const form = reactive(blank())
const errors = reactive({ name: '', sourceId: '', eventDestinationId: '' })
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

// The preview draws whichever ends are chosen so far, and says so where one is
// still missing rather than rendering an unnamed box. No status on either node:
// the picker's records carry an enabled flag, not a health reading.
const previewSource = computed(() => ({
  name: selectedSource.value?.name || 'Choose a source',
  hint: selectedSource.value?.slug || '',
  subtype: selectedSource.value?.sourceType ?? '',
  isEnabled: selectedSource.value
    ? selectedSource.value.isEnabled !== false
    : true
}))

const previewDestination = computed(() => ({
  name: selectedDestination.value?.name || 'Choose a destination',
  hint: selectedDestination.value?.slug || '',
  subtype: selectedDestination.value?.destinationType ?? '',
  isEnabled: selectedDestination.value
    ? selectedDestination.value.isEnabled !== false
    : true
}))

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

function validate() {
  errors.name = ''
  errors.sourceId = ''
  errors.eventDestinationId = ''

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

  return !Object.values(errors).some(Boolean)
}

async function submit() {
  if (!validate()) return
  saving.value = true

  const source = selectedSource.value
  const destination = selectedDestination.value
  const name = form.name.trim()

  // Real mode: create the pipeline (the Jitsu link) on the backend and open it.
  if (isReal.value) {
    try {
      const record = await createPipelineReal({
        name,
        sourceId: source.id,
        destinationId: destination.id
      })

      // `PipelineCreate` carries no `is_enabled`, so a pipe asked for paused is
      // created enabled and then patched. `PipelineUpdate` accepts that one
      // field and nothing else. The reload is what puts the new row in this
      // composable's list, which `setEnabled` looks the record up in.
      if (!form.isEnabled) {
        await loadPipes()
        await setEnabled(record.id, false)
      }

      $q.notify({
        message: form.isEnabled
          ? `“${name}” created`
          : `“${name}” created, paused`,
        color: 'positive',
        position: 'bottom',
        timeout: 2500
      })
      router.push({ name: 'pipes-detail', params: { id: record.id } })
    } catch (e) {
      $q.notify({
        message: `Couldn't create pipe: ${e.message || 'request failed'}`,
        color: 'negative',
        position: 'bottom',
        timeout: 4000
      })
    } finally {
      saving.value = false
    }
    return
  }

  const now = new Date().toISOString()

  const pipe = {
    id: makePipeId(name),
    name,
    sourceId: source.id,
    sourceName: source.name,
    sourceSlug: source.slug,
    sourceType: source.sourceType,
    eventDestinationId: destination.id,
    eventDestinationName: destination.name,
    eventDestinationSlug: destination.slug,
    isEnabled: form.isEnabled,
    createdAt: now,
    updatedAt: now
  }

  addPipe(pipe)
  created.value = pipe
  saving.value = false

  $q.notify({
    message: `“${pipe.name}” created. Nothing was saved, because Demo data mode has no backend.`,
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
