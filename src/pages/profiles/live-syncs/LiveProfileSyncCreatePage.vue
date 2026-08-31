<template>
  <q-page class="p-6">
    <PageHeader
      title="New live profile sync"
      subtitle="Pick the audience to deliver, where it lands, and the identifier the destination matches profiles on."
    />

    <!-- The audience is the primary resource: without one there is nothing to
         deliver, so its three non-populated states own the whole page. The
         destination and identifier catalogs are secondary and degrade inside
         their own section further down. -->
    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the audiences."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!audiences.length"
      title="No audiences to sync"
      description="A live profile sync delivers the profiles inside an audience. Build an audience first, then come back here."
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'audiences' })"
        >
          Go to audiences
        </button>
      </template>
    </EmptyState>

    <form v-else class="grid max-w-3xl gap-4" @submit.prevent="submit">
      <FormSection
        title="Basics"
        description="How this sync appears in lists and in delivery logs."
      >
        <FormField
          label="Name"
          required
          for-id="live-sync-name"
          :error="errors.name"
          hint="Name it after what it feeds, not how it works."
        >
          <input
            id="live-sync-name"
            v-model="form.name"
            type="text"
            placeholder="e.g. Meta custom audience for VIPs"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Audience"
        description="Every profile that enters this audience, or changes while inside it, is pushed to the destination."
      >
        <FormField
          label="Audience"
          required
          :error="errors.audienceId"
          hint="Only one audience per sync. Create a second sync for a second audience."
        >
          <q-select
            v-model="form.audienceId"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="audienceOptions"
            class="bg-white"
          />
        </FormField>

        <NoticeBanner
          v-if="selectedAudience"
          tone="info"
          :title="`${selectedAudience.name} currently resolves ${formatCount(selectedAudience.profileCount)} profiles.`"
          :message="audienceNotice"
        />
      </FormSection>

      <FormSection
        title="Destination"
        description="Where the profiles are delivered. One destination per sync."
      >
        <ErrorState
          v-if="destinationsError"
          title="Couldn't load the destinations."
          :message="destinationsError"
          @retry="loadDestinations"
        />

        <EmptyState
          v-else-if="!destinationsLoading && !destinations.length"
          variant="inline"
          title="No destinations configured"
          description="Connect a destination before a sync has anywhere to deliver."
        />

        <template v-else>
          <FormField
            label="Destination"
            required
            :error="errors.profileDestinationId"
            hint="Paused destinations can be selected, but deliver nothing until they are enabled."
          >
            <q-select
              v-model="form.profileDestinationId"
              dense
              outlined
              emit-value
              map-options
              options-dense
              :loading="destinationsLoading"
              :disable="destinationsLoading"
              :options="destinationOptions"
              class="bg-white"
            />
          </FormField>

          <NoticeBanner
            v-if="selectedDestination && !selectedDestination.isEnabled"
            tone="warn"
            :title="`${selectedDestination.name} is paused.`"
            message="Nothing will be delivered until the destination itself is enabled."
          />
        </template>
      </FormSection>

      <FormSection
        title="Matching and delivery"
        description="The identifier the destination matches a profile on, and how eagerly the sync pushes."
      >
        <ErrorState
          v-if="identifierTypesError"
          title="Couldn't load the identifier types."
          :message="identifierTypesError"
          @retry="loadIdentifierTypes"
        />

        <EmptyState
          v-else-if="!identifierTypesLoading && !identifierTypes.length"
          variant="inline"
          title="No identifier types defined"
          description="A sync needs at least one identifier type to key deliveries on."
        />

        <FormField
          v-else
          label="Keyed on"
          required
          :error="errors.identifierTypeId"
          :hint="identifierHint"
        >
          <q-select
            v-model="form.identifierTypeId"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :loading="identifierTypesLoading"
            :disable="identifierTypesLoading"
            :options="identifierTypeOptions"
            class="bg-white"
          />
        </FormField>

        <FormField
          label="Delivery mode"
          hint="Real-time pushes each change as it happens. Batched collects changes and delivers them together."
        >
          <div class="flex items-center gap-2">
            <button
              v-for="opt in MODE_OPTIONS"
              :key="opt.value"
              type="button"
              class="rounded-lg border px-3 py-1.5 text-sm"
              :class="
                form.mode === opt.value
                  ? 'border-brand/40 bg-brand/5 font-medium text-brand'
                  : 'border-line2 bg-white text-muted hover:bg-fill'
              "
              @click="form.mode = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </FormField>

        <FormField
          label="State on creation"
          hint="A paused sync keeps its configuration but delivers nothing."
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
          {{ saving ? 'Creating…' : 'Create live sync' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'live-profile-syncs' })"
        >
          Cancel
        </button>
        <p class="text-xs text-subtle"
          >Nothing is persisted yet. There is no backend behind this form.</p
        >
      </StickyActionBar>
    </form>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
import {
  formatCount,
  modeLabel,
  useLiveProfileSyncAudiences,
  useLiveProfileSyncDestinations,
  useLiveProfileSyncIdentifierTypes,
  useLiveProfileSyncToasts
} from '@/composables/useLiveProfileSyncs'

const router = useRouter()
const { toast } = useLiveProfileSyncToasts()

// Primary resource.
const { audiences, loading, error, load } = useLiveProfileSyncAudiences()

// Secondary resources: each keeps its own loading/error so a failure stays
// inside the section it belongs to instead of taking the form down.
const {
  destinations,
  loading: destinationsLoading,
  error: destinationsError,
  load: loadDestinations
} = useLiveProfileSyncDestinations()

const {
  identifierTypes,
  loading: identifierTypesLoading,
  error: identifierTypesError,
  load: loadIdentifierTypes
} = useLiveProfileSyncIdentifierTypes()

const MODE_OPTIONS = [
  { label: modeLabel('realtime'), value: 'realtime' },
  { label: modeLabel('batch'), value: 'batch' }
]

const STATE_OPTIONS = [
  { label: 'Live', value: true },
  { label: 'Paused', value: false }
]

const saving = ref(false)

const form = reactive({
  name: '',
  audienceId: '',
  profileDestinationId: '',
  identifierTypeId: '',
  mode: 'realtime',
  isEnabled: true
})

const errors = reactive({
  name: '',
  audienceId: '',
  profileDestinationId: '',
  identifierTypeId: ''
})

const audienceOptions = computed(() =>
  audiences.value.map(a => ({
    label: `${a.name} · ${formatCount(a.profileCount)} profiles`,
    value: a.id
  }))
)

// The workspace's configured destinations. A profile destination is not a
// separate record in this mock — the syncs carry the delivered-to name inline —
// so the catalog offered here is the destination list every other screen reads.
const destinationOptions = computed(() =>
  destinations.value.map(d => ({
    label: d.isEnabled ? d.name : `${d.name} (paused)`,
    value: d.id
  }))
)

const identifierTypeOptions = computed(() =>
  identifierTypes.value.map(t => ({
    label: `${t.displayName} · ${t.name}`,
    value: t.id
  }))
)

const selectedAudience = computed(
  () => audiences.value.find(a => a.id === form.audienceId) ?? null
)

const selectedDestination = computed(
  () => destinations.value.find(d => d.id === form.profileDestinationId) ?? null
)

const selectedIdentifierType = computed(
  () => identifierTypes.value.find(t => t.id === form.identifierTypeId) ?? null
)

const audienceNotice = computed(() => {
  const a = selectedAudience.value
  if (!a) return ''
  const kind =
    a.type === 'realtime' ? 'evaluated in real time' : 'warehouse-backed'
  return `It is ${kind}${a.isEnabled ? '' : ' and currently paused'}. Profiles are delivered as they enter it and whenever they change inside it.`
})

// Which sources actually produce the chosen identifier, so the person picking it
// can tell whether their audience will carry one at all.
const identifierHint = computed(() => {
  const t = selectedIdentifierType.value
  if (!t) return 'Profiles carrying no value for this identifier are skipped.'
  const sources = [...new Set((t.eventTypes ?? []).map(e => e.sourceName))]
  const collected = sources.length
    ? `Collected by ${sources.join(', ')}.`
    : 'No source currently collects this identifier.'
  return `${collected} Profiles carrying no ${t.name} are skipped.`
})

function validate() {
  errors.name = form.name.trim() ? '' : 'A name is required.'
  errors.audienceId = form.audienceId ? '' : 'Pick the audience to deliver.'
  errors.profileDestinationId = form.profileDestinationId
    ? ''
    : 'Pick where the profiles land.'
  errors.identifierTypeId = form.identifierTypeId
    ? ''
    : 'Pick the identifier the destination matches on.'

  return (
    !errors.name &&
    !errors.audienceId &&
    !errors.profileDestinationId &&
    !errors.identifierTypeId
  )
}

// Choosing an audience seeds an empty name from it, but never overwrites
// something the user has already typed.
watch(
  () => form.audienceId,
  id => {
    const audience = audiences.value.find(a => a.id === id)
    if (audience && !form.name.trim()) form.name = `${audience.name} sync`
  }
)

function submit() {
  if (!validate()) return
  saving.value = true

  // No POST to make. The sync is announced and the user is returned to the
  // list, which re-reads the mock JSON — so the new sync is deliberately not
  // there. Pretending otherwise would be the dishonest option.
  toast(`“${form.name.trim()}” configured`)

  saving.value = false
  router.push({ name: 'live-profile-syncs' })
}

onMounted(() => {
  load()
  loadDestinations()
  loadIdentifierTypes()
})
</script>
