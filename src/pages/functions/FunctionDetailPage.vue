<template>
  <q-page class="p-6">
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

    <!-- A bad :id is an empty result, not a failure — rendering ErrorState here
         would tell the smoke run this screen is broken. -->
    <EmptyState
      v-else-if="!fn"
      title="Function not found"
      :description="`No function matches the id “${route.params.id}”. It may have been deleted.`"
    >
      <template #cta>
        <SfereButton :to="{ name: 'functions' }">Back to functions</SfereButton>
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-5">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Kind" :value="kindLabel" :hint="kindDescription" />
        <StatCard
          label="Attached to"
          :value="attachmentLabel(fn)"
          hint="Detach it from a pipe's Functions tab."
        />
        <StatCard
          label="Version"
          :value="fn.version == null ? NOT_KNOWN : `v${fn.version}`"
          :hint="templateHint"
        />
      </div>

      <!-- The one thing this screen cannot do, said once and near the field it
           applies to. `PUT …/functions/{id}` replaces the code and nothing else:
           the handler echoes `name` and `description` back in its response and
           does not persist them upstream, so a rename here would report success
           and vanish on the next read. -->
      <NoticeBanner
        tone="warn"
        title="The name and description cannot be changed"
        message="A function update saves its code only. The backend echoes a new name back in its response and does not store it, so a rename would look like it worked and be gone on the next load. Create a replacement function if the name is wrong."
      />

      <CardPanel>
        <template #header>
          <div class="min-w-0 flex-1">
            <span class="text-sm font-semibold text-ink">Code</span>
            <p class="mt-0.5! text-xs text-muted"
              >Plain JavaScript. Test before saving — the test can run what is
              in this box rather than what is stored.</p
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

      <FunctionTestPanel
        :kind="fn.kind"
        :result="testResult"
        :testing="testing"
        :code-dirty="codeDirty"
        @run="runTest"
      />
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
import { NOT_KNOWN } from '@/lib/emptyValue'
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
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import FunctionTestPanel from '@/components/functions/FunctionTestPanel.vue'
import {
  FUNCTION_KINDS,
  attachmentLabel,
  hasTemplateUpgrade,
  useFunctions
} from '@/composables/useFunctions'
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
  },
  { immediate: true }
)

const codeDirty = computed(
  () => Boolean(fn.value) && code.value !== fn.value.code
)

const kindLabel = computed(
  () => FUNCTION_KINDS.find(k => k.value === fn.value?.kind)?.label ?? NOT_KNOWN
)
const kindDescription = computed(
  () => FUNCTION_KINDS.find(k => k.value === fn.value?.kind)?.description ?? ''
)

const subtitle = computed(() => {
  const f = fn.value
  if (!f) return 'Function'
  return f.description || `Slug: ${f.slug}`
})

const templateHint = computed(() => {
  const f = fn.value
  if (!f?.template) return 'Not created from a template.'
  if (hasTemplateUpgrade(f)) {
    return `From ${f.template} v${f.templateVersion}. v${f.latestTemplateVersion} is available.`
  }
  return `From ${f.template} v${f.templateVersion}.`
})

const deleteMessage = computed(() => {
  const f = fn.value
  if (!f) return ''
  const n = f.attachedPipelineIds.length
  if (n) {
    return `“${f.name}” still runs on ${n} pipe${n === 1 ? '' : 's'}. The backend refuses to delete an attached function, so detach it from each pipe's Functions tab first. Confirming now will not delete it.`
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
      ? `${f.name} is still attached to a pipeline`
      : (res.error ?? `Can't delete ${f.name} yet.`),
    caption: res.conflict ? res.error : undefined,
    color: 'dark',
    position: 'top-right',
    timeout: 6000
  })
}

onMounted(load)
</script>
