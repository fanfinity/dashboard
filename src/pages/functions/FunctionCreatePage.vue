<template>
  <q-page class="p-6">
    <PageHeader
      title="Write a function"
      subtitle="A function receives one event and returns it, changes it, or returns nothing to drop it."
    />

    <NoticeBanner
      v-if="!isReal"
      class="mb-5"
      tone="warn"
      title="Demo data mode saves nothing"
      message="Creating a function needs the backend. Switch Settings → Data source to Real API before filling this in."
    />

    <div class="flex flex-col gap-5">
      <FormSection
        title="Identity"
        description="What this function is called, and what it does to an event."
      >
        <FormField
          label="Name"
          required
          for-id="function-name"
          hint="What it does, in a few words. This is the label on every pipe it runs on."
          :error="errors.name"
        >
          <SfereInput
            id="function-name"
            v-model="form.name"
            placeholder="e.g. Drop internal test traffic"
            autocomplete="off"
          />
        </FormField>

        <!-- Derived and overridable rather than asked for twice: `FunctionCreate`
             requires both `name` and `slug`, and nobody wants to type the same
             thing in two boxes. -->
        <FormField
          label="Slug"
          required
          for-id="function-slug"
          hint="The machine name. Derived from the name; change it if you need a specific one."
          :error="errors.slug"
        >
          <SfereInput
            id="function-slug"
            v-model="slugField"
            placeholder="drop-internal-test-traffic"
            autocomplete="off"
          />
        </FormField>

        <FormField
          label="Description"
          optional
          for-id="function-description"
          hint="Why it exists. Worth a sentence — the next person to see this is deciding whether it is safe to remove."
        >
          <SfereTextarea
            id="function-description"
            v-model="form.description"
            :rows="2"
          />
        </FormField>

        <FormField label="Kind" required for-id="function-kind">
          <div id="function-kind" class="flex flex-col gap-2">
            <label
              v-for="kind in FUNCTION_KINDS"
              :key="kind.value"
              class="flex cursor-pointer items-start gap-2.5 rounded-sfere border border-sfere-line bg-white px-3 py-2.5 hover:bg-sfere-fill"
            >
              <input
                v-model="form.kind"
                type="radio"
                :value="kind.value"
                class="mt-0.5 size-4 shrink-0 accent-sfere-500"
              />
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-sfere-fg">{{
                  kind.label
                }}</span>
                <span class="block text-xs text-sfere-fg-muted">{{
                  kind.description
                }}</span>
              </span>
            </label>
          </div>
        </FormField>
      </FormSection>

      <FormSection
        title="Code"
        description="Plain JavaScript. It receives the event and returns what should continue down the pipe."
      >
        <FormField
          label="Function body"
          for-id="function-code"
          optional
          hint="Leave blank to start from the backend's default for this kind. You can edit and test it on the detail page afterwards."
        >
          <SfereTextarea
            id="function-code"
            v-model="form.code"
            :rows="12"
            class="font-sfere-mono!"
            :placeholder="placeholder"
          />
        </FormField>
      </FormSection>
    </div>

    <StickyActionBar>
      <SfereButton :loading="submitting" @click="submit"
        >Create function</SfereButton
      >
      <SfereButton variant="secondary" :to="{ name: 'functions' }"
        >Back to functions</SfereButton
      >
      <p v-if="errors.form" class="min-w-0 flex-1 text-xs text-rose-600">{{
        errors.form
      }}</p>
    </StickyActionBar>
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
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
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
const slugField = computed({
  get: () => (slugEdited.value ? slugManual.value : slugify(form.name)),
  set: value => {
    slugEdited.value = true
    slugManual.value = value
  }
})
const slugManual = ref('')

watch(
  () => form.name,
  () => {
    if (!slugEdited.value) errors.slug = ''
  }
)

const placeholder = computed(() =>
  form.kind === 'filter'
    ? 'export default function (event) {\n  // Return the event to keep it, or nothing to drop it.\n  if (event.context?.traits?.internal) return\n  return event\n}'
    : 'export default function (event) {\n  return { ...event, tenant: "acme" }\n}'
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
