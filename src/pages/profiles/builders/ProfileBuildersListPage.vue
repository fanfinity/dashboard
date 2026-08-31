<template>
  <q-page class="p-6">
    <PageHeader
      title="Profile builders"
      subtitle="How a fan profile is assembled: which identifiers it is stitched on, in what order of trust, and on what schedule."
    >
      <template #actions>
        <SfereIconButton
          icon="plus"
          label="New profile builder"
          variant="primary"
          @click="openCreate"
        />
      </template>
    </PageHeader>

    <!-- The distinction worth stating on the screen itself, because the two live
         one nav row apart and only one of them works. -->
    <NoticeBanner
      class="mb-5"
      tone="info"
      title="This is the configuration, not the profiles"
      message="Profile builders decide how profiles are assembled. Reading the profiles themselves needs GET /v1/accounts/{account}/profiles, which is in the API contract with nothing behind it yet — which is why Profile search still reports no API."
    />

    <DataTable
      :columns="columns"
      :rows="builders"
      :loading="loading"
      :error="error"
      :api-missing="apiMissing"
      row-key="id"
      @retry="load"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">
          <code class="font-sfere-mono">{{ row.slug }}</code>
        </p>
      </template>

      <!-- Rendered as an arrow chain rather than a list of chips, because the
           ORDER is the configuration: it decides which identifier wins when two
           disagree about who a profile is. -->
      <template #cell-identifierTypes="{ row }">
        <span class="text-muted">{{ identifierLabel(row, labelFor) }}</span>
      </template>

      <template #cell-isEnabled="{ row }">
        <StatusBadge
          :tone="row.isEnabled ? 'success' : 'neutral'"
          :label="row.isEnabled ? 'Enabled' : 'Paused'"
        />
      </template>

      <template #cell-cron="{ row }">
        <span class="text-muted">{{ scheduleLabel(row) }}</span>
      </template>

      <template #cell-lastRunAt="{ row }">
        <span class="whitespace-nowrap text-muted">{{
          formatDateTime(row.lastRunAt, NEVER)
        }}</span>
      </template>

      <!-- `NOT_KNOWN`, never 0. `profile_count` is nullable and nothing counts
           it yet; a confident 0 would say the builder produced nothing. -->
      <template #cell-profileCount="{ row }">
        <span class="text-muted">{{ profileCountLabel(row) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill"
            @click.stop="askToggle(row)"
          >
            {{ row.isEnabled ? 'Pause' : 'Enable' }}
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill"
            @click.stop="openEdit(row)"
          >
            Edit
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="askDelete(row)"
          >
            Delete
          </button>
        </div>
      </template>

      <template #empty>
        <EmptyState
          title="No profile builders yet"
          description="A builder decides how events are stitched into one fan profile. Without one, events land in the warehouse and are never joined into a person."
        >
          <template #cta>
            <SfereButton @click="openCreate">Add a profile builder</SfereButton>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ProfileBuilderEditDialog
      v-model="editOpen"
      :builder="editing"
      :identifier-types="identifierTypes"
      :destinations="destinations"
      :submitting="submitting"
      :api-missing="!isReal"
      @submit="onSubmit"
    />

    <!-- Its own target ref, separate from the delete flow's: two dialogs reading
         one row is how a confirm acts on the wrong record. -->
    <ConfirmDialog
      v-model="confirmToggle"
      :title="toggleTitle"
      :message="toggleMessage"
      :confirm-label="
        toggleTarget?.isEnabled ? 'Pause builder' : 'Enable builder'
      "
      @confirm="toggle"
    />

    <ConfirmDialog
      v-model="confirmDelete"
      :title="deleteTitle"
      :message="deleteMessage"
      confirm-label="Delete builder"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { NEVER } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import ProfileBuilderEditDialog from '@/components/profiles/builders/ProfileBuilderEditDialog.vue'
import {
  identifierLabel,
  profileCountLabel,
  scheduleLabel,
  useProfileBuilders
} from '@/composables/useProfileBuilders'
import { useIdentifierTypes } from '@/composables/useIdentifierTypes'
import { useDestinations } from '@/composables/useDestinations'
import { useDataSource } from '@/composables/useDataSource'
import { notifyMutationResult } from '@/composables/useMutationFeedback'
import { formatDateTime } from '@/composables/useSources'

// `GET/POST …/profile-builders` and `GET/PUT/DELETE …/profile-builders/{id}`,
// all live as of backend PR #16.
const $q = useQuasar()
const { isReal } = useDataSource()

const {
  builders,
  loading,
  error,
  apiMissing,
  load,
  create,
  update,
  setEnabled,
  remove: removeBuilder
} = useProfileBuilders()

// The identifier keys a builder may stitch on, from the live catalog rather than
// a hardcoded list — those keys are what `identifier_types` holds.
const { identifierTypes, load: loadIdentifierTypes } = useIdentifierTypes()

// A builder can write its profiles into a destination, so the picker needs the
// account's real destinations.
const { destinations, load: loadDestinations } = useDestinations()

const editOpen = ref(false)
const editing = ref(null)
const submitting = ref(false)
const confirmToggle = ref(false)
const toggleTarget = ref(null)
const confirmDelete = ref(false)
const deleteTarget = ref(null)

const columns = [
  { key: 'name', label: 'Builder', sortable: true },
  { key: 'identifierTypes', label: 'Stitched on (most trusted first)' },
  { key: 'isEnabled', label: 'Status', sortable: true },
  { key: 'cron', label: 'Schedule' },
  { key: 'lastRunAt', label: 'Last run', sortable: true },
  { key: 'profileCount', label: 'Profiles', align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '230px' }
]

function labelFor(key) {
  return identifierTypes.value.find(t => t.key === key)?.displayName ?? key
}

function openCreate() {
  editing.value = null
  editOpen.value = true
}

function openEdit(row) {
  editing.value = row
  editOpen.value = true
}

async function onSubmit(payload) {
  submitting.value = true
  try {
    const res = editing.value
      ? await update(editing.value.id, { ...editing.value, ...payload })
      : await create(payload)
    notifyMutationResult($q, res, {
      success: editing.value
        ? `${payload.name} saved`
        : `${payload.name} created`,
      apiMissing: "Can't save a profile builder yet."
    })
    if (res.ok) editOpen.value = false
  } finally {
    submitting.value = false
  }
}

function askToggle(row) {
  toggleTarget.value = row
  confirmToggle.value = true
}

const toggleTitle = computed(() =>
  toggleTarget.value?.isEnabled
    ? `Pause “${toggleTarget.value.name}”?`
    : `Enable “${toggleTarget.value?.name ?? 'this builder'}”?`
)

// Says what stops and what is left alone, and deliberately makes no claim about
// what happens to events arriving while it is paused — nothing measured tells us
// whether they are queued, replayed or simply unstitched.
const toggleMessage = computed(() => {
  const b = toggleTarget.value
  if (!b) return ''
  return b.isEnabled
    ? `“${b.name}” stops assembling profiles straight away. Profiles it has already built stay exactly as they are, and events keep landing in the warehouse — they just stop being stitched onto a person until you enable it again.`
    : `“${b.name}” starts assembling profiles again on its next scheduled run.`
})

async function toggle() {
  const b = toggleTarget.value
  if (!b) return
  const res = await setEnabled(b.id, !b.isEnabled)
  notifyMutationResult($q, res, {
    success: `${b.name} ${b.isEnabled ? 'paused' : 'enabled'}`,
    apiMissing: `Can't ${b.isEnabled ? 'pause' : 'enable'} ${b.name} yet.`
  })
}

function askDelete(row) {
  deleteTarget.value = row
  confirmDelete.value = true
}

const deleteTitle = computed(() =>
  deleteTarget.value
    ? `Delete “${deleteTarget.value.name}”?`
    : 'Delete this builder?'
)

const deleteMessage = computed(() => {
  const b = deleteTarget.value
  if (!b) return ''
  return `“${b.name}” is removed and stops assembling profiles. Profiles it already built are not deleted — they live in the warehouse, not here. There is no trash for a profile builder, so the configuration itself cannot be restored.`
})

async function remove() {
  const b = deleteTarget.value
  if (!b) return
  const res = await removeBuilder(b.id)
  notifyMutationResult($q, res, {
    success: `${b.name} deleted`,
    apiMissing: `Can't delete ${b.name} yet.`
  })
}

onMounted(() => {
  load()
  loadIdentifierTypes()
  loadDestinations()
})
</script>
