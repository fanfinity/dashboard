<template>
  <q-page class="p-6">
    <PageHeader
      title="Functions"
      subtitle="Code that runs on an event as it travels a pipe: reshape it, drop it, or add to it."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search functions..." />
        <SfereIconButton
          icon="plus"
          label="New function"
          variant="primary"
          :to="{ name: 'functions-new' }"
        />
      </template>
    </PageHeader>

    <div
      v-if="!loading && !error && !apiMissing && functions.length"
      class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatCard label="Functions" :value="formatCount(functions.length)" />
      <StatCard
        v-for="kind in FUNCTION_KINDS"
        :key="kind.value"
        :label="kind.label"
        :value="formatCount(countOfKind(kind.value))"
        :hint="kind.description"
      />
    </div>

    <DataTable
      :columns="columns"
      :rows="filtered"
      :loading="loading"
      :error="error"
      :api-missing="apiMissing"
      row-key="id"
      @retry="load"
      @row-click="open"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">
          <code class="font-sfere-mono">{{ row.slug }}</code>
          <template v-if="row.description"> · {{ row.description }}</template>
        </p>
      </template>

      <template #cell-kind="{ row }">
        <StatusBadge tone="neutral" :label="kindLabel(row.kind)" />
      </template>

      <!-- `NONE`, not 0: a function attached to nothing is a genuinely empty
           collection, and this list is the only place that is visible before a
           delete fails on it. -->
      <template #cell-attached="{ row }">
        <span class="text-muted">{{ attachmentLabel(row) }}</span>
      </template>

      <template #cell-template="{ row }">
        <div v-if="row.template" class="flex items-center gap-1.5">
          <code class="font-sfere-mono text-xs text-muted">{{
            row.template
          }}</code>
          <StatusBadge
            v-if="hasTemplateUpgrade(row)"
            tone="warn"
            :label="`v${row.latestTemplateVersion} available`"
          />
        </div>
        <span v-else class="text-muted">{{ NOT_SET }}</span>
      </template>

      <template #cell-updatedAt="{ value }">
        <span class="whitespace-nowrap text-muted">{{
          formatDate(value)
        }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-fill"
            @click.stop="open(row)"
          >
            Open
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
          :title="query ? 'No functions match your search' : 'No functions yet'"
          :description="
            query
              ? `Nothing here matches “${query}”.`
              : 'A function runs on each event a pipe carries. Write one to reshape events, drop the ones you do not want, or add fields to them.'
          "
        >
          <template #cta>
            <SfereButton v-if="!query" :to="{ name: 'functions-new' }"
              >Write your first function</SfereButton
            >
            <SfereButton v-else variant="secondary" @click="query = ''"
              >Clear search</SfereButton
            >
          </template>
        </EmptyState>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="confirmDelete"
      :title="deleteTitle"
      :message="deleteMessage"
      confirm-label="Delete function"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { NOT_SET } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import {
  FUNCTION_KINDS,
  attachmentLabel,
  hasTemplateUpgrade,
  useFunctions
} from '@/composables/useFunctions'
import { formatCount, formatDate } from '@/composables/useSources'

// `GET /v1/accounts/{account}/functions`, live as of backend PR #16.
//
// There is no Trash icon in the header, unlike the ten other list screens: a
// function is hard-deleted (and refused outright while a pipeline still holds
// it), so there is no trash for one to land in.
const router = useRouter()
const $q = useQuasar()

const {
  functions,
  loading,
  error,
  apiMissing,
  load,
  remove: removeFunction
} = useFunctions()

const query = ref('')
const confirmDelete = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Function', sortable: true },
  { key: 'kind', label: 'Kind', sortable: true },
  { key: 'attached', label: 'Attached to' },
  { key: 'template', label: 'Template' },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '160px' }
]

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return functions.value
  return functions.value.filter(
    f =>
      f.name.toLowerCase().includes(q) ||
      f.slug.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q)
  )
})

function countOfKind(kind) {
  return functions.value.filter(f => f.kind === kind).length
}

function kindLabel(kind) {
  return FUNCTION_KINDS.find(k => k.value === kind)?.label ?? kind
}

function open(row) {
  router.push({ name: 'functions-detail', params: { id: row.id } })
}

function askDelete(row) {
  target.value = row
  confirmDelete.value = true
}

const deleteTitle = computed(() =>
  target.value ? `Delete “${target.value.name}”?` : 'Delete this function?'
)

// Names the attachments up front rather than letting the 409 be the first the
// user hears of it. The backend refuses the delete while any pipeline holds the
// function, which is the right behaviour and a bad surprise.
const deleteMessage = computed(() => {
  const fn = target.value
  if (!fn) return ''
  const n = fn.attachedPipelineIds.length
  if (n) {
    return `“${fn.name}” still runs on ${n} pipe${n === 1 ? '' : 's'}. The backend refuses to delete a function that is attached, so detach it from each pipe's Functions tab first. Nothing happens if you confirm now.`
  }
  return `“${fn.name}” is removed. It runs on no pipes, so no events change route. The code is not recoverable — copy it out first if you might want it.`
})

async function remove() {
  const fn = target.value
  if (!fn) return
  const res = await removeFunction(fn.id)
  if (res.ok) {
    $q.notify({
      message: `${fn.name} deleted`,
      color: 'dark',
      position: 'top-right',
      timeout: 3000
    })
    return
  }
  $q.notify({
    message: res.conflict
      ? `${fn.name} is still attached to a pipeline`
      : (res.error ?? `Can't delete ${fn.name} yet.`),
    caption: res.conflict ? res.error : undefined,
    color: 'dark',
    position: 'top-right',
    timeout: 6000
  })
}

onMounted(load)
</script>
