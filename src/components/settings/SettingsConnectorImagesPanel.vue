<template>
  <CardPanel>
    <template #header>
      <div class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-ink">Connector images</span>
        <p class="mt-0.5! text-xs text-muted"
          >Bring your own Airbyte connector. Registering an image lets a source
          pull from a system that is not in the built-in catalog.</p
        >
      </div>
      <SfereButton
        v-if="!apiMissing"
        class="shrink-0"
        size="sm"
        variant="secondary"
        @click="addOpen = true"
        >Register an image</SfereButton
      >
    </template>

    <!-- Said once, because it explains the "Preparing" rows below rather than
         each one having to. -->
    <NoticeBanner
      v-if="hasPending"
      class="mb-4"
      tone="info"
      title="An image is still being prepared"
      message="The backend fetches and inspects a newly registered image before it can be used. A Preparing row is work in progress, not a failure — it finishes on its own, and this list refreshes while it does."
    />

    <DataTable
      :columns="columns"
      :rows="images"
      :loading="loading"
      :error="error"
      :api-missing="apiMissing"
      row-key="id"
      @retry="emit('retry')"
    >
      <template #cell-package="{ row }">
        <code class="font-sfere-mono text-sm text-ink"
          >{{ row.package }}:{{ row.version }}</code
        >
        <p v-if="row.error" class="text-xs text-rose-600">{{ row.error }}</p>
      </template>

      <template #cell-protocol="{ value }">
        <span class="text-muted">{{ value || NOT_KNOWN }}</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge
          :tone="imageStatusBadge(row.status).tone"
          :label="imageStatusBadge(row.status).label"
        />
      </template>

      <template #cell-createdAt="{ value }">
        <span class="whitespace-nowrap text-muted">{{
          formatDate(value)
        }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="askRemove(row)"
          >
            Remove
          </button>
        </div>
      </template>

      <template #empty>
        <EmptyState
          title="No custom connector images"
          description="Sources are pulled with the built-in connectors. Register an Airbyte image to add one that is not on that list."
        >
          <template #cta>
            <SfereButton size="sm" @click="addOpen = true"
              >Register an image</SfereButton
            >
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="addOpen"
      title="Register a connector image"
      message="The backend fetches and inspects the image before it can be used, so it appears as Preparing for a while."
      confirm-label="Register image"
      :loading="creating"
      @confirm="submitAdd"
    >
      <div class="flex flex-col gap-3">
        <FormField
          label="Package"
          required
          for-id="image-package"
          hint="The published image name, without a tag."
          :error="errors.package"
        >
          <SfereInput
            id="image-package"
            v-model="draft.package"
            placeholder="airbyte/source-hubspot"
            autocomplete="off"
          />
        </FormField>

        <FormField
          label="Version"
          required
          for-id="image-version"
          hint="The tag to pull. Pin a real version rather than using latest, so a rebuild upstream cannot change what your syncs run."
          :error="errors.version"
        >
          <SfereInput
            id="image-version"
            v-model="draft.version"
            placeholder="4.2.1"
            autocomplete="off"
          />
        </FormField>

        <!-- Write-only: `ConnectorImageCreate` accepts it, `ConnectorImage` has
             no such field, and there is no update route. So it is asked for once
             and never shown back, which is also why nothing here keeps it after
             the request. -->
        <FormField
          label="Registry credentials"
          optional
          for-id="image-credentials"
          hint="Only for a private registry. JSON, sent once and never returned — there is nothing to edit afterwards, only re-register."
          :error="errors.credentials"
        >
          <SfereTextarea
            id="image-credentials"
            v-model="draft.credentials"
            :rows="3"
            placeholder='{ "username": "…", "password": "…" }'
          />
        </FormField>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      v-model="removeOpen"
      :title="
        removeTarget
          ? `Remove ${removeTarget.package}:${removeTarget.version}?`
          : 'Remove this image?'
      "
      :message="removeMessage"
      confirm-label="Remove image"
      destructive
      @confirm="submitRemove"
    />
  </CardPanel>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, reactive, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { imageStatusBadge } from '@/composables/useConnectorImages'
import { formatDate } from '@/composables/useSources'

// `GET/POST …/connector-images` and `DELETE …/connector-images/{id}`, live as of
// backend PR #16.
defineProps({
  images: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false },
  hasPending: { type: Boolean, default: false },
  creating: { type: Boolean, default: false }
})

const emit = defineEmits(['retry', 'create', 'remove'])

const columns = [
  { key: 'package', label: 'Image', sortable: true },
  { key: 'protocol', label: 'Protocol' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Registered', align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '130px' }
]

const addOpen = ref(false)
const draft = reactive({ package: '', version: '', credentials: '' })
const errors = reactive({ package: '', version: '', credentials: '' })

watch(addOpen, isOpen => {
  if (!isOpen) {
    // Cleared on close as well as on open: the credentials box holds a registry
    // password, and there is no reason for it to sit in memory afterwards.
    draft.credentials = ''
    return
  }
  draft.package = ''
  draft.version = ''
  draft.credentials = ''
  errors.package = ''
  errors.version = ''
  errors.credentials = ''
})

const removeOpen = ref(false)
const removeTarget = ref(null)

const removeMessage = computed(() => {
  const i = removeTarget.value
  if (!i) return ''
  return `Sources configured against ${i.package}:${i.version} cannot sync once the image is gone, and their next scheduled run fails. Data already pulled is untouched — it is in the warehouse. Registering the same image again is possible, so this is recoverable, but the syncs in between will have failed.`
})

function askRemove(row) {
  removeTarget.value = row
  removeOpen.value = true
}

function submitAdd() {
  errors.package = draft.package.trim() ? '' : 'Name the image.'
  errors.version = draft.version.trim() ? '' : 'Pin a version.'
  errors.credentials = ''

  let credentials = null
  const raw = draft.credentials.trim()
  if (raw) {
    try {
      credentials = JSON.parse(raw)
    } catch {
      // Caught here rather than sent: a 422 about a body says less than this,
      // and a rejected request means re-typing a password.
      errors.credentials = 'That is not valid JSON.'
    }
  }

  if (errors.package || errors.version || errors.credentials) return

  emit('create', {
    package: draft.package.trim(),
    version: draft.version.trim(),
    credentials
  })
  // Dropped immediately: the request has it, and this component should not.
  draft.credentials = ''
}

function submitRemove() {
  if (removeTarget.value) emit('remove', removeTarget.value)
}
</script>
