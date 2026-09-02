<template>
  <q-dialog v-model="open">
    <div :class="cardClasses">
      <div
        class="flex shrink-0 items-start justify-between gap-4 border-b border-sfere-line px-5 py-4"
      >
        <div class="min-w-0">
          <h2 class="font-sfere-display! text-sfere-h4! text-sfere-fg"
            >Create an API token</h2
          >
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted"
            >For CI, a warehouse job or anything else that calls the API without
            a person signing in.</p
          >
        </div>
      </div>

      <div class="flex flex-col gap-4 px-5 py-5">
        <NoticeBanner
          v-if="apiMissing"
          tone="info"
          title="Nothing will be created"
          message="Demo data mode is on, so this form validates and stops. Switch Settings → Data source to Real API to mint a token."
        />

        <FormField
          label="Name"
          required
          for-id="token-name"
          hint="What is calling. This is the only label a revoke decision has to go on later."
          :error="errors.name"
        >
          <SfereInput
            id="token-name"
            v-model="form.name"
            placeholder="e.g. Nightly warehouse job"
            autocomplete="off"
          />
        </FormField>

        <!-- Three coarse scopes, not per-resource ones. That is the whole
             vocabulary the backend has (`ApiTokenScope`), so offering a longer
             list would be offering scopes it will reject. -->
        <FormField
          label="Scopes"
          required
          for-id="token-scopes"
          hint="What the token may do. Pick the narrowest that works."
          :error="errors.scopes"
        >
          <div id="token-scopes" class="flex flex-col gap-2">
            <label
              v-for="scope in API_TOKEN_SCOPES"
              :key="scope.value"
              class="flex cursor-pointer items-start gap-2.5 rounded-sfere border border-sfere-line bg-white px-3 py-2.5 hover:bg-sfere-fill"
            >
              <input
                v-model="form.scopes"
                type="checkbox"
                :value="scope.value"
                class="mt-0.5 size-4 shrink-0 accent-sfere-500"
              />
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-sfere-fg">{{
                  scope.label
                }}</span>
                <span class="block text-xs text-sfere-fg-muted">{{
                  scope.description
                }}</span>
              </span>
            </label>
          </div>
        </FormField>

        <FormField
          label="Expires"
          optional
          for-id="token-expires"
          hint="Leave blank for a token that does not expire. A dated one stops working on its own, which is one fewer thing to remember to revoke."
          :error="errors.expiresAt"
        >
          <SfereInput id="token-expires" v-model="form.expiresAt" type="date" />
        </FormField>
      </div>

      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-sfere-line px-5 py-3.5"
      >
        <SfereButton v-close-popup variant="secondary" size="sm"
          >Cancel</SfereButton
        >
        <!-- Enabled unless a request is in flight. A control that refuses and
             explains nothing is what the sign-in QA finding was about; the
             errors below the fields are the explanation. -->
        <SfereButton size="sm" :loading="submitting" @click="submit"
          >Create token</SfereButton
        >
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import { API_TOKEN_SCOPES } from '@/composables/useApiTokens'

// `POST /v1/accounts/{account}/api-tokens` went live in backend PR #16, which is
// what turns this from the "Token creation needs the accounts backend" toast it
// replaced into a real form.
//
// It does not show the created token: the plaintext comes back once and showing
// it is `SecretRevealDialog`'s job, opened by the page above. Keeping the two
// separate means this dialog never holds a secret at all.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** True in Demo mode: the form still validates, nothing is minted. */
  apiMissing: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'create'])

const cardClasses = [
  'flex w-[min(560px,92vw)]! max-w-[min(560px,92vw)]! flex-col overflow-hidden',
  'rounded-sfere-xl border border-sfere-line bg-sfere-surface shadow-sfere-pop'
]

const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const form = reactive({ name: '', scopes: ['read'], expiresAt: '' })
const errors = reactive({ name: '', scopes: '', expiresAt: '' })

watch(open, isOpen => {
  if (!isOpen) return
  form.name = ''
  form.scopes = ['read']
  form.expiresAt = ''
  errors.name = ''
  errors.scopes = ''
  errors.expiresAt = ''
})

const firstInvalid = ref('')

function validate() {
  errors.name = form.name.trim() ? '' : 'Give the token a name.'
  errors.scopes = form.scopes.length ? '' : 'Pick at least one scope.'
  // A date in the past would be accepted by the backend and the token would be
  // dead on arrival, which is worse than refusing it here.
  errors.expiresAt =
    form.expiresAt && new Date(form.expiresAt).getTime() < Date.now()
      ? 'Pick a date in the future, or leave it blank.'
      : ''
  firstInvalid.value =
    ['name', 'scopes', 'expiresAt'].find(key => errors[key]) ?? ''
  return !firstInvalid.value
}

function submit() {
  if (!validate()) {
    document.getElementById(`token-${firstInvalid.value}`)?.focus()
    return
  }
  emit('create', {
    name: form.name.trim(),
    scopes: [...form.scopes],
    // A date input gives 'YYYY-MM-DD'; the field is a date-time on the wire, so
    // it goes out as the end of that day in UTC rather than midnight, which
    // would expire the token the evening before the date someone picked.
    expiresAt: form.expiresAt
      ? new Date(`${form.expiresAt}T23:59:59Z`).toISOString()
      : null
  })
}
</script>
