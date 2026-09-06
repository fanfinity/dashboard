<template>
  <q-page class="p-6">
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader :title="fn?.name || 'Function'" :subtitle="subtitle">
        <template #actions>
          <SfereIconButton
            v-if="fn"
            icon="trash"
            label="Delete this function"
            variant="danger"
            @click="confirmDelete = true"
          />
        </template>
      </PageHeader>

      <LoadingState v-if="loading" variant="form" :rows="6" />

      <ErrorState
        v-else-if="error"
        title="Couldn't load this function."
        :message="error"
        @retry="load"
      />

      <EmptyState
        v-else-if="apiMissing"
        title="No API yet"
        description="Functions are live as of backend PR #16, and Demo data mode has no fixture for them. Switch Settings → Data source to Real API to edit one."
      />

      <!-- A bad :id is an empty result, not a failure — rendering ErrorState
           here would tell the smoke run this screen is broken. -->
      <EmptyState
        v-else-if="!fn"
        title="Function not found"
        :description="`No function matches the id “${route.params.id}”. It may have been deleted.`"
      >
        <template #cta>
          <SfereButton :to="{ name: 'functions' }"
            >Back to functions</SfereButton
          >
        </template>
      </EmptyState>

      <div v-else class="grid gap-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Type" :value="kindLabel" :hint="kindDescription" />
          <StatCard
            label="Attached to"
            :value="attachmentLabel(fn)"
            :hint="attachedHint"
          />
          <!-- The one card in the row allowed a tint, and only when there is
               something to act on: a template that has moved on since this
               function was installed. -->
          <StatCard
            label="Owner"
            :value="fn.template ? 'Sfere managed' : 'Your team'"
            :hint="ownerHint"
            :tone="upgradeAvailable ? 'warn' : 'neutral'"
          />
        </div>

        <!-- Managed: Sfere installed it with an integration and updates it
             from the template, so the code is shown rather than edited. -->
        <NoticeBanner
          v-if="fn.template"
          tone="info"
          title="This function is managed by Sfere"
          :message="managedMessage"
        />

        <!-- The one thing this screen cannot do, said once and beside the
             fields it applies to. `PUT …/functions/{id}` replaces the code and
             nothing else: the handler echoes `name` and `description` back in
             its response and does not persist them, so a rename here would
             report success and vanish on the next read. -->
        <NoticeBanner
          v-else
          tone="warn"
          title="The name, description and type cannot be changed"
          message="An update saves the code only. The backend echoes a new name back in its response and does not store it, so a rename would look like it worked and be gone on the next load. Create a replacement function if any of the three is wrong."
        />

        <CardPanel v-if="fn.template">
          <template #header>
            <div class="sfere-flush grid min-w-0 flex-1 gap-1">
              <span class="text-sm font-semibold text-ink">Code</span>
              <p class="text-xs text-muted"
                >Read-only. Sfere maintains this code with the integration that
                installed it.</p
              >
            </div>
            <SfereButton
              class="shrink-0"
              variant="secondary"
              size="sm"
              @click="copyCode"
              >{{ copied ? 'Copied' : 'Copy code' }}</SfereButton
            >
          </template>

          <SfereCode
            :filename="`${fn.slug}.js`"
            :code="fn.code || '// empty'"
          />
        </CardPanel>

        <CardPanel v-else>
          <template #header>
            <div class="sfere-flush grid min-w-0 flex-1 gap-1">
              <span class="text-sm font-semibold text-ink">Code</span>
              <p class="text-xs text-muted"
                >Plain JavaScript. Test before saving — a run can use what is in
                this box rather than what is stored.</p
              >
            </div>
            <StatusBadge
              v-if="codeDirty"
              class="shrink-0"
              tone="warn"
              label="Unsaved"
            />
          </template>

          <SfereTextarea
            v-model="code"
            :rows="18"
            class="font-sfere-mono!"
            aria-label="Function code"
          />

          <template #footer>
            <div class="flex flex-wrap items-center gap-3">
              <SfereButton
                size="sm"
                :loading="saving"
                :disabled="!codeDirty"
                @click="save"
                >Save code</SfereButton
              >
              <SfereButton
                variant="secondary"
                size="sm"
                :disabled="!codeDirty"
                @click="code = fn.code"
                >Discard changes</SfereButton
              >
              <p v-if="codeDirty" class="min-w-0 flex-1 text-xs text-subtle"
                >Saving replaces the code on every pipe this function runs on,
                immediately.</p
              >
            </div>
          </template>
        </CardPanel>

        <FunctionWorkbench
          :kind="fn.kind"
          :result="testResult"
          :testing="testing"
          :code-dirty="codeDirty"
          @run="runTest"
        />
      </div>
    </div>

    <ConfirmDialog
      v-model="confirmDelete"
      :title="fn ? `Delete “${fn.name}”?` : 'Delete this function?'"
      :message="deleteMessage"
      confirm-label="Delete function"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereCode from '@/components/ui/SfereCode.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FunctionWorkbench from '@/components/functions/FunctionWorkbench.vue'
import {
  FUNCTION_KINDS,
  attachmentLabel,
  hasTemplateUpgrade,
  useFunctions
} from '@/composables/useFunctions'
import { usePipes } from '@/composables/usePipes'
import { notifyMutationResult } from '@/composables/useMutationFeedback'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const {
  functions,
  loading,
  error,
  apiMissing,
  load,
  update,
  remove: removeFunction,
  test
} = useFunctions()

// Resolved off the loaded list rather than a per-id fetch, the same way every
// other detail screen here does it.
const fn = computed(
  () => functions.value.find(f => f.id === route.params.id) ?? null
)

const code = ref('')
const saving = ref(false)
const copied = ref(false)
const confirmDelete = ref(false)
const testResult = ref(null)
const testing = ref(false)

// Re-seed when the record arrives or changes identity. Guarded on the id rather
// than on the object so a save's own response does not blow away an edit made
// while the request was in flight.
watch(
  () => fn.value?.id,
  () => {
    code.value = fn.value?.code ?? ''
    testResult.value = null
    copied.value = false
  },
  { immediate: true }
)

// Pipes are read LAZILY and only to put names on ids — `attached_pipeline_ids`
// is the real field, and `usePipes().load()` is three requests (pipelines, then
// the two ends). Firing them on every visit, including the ones where the id
// resolves to nothing, would spend that on a hint. Names fall back to the
// count, never to a bare id.
const { load: loadPipes, byId: pipeById } = usePipes()
const pipesRequested = ref(false)

watch(
  () => fn.value?.attachedPipelineIds.length ?? 0,
  count => {
    if (!count || pipesRequested.value) return
    pipesRequested.value = true
    loadPipes()
  },
  { immediate: true }
)

const attachedNames = computed(() =>
  (fn.value?.attachedPipelineIds ?? [])
    .map(id => pipeById(id)?.name)
    .filter(Boolean)
)

// Names are used ONLY when every attached id resolved. A partial list reads as
// the whole list: "detach it from A and B" on a function that is also on C
// sends someone to detach two pipes and hit the same 409. Falling back to the
// count is vaguer and true.
const namesComplete = computed(
  () =>
    Boolean(fn.value?.attachedPipelineIds.length) &&
    attachedNames.value.length === fn.value.attachedPipelineIds.length
)

/** `'A'`, `'A and B'`, `'A, B and C'`. */
function listNames(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const attachedHint = computed(() => {
  if (!fn.value?.attachedPipelineIds.length) {
    return 'It runs on no pipes, so no events pass through it yet.'
  }
  if (namesComplete.value) return listNames(attachedNames.value)
  return "Detach it from a pipe's Functions tab before deleting it."
})

const upgradeAvailable = computed(() => hasTemplateUpgrade(fn.value))

const kindLabel = computed(
  () => FUNCTION_KINDS.find(k => k.value === fn.value?.kind)?.label ?? ''
)
const kindDescription = computed(
  () => FUNCTION_KINDS.find(k => k.value === fn.value?.kind)?.description ?? ''
)

const subtitle = computed(() => {
  const f = fn.value
  if (!f) return 'Function'
  return f.description || `Slug: ${f.slug}`
})

const ownerHint = computed(() => {
  const f = fn.value
  if (!f) return ''
  if (!f.template) return 'Written on this account.'
  if (upgradeAvailable.value) {
    return `Installed from ${f.template} v${f.templateVersion}. v${f.latestTemplateVersion} is available.`
  }
  return `Installed from ${f.template}${f.templateVersion == null ? '' : ` v${f.templateVersion}`}.`
})

const managedMessage = computed(() => {
  const f = fn.value
  if (!f) return ''
  const base =
    'Sfere installed this function with an integration and updates it from its template, so the code is shown here rather than edited — a change made here would be replaced by the next template update. You can read it and run it against a sample event.'
  return upgradeAvailable.value
    ? `${base} A newer version of the template (v${f.latestTemplateVersion}) is available.`
    : base
})

const codeDirty = computed(
  () => Boolean(fn.value) && !fn.value.template && code.value !== fn.value.code
)

const deleteMessage = computed(() => {
  const f = fn.value
  if (!f) return ''
  const n = f.attachedPipelineIds.length
  if (n) {
    const where = namesComplete.value
      ? `on ${listNames(attachedNames.value)}`
      : `on ${n} pipe${n === 1 ? '' : 's'}`
    return `“${f.name}” still runs ${where}. The backend refuses to delete an attached function, so detach it from each pipe's Functions tab first. Confirming now will not delete it.`
  }
  if (f.template) {
    return `“${f.name}” was installed by Sfere with an integration, and deleting it stops that integration's events being reshaped. It runs on no pipes, so nothing changes route today, and the code is not recoverable from here.`
  }
  return `“${f.name}” is removed and the code is not recoverable. It runs on no pipes, so no events change route.`
})

async function save() {
  saving.value = true
  try {
    const res = await update(fn.value.id, code.value)
    notifyMutationResult($q, res, {
      success: 'Code saved',
      apiMissing: "Can't save this function yet."
    })
  } finally {
    saving.value = false
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(fn.value?.code ?? '')
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    $q.notify({
      message:
        "This browser wouldn't let the page copy — select the code instead.",
      color: 'dark',
      position: 'top-right',
      timeout: 4000
    })
  }
}

/**
 * Runs the editor's content when it differs from what is stored — that is what
 * `FunctionTestRequest.code` is for, and it is the difference between testing
 * your edit and testing last week's.
 */
async function runTest(event) {
  testing.value = true
  testResult.value = null
  try {
    const res = await test(fn.value.id, {
      event,
      code: codeDirty.value ? code.value : undefined
    })
    if (res.ok) {
      testResult.value = res.data
      return
    }
    notifyMutationResult($q, res, {
      success: '',
      apiMissing: "Can't run a function test yet."
    })
  } finally {
    testing.value = false
  }
}

async function remove() {
  const f = fn.value
  const res = await removeFunction(f.id)
  if (res.ok) {
    $q.notify({
      message: `${f.name} deleted`,
      color: 'dark',
      position: 'top-right',
      timeout: 3000
    })
    router.push({ name: 'functions' })
    return
  }
  $q.notify({
    message: res.conflict
      ? `${f.name} is still attached to a pipeline — detach it first`
      : (res.error ?? `Can't delete ${f.name} yet.`),
    caption: res.conflict ? res.error : undefined,
    color: 'dark',
    position: 'top-right',
    timeout: 6000
  })
}

onMounted(load)
</script>
