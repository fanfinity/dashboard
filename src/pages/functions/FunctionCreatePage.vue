<template>
  <q-page class="p-6">
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Create a function"
        subtitle="Define what the function does, then write the code. A function receives one event and returns it, changes it, or returns nothing to drop it."
      />

      <NoticeBanner
        v-if="!isReal"
        class="mb-5"
        tone="warn"
        title="Demo data mode saves nothing"
        message="Creating a function needs the backend. Switch Settings → Data source to Real API before filling this in."
      />

      <!-- `grid`, not `flex flex-col`: Quasar's unlayered `.flex` forces
           `flex-wrap: wrap`, which stretches block children into a second
           column under a height cap. Grid `gap` has no Quasar counterpart. -->
      <div class="grid gap-5">
        <FormSection
          title="Function details"
          description="Give it a clear name so teammates understand why it exists."
        >
          <FormField
            label="Name"
            required
            for-id="function-name"
            hint="This name appears on the Functions page and on every pipe it runs on."
            :error="errors.name"
          >
            <SfereInput
              id="function-name"
              v-model="form.name"
              placeholder="e.g. Remove internal test traffic"
              autocomplete="off"
              :invalid="Boolean(errors.name)"
            />
          </FormField>

          <!-- Derived and overridable rather than asked for twice:
               `FunctionCreate` requires both `name` and `slug`, and nobody
               wants to type the same thing into two boxes. -->
          <FormField
            label="Slug"
            required
            for-id="function-slug"
            hint="The machine name Sfere uses. Derived from the name; change it if you need a specific one."
            :error="errors.slug"
          >
            <SfereInput
              id="function-slug"
              v-model="slugField"
              placeholder="remove-internal-test-traffic"
              autocomplete="off"
              :invalid="Boolean(errors.slug)"
            />
          </FormField>

          <FormField
            label="Description"
            optional
            for-id="function-description"
            hint="Describe what this function changes and why. The next person to see it is deciding whether it is safe to remove."
          >
            <SfereTextarea
              id="function-description"
              v-model="form.description"
              :rows="2"
            />
          </FormField>

          <!-- The kind is set HERE and nowhere else: `PUT …/functions/{id}`
               persists code only, so the detail page cannot offer to change it
               and does not pretend to. -->
          <FormField
            label="Type"
            required
            hint="This cannot be changed later — an update saves the code only."
          >
            <div
              role="group"
              aria-label="Function type"
              class="grid gap-3 sm:grid-cols-3"
            >
              <SelectableCard
                v-for="kind in FUNCTION_KINDS"
                :key="kind.value"
                :selected="form.kind === kind.value"
                @select="form.kind = kind.value"
              >
                <span class="grid gap-1.5">
                  <span class="flex items-center gap-2">
                    <SfereIcon name="function-f" size="md" />
                    <span class="text-sm font-semibold text-sfere-fg">{{
                      kind.label
                    }}</span>
                  </span>
                  <span class="text-xs text-sfere-fg-muted">{{
                    kind.description
                  }}</span>
                </span>
              </SelectableCard>
            </div>
          </FormField>
        </FormSection>

        <FormSection
          title="Code"
          description="JavaScript that receives an event and returns what continues down the pipe."
        >
          <FormField
            label="Function body"
            for-id="function-code"
            optional
            hint="Leave it blank to start from the backend's default for this type. The code is the one thing you can change afterwards."
          >
            <SfereTextarea
              id="function-code"
              v-model="form.code"
              :rows="14"
              class="font-sfere-mono!"
              :placeholder="placeholder"
            />
          </FormField>
        </FormSection>

        <!-- The same workbench the detail page renders, with its Run control
             absent: `POST …/functions/{id}/test` is keyed on a function id, and
             this function has none until it is created. -->
        <FunctionWorkbench
          :kind="form.kind"
          :can-run="false"
          cannot-run-reason="A test runs against a saved function, so it cannot run from here. Create the function and its own page runs this code against an event — nothing is ingested and nothing is delivered."
        />
      </div>

      <StickyActionBar>
        <SfereButton :loading="submitting" @click="submit"
          >Create function</SfereButton
        >
        <SfereButton variant="secondary" :to="{ name: 'functions' }"
          >Cancel</SfereButton
        >
        <p v-if="errors.form" class="min-w-0 flex-1 text-xs text-rose-600">{{
          errors.form
        }}</p>
      </StickyActionBar>
    </div>
  </q-page>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormField from '@/components/ui/FormField.vue'
import FormSection from '@/components/ui/FormSection.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
import FunctionWorkbench from '@/components/functions/FunctionWorkbench.vue'
import { useDataSource } from '@/composables/useDataSource'
import {
  FUNCTION_KINDS,
  slugify,
  useFunctions
} from '@/composables/useFunctions'
import { notifyMutationResult } from '@/composables/useMutationFeedback'

// `POST /v1/accounts/{account}/functions`, live as of backend PR #16.
const router = useRouter()
const $q = useQuasar()
const { isReal } = useDataSource()
const { create } = useFunctions()

const form = reactive({
  name: '',
  description: '',
  kind: 'transform',
  code: ''
})
const errors = reactive({ name: '', slug: '', form: '' })
const submitting = ref(false)

// The slug follows the name until someone edits it, then stops — a slug that
// keeps rewriting itself under an explicit choice is the more annoying failure.
const slugEdited = ref(false)
const slugManual = ref('')
const slugField = computed({
  get: () => (slugEdited.value ? slugManual.value : slugify(form.name)),
  set: value => {
    slugEdited.value = true
    slugManual.value = value
  }
})

watch(
  () => form.name,
  () => {
    if (!slugEdited.value) errors.slug = ''
  }
)

const placeholder = computed(() =>
  form.kind === 'filter'
    ? 'export default async function (event, { log }) {\n  // Return the event to keep it, or nothing to drop it.\n  if (event.context?.traits?.internal) return\n  return event\n}'
    : 'export default async function (event, { log }) {\n  return { ...event, tenant: "acme" }\n}'
)

function validate() {
  errors.name = form.name.trim() ? '' : 'Give the function a name.'
  const slug = slugField.value.trim()
  errors.slug = slug
    ? /^[a-z0-9-]+$/.test(slug)
      ? ''
      : 'A slug uses lower-case letters, numbers and hyphens only.'
    : 'A slug is required.'
  errors.form = errors.name || errors.slug ? 'Fix the fields above.' : ''
  return !errors.form
}

async function submit() {
  if (!validate()) {
    document
      .getElementById(errors.name ? 'function-name' : 'function-slug')
      ?.focus()
    return
  }
  submitting.value = true
  try {
    const res = await create({
      name: form.name.trim(),
      slug: slugField.value.trim(),
      description: form.description.trim(),
      kind: form.kind,
      code: form.code
    })
    notifyMutationResult($q, res, {
      success: `${form.name.trim()} created`,
      apiMissing: "Can't create a function yet."
    })
    if (res.ok && !res.skipped) {
      router.push({ name: 'functions-detail', params: { id: res.data.id } })
    }
  } finally {
    submitting.value = false
  }
}
</script>
