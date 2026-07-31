<template>
  <form class="mb-5 max-w-3xl" @submit.prevent="submit">
    <FormSection
      title="Add a secret"
      description="The value is encrypted on submission and never shown again. Functions read it back as secrets.KEY_NAME."
    >
      <FormField
        label="Key"
        required
        for="secret-key"
        :error="errors.key"
        :hint="keyHint"
      >
        <input
          id="secret-key"
          v-model="form.key"
          type="text"
          autocomplete="off"
          placeholder="META_ACCESS_TOKEN"
          class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
          @blur="form.key = normaliseSecretKey(form.key)"
        />
      </FormField>

      <FormField
        label="Value"
        required
        for="secret-value"
        :error="errors.value"
        hint="Write-only. Stored encrypted; nothing on this screen can print it back."
      >
        <input
          id="secret-value"
          v-model="form.value"
          type="password"
          autocomplete="new-password"
          placeholder="Paste the credential"
          class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
        />
      </FormField>

      <FormField
        label="Description"
        for="secret-description"
        hint="Optional. One line of context for whoever inherits this."
      >
        <input
          id="secret-description"
          v-model="form.description"
          type="text"
          placeholder="System user token for the Meta Conversions API destination."
          class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
        />
      </FormField>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          Add secret
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <p class="text-xs text-subtle"
          >Nothing is persisted yet — there is no backend behind this form.</p
        >
      </div>
    </FormSection>
  </form>
</template>

<script setup>
import { computed, reactive } from 'vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import {
  isValidSecretKey,
  normaliseSecretKey
} from '@/composables/useSettingsSecrets'

// The create form for a secret. It lives inline on the list screen rather than
// in a dialog because the key rule needs a hint line and an error line, and a
// ConfirmDialog closes on confirm — it cannot hold a field back for being
// invalid.
//
// The value field is `type="password"` so the credential is never legible, not
// even to someone reading over a shoulder or looking at a smoke screenshot.
const props = defineProps({
  // Keys already in use, so a collision is caught before submit.
  existingKeys: { type: Array, default: () => [] }
})
const emit = defineEmits(['submit', 'cancel'])

const form = reactive({ key: '', value: '', description: '' })
const errors = reactive({ key: '', value: '' })

const keyHint = computed(
  () =>
    `Uppercase letters, numbers and underscores. Read back as secrets.${form.key || 'KEY_NAME'}`
)

function validate() {
  const key = normaliseSecretKey(form.key)

  if (!key) {
    errors.key = 'A key is required.'
  } else if (!isValidSecretKey(key)) {
    errors.key = 'Start with a letter; use uppercase letters, numbers and _.'
  } else if (props.existingKeys.includes(key)) {
    errors.key = 'That key is already in use.'
  } else {
    errors.key = ''
  }

  errors.value = form.value ? '' : 'A value is required.'

  return !errors.key && !errors.value
}

function submit() {
  if (!validate()) return
  // The value is intentionally not emitted. There is nothing to encrypt it
  // with, and holding it anywhere a later Reveal could reach is exactly what
  // this screen must not do.
  emit('submit', {
    key: normaliseSecretKey(form.key),
    description: form.description.trim()
  })
  form.key = ''
  form.value = ''
  form.description = ''
}
</script>
