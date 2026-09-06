<template>
  <q-page class="p-6">
    <!-- One content cap for the header, the band, the stats, the filters and
         the table, so every edge on the screen lines up. Literal rather than a
         token: Tailwind v4 extracts class names from source text. -->
    <div class="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Functions"
        subtitle="Code that runs on an event as it travels through a pipe: transform it, filter it, or enrich it before delivery."
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

      <IntroBand
        class="mb-5"
        storage-key="functions-intro"
        eyebrow="Shape events before delivery"
        title="Functions let you customise activity inside a pipe."
        body="Sfere can install managed functions automatically for integrations such as Zid. Your team can also create custom transformations, filters and enrichments."
      />

      <!-- Every one of these four is counted off the loaded records, so each is
           a measurement rather than an estimate. All four stay `neutral`: the
           tint is for the one stat in a row that is a problem, and none of
           these is. -->
      <div
        v-if="!loading && !error && !apiMissing && functions.length"
        class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Total"
          :value="formatCount(functions.length)"
          hint="All functions on this account"
        />
        <StatCard
          label="Sfere managed"
          :value="formatCount(managedCount)"
          hint="Installed with an integration"
        />
        <StatCard
          label="Your functions"
          :value="formatCount(functions.length - managedCount)"
          hint="Written by your team"
        />
        <StatCard
          label="Attached"
          :value="formatCount(attachedCount)"
          hint="Running on at least one pipe"
        />
      </div>

      <div
        v-if="!loading && !error && !apiMissing && functions.length"
        class="mb-4"
      >
        <TabNav v-model="filter" :tabs="filterTabs" variant="pill" />
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
          <div class="flex items-center gap-2.5">
            <span
              class="grid size-8 shrink-0 place-items-center rounded-sfere border border-sfere-line bg-sfere-fill text-sfere-brand-text"
            >
              <SfereIcon name="function-f" size="md" />
            </span>
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span class="truncate font-medium text-ink">{{ row.name }}</span>
              <span class="truncate text-xs text-subtle">
                <code class="font-sfere-mono">{{ row.slug }}</code>
                <template v-if="row.description">
                  · {{ row.description }}</template
                >
              </span>
            </span>
          </div>
        </template>

        <template #cell-kind="{ row }">
          <StatusBadge tone="neutral" :label="kindLabel(row.kind)" />
        </template>

        <!-- One column for "where did this come from", not two. The template
             name and its upgrade sit under the owner rather than in a column of
             their own, which would say the same thing twice. -->
        <template #cell-owner="{ row }">
          <div class="grid gap-0.5 justify-items-start">
            <StatusBadge
              :tone="row.template ? 'brand' : 'neutral'"
              :label="row.template ? 'Sfere managed' : 'Your team'"
            />
            <span
              v-if="row.template"
              class="truncate font-sfere-mono text-xs text-muted"
              >{{ row.template
              }}<template v-if="row.templateVersion != null">
                v{{ row.templateVersion }}</template
              ></span
            >
            <StatusBadge
              v-if="hasTemplateUpgrade(row)"
              tone="warn"
              :label="`v${row.latestTemplateVersion} available`"
            />
          </div>
        </template>

        <!-- `NONE`, not 0: a function attached to nothing is a genuinely empty
             collection, and this list is the only place that is visible before
             a delete fails on it. -->
        <template #cell-attached="{ row }">
          <span class="whitespace-nowrap text-muted">{{
            attachmentLabel(row)
          }}</span>
        </template>

        <template #cell-updatedAt="{ value }">
          <span class="whitespace-nowrap text-muted">{{
            formatDate(value)
          }}</span>
        </template>

        <!-- One kebab rather than the prototype's icon pair: an eye and a bin
             beside every row is exactly what this app replaced, and the noun
             that matters on a row is which row, not the <h1>. -->
        <template #cell-actions="{ row }">
          <RowActionsMenu
            :label="`Actions for ${row.name}`"
            :actions="ROW_ACTIONS"
            @select="onRowAction(row, $event)"
          />
        </template>

        <template #empty>
          <EmptyState :title="emptyTitle" :description="emptyDescription">
            <template #cta>
              <SfereButton
                v-if="query || filter !== 'all'"
                variant="secondary"
                @click="clearFilters"
                >Clear filters</SfereButton
              >
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </div>

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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import IntroBand from '@/components/ui/IntroBand.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
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
// it), so there is no trash for one to land in. There is also deliberately no
// "add a function" control in the body — the header already carries one.
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
const filter = ref('all')
const confirmDelete = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Function', sortable: true },
  { key: 'kind', label: 'Kind', sortable: true },
  { key: 'owner', label: 'Owner' },
  { key: 'attached', label: 'Attached to' },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: '72px' }
]

// `template` non-null is the whole of "Sfere installed this", so both the
// counts and the filter read the same field.
const managedCount = computed(
  () => functions.value.filter(f => f.template).length
)

const attachedCount = computed(
  () => functions.value.filter(f => f.attachedPipelineIds.length).length
)

const filterTabs = computed(() => [
  { key: 'all', label: 'All', count: functions.value.length },
  { key: 'managed', label: 'Sfere managed', count: managedCount.value },
  {
    key: 'team',
    label: 'Created by you',
    count: functions.value.length - managedCount.value
  }
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return functions.value.filter(f => {
    if (filter.value === 'managed' && !f.template) return false
    if (filter.value === 'team' && f.template) return false
    if (!q) return true
    return (
      f.name.toLowerCase().includes(q) ||
      f.slug.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q)
    )
  })
})

const narrowed = computed(
  () => Boolean(query.value.trim()) || filter.value !== 'all'
)

const emptyTitle = computed(() =>
  narrowed.value ? 'No functions match those filters' : 'No functions yet'
)

const emptyDescription = computed(() =>
  narrowed.value
    ? 'Nothing on this account matches what you are looking for.'
    : 'A function runs on each event a pipe carries. Write one to reshape events, drop the ones you do not want, or add fields to them.'
)

function kindLabel(kind) {
  return FUNCTION_KINDS.find(k => k.value === kind)?.label ?? kind
}

function clearFilters() {
  query.value = ''
  filter.value = 'all'
}

function open(row) {
  router.push({ name: 'functions-detail', params: { id: row.id } })
}

// Icons all-or-none per menu: one icon-less entry beside iconed ones starts its
// label a glyph's width to the left, and every item is on screen at once.
const ROW_ACTIONS = [
  { key: 'open', label: 'Open function', icon: 'eye' },
  {
    key: 'delete',
    label: 'Delete function',
    icon: 'trash',
    tone: 'destructive'
  }
]

// The menu never acts: Delete lands on the confirm the row button opened.
function onRowAction(row, key) {
  if (key === 'open') open(row)
  else if (key === 'delete') askDelete(row)
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
  if (fn.template) {
    return `“${fn.name}” was installed by Sfere with an integration. Deleting it stops that integration's events being reshaped, and the code is not recoverable from here. It runs on no pipes, so nothing changes route today.`
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
      ? `${fn.name} is still attached to a pipeline — detach it first`
      : (res.error ?? `Can't delete ${fn.name} yet.`),
    caption: res.conflict ? res.error : undefined,
    color: 'dark',
    position: 'top-right',
    timeout: 6000
  })
}

onMounted(load)
</script>
