<template>
  <CardPanel data-connector-connect>
    <template #header>
      <div class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-ink"
          >Connect {{ connector.meta?.name || connector.packageId }}</span
        >
        <p class="mt-0.5 text-xs text-muted">{{ spec.lede }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <StatusBadge
          v-if="connector.meta?.license"
          tone="neutral"
          :label="connector.meta.license"
        />
        <SfereButton variant="ghost" size="sm" @click="emit('cancel')"
          >Cancel</SfereButton
        >
      </div>
    </template>

    <!-- The generic case is worth flagging rather than hiding: a paste-your-JSON
         box is a worse form than a named one, and saying why stops it reading as
         carelessness. -->
    <NoticeBanner
      v-if="spec.generic"
      class="mb-4"
      tone="info"
      title="Generic credentials form"
      :message="`The catalog does not describe what ${connector.meta?.name || 'this connector'} needs yet, so this asks for raw JSON. The named connectors (Firebase, MongoDB, Shopify, Stripe, GA4) have proper fields.`"
    />

    <div class="flex flex-col gap-4">
      <FormField
        v-for="field in spec.fields"
        :key="field.key"
        :label="field.label"
        :required="field.required"
        :optional="!field.required"
        :for-id="`connector-${field.key}`"
        :hint="field.help"
        :error="errors[field.key] || ''"
      >
        <!-- A drop target, not an upload. The dashboard has no ingestion path
             for a credential file and no endpoint to post it to, so this records
             the filename and says plainly that the contents go nowhere. -->
        <div
          v-if="field.kind === 'file'"
          class="flex flex-col gap-2 rounded-sfere-lg border border-dashed border-sfere-line bg-sfere-fill px-4 py-5 text-center"
        >
          <p class="text-sm text-muted">
            {{ files[field.key] || 'Drop the JSON key file here, or browse' }}
          </p>
          <div class="flex justify-center">
            <label
              class="cursor-pointer rounded-sfere border border-sfere-line bg-white px-3 py-1.5 text-sm font-medium text-sfere-brand-text hover:bg-sfere-fill"
            >
              Choose file
              <input
                :id="`connector-${field.key}`"
                type="file"
                :accept="field.accept"
                class="sr-only"
                @change="onFile(field.key, $event)"
              />
            </label>
          </div>
        </div>

        <SfereTextarea
          v-else-if="field.kind === 'textarea'"
          :id="`connector-${field.key}`"
          v-model="form[field.key]"
          :rows="4"
          :placeholder="field.placeholder || ''"
        />

        <SfereInput
          v-else
          :id="`connector-${field.key}`"
          v-model="form[field.key]"
          :type="field.kind === 'password' ? 'password' : 'text'"
          :placeholder="field.placeholder || ''"
          autocomplete="off"
        />
      </FormField>

      <FormField
        label="Sync schedule"
        for-id="connector-schedule"
        hint="How often Sfere pulls. You can change this later, and run a sync by hand any time."
      >
        <SfereSelect
          id="connector-schedule"
          v-model="schedule"
          :options="CONNECTOR_SCHEDULES"
        />
      </FormField>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center gap-3">
        <SfereButton @click="submit"
          >Connect {{ connector.meta?.name || 'connector' }}</SfereButton
        >
        <SfereButton variant="secondary" @click="emit('cancel')"
          >Cancel</SfereButton
        >
        <p class="text-xs text-subtle"
          >No connector endpoint yet. This validates the form and reports what
          it would send.</p
        >
      </div>
    </template>
  </CardPanel>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereSelect from '@/components/ui/SfereSelect.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import {
  CONNECTOR_SCHEDULES,
  specForConnector
} from '@/config/connectorCredentials'

// The step the catalog used to be missing: picking a connector card opened a
// "coming soon" toast, which is the same as the card not being clickable.
//
// It validates for real and reports what it would send, because the interesting
// part of connecting Firebase is knowing *which* four values it wants and where
// they live — and that is true whether or not the POST exists. Credentials are
// never held longer than this component: nothing is persisted, and the file
// field reads no bytes.
const props = defineProps({
  connector: { type: Object, required: true }
})

const emit = defineEmits(['cancel', 'connect'])

const spec = computed(() => specForConnector(props.connector))

const form = reactive({})
const files = reactive({})
const errors = reactive({})
const schedule = ref('hourly')

// Re-seed on a different connector: switching from Firebase to Stripe must not
// leave Firebase's project id sitting in a field Stripe never asked for.
watch(
  () => props.connector?.packageId,
  () => {
    for (const key of Object.keys(form)) delete form[key]
    for (const key of Object.keys(files)) delete files[key]
    for (const key of Object.keys(errors)) delete errors[key]
    for (const field of spec.value.fields) form[field.key] = ''
    schedule.value = 'hourly'
  },
  { immediate: true }
)

function onFile(key, event) {
  const file = event.target.files?.[0]
  files[key] = file ? file.name : ''
  errors[key] = ''
}

function validate() {
  let ok = true
  for (const field of spec.value.fields) {
    const filled =
      field.kind === 'file'
        ? Boolean(files[field.key])
        : Boolean(form[field.key]?.trim())
    errors[field.key] =
      field.required && !filled ? `${field.label} is required.` : ''
    if (errors[field.key]) ok = false
  }
  return ok
}

function submit() {
  if (!validate()) return
  emit('connect', {
    connector: props.connector,
    schedule: schedule.value,
    // Field NAMES only. The values are credentials and have no business
    // travelling up to a page that would only log them.
    provided: spec.value.fields.map(f => f.key)
  })
}
</script>
