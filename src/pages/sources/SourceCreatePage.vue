<template>
  <q-page class="p-6">
    <!-- The guided source flow, as one page in three steps rather than three
         routes.
         WHY ONE PAGE: the three steps share the form state — the intent picks
         the template, the template names the source, the created source is what
         the install guide needs a key from. Three routes would mean threading
         all of it through query params or a store, and a reload mid-flow would
         land on step 3 with nothing to install. This way a reload restarts the
         flow cleanly, which is the honest behaviour.
         The `<h1>` comes from PageHeader and never changes identity, so
         `pnpm smoke:dist` sees one titled screen regardless of which step is
         showing. -->
    <PageHeader :title="headerTitle" :subtitle="headerSubtitle">
      <template #actions>
        <SfereButton
          v-if="step === 'install'"
          size="sm"
          :to="{ name: 'destinations-new' }"
          >Add a destination →</SfereButton
        >
        <SfereButton
          v-else
          variant="secondary"
          size="sm"
          @click="router.push({ name: 'sources' })"
          >Cancel</SfereButton
        >
      </template>
    </PageHeader>

    <div class="mb-6 max-w-3xl">
      <SetupStepper
        :steps="STEPS"
        :current="stepIndex"
        aria-label="Add a source"
      />
    </div>

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
        <SfereButton variant="secondary" :to="{ name: 'sources' }"
          >Back to sources</SfereButton
        >
      </template>
    </EmptyState>

    <!-- STEP 1 — what are you connecting? -->
    <div v-else-if="step === 'intent'" class="grid max-w-5xl gap-5">
      <SourceIntentPicker
        v-model="intent"
        :available-template-ids="templateIds"
      />

      <StickyActionBar align="end">
        <p v-if="!intent" class="text-xs text-subtle">Pick one to continue.</p>
        <SfereButton :disabled="!intent" @click="continueFromIntent">{{
          continueLabel
        }}</SfereButton>
      </StickyActionBar>
    </div>

    <!-- STEP 2 — name it and set it up. -->
    <form
      v-else-if="step === 'configure'"
      class="grid max-w-4xl gap-4"
      @submit.prevent="submit"
    >
      <!-- One template behind the chosen intent: settled, shown as a fact with a
           way back, rather than a one-option picker asking a question that has
           only one answer. Two or more: a real choice. -->
      <FormSection
        v-if="intentTemplates.length > 1"
        title="Which one?"
        :description="`${chosenIntent?.title} covers ${intentTemplates.length} templates. Pick the platform you are wiring up.`"
      >
        <SourceTemplatePicker
          v-model="form.templateId"
          :templates="intentTemplates"
        />
        <p v-if="errors.templateId" class="text-xs text-rose-500">{{
          errors.templateId
        }}</p>
      </FormSection>

      <div
        v-else
        class="flex flex-wrap items-center justify-between gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill px-4 py-3"
      >
        <!-- `min-w-0 flex-1` throughout this file for the same reason: Quasar's
             unlayered `.flex { flex-wrap: wrap }` outranks Tailwind's
             `flex-nowrap`, so a text child wider than the row jumps to its own
             line and strands the control beside it. -->
        <p class="min-w-0 flex-1 text-sm text-muted">
          Setting up
          <span class="font-medium text-ink">{{ selectedTemplate?.name }}</span>
          — {{ selectedTemplate?.description }}
        </p>
        <SfereButton variant="ghost" size="sm" @click="backToIntent"
          >Change</SfereButton
        >
      </div>

      <FormSection
        title="Details"
        description="How this source appears in lists, and the slug its ingest endpoint uses."
      >
        <FormField
          label="Name"
          required
          for-id="source-name"
          :error="errors.name"
          hint="Shown everywhere this source is referenced — pick something a teammate will recognise."
        >
          <SfereInput
            id="source-name"
            v-model="form.name"
            placeholder="e.g. Matchday web tracker"
          />
        </FormField>

        <FormField
          label="Slug"
          required
          for-id="source-slug"
          :error="errors.slug"
          :hint="slugHint"
        >
          <SfereInput
            id="source-slug"
            v-model="form.slug"
            placeholder="matchday-web-tracker"
            @update:model-value="slugTouched = true"
          />
        </FormField>

        <FormField
          label="Description"
          optional
          for-id="source-description"
          hint="One line of context for whoever inherits this."
        >
          <SfereTextarea
            id="source-description"
            v-model="form.description"
            :rows="3"
            placeholder="First-party web tracker on sfere.io"
          />
        </FormField>

        <FormField
          v-if="isZid"
          label="Zid store ID"
          required
          for-id="source-store-id"
          :error="errors.storeId"
          hint="The store this source connects to — found in your Zid dashboard."
        >
          <SfereInput
            id="source-store-id"
            v-model="form.storeId"
            placeholder="e.g. 12345678"
          />
        </FormField>
      </FormSection>

      <!-- Keys and strict mode. Both are decided at create time and both are
           easy to get wrong, so each carries its own sentence about what it is
           for rather than a bare label. -->
      <FormSection
        v-if="issuesWriteKey"
        title="Keys"
        description="Generated when you save. You never have to invent one."
      >
        <div
          class="rounded-sfere-lg border border-sfere-line bg-sfere-fill px-4 py-3"
        >
          <p class="text-sm font-medium text-ink">Browser write key</p>
          <p class="mt-1 text-xs text-muted">
            Public by design — it belongs in client-side code, the same way a
            Google Analytics or Meta Pixel id does. Issued automatically.
          </p>
        </div>

        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink"
              >Also issue a server-to-server key</p
            >
            <p class="mt-1 text-xs text-muted">
              Only if you will also send events from your own backend for this
              source. Keep that one private — never in client-side code.
            </p>
          </div>
          <SfereToggle
            v-model="form.serverKey"
            label="Issue a server-to-server key"
          />
        </div>

        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink">Strict mode</p>
            <p class="mt-1 text-xs text-muted">
              Off while you are wiring things up: an event arriving without a
              valid key is still matched to this source by domain. Turn it on
              once you are confident, so a mistyped key fails loudly instead of
              landing somewhere quietly wrong.
            </p>
          </div>
          <SfereToggle v-model="form.strictMode" label="Strict mode" />
        </div>
      </FormSection>

      <FormSection
        title="State on creation"
        description="A paused source keeps its configuration but accepts no events."
      >
        <div class="flex items-center gap-2">
          <button
            v-for="opt in STATE_OPTIONS"
            :key="opt.label"
            type="button"
            class="rounded-sfere px-3 py-1.5 text-sm transition duration-150 ease-sfere-ui"
            :class="
              form.isEnabled === opt.value
                ? 'border border-sfere-300 bg-sfere-50 font-medium text-sfere-brand-text'
                : 'border border-sfere-line bg-white text-muted hover:bg-sfere-fill'
            "
            @click="form.isEnabled = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </FormSection>

      <StickyActionBar>
        <SfereButton type="submit" :loading="saving">{{
          saving ? 'Creating…' : 'Create source →'
        }}</SfereButton>
        <SfereButton variant="secondary" @click="backToIntent"
          >Back</SfereButton
        >
        <p v-if="!isReal" class="min-w-0 flex-1 text-xs text-subtle"
          >Demo data mode — this will walk you through setup but save nothing.
          Switch Settings → Data source to real to persist.</p
        >
      </StickyActionBar>
    </form>

    <!-- STEP 3 — install and confirm. -->
    <div v-else class="grid max-w-4xl gap-4">
      <NoticeBanner
        v-if="preview"
        tone="warn"
        title="Nothing was saved"
        message="You are in Demo data mode, so this source exists only on this screen. The snippets below are the right shape but the key is not a real key. Switch Settings → Data source to real and create it again to go live."
      />

      <SourceInstallGuide
        :source="created"
        :preview="preview"
        @copy="copyValue"
        @verified="onVerified"
      />

      <StickyActionBar>
        <SfereButton :to="{ name: 'destinations-new' }"
          >Add a destination →</SfereButton
        >
        <SfereButton
          v-if="!preview"
          variant="secondary"
          :to="{ name: 'sources-detail', params: { id: created.id } }"
          >Open this source</SfereButton
        >
        <SfereButton variant="ghost" :to="{ name: 'sources' }"
          >I'll finish this later</SfereButton
        >
      </StickyActionBar>
    </div>
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
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
import SetupStepper from '@/components/sources/SetupStepper.vue'
import SourceIntentPicker from '@/components/sources/SourceIntentPicker.vue'
import SourceInstallGuide from '@/components/sources/SourceInstallGuide.vue'
import SourceTemplatePicker from '@/components/sources/SourceTemplatePicker.vue'
import { intentByKey } from '@/config/sourceIntents'
import { slugify, useSourceTemplates } from '@/composables/useSources'
import { useSourcesAPI } from '@/composables/useSourcesAPI'
import { useDataSource } from '@/composables/useDataSource'

const router = useRouter()
const $q = useQuasar()
const { templates, loading, error, load, findById } = useSourceTemplates()
const { isReal } = useDataSource()
const { create: createSourceReal } = useSourcesAPI()

const STEPS = [
  { key: 'intent', label: 'What are you connecting?' },
  { key: 'configure', label: 'Add the source' },
  { key: 'install', label: 'Install & confirm' }
]

const STATE_OPTIONS = [
  { label: 'Enabled', value: true },
  { label: 'Paused', value: false }
]

const step = ref('intent')
const intent = ref('')
const saving = ref(false)
const slugTouched = ref(false)
const created = ref(null)
const preview = ref(false)

const stepIndex = computed(() =>
  Math.max(
    0,
    STEPS.findIndex(s => s.key === step.value)
  )
)

const form = reactive({
  templateId: '',
  name: '',
  slug: '',
  description: '',
  storeId: '',
  isEnabled: true,
  serverKey: false,
  strictMode: false
})

const errors = reactive({ templateId: '', name: '', slug: '', storeId: '' })

const templateIds = computed(() => templates.value.map(t => t.id))

const chosenIntent = computed(() => intentByKey(intent.value))

const intentTemplates = computed(() => {
  const ids = chosenIntent.value?.templates ?? []
  return templates.value.filter(t => ids.includes(t.id))
})

const selectedTemplate = computed(() => findById(form.templateId))

const isZid = computed(() => form.templateId === 'zid')

// A cloud app is polled, so no key is ever issued for it and the Keys section
// would be describing something that does not exist.
const issuesWriteKey = computed(
  () => selectedTemplate.value?.sourceType !== 'cloud_app'
)

const continueLabel = computed(() =>
  chosenIntent.value
    ? `Continue with ${chosenIntent.value.title.replace(/^(A|An|My own) /, '')} →`
    : 'Continue →'
)

const headerTitle = computed(() => {
  if (step.value === 'install')
    return `Install & confirm — ${created.value?.name}`
  if (step.value === 'configure' && selectedTemplate.value) {
    return `Add a ${selectedTemplate.value.name} source`
  }
  return 'Connect a source'
})

const headerSubtitle = computed(() => {
  if (step.value === 'install') {
    return 'Pick how you want to send events. You can add another method later.'
  }
  if (step.value === 'configure') {
    return 'This creates the place your events land. Setup instructions come right after.'
  }
  return "Tell us what you're tracking — we'll show you exactly what to do next."
})

const slugHint = computed(
  () =>
    `Lowercase letters, numbers and dashes. Used in the ingest endpoint: /v1/${form.slug || 'your-slug'}`
)

function continueFromIntent() {
  const chosen = chosenIntent.value
  if (!chosen) return

  // The one intent that is not a template: browsing connectors is a different
  // screen, so send them there instead of into a form.
  if (chosen.to) {
    router.push(chosen.to)
    return
  }

  // A single-template intent is settled by the intent itself — nobody should
  // have to pick "Web SDK" after saying "a website".
  if (intentTemplates.value.length === 1) {
    form.templateId = intentTemplates.value[0].id
  } else if (!intentTemplates.value.some(t => t.id === form.templateId)) {
    form.templateId = ''
  }

  step.value = 'configure'
}

function backToIntent() {
  step.value = 'intent'
}

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
  errors.storeId =
    isZid.value && !form.storeId.trim()
      ? 'A Zid source needs its store ID.'
      : ''

  if (!form.slug.trim()) {
    errors.slug = 'A slug is required.'
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
    errors.slug = 'Use lowercase letters, numbers and single dashes only.'
  } else {
    errors.slug = ''
  }

  return !errors.templateId && !errors.name && !errors.slug && !errors.storeId
}

async function submit() {
  if (!validate()) return
  saving.value = true

  // Real mode: POST to the backend, then step straight into the install guide
  // for the source that now exists — the write key it returns is what the
  // snippets need, so this is the only moment the flow can hand it over without
  // a second fetch.
  if (isReal.value) {
    try {
      // The zid and web-sdk templates map to the backend's own source types —
      // both provision a Jitsu stream + write key + ClickHouse destination and
      // pipeline in the create call.
      const sourceType = isZid.value
        ? 'zid'
        : form.templateId === 'web-sdk'
          ? 'web'
          : (findById(form.templateId)?.sourceType ?? null)

      const result = await createSourceReal({
        name: form.name.trim(),
        slug: form.slug.trim(),
        sourceType,
        templateId: form.templateId || null,
        storeId: isZid.value ? form.storeId.trim() : null
      })

      $q.notify({
        message: `“${form.name.trim()}” created`,
        color: 'positive',
        position: 'top-right',
        timeout: 2500
      })

      // The backend owns the write key and the type; the template id is ours and
      // is what picks the right snippets, so carry it across explicitly rather
      // than hoping the response echoes it.
      created.value = {
        ...result,
        templateId: form.templateId,
        sourceType: result.sourceType ?? sourceType,
        slug: result.slug ?? form.slug.trim(),
        name: result.name ?? form.name.trim()
      }
      preview.value = false
      step.value = 'install'
    } catch (e) {
      $q.notify({
        message: `Couldn't create source: ${e.message || 'request failed'}`,
        color: 'negative',
        position: 'top-right',
        timeout: 4000
      })
    } finally {
      saving.value = false
    }
    return
  }

  // Demo data mode: nothing is persisted, and the list will not show it. The
  // flow still continues to step 3 so the setup instructions can be reviewed —
  // marked `preview`, which is what makes the guide say so on screen rather
  // than implying a live source.
  created.value = {
    id: 'preview',
    name: form.name.trim(),
    slug: form.slug.trim(),
    templateId: form.templateId,
    sourceType: selectedTemplate.value?.sourceType ?? null,
    writeKey: 'sfere_wk_preview_not_a_real_key'
  }
  preview.value = true
  step.value = 'install'
  saving.value = false
}

async function copyValue({ label, value }) {
  try {
    await navigator.clipboard.writeText(value)
    $q.notify({
      message: `${label} copied`,
      color: 'dark',
      position: 'top-right',
      timeout: 1500
    })
  } catch {
    $q.notify({
      message: `Couldn't copy ${label.toLowerCase()}`,
      color: 'negative',
      position: 'top-right',
      timeout: 2500
    })
  }
}

function onVerified() {
  if (preview.value) return
  $q.notify({
    message: 'Source verified — events are arriving',
    caption: 'Add a destination next so they have somewhere to go.',
    color: 'positive',
    position: 'top-right',
    timeout: 3000
  })
}

onMounted(load)
</script>
