<template>
  <q-page class="p-6">
    <PageHeader
      title="Secrets"
      subtitle="Encrypted credentials your pipe functions read back as secrets.KEY_NAME."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search secrets..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="showForm = !showForm"
        >
          {{ showForm ? 'Close' : 'Add secret' }}
        </button>
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && secrets.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard label="Secrets" :value="formatCount(secrets.length)" />
      <StatCard
        label="Referenced"
        :value="`${inUseCount} of ${secrets.length}`"
        hint="Read by a destination or a function"
      />
      <StatCard
        label="Never used"
        :value="formatCount(unusedCount)"
        :hint="unusedCount ? 'Safe to delete once confirmed' : 'All in use'"
      />
      <StatCard
        label="In trash"
        :value="trashError ? '—' : formatCount(deleted.length)"
        :hint="
          trashError ? 'Open the Trash tab to retry' : 'Restorable for 30 days'
        "
      />
    </div>

    <NoticeBanner
      v-if="!loading && !error && unusedCount"
      class="mb-5"
      variant="info"
      :title="unusedTitle"
      message="A credential nobody reads is a credential nobody rotates. Delete the ones you no longer need."
    />

    <SettingsSecretForm
      v-if="showForm"
      :existing-keys="existingKeys"
      @submit="addSecret"
      @cancel="showForm = false"
    />

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="isTrashTab ? trashLoading : loading"
      :error="isTrashTab ? trashError : error"
      row-key="id"
      @retry="retry"
    >
      <template #cell-key="{ row }">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-mono font-medium text-ink">{{ row.key }}</p>
          <!-- The reference, not the credential: this is the string a function
               author pastes, and it is safe on the clipboard. -->
          <button
            class="rounded-lg border border-line2 bg-white px-2.5 py-1 text-xs font-medium text-brand hover:bg-fill"
            @click.stop="copyReference(row)"
          >
            Copy reference
          </button>
        </div>
        <p v-if="row.description" class="mt-0.5 text-xs text-subtle">{{
          row.description
        }}</p>
      </template>

      <template #cell-value="{ row }">
        <SettingsSecretValue :preview="row.valuePreview" />
      </template>

      <template #cell-usedBy="{ row }">
        <p class="text-muted">{{ usedByCount(row) }}</p>
        <p v-if="usedByNames(row)" class="truncate text-xs text-subtle">{{
          usedByNames(row)
        }}</p>
      </template>

      <template #cell-version="{ value }">v{{ value }}</template>

      <template #cell-lastUsedAt="{ value }">
        {{ formatDateTime(value) }}
      </template>

      <template #cell-deletedAt="{ row }">
        <p class="text-muted">{{ formatDateTime(row.deletedAt) }}</p>
        <p class="text-xs text-subtle">by {{ row.deletedByName }}</p>
      </template>

      <template #cell-actions="{ row }">
        <div v-if="isTrashTab" class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="restoreSecret(row)"
          >
            Restore
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="askPurge(row)"
          >
            Delete forever
          </button>
        </div>

        <div v-else class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click.stop="rotate(row)"
          >
            Rotate
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click.stop="askDelete(row)"
          >
            Delete
          </button>
        </div>
      </template>

      <!-- Three "no rows" cases, and they want different things: a filter that
           matched nothing, an empty trash (the good outcome) and a workspace
           with no secrets at all. -->
      <template #empty>
        <EmptyState :title="emptyTitle" :description="emptyDescription">
          <template #cta>
            <button
              v-if="filteredEmpty"
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="clearFilters"
            >
              Clear filters
            </button>
            <button
              v-else-if="isTrashTab"
              class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
              @click="tab = 'all'"
            >
              All secrets
            </button>
            <button
              v-else
              class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="showForm = true"
            >
              Add your first secret
            </button>
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move secret to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
      destructive
      @confirm="removeSecret"
    />

    <ConfirmDialog
      v-model="confirmPurge"
      title="Delete secret forever?"
      :message="purgeMessage"
      confirm-label="Delete forever"
      destructive
      @confirm="purgeSecret"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatCard from '@/components/ui/StatCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SettingsSecretValue from '@/components/settings/SettingsSecretValue.vue'
import SettingsSecretForm from '@/components/settings/SettingsSecretForm.vue'
import { formatCount, formatDateTime } from '@/composables/useSettingsFormat'
import {
  secretReference,
  useSettingsSecrets,
  useSettingsSecretsTrash
} from '@/composables/useSettingsSecrets'

const $q = useQuasar()

const { secrets, loading, error, load, add, remove, restoreRecord } =
  useSettingsSecrets()

// The trash is its own resource with its own retry: it backs one tab, so a
// failure there must not take the live list down with it.
const {
  deleted,
  loading: trashLoading,
  error: trashError,
  load: loadTrash,
  restore,
  purge
} = useSettingsSecretsTrash()

const query = ref('')
const tab = ref('all')
const showForm = ref(false)
const confirmDelete = ref(false)
const confirmPurge = ref(false)
const target = ref(null)

const isTrashTab = computed(() => tab.value === 'trash')

const LIVE_COLUMNS = [
  { key: 'key', label: 'Key', sortable: true },
  { key: 'value', label: 'Value', width: '250px' },
  { key: 'usedBy', label: 'Used by' },
  { key: 'version', label: 'Version', sortable: true, align: 'right' },
  { key: 'lastUsedAt', label: 'Last used', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '190px' }
]

const TRASH_COLUMNS = [
  { key: 'key', label: 'Key', sortable: true },
  { key: 'value', label: 'Value', width: '250px' },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '230px' }
]

const columns = computed(() =>
  isTrashTab.value ? TRASH_COLUMNS : LIVE_COLUMNS
)

// Each tab is a predicate over a live secret; 'all' has none and 'trash' reads
// a different collection entirely.
const TAB_PREDICATES = {
  used: s => (s.usedByCount ?? 0) > 0,
  unused: s => !(s.usedByCount ?? 0)
}

const inUseCount = computed(
  () => secrets.value.filter(TAB_PREDICATES.used).length
)
const unusedCount = computed(
  () => secrets.value.filter(TAB_PREDICATES.unused).length
)

const unusedTitle = computed(
  () =>
    `${unusedCount.value} secret${unusedCount.value === 1 ? ' is' : 's are'} not referenced by anything`
)

const tabs = computed(() => [
  { key: 'all', label: 'All', count: secrets.value.length },
  { key: 'used', label: 'Referenced', count: inUseCount.value },
  { key: 'unused', label: 'Unused', count: unusedCount.value },
  {
    key: 'trash',
    label: 'Trash',
    count: trashError.value ? undefined : deleted.value.length
  }
])

const existingKeys = computed(() => secrets.value.map(s => s.key))

const SEARCH_FIELDS = ['key', 'description']

function matchesQuery(secret, q) {
  if (!q) return true
  if ((secret.usedBy ?? []).some(u => u.name.toLowerCase().includes(q))) {
    return true
  }
  return SEARCH_FIELDS.some(f =>
    String(secret[f] ?? '')
      .toLowerCase()
      .includes(q)
  )
}

const rows = computed(() => (isTrashTab.value ? deleted.value : secrets.value))

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  const predicate = TAB_PREDICATES[tab.value]
  return rows.value.filter(s => {
    if (predicate && !predicate(s)) return false
    return matchesQuery(s, q)
  })
})

// "The filter hid everything" vs "there is nothing here" — the first offers a
// way back, the second offers the primary action.
const filteredEmpty = computed(
  () => !visible.value.length && Boolean(rows.value.length)
)

const emptyTitle = computed(() => {
  if (filteredEmpty.value) return 'No secrets match your filters'
  if (isTrashTab.value) return 'Trash is empty'
  return 'No secrets yet'
})

const emptyDescription = computed(() => {
  if (filteredEmpty.value) {
    return 'Try a different search term, or switch back to the All tab.'
  }
  if (isTrashTab.value) {
    return 'No secret has been deleted in the last 30 days.'
  }
  return 'Add a secret to start using encrypted credentials in your functions.'
})

function clearFilters() {
  query.value = ''
  tab.value = 'all'
}

function retry() {
  if (isTrashTab.value) loadTrash()
  else load()
}

function usedByCount(row) {
  const n = row.usedByCount ?? 0
  return n ? `${n} reference${n === 1 ? '' : 's'}` : 'Not referenced'
}

function usedByNames(row) {
  return (row.usedBy ?? []).map(u => u.name).join(', ')
}

// Nothing here persists — say so in the toast rather than implying a save.
function notifyLocal(message) {
  $q.notify({
    message,
    caption: 'Local preview only — no backend is connected yet.',
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}

// Clipboard access is permission-gated and unavailable outside a secure
// context, so a failure has to be reported rather than thrown. Only the
// reference (`secrets.KEY_NAME`) is ever copied — never a credential.
async function copyReference(row) {
  let message = 'Reference copied to clipboard'
  try {
    await navigator.clipboard.writeText(secretReference(row))
  } catch {
    message = "Couldn't copy the reference — select it and copy by hand."
  }
  $q.notify({ message, color: 'dark', position: 'bottom', timeout: 2500 })
}

function addSecret(input) {
  const record = add(input)
  showForm.value = false
  tab.value = 'all'
  notifyLocal(`${record.key} added`)
}

function rotate(row) {
  notifyLocal(`Rotation started for ${row.key}`)
}

function askDelete(row) {
  target.value = row
  confirmDelete.value = true
}

const deleteMessage = computed(() =>
  target.value
    ? `Functions reading secrets.${target.value.key} stop resolving it. The secret moves to the trash, where it can be restored for 30 days.`
    : ''
)

function removeSecret() {
  const row = target.value
  if (!row) return
  remove(row.id)
  notifyLocal(`${row.key} moved to trash`)
  target.value = null
}

function askPurge(row) {
  target.value = row
  confirmPurge.value = true
}

const purgeMessage = computed(() =>
  target.value
    ? `${target.value.key} and its encrypted value are removed permanently. This cannot be undone.`
    : ''
)

function purgeSecret() {
  const row = target.value
  if (!row) return
  purge(row.id)
  notifyLocal(`${row.key} deleted forever`)
  target.value = null
}

function restoreSecret(row) {
  restore(row.id)
  restoreRecord(row)
  notifyLocal(`${row.key} restored`)
}

onMounted(() => {
  load()
  loadTrash()
})
</script>
