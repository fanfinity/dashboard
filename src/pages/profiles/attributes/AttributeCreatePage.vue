<template>
  <q-page class="p-6">
    <PageHeader
      title="New attribute"
      subtitle="Define a computed field on the fan profile: where its value comes from, how it is aggregated, and what it writes."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'attributes' })"
        >
          All attributes
        </button>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="6" />

    <!-- The data-model catalog is this screen's primary resource: a warehouse
         attribute cannot be described without it. Identifier types are
         secondary and degrade inside their own field, below. -->
    <ErrorState
      v-else-if="modelsError"
      title="Couldn't load the warehouse models."
      :message="modelsError"
      @retry="load"
    />

    <EmptyState
      v-else-if="!models.length && !identifierTypes.length"
      title="Nothing to build an attribute from yet"
      description="An attribute reads from a warehouse model or from an identified event stream, and this workspace has neither."
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'warehouse-models-new' })"
        >
          Create a data model
        </button>
      </template>
    </EmptyState>

    <form v-else class="flex max-w-3xl flex-col gap-4" @submit.prevent="submit">
      <FormSection
        title="Kind"
        description="Realtime attributes update as events land. Warehouse attributes are recomputed when their model refreshes."
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectableCard
            v-for="kind in KINDS"
            :key="kind.value"
            :selected="form.type === kind.value"
            @select="form.type = kind.value"
          >
            <div class="flex w-full items-start justify-between gap-2">
              <span class="text-sm font-medium text-ink">{{ kind.label }}</span>
              <StatusBadge
                v-if="form.type === kind.value"
                tone="brand"
                label="Selected"
              />
            </div>
            <p class="mt-2 text-xs leading-5 text-muted">{{
              kind.description
            }}</p>
          </SelectableCard>
        </div>
      </FormSection>

      <FormSection
        title="Basics"
        description="How the attribute appears in the audience builder and in profile exports."
      >
        <FormField
          label="Name"
          required
          for-id="attribute-name"
          :error="errors.name"
          :hint="idHint"
        >
          <input
            id="attribute-name"
            v-model="form.name"
            type="text"
            maxlength="255"
            placeholder="e.g. Most frequent city"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          label="Aggregation"
          required
          :error="errors.algorithm"
          hint="Applied when more than one row matches the same fan."
        >
          <q-select
            v-model="form.algorithm"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="ALGORITHMS"
            class="bg-white"
          />
        </FormField>

        <FormField
          hint="A single-row attribute keeps only the newest result per fan. Turn it off to keep every matching row."
        >
          <q-toggle
            v-model="form.isSingleRow"
            dense
            label="Single row per fan"
            class="text-sm text-ink"
          />
        </FormField>
      </FormSection>

      <FormSection
        v-if="form.type === 'warehouse'"
        title="Warehouse source"
        description="The model the attribute reads, and the columns it takes its value and its timestamp from."
      >
        <EmptyState
          v-if="!models.length"
          variant="inline"
          title="No data models yet"
          description="A warehouse attribute is computed over a model. Create one, then come back — or switch this attribute to Realtime."
        >
          <template #cta>
            <button
              type="button"
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="router.push({ name: 'warehouse-models-new' })"
            >
              New data model
            </button>
          </template>
        </EmptyState>

        <template v-else>
          <FormField
            label="Data model"
            required
            :error="errors.dataModelId"
            :hint="modelHint"
          >
            <q-select
              v-model="form.dataModelId"
              dense
              outlined
              emit-value
              map-options
              options-dense
              :options="modelOptions"
              class="bg-white"
            />
          </FormField>

          <FormField
            label="Value column"
            required
            for-id="attribute-column"
            :error="errors.dataColumn"
            hint="The column the aggregation is applied to."
          >
            <input
              id="attribute-column"
              v-model="form.dataColumn"
              type="text"
              placeholder="order_total"
              class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
            />
          </FormField>

          <FormField
            label="Timestamp column"
            for-id="attribute-timestamp"
            hint="Orders the rows so “last value” means the newest one. Defaults to the model's own timestamp."
          >
            <input
              id="attribute-timestamp"
              v-model="form.timestampColumn"
              type="text"
              placeholder="ordered_at"
              class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
            />
          </FormField>
        </template>
      </FormSection>

      <FormSection
        v-else
        title="Event source"
        description="Which fan a matching event belongs to, and how the stream is ordered."
      >
        <!-- Secondary resource: its failure stays in this field, with its own
             retry, rather than taking the whole form down. -->
        <ErrorState
          v-if="identifiersError"
          title="Couldn't load identifier types."
          :message="identifiersError"
          @retry="loadIdentifierTypes"
        />

        <EmptyState
          v-else-if="!identifierTypes.length"
          variant="inline"
          title="No identifier types configured"
          description="A realtime attribute attaches to an identifier, so events can be matched to a fan."
        />

        <FormField
          v-else
          label="Identifier"
          required
          :error="errors.identifierTypeId"
          hint="Only events carrying this identifier contribute to the attribute."
        >
          <q-select
            v-model="form.identifierTypeId"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="identifierOptions"
            class="bg-white"
          />
        </FormField>

        <FormField
          label="Timestamp field"
          for-id="attribute-event-timestamp"
          hint="The event field used to order the stream."
        >
          <input
            id="attribute-event-timestamp"
            v-model="form.timestampColumn"
            type="text"
            placeholder="event_time"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="Dimensions"
        description="The values this attribute writes onto the profile. The first is the value itself; the rest are the context an audience can filter on."
      >
        <FormField :error="errors.dimensions">
          <AttributeDimensionsField
            v-model="form.dimensions"
            :type-options="DIMENSION_TYPES"
          />
        </FormField>
      </FormSection>

      <FormSection title="Definition" :description="queryDescription">
        <FormField
          label="Query"
          :required="form.type === 'realtime'"
          for-id="attribute-query"
          :error="errors.query"
          hint="Select one column per dimension, named exactly as the dimension is."
        >
          <textarea
            id="attribute-query"
            v-model="form.query"
            rows="6"
            :placeholder="queryPlaceholder"
            class="min-h-[120px] rounded-lg border border-line2 bg-white px-2.5 py-2 font-mono text-sm text-ink outline-none placeholder:text-subtle"
          ></textarea>
        </FormField>
      </FormSection>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create attribute' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'attributes' })"
        >
          Cancel
        </button>
        <p class="text-xs text-subtle"
          >Nothing is persisted yet — there is no backend behind this form.</p
        >
      </div>
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
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import AttributeDimensionsField from '@/components/profiles/attributes/AttributeDimensionsField.vue'
import { useMockResource } from '@/composables/useMockResource'
import {
  ALGORITHMS,
  DIMENSION_TYPES,
  makeAttributeId,
  useAttributes
} from '@/composables/useAttributes'

const router = useRouter()
const $q = useQuasar()

const KINDS = [
  {
    value: 'realtime',
    label: 'Realtime',
    description:
      'Computed from the event stream as events arrive — a last-seen city, the newest consent flag.'
  },
  {
    value: 'warehouse',
    label: 'Warehouse',
    description:
      'Computed over a warehouse model on its refresh cycle — a lifetime spend, a season-ticket tier.'
  }
]

const {
  data: models,
  loading: modelsLoading,
  error: modelsError,
  load: loadModels
} = useMockResource('warehouse-models')

const {
  data: identifierTypes,
  loading: identifiersLoading,
  error: identifiersError,
  load: loadIdentifierTypes
} = useMockResource('identifier-types')

// Loaded for one reason only: to refuse a name that is already taken before the
// user submits it. If it fails, the check is skipped rather than blocking the
// form — the backend would be the real authority anyway.
const {
  attributes,
  loading: attributesLoading,
  load: loadAttributes
} = useAttributes()

const loading = computed(
  () =>
    modelsLoading.value || identifiersLoading.value || attributesLoading.value
)

async function load() {
  await Promise.all([loadModels(), loadIdentifierTypes(), loadAttributes()])
}

const saving = ref(false)

const form = reactive({
  type: 'realtime',
  name: '',
  algorithm: 'last',
  isSingleRow: true,
  dataModelId: '',
  dataColumn: '',
  identifierTypeId: '',
  timestampColumn: '',
  query: '',
  dimensions: [{ name: '', type: 'string', isSingleValue: true }]
})

const errors = reactive({
  name: '',
  algorithm: '',
  dataModelId: '',
  dataColumn: '',
  identifierTypeId: '',
  query: '',
  dimensions: ''
})

const modelOptions = computed(() =>
  models.value.map(m => ({
    label: m.isEnabled ? m.name : `${m.name} (paused)`,
    value: m.id
  }))
)

const identifierOptions = computed(() =>
  identifierTypes.value.map(i => ({
    label: `${i.displayName} (${i.name})`,
    value: i.id
  }))
)

const selectedModel = computed(
  () => models.value.find(m => m.id === form.dataModelId) ?? null
)

const idHint = computed(() => {
  const id = makeAttributeId(form.name)
  return id
    ? `Addressed as “${id}” in audience rules and profile exports.`
    : 'Shown wherever this attribute is referenced.'
})

const modelHint = computed(() =>
  selectedModel.value
    ? `Stored in ${selectedModel.value.dwhConnectionName}, keyed on ${selectedModel.value.identifierColumn}.`
    : 'The model whose rows this attribute aggregates.'
)

const queryDescription = computed(() =>
  form.type === 'realtime'
    ? 'A realtime attribute is defined by the query it runs against the event stream.'
    : 'Optional. Leave blank to read the columns above straight off the model.'
)

const queryPlaceholder = computed(() =>
  form.type === 'realtime'
    ? "select payload->>'city' as value from events where event_type = 'page_view'"
    : 'select profile_id, sum(order_total) as value from FAN_PROD.PUBLIC.MERCH_ORDERS group by 1'
)

// Picking a model seeds the timestamp column from its own, but never overwrites
// something the user has already typed.
watch(
  () => form.dataModelId,
  () => {
    if (!form.timestampColumn.trim() && selectedModel.value) {
      form.timestampColumn = selectedModel.value.timestampColumn ?? ''
    }
  }
)

function validate() {
  for (const key of Object.keys(errors)) errors[key] = ''

  const name = form.name.trim()
  if (!name) {
    errors.name = 'A name is required.'
  } else if (name.length > 255) {
    errors.name = 'Name must be at most 255 characters.'
  } else if (
    attributes.value.some(
      a =>
        a.name.toLowerCase() === name.toLowerCase() ||
        a.id === makeAttributeId(name)
    )
  ) {
    errors.name = 'An attribute with that name already exists.'
  }

  if (!form.algorithm) errors.algorithm = 'Pick an aggregation.'

  if (form.type === 'warehouse') {
    if (!form.dataModelId) errors.dataModelId = 'Pick a data model.'
    if (!form.dataColumn.trim()) {
      errors.dataColumn = 'Name the column the value comes from.'
    }
  } else {
    if (!form.identifierTypeId) {
      errors.identifierTypeId = 'Pick the identifier events are matched on.'
    }
    if (!form.query.trim()) {
      errors.query = 'A realtime attribute needs a query over the event stream.'
    }
  }

  const named = form.dimensions.filter(d => d.name.trim())
  const unique = new Set(named.map(d => d.name.trim().toLowerCase()))
  if (!named.length) {
    errors.dimensions = 'Add at least one dimension and give it a name.'
  } else if (unique.size !== named.length) {
    errors.dimensions = 'Dimension names must be unique.'
  } else if (named.some(d => !/^[a-z][a-z0-9_]*$/.test(d.name.trim()))) {
    errors.dimensions =
      'Use lowercase letters, numbers and underscores in dimension names.'
  }

  return !Object.values(errors).some(Boolean)
}

function submit() {
  if (!validate()) return
  saving.value = true

  // No POST to make. The attribute is announced and the user is returned to the
  // list, which re-reads the mock JSON — so the new attribute is deliberately
  // not there. Pretending otherwise would be the dishonest option.
  $q.notify({
    message: `“${form.name.trim()}” configured`,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    timeout: 2500
  })

  saving.value = false
  router.push({ name: 'attributes' })
}

onMounted(load)
</script>
