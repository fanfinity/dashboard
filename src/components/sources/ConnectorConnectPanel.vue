<template>
  <CardPanel data-connector-connect>
    <template #header>
      <div class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-ink"
          >Connect {{ connector.name }}</span
        >
        <p class="mt-0.5 text-xs text-muted">{{ lede }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <StatusBadge
          v-if="connector.license"
          tone="neutral"
          :label="connector.license"
        />
        <StatusBadge
          v-if="schemaSource === 'live'"
          tone="success"
          label="Live schema"
        />
        <SfereButton variant="ghost" size="sm" @click="emit('cancel')"
          >Cancel</SfereButton
        >
      </div>
    </template>

    <!-- The connector cannot be configured from credentials at all until the
         store has authorised the app. Said before the fields rather than after
         a failed submit. -->
    <NoticeBanner
      v-if="connector.requiresOauth"
      class="mb-4"
      tone="warn"
      title="This connector needs authorising first"
      :message="`${connector.name} pulls on behalf of an account that has to grant access. Create the source, then use its Setup tab to authorise — the credentials below cannot stand in for that step.`"
    />

    <!-- The spec read is still in flight, or the backend is still fetching it
         from the connector image (`ConnectorSpec.pending`). That is a loading
         state and not an empty one: rendering "no credentials needed" here
         would be wrong in the expensive direction. -->
    <NoticeBanner
      v-else-if="specPending || specLoading"
      class="mb-4"
      tone="info"
      title="Reading this connector’s configuration"
      message="The backend is fetching the config schema from the connector image. The fields appear as soon as it answers."
    />

    <!-- A live schema that declares no properties is a real answer, not a gap:
         the Airbyte connectors hosted on Jitsu are configured there, so there
         is genuinely nothing to ask for here. -->
    <NoticeBanner
      v-else-if="schemaSource === 'live' && !fields.length"
      class="mb-4"
      tone="info"
      title="No credentials needed"
      :message="`${connector.name} is configured upstream, so it asks for nothing here. Pick a sync schedule and connect.`"
    />

    <!-- The generic case is worth flagging rather than hiding: a paste-your-JSON
         box is a worse form than a named one, and saying why stops it reading as
         carelessness. -->
    <NoticeBanner
      v-else-if="schemaSource === 'hand' && handSpec.generic"
      class="mb-4"
      tone="info"
      title="Generic credentials form"
      :message="`No config schema came back for ${connector.name}, so this asks for raw JSON. GET /v1/connectors/{id}/spec serves a real schema for the connectors that have one.`"
    />

    <div class="flex flex-col gap-4">
      <FormField
        v-for="field in fields"
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

        <!-- An enum in the schema becomes a select, not a text box: a typo in
             a constrained field is a 422 nobody can debug from the form. -->
        <SfereSelect
          v-else-if="field.kind === 'select'"
          :id="`connector-${field.key}`"
          v-model="form[field.key]"
          :options="field.options"
        />

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

      <!-- Only from the live spec. `supported_modes` says which sync modes the
           connector can actually run, and a connector that only does `full`
           must not be offered an incremental one. Absent when the schema is the
           hand-written fallback, because that file states no modes. -->
      <FormField
        v-if="modeOptions.length"
        label="Sync mode"
        for-id="connector-mode"
        hint="What each run pulls. The connector reports which of these it supports."
      >
        <SfereSelect
          id="connector-mode"
          v-model="mode"
          :options="modeOptions"
        />
      </FormField>

      <p v-if="documentationUrl" class="text-xs text-muted">
        <a
          :href="documentationUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-brand underline"
          >Connector documentation</a
        >
      </p>
    </div>

    <template #footer>
      <div class="flex flex-wrap items-center gap-3">
        <SfereButton :disabled="specPending || specLoading" @click="submit"
          >Connect {{ connector.name }}</SfereButton
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
import { fieldsFromJsonSchema, describesConfig } from '@/lib/jsonSchemaFields'
import { useConnectorSpec } from '@/composables/useConnectorCatalog'
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

// The hand-written spec, still the fallback and still the source of every
// "where do I find this?" line. `GET /v1/connectors/{id}/spec` is live as of
// backend PR #16 and serves the connector's real `config_schema`, so the live
// schema decides WHICH fields exist and the hand-written entry only lends its
// help text and placeholder where a key matches. Neither replaces the other:
// a JSON Schema cannot say "Firebase console → Project settings → Service
// accounts", which is the twenty minutes of the job.
const handSpec = computed(() => specForConnector(props.connector))

const {
  spec: liveSpec,
  pending: specPending,
  loading: specLoading,
  load: loadSpec
} = useConnectorSpec()

// Re-read whenever the picked card changes. The catalog's own id, not the
// package id: `GET /v1/connectors/{connector_id}/spec` is keyed on the catalog
// id (`"zid"`, `"firebase"`), which for an Airbyte entry is not the package.
watch(
  () => props.connector?.id,
  id => {
    if (id) loadSpec(id)
  },
  { immediate: true }
)

/**
 * 'live' when the backend described this connector's configuration, 'hand'
 * otherwise. Drives the banners rather than being inferred at each one, so the
 * four states stay mutually exclusive.
 */
const schemaSource = computed(() =>
  describesConfig(liveSpec.value?.configSchema) ? 'live' : 'hand'
)

const fields = computed(() =>
  schemaSource.value === 'live'
    ? fieldsFromJsonSchema(liveSpec.value.configSchema, handSpec.value.fields)
    : handSpec.value.fields
)

const lede = computed(() => {
  if (props.connector.description) return props.connector.description
  return handSpec.value.lede
})

const documentationUrl = computed(() => liveSpec.value?.documentationUrl || '')

const MODE_LABELS = {
  full: 'Full refresh — re-pull everything each run',
  incremental: 'Incremental — only what changed',
  date_range: 'Date range — a window you choose'
}

const modeOptions = computed(() =>
  (liveSpec.value?.supportedModes ?? []).map(value => ({
    value,
    label: MODE_LABELS[value] || value
  }))
)

const form = reactive({})
const files = reactive({})
const errors = reactive({})
const schedule = ref('hourly')
const mode = ref('')

// Re-seed on a different connector, or on the field list arriving: switching
// from Firebase to Stripe must not leave Firebase's project id sitting in a
// field Stripe never asked for, and the live schema lands after the first
// render so the seed has to follow it rather than the connector alone.
watch(
  fields,
  list => {
    for (const key of Object.keys(form)) delete form[key]
    for (const key of Object.keys(files)) delete files[key]
    for (const key of Object.keys(errors)) delete errors[key]
    for (const field of list) {
      form[field.key] =
        field.kind === 'select' ? (field.options?.[0]?.value ?? '') : ''
    }
    schedule.value = 'hourly'
    mode.value = modeOptions.value[0]?.value ?? ''
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
  for (const field of fields.value) {
    const raw = form[field.key]
    const filled =
      field.kind === 'file'
        ? Boolean(files[field.key])
        : Boolean(typeof raw === 'string' ? raw.trim() : raw)
    errors[field.key] =
      field.required && !filled ? `${field.label} is required.` : ''
    // A schema field typed `array` or `object` is entered as JSON, so a value
    // that will not parse is caught here rather than becoming a 422 the form
    // cannot explain.
    if (!errors[field.key] && field.json && filled) {
      try {
        JSON.parse(raw)
      } catch {
        errors[field.key] = `${field.label} must be valid JSON.`
      }
    }
    if (errors[field.key]) ok = false
  }
  return ok
}

function submit() {
  if (!validate()) return
  emit('connect', {
    connector: props.connector,
    schedule: schedule.value,
    mode: mode.value,
    schemaSource: schemaSource.value,
    // Field NAMES only. The values are credentials and have no business
    // travelling up to a page that would only log them.
    provided: fields.value.map(f => f.key)
  })
}
</script>
