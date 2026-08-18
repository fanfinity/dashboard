<template>
  <q-page class="p-6">
    <PageHeader
      title="New destination"
      :subtitle="
        selected
          ? `Configure the ${selected.name} template and give it credentials.`
          : 'Pick the template that matches where these events should land.'
      "
    >
      <template #actions>
        <button
          v-if="selected"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="clearTemplate"
        >
          Change template
        </button>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'destinations' })"
        >
          Cancel
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="grid" :rows="6" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the destination templates."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!templates.length"
      title="No destination templates available"
      description="This workspace has no destination templates enabled, so there is nothing to create from yet."
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'destinations' })"
        >
          Back to destinations
        </button>
      </template>
    </EmptyState>

    <!-- Step 1 — template picker. -->
    <div v-else-if="!selected" class="flex flex-col gap-4">
      <ToolbarSearch v-model="query" placeholder="Search templates..." />

      <div
        v-if="visibleTemplates.length"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <DestinationTemplateCard
          v-for="t in visibleTemplates"
          :key="t.id"
          :template="t"
          @select="pick"
        />
      </div>

      <EmptyState
        v-else
        title="No templates match your search"
        :description="`None of the ${templates.length} templates match “${query}”.`"
      >
        <template #cta>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="query = ''"
          >
            Clear search
          </button>
        </template>
      </EmptyState>
    </div>

    <!-- Step 2 — configure the chosen template. -->
    <form v-else class="flex max-w-2xl flex-col gap-4" @submit.prevent="submit">
      <FormSection
        title="Basics"
        description="How this destination appears in lists and pipe pickers."
      >
        <FormField
          label="Name"
          required
          for-id="destination-name"
          :error="errors.name"
        >
          <input
            id="destination-name"
            v-model="form.name"
            type="text"
            placeholder="e.g. Meta CAPI — production"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          label="Description"
          hint="Optional. One line on why this destination exists."
          for-id="destination-description"
        >
          <input
            id="destination-description"
            v-model="form.description"
            type="text"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField label="Template">
          <div class="flex flex-wrap items-center gap-2">
            <StatusBadge tone="brand" :label="templateBadgeLabel" />
            <span class="text-xs text-subtle">{{ selected.description }}</span>
          </div>
        </FormField>
      </FormSection>

      <FormSection
        v-if="paramKeys.length"
        title="Configuration"
        :description="`Parameters ${selected.name} needs in order to deliver.`"
      >
        <DestinationParamFields
          v-model="form.params"
          :schema="selected.paramsSchema"
          :errors="errors.params"
          id-prefix="destination-param"
        />
      </FormSection>

      <FormSection
        v-if="selected.secrets?.length"
        title="Credentials"
        description="Stored as workspace secrets and referenced by key — never shown again after saving."
      >
        <FormField
          v-for="secret in selected.secrets"
          :key="secret.keyPrefix"
          :label="secret.keyPrefix"
          :hint="secret.description"
          :error="errors.secrets[secret.keyPrefix] || ''"
          :for-id="`destination-secret-${secret.keyPrefix}`"
          required
        >
          <input
            :id="`destination-secret-${secret.keyPrefix}`"
            :value="form.secrets[secret.keyPrefix] ?? ''"
            type="password"
            autocomplete="off"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
            @input="setSecret(secret.keyPrefix, $event.target.value)"
          />
        </FormField>
      </FormSection>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create destination' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'destinations' })"
        >
          Cancel
        </button>
      </div>

      <p class="text-xs text-subtle"
        >No backend is connected to this screen yet — creating a destination
        updates this session only and is gone on reload.</p
      >
    </form>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import DestinationTemplateCard from '@/components/destinations/DestinationTemplateCard.vue'
import DestinationParamFields from '@/components/destinations/DestinationParamFields.vue'
import {
  useDestinationTemplates,
  useDestinationToasts
} from '@/composables/useDestinations'

const router = useRouter()
const { templates, loading, error, load } = useDestinationTemplates()
const { toast } = useDestinationToasts()

const query = ref('')
const selected = ref(null)
const saving = ref(false)

const form = ref({ name: '', description: '', params: {}, secrets: {} })
const errors = ref(blankErrors())

const visibleTemplates = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return templates.value
  return templates.value.filter(t =>
    [t.name, t.description, ...(t.tags || [])].some(v =>
      String(v ?? '')
        .toLowerCase()
        .includes(q)
    )
  )
})

// The template's JSON Schema drives both the rendered fields and the validation
// below, so a template that gains a parameter needs no code change here.
const paramKeys = computed(() =>
  Object.keys(selected.value?.paramsSchema?.properties ?? {})
)
const requiredParams = computed(
  () => selected.value?.paramsSchema?.required ?? []
)

const templateBadgeLabel = computed(() =>
  selected.value ? `${selected.value.id} · ${selected.value.version}` : ''
)

function blankErrors() {
  return { name: '', params: {}, secrets: {} }
}

function pick(template) {
  selected.value = template
  errors.value = blankErrors()
  // Templates ship `defaults` so the form opens pre-filled the way the catalog
  // intends; both fields stay editable.
  form.value = {
    name: template.defaults?.name ?? template.name,
    description: template.defaults?.description ?? '',
    params: {},
    secrets: {}
  }
}

function clearTemplate() {
  selected.value = null
  errors.value = blankErrors()
}

function setSecret(key, value) {
  form.value.secrets = { ...form.value.secrets, [key]: value }
}

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

function validate() {
  const next = blankErrors()

  if (isBlank(form.value.name)) next.name = 'A destination name is required.'

  for (const key of requiredParams.value) {
    if (isBlank(form.value.params[key])) {
      next.params[key] = 'This parameter is required.'
    }
  }

  for (const secret of selected.value.secrets ?? []) {
    if (isBlank(form.value.secrets[secret.keyPrefix])) {
      next.secrets[secret.keyPrefix] = 'This credential is required.'
    }
  }

  errors.value = next
  return (
    !next.name &&
    !Object.keys(next.params).length &&
    !Object.keys(next.secrets).length
  )
}

function submit() {
  if (!validate()) return
  saving.value = true
  // No backend to await, and writing back to public/data would be a lie in a
  // file other packets read — so the toast says what actually happened.
  toast(
    `“${form.value.name}” created from ${selected.value.name} — demo data, nothing was saved.`
  )
  saving.value = false
  router.push({ name: 'destinations' })
}

onMounted(load)
</script>
