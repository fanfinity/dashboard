<template>
  <CardPanel>
    <template #header>
      <div class="sfere-flush grid min-w-0 flex-1 gap-1">
        <span class="text-sm font-semibold text-ink">Test</span>
        <p class="text-xs text-muted">{{ lede }}</p>
      </div>
    </template>

    <!-- Tabs, then a toolbar, then one panel — the prototype's shape. TabNav's
         `underline` variant is the right one here (it switches the card's
         primary content rather than filtering a list) and it carries its own
         `mb-4`, so nothing below it adds a top margin. -->
    <TabNav v-model="tab" :tabs="tabs" />

    <div
      class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sfere border border-sfere-line bg-sfere-fill px-3 py-2.5"
    >
      <p class="min-w-0 flex-1 text-xs text-muted">{{ toolbarNote }}</p>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <!-- Both controls are absent rather than dimmed where nothing can
             run: the box below is already the sample, so a Reset that redraws
             it would be a control whose only effect is to look like one. -->
        <SfereButton
          v-if="canRun"
          variant="secondary"
          size="sm"
          @click="resetSample"
          >Sample event</SfereButton
        >
        <!-- No Run control at all where there is nothing to run, rather than a
             disabled one: `POST …/functions/{id}/test` needs an id, and a
             function that has not been created has none. A dimmed button would
             be a control whose only message is delivered by its own
             deadness — and `disabled:opacity-*` is a dead class in this repo
             anyway (cascade collision #2). The sentence to its left says why. -->
        <SfereButton v-if="canRun" size="sm" :loading="testing" @click="run">
          <SfereIcon name="play" size="sm" />
          Run test
        </SfereButton>
      </div>
    </div>

    <div v-if="tab === 'event'" class="sfere-flush grid gap-2">
      <FormField
        label="Sample event"
        for-id="function-test-event"
        :hint="eventHint"
        :error="parseError"
      >
        <SfereTextarea
          id="function-test-event"
          v-model="eventText"
          :rows="12"
          class="font-sfere-mono!"
          :disabled="!canRun"
          :invalid="Boolean(parseError)"
        />
      </FormField>
    </div>

    <!-- The one tab that carries no control. `FunctionTestRequest` is
         `{event, code}` and has no environment field, so a box here would take
         input the request cannot send — which is worse than an absence,
         because nothing would say the values had been dropped. -->
    <div v-else-if="tab === 'env'" class="sfere-flush grid gap-2">
      <p class="text-sm text-ink"
        >Environment variables are not passed to a test run yet.</p
      >
      <p class="max-w-[70ch] text-xs text-muted"
        >A test request carries the event and the code, and nothing else. There
        is no box here on purpose: values typed into one would be dropped on the
        way to the backend, and nothing on screen would tell you.</p
      >
    </div>

    <div v-else-if="tab === 'result'" class="sfere-flush grid gap-3">
      <!-- The one reading that matters: a filter that dropped the event
           SUCCEEDED. `describeTestResult` owns that distinction; a panel that
           painted `dropped: true` red would tell someone their working filter
           is broken. -->
      <NoticeBanner
        v-if="verdict"
        :tone="verdict.tone"
        :title="verdict.title"
        :message="verdict.message"
      />

      <SfereCode
        v-if="result && result.result"
        filename="Returned event"
        :code="prettyResult"
      />

      <p v-if="result && result.durationMs != null" class="text-xs text-subtle"
        >Ran in {{ result.durationMs }}ms.</p
      >

      <p v-if="!result" class="text-sm text-muted">{{ idleResultNote }}</p>
    </div>

    <div v-else class="sfere-flush grid gap-2">
      <ol v-if="logs.length" class="grid gap-1">
        <li
          v-for="(entry, index) in logs"
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

      <p v-else class="text-sm text-muted">{{ idleLogsNote }}</p>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereCode from '@/components/ui/SfereCode.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import TabNav from '@/components/ui/TabNav.vue'
import { describeTestResult } from '@/composables/useFunctions'

// The one test surface for a function, on both the create page and the detail
// page — it replaced `FunctionTestPanel.vue`, which only the detail page had.
// `POST …/functions/{id}/test` is live as of backend PR #16 and returns
// `{ok, result, dropped, error, logs, duration_ms}`, so the result, the log and
// the duration below are all measured rather than illustrated.
//
// Three panels are backed and one is not. The prototype's "Get live event"
// button is NOT built: no endpoint hands the editor a recent real event, and a
// button that fabricates one would be the least honest control on the screen.
const props = defineProps({
  /** The function's `kind` — the only thing that reads `dropped: true`. */
  kind: { type: String, default: 'transform' },
  /** A camelCase `FunctionTestResult`, or null before the first run. */
  result: { type: Object, default: null },
  testing: { type: Boolean, default: false },
  /** Whether the editor above has unsaved changes, which changes what runs. */
  codeDirty: { type: Boolean, default: false },
  /**
   * False before the function exists. The test endpoint is keyed on a function
   * id, so the create page can show the workbench and cannot run it.
   */
  canRun: { type: Boolean, default: true },
  /** Why it cannot run, in the page's own words. Required when `canRun` is false. */
  cannotRunReason: { type: String, default: '' }
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

const tab = ref('event')
const eventText = ref(SAMPLE)
const parseError = ref('')

const logs = computed(() => props.result?.logs ?? [])

const tabs = computed(() => [
  { key: 'event', label: 'Event' },
  { key: 'env', label: 'Test environment variables' },
  { key: 'result', label: 'Last run result' },
  logs.value.length
    ? { key: 'logs', label: 'Logs', count: logs.value.length }
    : { key: 'logs', label: 'Logs' }
])

const lede = computed(() => {
  if (!props.canRun) return props.cannotRunReason
  return props.codeDirty
    ? 'The editor has unsaved changes, so a run uses what is in the box above rather than what is stored.'
    : 'Runs the saved code against one event. Nothing is ingested and nothing is delivered.'
})

const toolbarNote = computed(() =>
  props.canRun
    ? 'Edit the event below, then run it through the function.'
    : props.cannotRunReason
)

const eventHint = computed(() =>
  props.canRun
    ? 'One event, as JSON. Nothing is ingested and nothing is delivered — the function runs once and the result is thrown away.'
    : 'This is the event a run will use. The box takes no input yet, for the same reason there is no Run control: there is nothing to run it against.'
)

const idleResultNote = computed(() =>
  props.canRun
    ? 'Run the test to see what the next stage of the pipe would receive.'
    : 'There is no run to report yet.'
)

const idleLogsNote = computed(() =>
  props.canRun
    ? 'Nothing logged yet. Anything the function writes while it runs appears here.'
    : 'There is no run to report yet.'
)

const verdict = computed(() => describeTestResult(props.result, props.kind))

const prettyResult = computed(() => {
  try {
    return JSON.stringify(props.result?.result, null, 2)
  } catch {
    return String(props.result?.result)
  }
})

// A run answers a question, so the answer is what the card shows next. Watching
// the result rather than the click is what keeps the tab from switching on a
// run that failed before it left the page.
watch(
  () => props.result,
  value => {
    if (value) tab.value = 'result'
  }
)

function resetSample() {
  eventText.value = SAMPLE
  parseError.value = ''
  tab.value = 'event'
}

function run() {
  parseError.value = ''
  let event
  try {
    event = JSON.parse(eventText.value)
  } catch {
    // Caught here rather than sent: a 422 about a malformed body says less than
    // this does, and it says it further from the box you have to fix.
    parseError.value = 'That is not valid JSON. Fix it before running the test.'
    tab.value = 'event'
    return
  }
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    parseError.value = 'A sample event has to be a JSON object.'
    tab.value = 'event'
    return
  }
  emit('run', event)
}
</script>
