<template>
  <q-page class="p-6">
    <PageHeader :title="source?.name || 'Source'" :subtitle="subtitle">
      <template #actions>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.push({ name: 'sources' })"
        >
          All sources
        </button>
        <template v-if="source">
          <button
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
            @click="toggle"
          >
            {{ source.isEnabled ? 'Pause' : 'Enable' }}
          </button>
          <button
            class="flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
            @click="confirmDelete = true"
          >
            Delete
          </button>
        </template>
      </template>
    </PageHeader>

    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load this source."
      :message="error"
      @retry="load"
    />

    <!-- A bad :id is not a failure, it is an empty result — rendering ErrorState
         here would tell the smoke run the screen is broken. -->
    <EmptyState
      v-else-if="!source"
      title="Source not found"
      :description="`No source matches the id “${route.params.id}”. It may have been deleted.`"
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'sources' })"
        >
          Back to sources
        </button>
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-5">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Events (last hour)"
          :value="formatCount(source.eventCountLastHour)"
        />
        <StatCard
          label="Event types"
          :value="formatCount(source.eventTypeCount)"
        />
        <StatCard label="Pipes" :value="formatCount(source.pipeCount)" />
        <StatCard label="Config version" :value="`v${source.version}`" />
      </div>

      <div v-if="upgradeText" class="flex flex-wrap items-center gap-3">
        <StatusBadge variant="warn" :label="upgradeText" />
        <button
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click="upgrade"
        >
          Upgrade template
        </button>
      </div>

      <TabNav v-model="tab" :tabs="tabs" />

      <CardPanel v-if="tab === 'overview'">
        <template #header>
          <span class="text-sm font-semibold text-ink">Configuration</span>
          <StatusBadge
            :enabled="source.isEnabled"
            :label="source.isEnabled ? 'Enabled' : 'Paused'"
          />
        </template>

        <dl class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div v-for="f in facts" :key="f.label" class="min-w-0">
            <dt class="text-xs font-medium text-subtle">{{ f.label }}</dt>
            <dd class="mt-0.5 truncate text-sm text-ink">{{ f.value }}</dd>
          </div>
        </dl>
      </CardPanel>

      <SourceIngestPanel
        v-else-if="tab === 'ingest'"
        :source="source"
        @copy="copyValue"
      />

      <template v-else>
        <LoadingState v-if="templatesLoading" variant="form" :rows="3" />

        <ErrorState
          v-else-if="templatesError"
          title="Couldn't load the source templates."
          :message="templatesError"
          @retry="loadTemplates"
        />

        <EmptyState
          v-else-if="!template"
          title="Not created from a template"
          description="This source was configured by hand, so there is no template to track or upgrade."
        />

        <CardPanel v-else>
          <template #header>
            <span class="text-sm font-semibold text-ink">{{
              template.name
            }}</span>
            <StatusBadge
              :variant="upgradeText ? 'warn' : 'success'"
              :label="upgradeText || 'Up to date'"
            />
          </template>

          <p class="text-sm text-muted">{{ template.description }}</p>

          <div class="mt-4 flex flex-wrap gap-2">
            <StatusBadge
              v-for="t in template.tags"
              :key="t"
              variant="neutral"
              :label="t"
            />
          </div>

          <dl class="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-medium text-subtle">Running version</dt>
              <dd class="mt-0.5 text-sm text-ink">{{
                source.templateVersion
              }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-subtle">Latest version</dt>
              <dd class="mt-0.5 text-sm text-ink">{{
                source.latestTemplateVersion
              }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-subtle">Event types</dt>
              <dd class="mt-0.5 text-sm text-ink">{{
                formatCount(template.eventTypeCount)
              }}</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-subtle"
                >Real-time attributes</dt
              >
              <dd class="mt-0.5 text-sm text-ink">{{
                formatCount(template.realtimeAttributeCount)
              }}</dd>
            </div>
          </dl>
        </CardPanel>
      </template>
    </div>

    <ConfirmDialog
      v-model="confirmDelete"
      title="Move source to trash?"
      :message="deleteMessage"
      confirm-label="Move to trash"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SourceIngestPanel from '@/components/sources/SourceIngestPanel.vue'
import { useTemplates } from '@/composables/useTemplates'
import {
  formatCount,
  formatDateTime,
  sourceTypeLabel,
  useSourceTemplates,
  useSources
} from '@/composables/useSources'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const { upgradeLabel } = useTemplates()

const {
  sources,
  loading,
  error,
  load,
  setEnabled,
  remove: removeSource
} = useSources()

// The template catalog is supporting detail: a failure there degrades one tab
// rather than the page, so it keeps its own error and its own Retry.
const {
  templates,
  loading: templatesLoading,
  error: templatesError,
  load: loadTemplates,
  findById: findTemplate
} = useSourceTemplates()

const tab = ref('overview')
const confirmDelete = ref(false)

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'ingest', label: 'Ingest' },
  { key: 'template', label: 'Template' }
]

// Resolved off the loaded list rather than a per-id fetch: the mock layer is one
// JSON file, and a list already in memory is the same data.
const source = computed(
  () => sources.value.find(s => s.id === route.params.id) ?? null
)

const template = computed(() =>
  source.value && templates.value.length
    ? findTemplate(source.value.templateId)
    : null
)

const subtitle = computed(() => {
  if (!source.value) return 'Event stream'
  const type = sourceTypeLabel(source.value.sourceType)
  return source.value.description
    ? `${type} · ${source.value.description}`
    : type
})

const upgradeText = computed(() =>
  source.value ? upgradeLabel(source.value) : ''
)

const facts = computed(() => {
  const s = source.value
  if (!s) return []
  return [
    { label: 'Slug', value: s.slug },
    { label: 'Source id', value: s.id },
    { label: 'Type', value: sourceTypeLabel(s.sourceType) },
    { label: 'Template', value: s.templateId ?? 'Hand-configured' },
    { label: 'Template version', value: s.templateVersion ?? '—' },
    { label: 'Created', value: formatDateTime(s.createdAt) },
    { label: 'Last updated', value: formatDateTime(s.updatedAt) },
    { label: 'Description', value: s.description || '—' }
  ]
})

const deleteMessage = computed(() =>
  source.value
    ? `“${source.value.name}” stops collecting events and moves to the trash, where it can be restored for 30 days.`
    : ''
)

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

function toggle() {
  const s = source.value
  setEnabled(s.id, !s.isEnabled)
  notifyLocal(`${s.name} ${s.isEnabled ? 'enabled' : 'paused'}`)
}

function upgrade() {
  notifyLocal(
    `${source.value.name} would upgrade to template ${source.value.latestTemplateVersion}`
  )
}

function remove() {
  const s = source.value
  removeSource(s.id)
  notifyLocal(`${s.name} moved to trash`)
  router.push({ name: 'sources' })
}

// Clipboard access is permission-gated and unavailable outside a secure context,
// so a failure has to be reported rather than thrown.
async function copyValue({ label, value }) {
  let message = `${label} copied to clipboard`
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    message = `Couldn't copy the ${label.toLowerCase()} — select it and copy by hand.`
  }
  $q.notify({ message, color: 'dark', position: 'bottom', timeout: 2500 })
}

onMounted(() => {
  load()
  loadTemplates()
})
</script>
