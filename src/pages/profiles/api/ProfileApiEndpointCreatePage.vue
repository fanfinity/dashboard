<template>
  <q-page class="p-6">
    <PageHeader
      title="New Profile API endpoint"
      subtitle="Name the lookup, choose what a caller may search by, and choose what comes back."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'profile-api' })"
        >
          Cancel
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="6" />

    <!-- Both catalogs are primary here: without them there is no form to fill,
         so a failure in either is a page-level failure. -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load the identifier types and attributes."
      :message="error"
      @retry="loadAll"
    />

    <EmptyState
      v-else-if="!identifierTypes.length || !attributes.length"
      :title="emptyTitle"
      :description="emptyDescription"
    >
      <template #cta>
        <button
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click="router.push({ name: 'profile-api' })"
        >
          Back to Profile API
        </button>
      </template>
    </EmptyState>

    <form v-else class="grid max-w-4xl gap-4" @submit.prevent="submit">
      <FormSection
        title="Details"
        description="How this endpoint appears in lists, and the path callers will hit."
      >
        <FormField
          label="Name"
          required
          for-id="endpoint-name"
          :error="errors.name"
          hint="Shown everywhere this endpoint is referenced."
        >
          <input
            id="endpoint-name"
            v-model="form.name"
            type="text"
            placeholder="e.g. Matchday kiosk"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          label="Slug"
          required
          for-id="endpoint-slug"
          :error="errors.slug"
          :hint="slugHint"
        >
          <input
            id="endpoint-slug"
            v-model="form.slug"
            type="text"
            placeholder="matchday-kiosk"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
            @input="slugTouched = true"
          />
        </FormField>

        <FormField
          label="Description"
          for-id="endpoint-description"
          hint="Optional. One line on who calls this and why."
        >
          <textarea
            id="endpoint-description"
            v-model="form.description"
            rows="3"
            placeholder="Ticket-reference lookup used by the stadium kiosk screens."
            class="rounded-lg border border-line2 bg-white px-2.5 py-2 text-sm text-ink outline-none placeholder:text-subtle"
          ></textarea>
        </FormField>
      </FormSection>

      <FormSection
        title="Lookup"
        description="Which identifier types a caller may search a fan by. One identifier per request."
      >
        <ProfileApiIdentifierPicker
          v-model="form.identifierTypeIds"
          :identifier-types="identifierTypes"
        />

        <p v-if="errors.identifierTypeIds" class="text-xs text-rose-500">{{
          errors.identifierTypeIds
        }}</p>
      </FormSection>

      <FormSection
        title="Response"
        description="Which attributes come back. Everything else about the fan stays behind the wall."
      >
        <ProfileApiAttributePicker
          v-model="form.attributes"
          :attributes="attributes"
        />

        <p v-if="errors.attributes" class="text-xs text-rose-500">{{
          errors.attributes
        }}</p>
      </FormSection>

      <FormSection
        title="Access"
        description="Who may call this endpoint, and how hard."
      >
        <FormField
          label="Protection mode"
          hint="A protected endpoint needs a token carrying the profiles:read scope."
        >
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="opt in PROTECTION_OPTIONS"
              :key="opt.value"
              type="button"
              class="rounded-lg border px-3 py-1.5 text-sm"
              :class="
                form.protection === opt.value
                  ? 'border-brand/40 bg-brand/5 font-medium text-brand'
                  : 'border-line2 bg-white text-muted hover:bg-fill'
              "
              @click="form.protection = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </FormField>

        <NoticeBanner
          v-if="form.protection === 'public'"
          tone="warn"
          title="An unprotected endpoint answers anyone who knows the URL"
          message="Fan attributes would leave the platform with no audit trail. Keep it protected unless the response carries nothing personal."
        />

        <FormField
          label="Rate limit"
          hint="Requests per minute, across all callers."
        >
          <q-select
            v-model="form.rateLimitPerMinute"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="RATE_LIMIT_OPTIONS"
            class="bg-white"
          />
        </FormField>

        <FormField
          label="Cache"
          hint="How long a resolved profile may be served from cache."
        >
          <q-select
            v-model="form.cacheTtlSeconds"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="CACHE_TTL_OPTIONS"
            class="bg-white"
          />
        </FormField>

        <FormField
          label="State on creation"
          hint="A paused endpoint keeps its configuration but answers nothing."
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
          {{ saving ? 'Creating…' : 'Create endpoint' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'profile-api' })"
        >
          Cancel
        </button>
        <p class="text-xs text-subtle"
          >Nothing is persisted yet — there is no backend behind this form.</p
        >
      </StickyActionBar>
    </form>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
import ProfileApiIdentifierPicker from '@/components/profiles/api/ProfileApiIdentifierPicker.vue'
import ProfileApiAttributePicker from '@/components/profiles/api/ProfileApiAttributePicker.vue'
import {
  PROFILE_API_BASE_URL,
  PROFILE_API_PATH_PREFIX,
  slugify,
  useProfileApiAttributes,
  useProfileApiIdentifierTypes
} from '@/composables/useProfileApi'

const router = useRouter()
const $q = useQuasar()

const {
  identifierTypes,
  loading: identifiersLoading,
  error: identifiersError,
  load: loadIdentifiers
} = useProfileApiIdentifierTypes()

const {
  attributes,
  loading: attributesLoading,
  error: attributesError,
  load: loadAttributes
} = useProfileApiAttributes()

const NAME_MAX = 255

const PROTECTION_OPTIONS = [
  { label: 'Protected (API key required)', value: 'protected' },
  { label: 'Unprotected (public)', value: 'public' }
]

const STATE_OPTIONS = [
  { label: 'Live', value: true },
  { label: 'Paused', value: false }
]

const RATE_LIMIT_OPTIONS = [
  { label: '600 requests / minute', value: 600 },
  { label: '1,200 requests / minute', value: 1200 },
  { label: '3,000 requests / minute', value: 3000 },
  { label: '6,000 requests / minute', value: 6000 }
]

const CACHE_TTL_OPTIONS = [
  { label: 'No cache — always resolve fresh', value: 0 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 }
]

const saving = ref(false)
// The slug follows the name until the user edits it, then it is theirs.
const slugTouched = ref(false)

const form = reactive({
  name: '',
  slug: '',
  description: '',
  identifierTypeIds: [],
  attributes: [],
  protection: 'protected',
  rateLimitPerMinute: 600,
  cacheTtlSeconds: 60,
  isEnabled: true
})

const errors = reactive({
  name: '',
  slug: '',
  identifierTypeIds: '',
  attributes: ''
})

const loading = computed(
  () => identifiersLoading.value || attributesLoading.value
)

const error = computed(() => identifiersError.value || attributesError.value)

const emptyTitle = computed(() =>
  identifierTypes.value.length
    ? 'No attributes available'
    : 'No identifier types available'
)

const emptyDescription = computed(() =>
  identifierTypes.value.length
    ? 'An endpoint has to return something. Define an attribute before creating one.'
    : 'An endpoint has to accept something. Define an identifier type before creating one.'
)

const slugHint = computed(
  () =>
    `Lowercase letters, numbers and dashes. Callers will GET ${PROFILE_API_BASE_URL}${PROFILE_API_PATH_PREFIX}/${form.slug || 'your-slug'}`
)

watch(
  () => form.name,
  name => {
    if (!slugTouched.value) form.slug = slugify(name)
  }
)

function validate() {
  const name = form.name.trim()
  if (!name) {
    errors.name = 'An endpoint name is required.'
  } else if (name.length > NAME_MAX) {
    errors.name = `Name must be at most ${NAME_MAX} characters.`
  } else {
    errors.name = ''
  }

  if (!form.slug.trim()) {
    errors.slug = 'A slug is required.'
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
    errors.slug = 'Use lowercase letters, numbers and single dashes only.'
  } else {
    errors.slug = ''
  }

  errors.identifierTypeIds = form.identifierTypeIds.length
    ? ''
    : 'Pick at least one identifier type a caller may look a fan up by.'

  errors.attributes = form.attributes.length
    ? ''
    : 'Pick at least one attribute to return.'

  return !Object.values(errors).some(Boolean)
}

function submit() {
  if (!validate()) return
  saving.value = true

  // No POST to make. The endpoint is announced and the user is returned to the
  // list, which re-reads the mock JSON — so the new endpoint is deliberately
  // not there. Pretending otherwise would be the dishonest option.
  $q.notify({
    message: `“${form.name.trim()}” configured`,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })

  saving.value = false
  router.push({ name: 'profile-api' })
}

function loadAll() {
  loadIdentifiers()
  loadAttributes()
}

onMounted(loadAll)
</script>
