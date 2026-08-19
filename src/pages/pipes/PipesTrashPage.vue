<template>
  <q-page class="p-6">
    <PageHeader
      title="Pipes trash"
      subtitle="Deleted pipes are kept here. Restoring one puts it back exactly as it was, still paused."
    >
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'pipes' })"
        >
          All pipes
        </button>
        <button
          :disabled="!items.length"
          class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="confirmEmpty = true"
        >
          Empty trash
        </button>
      </template>
    </PageHeader>

    <!-- A whole sentence does not fit a StatusBadge, which is a pill sized for
         a word or two. It is a full-width block above the table rather than a
         DataTable #toolbar item, because the toolbar is a centred flex row and
         a banner in it would shrink to its text and read as a giant chip. -->
    <NoticeBanner
      v-if="cascadeCount"
      tone="warn"
      class="mb-4"
      title="Some of these cannot be restored on their own"
      :message="`${cascadeCount} of these reference a source or destination that was deleted too.`"
    />

    <DataTable
      :columns="columns"
      :rows="items"
      :loading="loading"
      :error="error"
      row-key="id"
      empty-title="Nothing in the trash"
      empty-description="No pipe has been deleted. Anything you delete lands here first, so it can be put back."
      empty-cta-label="Back to pipes"
      :empty-cta-to="{ name: 'pipes' }"
      @retry="load"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-2">
          <p class="font-medium text-ink">{{ row.name }}</p>
          <StatusBadge
            v-if="row.hasFunctionCode"
            tone="brand"
            label="Transform"
          />
        </div>
        <p class="text-xs text-subtle">{{ row.id }}</p>
      </template>

      <template #cell-route="{ row }">
        <div class="flex flex-wrap items-center gap-1.5">
          <span :class="row.sourceState === 'live' ? 'text-ink' : 'text-muted'">
            {{ row.sourceName }}
          </span>
          <StatusBadge
            v-if="row.sourceState !== 'live'"
            :tone="row.sourceState === 'trashed' ? 'warn' : 'danger'"
            :label="row.sourceState === 'trashed' ? 'Deleted' : 'Missing'"
          />
          <span class="text-subtle">→</span>
          <span
            :class="row.destinationState === 'live' ? 'text-ink' : 'text-muted'"
          >
            {{ row.eventDestinationName }}
          </span>
          <StatusBadge
            v-if="row.destinationState !== 'live'"
            :tone="row.destinationState === 'trashed' ? 'warn' : 'danger'"
            :label="row.destinationState === 'trashed' ? 'Deleted' : 'Missing'"
          />
        </div>
      </template>

      <template #cell-deletedAt="{ value }">
        {{ formatDate(value) }}
      </template>

      <template #cell-deletedByName="{ row }">
        {{ row.deletedByName || row.deletedBy || '—' }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            :disabled="row.blocked"
            :title="
              row.blocked
                ? 'One end of this pipe no longer exists, so it cannot be restored.'
                : ''
            "
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40"
            @click="askRestore(row)"
          >
            Restore
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click="askPurge(row)"
          >
            Delete forever
          </button>
        </div>
      </template>
    </DataTable>

    <!-- A pipe whose source or destination is also deleted cannot come back
         alone, so the restore is widened rather than silently left dangling. -->
    <ConfirmDialog
      v-if="target"
      v-model="confirmCascade"
      title="Restore the linked records too?"
      :message="`“${target.name}” points at ${cascadeSentence} that ${target.cascade.length === 1 ? 'was' : 'were'} deleted as well. Restoring the pipe on its own would leave it broken.`"
      confirm-label="Restore all"
      @confirm="restoreTarget"
    >
      <div class="flex flex-wrap gap-2">
        <StatusBadge
          v-for="link in target.cascade"
          :key="link.id"
          tone="neutral"
          :label="`${link.name} · ${link.kind}`"
        />
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      v-if="target"
      v-model="confirmPurge"
      title="Delete forever?"
      :message="`“${target.name}” will be removed permanently. This cannot be undone.`"
      confirm-label="Delete forever"
      destructive
      @confirm="purgeTarget"
    />

    <ConfirmDialog
      v-model="confirmEmpty"
      title="Empty the pipes trash?"
      :message="`All ${items.length} deleted ${items.length === 1 ? 'pipe' : 'pipes'} will be removed permanently. This cannot be undone.`"
      confirm-label="Empty trash"
      destructive
      @confirm="emptyTrash"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DataTable from '@/components/ui/DataTable.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { formatDate } from '@/composables/usePipes'
import { usePipesTrash } from '@/composables/usePipesTrash'

const router = useRouter()
const $q = useQuasar()

const { items, loading, error, load, restore, purge, purgeAll } =
  usePipesTrash()

const confirmCascade = ref(false)
const confirmPurge = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const columns = [
  { key: 'name', label: 'Pipe', sortable: true },
  { key: 'route', label: 'Route' },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'deletedByName', label: 'Deleted by', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '230px' }
]

const cascadeCount = computed(
  () => items.value.filter(i => i.cascade.length).length
)

const cascadeSentence = computed(() => {
  const kinds = (target.value?.cascade ?? []).map(c => `a ${c.kind}`)
  if (!kinds.length) return 'a record'
  if (kinds.length === 1) return kinds[0]
  return `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}`
})

function notify(message) {
  $q.notify({
    message,
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}

function askRestore(item) {
  target.value = item
  if (item.cascade.length) {
    confirmCascade.value = true
  } else {
    restoreTarget()
  }
}

function restoreTarget() {
  const item = target.value
  if (!item) return
  restore(item)
  const extra = item.cascade.map(c => `“${c.name}”`).join(' and ')
  notify(
    `“${item.name}”${extra ? ` and ${extra}` : ''} restored — nothing was saved, this preview has no backend.`
  )
  target.value = null
}

function askPurge(item) {
  target.value = item
  confirmPurge.value = true
}

function purgeTarget() {
  const item = target.value
  if (!item) return
  purge(item)
  notify(
    `“${item.name}” deleted forever — nothing was saved, this preview has no backend.`
  )
  target.value = null
}

function emptyTrash() {
  const count = items.value.length
  purgeAll()
  notify(
    `${count} ${count === 1 ? 'pipe' : 'pipes'} deleted forever — nothing was saved, this preview has no backend.`
  )
}

onMounted(load)
</script>
