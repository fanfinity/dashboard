<template>
  <CardPanel>
    <template #header>
      <div class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-ink">Test</span>
        <p class="mt-0.5! text-xs text-muted">{{ lede }}</p>
      </div>
      <SfereButton
        class="shrink-0"
        size="sm"
        variant="secondary"
        :loading="testing"
        @click="run"
        >Run test</SfereButton
      >
    </template>

    <div class="flex flex-col gap-4">
      <FormField
        label="Sample event"
        required
        for-id="function-test-event"
        hint="One event, as JSON. Nothing is ingested — this runs the function and throws the result away."
        :error="error"
      >
        <SfereTextarea
          id="function-test-event"
          v-model="eventText"
          :rows="8"
          class="font-sfere-mono!"
        />
      </FormField>

      <div class="flex flex-wrap items-center gap-2">
        <SfereButton variant="ghost" size="sm" @click="eventText = SAMPLE"
          >Reset the sample</SfereButton
        >
      </div>

      <!-- The verdict, and the one reading that matters: a filter that dropped
           the event SUCCEEDED. `describeTestResult` owns that distinction; a
           panel that painted `dropped: true` red would tell someone their
           working filter is broken. -->
      <NoticeBanner
        v-if="verdict"
        :tone="verdict.tone"
        :title="verdict.title"
        :message="verdict.message"
      />

      <div v-if="result" class="flex flex-col gap-3">
        <div v-if="result.result">
          <p
            class="mb-1 text-xs font-semibold uppercase tracking-[0.4px] text-subtle"
            >Result</p
          >
          <pre
            class="overflow-x-auto rounded-sfere border border-sfere-line bg-sfere-fill px-3 py-2.5 font-sfere-mono text-xs text-ink"
            >{{ prettyResult }}</pre
          >
        </div>

        <div v-if="result.logs.length">
          <p
            class="mb-1 text-xs font-semibold uppercase tracking-[0.4px] text-subtle"
            >Log</p
          >
          <ol class="flex flex-col gap-1">
            <li
              v-for="(entry, index) in result.logs"
              :key="index"
              class="flex items-start gap-2 rounded-sfere border-l-2 bg-sfere-fill px-3 py-1.5"
              :class="LEVEL_BORDER[entry.level] ?? 'border-sfere-line'"
            >
              <span
                class="shrink-0 font-sfere-mono text-[11px] uppercase text-sfere-fg-subtle"
                >{{ entry.level }}</span
              >
              <span class="min-w-0 flex-1 break-words text-xs text-ink">{{
                entry.message
              }}</span>
            </li>
          </ol>
        </div>

        <p v-if="result.durationMs != null" class="text-xs text-subtle"
          >Ran in {{ result.durationMs }}ms.</p
        >
      </div>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import { describeTestResult } from '@/composables/useFunctions'

// `POST …/functions/{id}/test`, live as of backend PR #16.
const props = defineProps({
  kind: { type: String, default: 'transform' },
  result: { type: Object, default: null },
  testing: { type: Boolean, default: false },
  /** Whether the editor above has unsaved changes, which changes what runs. */
  codeDirty: { type: Boolean, default: false }
})

const emit = defineEmits(['run'])

const LEVEL_BORDER = {
  info: 'border-sfere-line',
  warn: 'border-amber-400',
  error: 'border-rose-500'
}

const SAMPLE = JSON.stringify(
  {
    type: 'track',
    event: 'Order Completed',
    userId: 'u_1042',
    properties: { revenue: 84.5, currency: 'SAR', items: 3 },
    context: { page: { url: 'https://example.com/checkout' } }
  },
  null,
  2
)

const eventText = ref(SAMPLE)
const error = ref('')

const lede = computed(() =>
  props.codeDirty
    ? 'The editor has unsaved changes, so the test runs what is in the box above — not what is stored.'
    : 'Runs the saved code against one event. Nothing is ingested and nothing is delivered.'
)

const verdict = computed(() => describeTestResult(props.result, props.kind))

const prettyResult = computed(() => {
  try {
    return JSON.stringify(props.result?.result, null, 2)
  } catch {
    return String(props.result?.result)
  }
})

function run() {
  error.value = ''
  let event
  try {
    event = JSON.parse(eventText.value)
  } catch {
    // Caught here rather than sent: a 422 about a malformed body says less than
    // this does, and it says it further from the box you have to fix.
    error.value = 'That is not valid JSON. Fix it before running the test.'
    return
  }
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    error.value = 'A sample event has to be a JSON object.'
    return
  }
  emit('run', event)
}
</script>
