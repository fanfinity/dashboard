<template>
  <q-page class="p-6">
    <PageHeader
      title="New source"
      subtitle="Pick a template, name the stream, and start collecting fan events."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'sources' })"
        >
          Cancel
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the source templates."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!templates.length"
      title="No source templates available"
      description="Your workspace has no ingestion templates enabled yet. Ask an admin to enable one."
    >
      <template #cta>
        <button
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click="router.push({ name: 'sources' })"
        >
          Back to sources
        </button>
      </template>
    </EmptyState>

    <form v-else class="flex max-w-4xl flex-col gap-4" @submit.prevent="submit">
      <FormSection
        title="Template"
        description="Templates ship the ingestion contract and the event types the source will emit."
      >
        <TabNav v-model="typeTab" :tabs="typeTabs" />

        <SourceTemplatePicker
          v-model="form.templateId"
          :templates="visibleTemplates"
        />

        <p v-if="errors.templateId" class="text-xs text-rose-500">{{
          errors.templateId
        }}</p>
      </FormSection>

      <FormSection
        title="Details"
        description="How this source appears in lists, and the slug its ingest endpoint uses."
      >
        <FormField
          label="Name"
          required
          for="source-name"
          :error="errors.name"
          hint="Shown everywhere this source is referenced."
        >
          <input
            id="source-name"
            v-model="form.name"
            type="text"
            placeholder="e.g. Matchday web tracker"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          label="Slug"
          required
          for="source-slug"
          :error="errors.slug"
          :hint="slugHint"
        >
          <input
            id="source-slug"
            v-model="form.slug"
            type="text"
            placeholder="matchday-web-tracker"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
            @input="slugTouched = true"
          />
        </FormField>

        <FormField
          label="Description"
          for="source-description"
          hint="Optional. One line of context for whoever inherits this."
        >
          <textarea
            id="source-description"
            v-model="form.description"
            rows="3"
            placeholder="First-party web tracker on sfere.io"
            class="rounded-lg border border-line2 bg-white px-2.5 py-2 text-sm text-ink outline-none placeholder:text-subtle"
          ></textarea>
        </FormField>

        <FormField
          label="State on creation"
          hint="A paused source keeps its configuration but accepts no events."
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

      <div class="flex items-center gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create source' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'sources' })"
        >
          Cancel
        </button>
        <p class="text-xs text-subtle"
          >Nothing is persisted yet — there is no backend behind this form.</p
        >
      </div>
    </form>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SourceTemplatePicker from '@/components/sources/SourceTemplatePicker.vue'
import { slugify, useSourceTemplates } from '@/composables/useSources'

const router = useRouter()
const $q = useQuasar()
const { templates, loading, error, load, findById } = useSourceTemplates()

const STATE_OPTIONS = [
  { label: 'Enabled', value: true },
  { label: 'Paused', value: false }
]

const typeTab = ref('all')
const saving = ref(false)
// The slug follows the name until the user edits it, then it is theirs.
const slugTouched = ref(false)

const form = reactive({
  templateId: '',
  name: '',
  slug: '',
  description: '',
  isEnabled: true
})

const errors = reactive({ templateId: '', name: '', slug: '' })

const typeTabs = computed(() => [
  { key: 'all', label: 'All', count: templates.value.length },
  {
    key: 'event_stream',
    label: 'Event streams',
    count: templates.value.filter(t => t.sourceType === 'event_stream').length
  },
  {
    key: 'cloud_app',
    label: 'Cloud apps',
    count: templates.value.filter(t => t.sourceType === 'cloud_app').length
  }
])

const visibleTemplates = computed(() =>
  typeTab.value === 'all'
    ? templates.value
    : templates.value.filter(t => t.sourceType === typeTab.value)
)

const slugHint = computed(
  () =>
    `Lowercase letters, numbers and dashes. Used in the ingest endpoint: /v1/${form.slug || 'your-slug'}`
)

// Picking a template seeds the name from its defaults, but never overwrites
// something the user has already typed.
watch(
  () => form.templateId,
  id => {
    const template = findById(id)
    if (!template) return
    if (!form.name.trim()) form.name = template.defaults?.name ?? template.name
  }
)

watch(
  () => form.name,
  name => {
    if (!slugTouched.value) form.slug = slugify(name)
  }
)

function validate() {
  errors.templateId = form.templateId ? '' : 'Pick a source template.'
  errors.name = form.name.trim() ? '' : 'A source name is required.'

  if (!form.slug.trim()) {
    errors.slug = 'A slug is required.'
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
    errors.slug = 'Use lowercase letters, numbers and single dashes only.'
  } else {
    errors.slug = ''
  }

  return !errors.templateId && !errors.name && !errors.slug
}

function submit() {
  if (!validate()) return
  saving.value = true

  // No POST to make. The record is announced and the user is returned to the
  // list, which re-reads the mock JSON — so the new source is deliberately not
  // there. Pretending otherwise would be the dishonest option.
  $q.notify({
    message: `“${form.name.trim()}” configured`,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })

  saving.value = false
  router.push({ name: 'sources' })
}

onMounted(load)
</script>
