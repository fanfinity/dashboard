<template>
  <q-page class="p-6">
    <PageHeader
      title="New warehouse connection"
      subtitle="Pick an engine, then give Sfere a service user that can read your tables."
    />

    <!-- The existing connections are this screen's one remote resource: they
         decide whether the name is already taken and whether this is the first
         warehouse (which becomes the primary one). -->
    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the existing connections."
      :message="error"
      @retry="load"
    />

    <form v-else class="grid max-w-4xl gap-4" @submit.prevent="submit">
      <!-- Nothing configured yet is not an empty screen — creating one is what
           this screen is for — so the "none yet" case is a notice, not an
           EmptyState. -->
      <NoticeBanner
        v-if="!connections.length"
        tone="info"
        title="This will be your first warehouse connection"
        message="It becomes the primary one, so warehouse models and audience snapshots default to it."
      />

      <FormSection
        title="Warehouse type"
        description="The engine decides what the fields below are called and which port they default to."
      >
        <DwhConnectionTypePicker
          v-model="form.type"
          :types="CONNECTION_TYPES"
        />

        <p v-if="errors.type" class="text-xs text-rose-500">{{
          errors.type
        }}</p>
      </FormSection>

      <FormSection
        title="Details"
        description="How this connection appears wherever a warehouse is chosen."
      >
        <FormField
          label="Connection name"
          required
          for-id="dwh-name"
          :error="errors.name"
          hint="Shown in every model, sync and export that reads from it."
        >
          <input
            id="dwh-name"
            v-model="form.name"
            type="text"
            maxlength="255"
            placeholder="e.g. Snowflake Production"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          label="Primary connection"
          :hint="
            connections.length
              ? 'The primary connection is what warehouse models and audience snapshots default to. Only one can hold it.'
              : 'The first connection is always the primary one.'
          "
        >
          <q-toggle
            v-model="form.isPrimary"
            :disable="!connections.length"
            dense
            :label="
              form.isPrimary
                ? 'Use this as the modelling default'
                : 'Leave the current primary in place'
            "
          />
        </FormField>
      </FormSection>

      <FormSection
        :title="credentialsTitle"
        description="Held in this page for as long as you are on it. Nothing is transmitted or stored — there is no backend behind this form."
      >
        <!-- Until an engine is picked there is nothing to label these fields
             with, so the section says so rather than guessing at Postgres. -->
        <EmptyState
          v-if="!form.type"
          variant="inline"
          title="Pick a warehouse type first"
          description="A Postgres host is a BigQuery project and a Databricks workspace — the fields change with the engine."
        />

        <template v-else>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
            <FormField
              :label="type.hostLabel"
              required
              for-id="dwh-host"
              :error="errors.host"
            >
              <input
                id="dwh-host"
                v-model="form.host"
                type="text"
                :placeholder="type.hostPlaceholder"
                class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>

            <FormField
              label="Port"
              required
              for-id="dwh-port"
              :error="errors.port"
            >
              <input
                id="dwh-port"
                v-model="form.port"
                type="text"
                inputmode="numeric"
                :placeholder="String(type.defaultPort)"
                class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
                @input="portTouched = true"
              />
            </FormField>
          </div>

          <FormField
            :label="type.databaseLabel"
            required
            for-id="dwh-database"
            :error="errors.database"
          >
            <input
              id="dwh-database"
              v-model="form.database"
              type="text"
              :placeholder="type.databasePlaceholder"
              class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
            />
          </FormField>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              :label="type.usernameLabel"
              required
              for-id="dwh-username"
              :error="errors.username"
            >
              <input
                id="dwh-username"
                v-model="form.username"
                type="text"
                autocomplete="off"
                :placeholder="type.usernamePlaceholder"
                class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>

            <!-- Masked, never echoed back, and never written anywhere: the
                 secret lives in this component's state and dies with the page. -->
            <FormField
              :label="type.secretLabel"
              required
              for-id="dwh-secret"
              :error="errors.secret"
              hint="Masked while you type and never displayed again."
            >
              <input
                id="dwh-secret"
                v-model="form.secret"
                type="password"
                autocomplete="new-password"
                placeholder="••••••••"
                class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
              />
            </FormField>
          </div>
        </template>
      </FormSection>

      <FormSection
        title="Audience snapshot location"
        description="Optional. A writable schema for the snapshot tables Sfere creates when an audience is materialised in your warehouse."
      >
        <FormField
          label="Schema"
          for-id="dwh-schema"
          :error="errors.schema"
          hint="Leave empty to keep audience snapshots inside Sfere."
        >
          <input
            id="dwh-schema"
            v-model="form.schema"
            type="text"
            :placeholder="form.type ? type.schemaPlaceholder : 'fan_managed'"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>
      </FormSection>

      <!-- The test is simulated in the browser, so it says so on its face
           rather than in a caption the user has to go looking for. -->
      <NoticeBanner
        v-if="testResult"
        :tone="testResult.ok ? 'info' : 'warn'"
        :title="testResult.title"
        :message="testResult.message"
      />

      <StickyActionBar>
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create connection' }}
        </button>
        <button
          type="button"
          :disabled="testing"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
          @click="test"
        >
          {{ testing ? 'Testing…' : 'Test connection' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'dwh-connections' })"
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
import PageHeader from '@/components/ui/PageHeader.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
import DwhConnectionTypePicker from '@/components/warehouse/connections/DwhConnectionTypePicker.vue'
import {
  CONNECTION_TYPES,
  connectionType,
  simulateConnectionTest,
  useDwhConnections,
  useDwhConnectionToasts
} from '@/composables/useDwhConnections'

const router = useRouter()
const { toast } = useDwhConnectionToasts()
const { connections, loading, error, load } = useDwhConnections()

const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)
// The port follows the engine's default until the user edits it, then it is
// theirs — switching engines afterwards leaves it alone.
const portTouched = ref(false)

const form = reactive({
  type: '',
  name: '',
  host: '',
  port: '',
  database: '',
  username: '',
  // Never rendered back, never logged, never leaves this object.
  secret: '',
  schema: '',
  isPrimary: false
})

const errors = reactive({
  type: '',
  name: '',
  host: '',
  port: '',
  database: '',
  username: '',
  secret: '',
  schema: ''
})

// `connectionType` falls back to PostgreSQL's labels so the fields always have
// names, but the heading must not claim an engine nobody picked.
const type = computed(() => connectionType(form.type))

const credentialsTitle = computed(() =>
  form.type ? `${type.value.label} credentials` : 'Credentials'
)

// A workspace with no connections has no primary, so the first one always is.
watch(connections, list => {
  if (!list.length) form.isPrimary = true
})

watch(
  () => form.type,
  value => {
    if (!value) return
    if (!portTouched.value)
      form.port = String(connectionType(value).defaultPort)
    // The engine changes what the credentials mean, so a stale result would be
    // answering a question nobody asked any more.
    testResult.value = null
  }
)

function validate() {
  const name = form.name.trim()
  const taken = connections.value.some(
    c => c.name.trim().toLowerCase() === name.toLowerCase()
  )
  const port = Number(form.port)

  errors.type = form.type ? '' : 'Pick the warehouse this connects to.'

  if (!name) {
    errors.name = 'A connection name is required.'
  } else if (taken) {
    errors.name = 'Another connection already uses that name.'
  } else {
    errors.name = ''
  }

  errors.host = form.host.trim() ? '' : `${type.value.hostLabel} is required.`

  if (!String(form.port).trim()) {
    errors.port = 'A port is required.'
  } else if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.port = 'Use a whole number between 1 and 65535.'
  } else {
    errors.port = ''
  }

  errors.database = form.database.trim()
    ? ''
    : `${type.value.databaseLabel} is required.`
  errors.username = form.username.trim()
    ? ''
    : `${type.value.usernameLabel} is required.`
  errors.secret = form.secret ? '' : `${type.value.secretLabel} is required.`
  errors.schema =
    !form.schema.trim() || /^[A-Za-z_][A-Za-z0-9_]*$/.test(form.schema.trim())
      ? ''
      : 'Letters, numbers and underscores only, starting with a letter.'

  return Object.values(errors).every(v => !v)
}

// No socket is opened and no request is made: the result is derived from what
// has been typed, and the copy says as much on its face.
function test() {
  if (!validate()) {
    testResult.value = {
      ok: false,
      title: 'Nothing to test yet',
      message:
        'Fill in the required fields first — the test reads the form, not the network.'
    }
    return
  }

  testing.value = true
  const result = simulateConnectionTest(form)
  window.setTimeout(() => {
    testing.value = false
    testResult.value = result
  }, 400)
}

function submit() {
  if (!validate()) return
  saving.value = true

  // No POST to make. The connection is announced and the user is returned to
  // the list, which re-reads the mock JSON — so the new record is deliberately
  // not there. Pretending otherwise would be the dishonest option. The secret
  // is dropped with the component.
  toast(`“${form.name.trim()}” configured`)
  saving.value = false
  router.push({ name: 'dwh-connections' })
}

onMounted(load)
</script>
