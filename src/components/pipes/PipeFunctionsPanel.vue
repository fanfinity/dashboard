<template>
  <CardPanel v-if="apiAvailable">
    <template #header>
      <div class="min-w-0 flex-1">
        <span class="text-sm font-medium text-ink">Functions</span>
        <p class="mt-0.5! text-xs text-subtle">
          {{ functions.length }}
          {{ functions.length === 1 ? 'function' : 'functions' }} on this pipe,
          run top to bottom
        </p>
      </div>
      <!-- Attaching is a real write now (`POST …/pipelines/{id}/functions`,
           backend PR #16). Only functions not already on this pipe are offered:
           the same function twice in one chain is not a thing anyone means. -->
      <div v-if="attachable.length" class="flex shrink-0 items-center gap-2">
        <SfereSelect
          v-model="attachChoice"
          :options="attachOptions"
          class="w-56"
          aria-label="Function to attach"
        />
        <SfereButton
          size="sm"
          variant="secondary"
          :loading="attaching"
          :disabled="!attachChoice"
          @click="onAttach"
          >Attach</SfereButton
        >
      </div>
    </template>

    <LoadingState v-if="loading" variant="form" :rows="3" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load this pipe's functions."
      :message="error"
      @retry="load(pipelineId)"
    />

    <p v-else-if="!functions.length" class="text-sm text-muted">
      No functions are attached to this pipe yet. Functions are provisioned
      automatically once the pipe is backed by a Jitsu connection.
    </p>

    <div v-else class="flex flex-col gap-5">
      <div
        v-for="(fn, index) in functions"
        :key="fn.functionId"
        class="flex flex-col gap-3 rounded-xl border border-line2 bg-white p-4"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-medium text-ink">{{ fn.name }}</span>
          <StatusBadge tone="neutral" :label="fn.template" />
          <StatusBadge
            v-if="fn.templateVersion < fn.latestTemplateVersion"
            tone="brand"
            label="New default available. Reset to upgrade"
          />
          <span class="ml-auto flex items-center gap-2">
            <!-- Order matters: these run in sequence, so a filter placed after
                 a transform sees the transformed event. Reordering sends the
                 COMPLETE id list — `reorderPipelineFunctions` 422s on a partial
                 one rather than treating an omission as a detach — which is why
                 this calls `move()` instead of assembling an array here. -->
            <button
              class="rounded-lg border border-line2 bg-white px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-fill disabled:opacity-40"
              :disabled="index === 0 || Boolean(busy[fn.functionId])"
              aria-label="Move earlier in the chain"
              @click="onMove(fn, -1)"
            >
              ↑
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-fill disabled:opacity-40"
              :disabled="
                index === functions.length - 1 || Boolean(busy[fn.functionId])
              "
              aria-label="Move later in the chain"
              @click="onMove(fn, 1)"
            >
              ↓
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-xs font-medium text-muted hover:bg-fill disabled:opacity-40"
              :disabled="busy[fn.functionId]"
              @click="resetFunction(fn)"
            >
              Reset to default
            </button>
            <button
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-fill disabled:opacity-40"
              :disabled="busy[fn.functionId]"
              @click="askDetach(fn)"
            >
              Detach
            </button>
            <button
              class="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              :disabled="!isDirty(fn) || busy[fn.functionId]"
              @click="saveFunction(fn)"
            >
              {{ busy[fn.functionId] === 'save' ? 'Saving…' : 'Save' }}
            </button>
          </span>
        </div>

        <textarea
          v-model="drafts[fn.functionId]"
          class="h-72 w-full resize-y rounded-lg border border-line2 bg-sidebar p-3 font-mono text-xs leading-5 text-ink focus:border-brand focus:outline-none"
          spellcheck="false"
        ></textarea>

        <!-- Test playground: runs the editor's code locally, nothing is sent
             to Jitsu. -->
        <div
          class="flex flex-col gap-2 rounded-lg border border-line2 bg-fill/40 p-3"
        >
          <button
            class="flex items-center gap-1.5 self-start text-xs font-medium text-subtle hover:text-ink"
            @click="toggleTest(fn.functionId)"
          >
            <span>{{ testOpen[fn.functionId] ? '▾' : '▸' }}</span>
            Test with a sample event
          </button>

          <template v-if="testOpen[fn.functionId]">
            <textarea
              v-model="testInputs[fn.functionId]"
              class="h-36 w-full resize-y rounded-lg border border-line2 bg-sidebar p-3 font-mono text-xs leading-5 text-ink focus:border-brand focus:outline-none"
              spellcheck="false"
              placeholder='{ "type": "track", "event": "AddToCart" }'
            ></textarea>
            <div class="flex items-center gap-2">
              <button
                class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-xs font-medium text-brand hover:bg-fill disabled:opacity-40"
                :disabled="busy[fn.functionId] === 'test'"
                @click="runTest(fn)"
              >
                {{ busy[fn.functionId] === 'test' ? 'Running…' : 'Run test' }}
              </button>
              <span class="text-xs text-subtle">
                Runs in your browser only. Nothing is sent to Jitsu.
              </span>
            </div>

            <div
              v-if="testResults[fn.functionId]"
              class="flex flex-col gap-2 rounded-lg border border-line2 bg-white p-3"
            >
              <div class="flex items-center gap-2">
                <StatusBadge
                  :tone="outcomeTone(testResults[fn.functionId].outcome)"
                  :label="outcomeLabel(testResults[fn.functionId].outcome)"
                />
                <span class="text-xs text-subtle"
                  >{{ testResults[fn.functionId].durationMs }} ms</span
                >
              </div>
              <p
                v-if="testResults[fn.functionId].error"
                class="text-xs text-danger"
                >{{ testResults[fn.functionId].error }}</p
              >
              <pre
                v-if="testResults[fn.functionId].result != null"
                class="max-h-80 overflow-auto rounded-lg bg-sidebar p-3 font-mono text-xs leading-5 text-muted"
                >{{ pretty(testResults[fn.functionId].result) }}</pre
              >
              <div
                v-if="testResults[fn.functionId].logs.length"
                class="flex flex-col gap-0.5"
              >
                <p class="text-xs font-medium text-subtle">Logs</p>
                <p
                  v-for="(entry, i) in testResults[fn.functionId].logs"
                  :key="i"
                  class="font-mono text-xs text-muted"
                >
                  [{{ entry.level }}] {{ entry.message }}
                </p>
              </div>
            </div>
          </template>
        </div>
      </div>

      <p class="text-xs text-subtle">
        These run in the order shown, each receiving what the one above
        returned. A function that returns nothing drops the event, so anything
        below it never sees that event at all.
      </p>
    </div>

    <ConfirmDialog
      v-model="detachOpen"
      :title="
        detachTarget
          ? `Detach “${detachTarget.name}”?`
          : 'Detach this function?'
      "
      :message="detachMessage"
      confirm-label="Detach function"
      destructive
      @confirm="onDetach"
    />
  </CardPanel>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereSelect from '@/components/ui/SfereSelect.vue'
import { usePipelineFunctions } from '@/composables/usePipelineFunctions'
import { useFunctions } from '@/composables/useFunctions'
import { runPipelineFunction } from '@/lib/pipelineFunctionRunner'

const props = defineProps({
  pipelineId: { type: String, required: true },
  apiAvailable: { type: Boolean, default: false }
})
const emit = defineEmits(['loaded'])

const $q = useQuasar()
const { functions, loading, error, load, save, reset, attach, detach, move } =
  usePipelineFunctions()

// The account library, so the attach control can offer something. Read here
// rather than passed in: this panel is the only place on the pipe screen that
// needs it, and the list is small.
const { functions: libraryFunctions, load: loadLibrary } = useFunctions()

const attachChoice = ref('')
const attaching = ref(false)
const detachOpen = ref(false)
const detachTarget = ref(null)

/** Account functions not already on this pipe. */
const attachable = computed(() => {
  const attached = new Set(functions.value.map(f => f.functionId))
  return libraryFunctions.value.filter(f => !attached.has(f.id))
})

const attachOptions = computed(() =>
  attachable.value.map(f => ({ value: f.id, label: f.name }))
)

const detachMessage = computed(() => {
  const fn = detachTarget.value
  if (!fn) return ''
  return `“${fn.name}” stops running on this pipe from the next event onwards. The function itself is not deleted — it stays in Functions and on any other pipe it is attached to, so you can attach it back here at any time.`
})

async function onAttach() {
  if (!attachChoice.value) return
  attaching.value = true
  try {
    // No `position`: a function added to an existing chain goes last, which is
    // what "add a step" means almost every time. Reorder afterwards if not.
    await attach(props.pipelineId, attachChoice.value)
    const name =
      libraryFunctions.value.find(f => f.id === attachChoice.value)?.name ??
      'Function'
    attachChoice.value = ''
    $q.notify({
      message: `${name} attached, last in the chain`,
      color: 'dark',
      position: 'top-right',
      timeout: 3000
    })
  } catch (e) {
    $q.notify({
      message: e.message || 'Could not attach that function.',
      color: 'dark',
      position: 'top-right',
      timeout: 5000
    })
  } finally {
    attaching.value = false
  }
}

function askDetach(fn) {
  detachTarget.value = fn
  detachOpen.value = true
}

async function onDetach() {
  const fn = detachTarget.value
  if (!fn) return
  try {
    await detach(props.pipelineId, fn.functionId)
    $q.notify({
      message: `${fn.name} detached`,
      color: 'dark',
      position: 'top-right',
      timeout: 3000
    })
  } catch (e) {
    $q.notify({
      message: e.message || 'Could not detach that function.',
      color: 'dark',
      position: 'top-right',
      timeout: 5000
    })
  }
  // `detachTarget` is deliberately left set — the dialog's message must not
  // blank out while it fades. `askDetach` overwrites it next time.
}

async function onMove(fn, delta) {
  busy[fn.functionId] = 'move'
  try {
    await move(props.pipelineId, fn.functionId, delta)
  } catch (e) {
    $q.notify({
      message: e.message || 'Could not change the order.',
      color: 'dark',
      position: 'top-right',
      timeout: 5000
    })
  } finally {
    busy[fn.functionId] = null
  }
}

// Editable copies keyed by function id; `functions` holds the last-saved code.
const drafts = reactive({})
const testInputs = reactive({})
const testResults = reactive({})
const testOpen = reactive({})
const busy = reactive({})

const SAMPLE_EVENT = JSON.stringify(
  {
    type: 'track',
    event: 'AddToCart',
    userId: '123',
    properties: { price: 99, quantity: 2 }
  },
  null,
  2
)

watch(
  () => (props.apiAvailable ? props.pipelineId : null),
  async id => {
    if (!id) return
    await load(id)
    for (const fn of functions.value) {
      drafts[fn.functionId] = fn.code
      if (!testInputs[fn.functionId]) testInputs[fn.functionId] = SAMPLE_EVENT
    }
    emit('loaded', functions.value.length)
  },
  { immediate: true }
)

function isDirty(fn) {
  return (
    drafts[fn.functionId] !== undefined && drafts[fn.functionId] !== fn.code
  )
}

function notify(message) {
  $q.notify({ message, color: 'dark', position: 'bottom', timeout: 2500 })
}

async function saveFunction(fn) {
  busy[fn.functionId] = 'save'
  try {
    await save(props.pipelineId, fn.functionId, drafts[fn.functionId])
    notify(`${fn.name} saved. Live on this pipe immediately.`)
  } catch (e) {
    notify(`Couldn't save ${fn.name}: ${e?.message || 'request failed'}`)
  } finally {
    delete busy[fn.functionId]
  }
}

async function resetFunction(fn) {
  busy[fn.functionId] = 'reset'
  try {
    const updated = await reset(props.pipelineId, fn.functionId)
    drafts[fn.functionId] = updated.code
    notify(`${fn.name} reset to the default template.`)
  } catch (e) {
    notify(`Couldn't reset ${fn.name}: ${e?.message || 'request failed'}`)
  } finally {
    delete busy[fn.functionId]
  }
}

function toggleTest(id) {
  testOpen[id] = !testOpen[id]
}

async function runTest(fn) {
  let event
  try {
    event = JSON.parse(testInputs[fn.functionId] || '')
  } catch (e) {
    testResults[fn.functionId] = {
      outcome: 'error',
      error: `Sample event is not valid JSON: ${e.message}`,
      logs: [],
      result: null,
      durationMs: 0
    }
    return
  }
  busy[fn.functionId] = 'test'
  try {
    // Tests the editor's current draft, not the last-saved code.
    testResults[fn.functionId] = await runPipelineFunction(
      drafts[fn.functionId],
      event
    )
  } finally {
    delete busy[fn.functionId]
  }
}

const OUTCOME_TONE = {
  delivered: 'success',
  dropped: 'neutral',
  error: 'danger',
  timeout: 'danger'
}

function outcomeTone(outcome) {
  return OUTCOME_TONE[outcome] ?? 'neutral'
}

function outcomeLabel(outcome) {
  return (
    {
      delivered: 'Delivered',
      dropped: 'Dropped (returned nothing)',
      error: 'Error',
      timeout: 'Timed out'
    }[outcome] ?? outcome
  )
}

function pretty(value) {
  return JSON.stringify(value, null, 2)
}

// The attach control needs the account library. Loaded once on mount rather
// than per pipe: the library is account-scoped, not pipeline-scoped.
onMounted(() => {
  if (props.apiAvailable) loadLibrary()
})
</script>
