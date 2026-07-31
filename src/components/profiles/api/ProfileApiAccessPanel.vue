<template>
  <CardPanel>
    <template #header>
      <span class="text-sm font-semibold text-ink"
        >Calling the Profile API</span
      >
      <StatusBadge
        :variant="selected?.isEnabled ? 'success' : 'neutral'"
        :label="selected?.isEnabled ? 'Live' : 'Paused'"
      />
    </template>

    <!-- `min-w-0` all the way down: a flex item defaults to `min-width: auto`,
         so the widest line in the curl block would otherwise stretch the card
         past its grid column and over the card beside it. -->
    <div class="flex min-w-0 flex-col gap-4">
      <FormField
        label="Endpoint"
        hint="Pick an endpoint to see the request that reaches it."
      >
        <q-select
          v-model="selectedId"
          dense
          outlined
          emit-value
          map-options
          options-dense
          :options="options"
          class="bg-white"
        />
      </FormField>

      <div class="flex w-full min-w-0 flex-col gap-1">
        <p class="text-xs font-medium text-subtle">Base URL</p>
        <div class="flex items-center gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded-lg border border-line2 bg-sidebar px-2.5 py-2 font-mono text-xs text-ink"
            >{{ baseUrl }}</code
          >
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="emit('copy', { label: 'Base URL', value: baseUrl })"
          >
            Copy
          </button>
        </div>
      </div>

      <div class="flex w-full min-w-0 flex-col gap-1">
        <p class="text-xs font-medium text-subtle">Request</p>
        <div class="flex items-center gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded-lg border border-line2 bg-sidebar px-2.5 py-2 font-mono text-xs text-ink"
            >{{ requestLine }}</code
          >
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="emit('copy', { label: 'Request URL', value: requestUrl })"
          >
            Copy
          </button>
        </div>
        <p class="text-xs text-subtle"
          >Look a fan up by their
          <span class="font-medium text-muted">{{ identifierName }}</span
          >. One identifier per request; the response carries the resolved
          profile only.</p
        >
      </div>

      <div class="flex w-full min-w-0 flex-col gap-1">
        <p class="text-xs font-medium text-subtle">Endpoint key</p>
        <div class="flex items-center gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded-lg border border-line2 bg-sidebar px-2.5 py-2 font-mono text-xs text-ink"
            >{{ shownKey }}</code
          >
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:bg-fill"
            @click="revealed = !revealed"
          >
            {{ revealed ? 'Hide' : 'Reveal' }}
          </button>
        </div>
        <p class="text-xs text-subtle">{{ keyHint }}</p>
      </div>

      <div class="flex w-full min-w-0 flex-col gap-1">
        <p class="text-xs font-medium text-subtle">Example request</p>
        <pre
          class="w-full overflow-x-auto rounded-lg border border-line2 bg-sidebar p-3 font-mono text-xs leading-5 text-muted"
          >{{ curl }}</pre
        >
        <div class="mt-1">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="emit('copy', { label: 'Example request', value: curl })"
          >
            Copy snippet
          </button>
        </div>
      </div>

      <div class="flex w-full min-w-0 flex-col gap-1">
        <p class="text-xs font-medium text-subtle">Example response</p>

        <!-- An endpoint that returns nothing is a configuration mistake, not a
             failure — say so where the payload would have been. -->
        <EmptyState
          v-if="!selected?.attributes?.length"
          variant="inline"
          title="This endpoint returns no attributes yet"
          description="Add at least one attribute so callers get something back."
        />

        <pre
          v-else
          class="w-full overflow-x-auto rounded-lg border border-line2 bg-sidebar p-3 font-mono text-xs leading-5 text-muted"
          >{{ response }}</pre
        >
      </div>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import {
  PROFILE_API_BASE_URL,
  buildCurlSnippet,
  buildResponseSample,
  endpointUrl,
  formatDate,
  maskKey
} from '@/composables/useProfileApi'

// Reference card for whoever has to integrate against these endpoints: base
// URL, the request that reaches the selected endpoint, its key, and the shape
// that comes back.
//
// It owns no data and performs no clipboard work — it emits `copy` with
// `{ label, value }` and the page decides, so the permission-sensitive
// `navigator.clipboard` call and its toast live in one place.
const props = defineProps({
  endpoints: { type: Array, default: () => [] }
})
const emit = defineEmits(['copy'])

const baseUrl = PROFILE_API_BASE_URL
const revealed = ref(false)
const selectedId = ref(props.endpoints[0]?.id ?? '')

const options = computed(() =>
  props.endpoints.map(e => ({ label: e.name, value: e.id }))
)

const selected = computed(
  () => props.endpoints.find(e => e.id === selectedId.value) ?? null
)

// The list mutates locally (pause, delete), so the selection has to survive the
// endpoint it pointed at disappearing.
watch(
  () => props.endpoints,
  list => {
    if (!list.some(e => e.id === selectedId.value)) {
      selectedId.value = list[0]?.id ?? ''
    }
  }
)

const identifierName = computed(
  () => selected.value?.identifierTypeName ?? 'identifier'
)

const requestUrl = computed(() =>
  selected.value
    ? `${endpointUrl(selected.value)}?${identifierName.value}=FAN_IDENTIFIER`
    : ''
)

const requestLine = computed(() =>
  selected.value ? `${selected.value.method} ${requestUrl.value}` : ''
)

// Masked by default. The last four characters are all that is ever stored, so
// "reveal" shows those and says as much rather than implying more is hidden.
const shownKey = computed(() =>
  maskKey(selected.value?.keyLastFour, revealed.value)
)

const keyHint = computed(() => {
  if (!selected.value?.keyLastFour) {
    return 'No key has been issued for this endpoint yet.'
  }
  const rotated = formatDate(selected.value.keyRotatedAt)
  return `Only the last four characters are kept — the full key was shown once, when it was issued. Last rotated ${rotated}.`
})

const curl = computed(() => buildCurlSnippet(selected.value))
const response = computed(() => buildResponseSample(selected.value))
</script>
