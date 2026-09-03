<template>
  <q-page class="p-6">
    <PageHeader :title="source?.name || 'Source'" :subtitle="subtitle">
      <!-- The noun is the <h1> beside them, so the two state actions are drawn
           rather than spelled (SfereIconButton carries the word to the tooltip
           and to assistive tech). Going back to the list is not one of them any
           more: PageHeader renders that from the screen manifest's `parent`, in
           the same place on all 23 sub-screens. -->
      <template #actions>
        <template v-if="source">
          <SfereIconButton
            :icon="source.isEnabled ? 'pause' : 'play'"
            :label="
              source.isEnabled ? 'Pause this source' : 'Enable this source'
            "
            @click="confirmToggle = true"
          />
          <SfereIconButton
            icon="trash"
            label="Delete this source"
            variant="danger"
            @click="confirmDelete = true"
          />
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
      <!-- Every card here is measured. The four it replaced were fixture-only
           fields the backend's Source does not carry: `version` printed the
           literal "vundefined", and the three counts printed an em dash on
           every real source. The pipe count is the same joined list the
           "Destinations & pipes" tab counts, so the row and the tab can never
           disagree. -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Status"
          :value="source.isEnabled ? 'Enabled' : 'Paused'"
          :hint="sourceTypeLabel(source.sourceType)"
        />
        <StatCard label="Pipes" :value="pipeCountLabel" :hint="pipesHint" />
        <StatCard
          label="Created"
          :value="formatDate(source.createdAt)"
          :hint="updatedHint"
        />
      </div>

      <ZidSetupWizard v-if="showZidWizard" :source="source" @complete="load" />
      <SallaSetupWizard
        v-if="showSallaWizard"
        :source="source"
        @complete="load"
      />

      <WebSdkSetupPanel
        v-if="showWebSdkSetup"
        :source="source"
        @copy="copyValue"
        @complete="load"
      />

      <TabNav v-model="tab" :tabs="tabs" />

      <CardPanel v-if="tab === 'overview'">
        <template #header>
          <span class="text-sm font-semibold text-ink">Configuration</span>
          <StatusBadge
            :tone="source.isEnabled ? 'success' : 'neutral'"
            :label="source.isEnabled ? 'Enabled' : 'Paused'"
          />
        </template>

        <DefinitionList :items="facts" :columns="2" />
      </CardPanel>

      <!-- The same guide the create flow's step 3 renders. One component, two
           entry points: the person who closed the tab mid-setup and the person
           coming back a week later want exactly the same page. -->
      <SourceInstallGuide
        v-else-if="tab === 'setup'"
        :source="source"
        :delivers-to="deliversTo"
        @copy="copyValue"
      />

      <SourceEventsPanel v-else-if="tab === 'events'" :source="source" />

      <SourcePipesPanel
        v-else-if="tab === 'pipes'"
        :source="source"
        :pipes="sourcePipes"
        :loading="pipesLoading"
        :error="pipesError"
        :api-missing="pipesApiMissing"
        @retry="loadPipes"
        @open="openPipe"
      />

      <SourceSettingsPanel
        v-else-if="tab === 'settings'"
        :source="source"
        @copy="copyValue"
        @delete="confirmDelete = true"
      />

      <SourceSyncPanel v-else-if="tab === 'sync'" :source="source" />
    </div>

    <!-- Both state actions ask first, and say what the click does. The header
         icons carry no sentence of their own, so the dialog is where the
         consequence is written; pausing is reversible, so it is not
         `destructive` — a red button on a routine confirm teaches people to
         click through red buttons. -->
    <ConfirmDialog
      v-if="source"
      v-model="confirmToggle"
      :title="source.isEnabled ? 'Pause this source?' : 'Enable this source?'"
      :message="toggleMessage"
      :confirm-label="source.isEnabled ? 'Pause source' : 'Enable source'"
      @confirm="toggle"
    />

    <!-- One verb for this action, everywhere it appears — the icon tooltip,
         the Settings danger zone, the list row and this dialog all say Delete.
         It used to open as "Move source to trash", which named an outcome the
         backend does not produce: DELETE on a source is a hard 204, there is no
         restore endpoint, and the deleted record never reached the Trash screen
         someone was then told to look in. When soft delete ships, this reverts
         to the trash wording in one edit — see `deleteMessage`. -->
    <ConfirmDialog
      v-model="confirmDelete"
      :title="deleteTitle"
      :message="deleteMessage"
      confirm-label="Delete source"
      destructive
      @confirm="remove"
    />
  </q-page>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import TabNav from '@/components/ui/TabNav.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SourceInstallGuide from '@/components/sources/SourceInstallGuide.vue'
import SourceEventsPanel from '@/components/sources/SourceEventsPanel.vue'
import SourcePipesPanel from '@/components/sources/SourcePipesPanel.vue'
import SourceSettingsPanel from '@/components/sources/SourceSettingsPanel.vue'
import SourceSyncPanel from '@/components/sources/SourceSyncPanel.vue'
import ZidSetupWizard from '@/components/sources/ZidSetupWizard.vue'
import SallaSetupWizard from '@/components/sources/SallaSetupWizard.vue'
import WebSdkSetupPanel from '@/components/sources/WebSdkSetupPanel.vue'
import { useDataSource } from '@/composables/useDataSource'
import {
  formatCount,
  formatDate,
  formatDateTime,
  sourceTypeLabel,
  useSources
} from '@/composables/useSources'
import { notifyMutationResult } from '@/composables/useMutationFeedback'
import { usePipes } from '@/composables/usePipes'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const {
  sources,
  loading,
  error,
  load,
  setEnabled,
  remove: removeSource
} = useSources()

const { isReal } = useDataSource()

const tab = ref('overview')
const confirmDelete = ref(false)
const confirmToggle = ref(false)

// Ordered as a setup journey, not alphabetically: what is it → how do I wire it
// → is anything arriving → where does it go → the knobs. "Ingest" became
// "Setup instructions" because that is what someone opening this tab is looking
// for, and it now renders the full multi-platform guide rather than one snippet.
//
// There is deliberately no Template tab. `SourceCreate` accepts a `template_id`
// and `Source` does not return one, so the template a source was made from is
// write-only as far as this screen is concerned — the tab could only ever say
// "no template on record", and the upgrade badge and "Upgrade template" button
// that sat with it compared two versions the backend has never sent. Bring them
// back when `Source` carries the template, not before.
const tabs = computed(() => [
  { key: 'overview', label: 'Overview' },
  { key: 'setup', label: 'Setup instructions' },
  { key: 'events', label: 'Live events' },
  {
    key: 'pipes',
    label: 'Destinations & pipes',
    count: sourcePipes.value.length
  },
  { key: 'sync', label: 'Syncs' },
  { key: 'settings', label: 'Settings' }
])

// The Zid go-live steps (authorize → connect webhooks → first sync) hit the
// real backend, so only offer them in real mode for an unsynced Zid source.
const showZidWizard = computed(
  () =>
    isReal.value &&
    source.value?.sourceType === 'zid' &&
    !source.value?.lastSyncedAt
)

// Salla mirrors the Zid go-live steps (authorize → connect webhooks → first sync).
const showSallaWizard = computed(
  () =>
    isReal.value &&
    source.value?.sourceType === 'salla' &&
    !source.value?.lastSyncedAt
)

// Web SDK go-live is a single step — paste the snippet — so the panel shows
// for any real web source until the user dismisses it (the panel persists the
// dismissal itself).
const showWebSdkSetup = computed(
  () => isReal.value && source.value?.sourceType === 'web'
)

// The workspace's pipes, filtered to this source. Read here rather than in
// SourcePipesPanel so switching tabs does not refetch, and so the tab can carry
// a live count in its label.
const {
  pipes: allPipes,
  loading: pipesLoading,
  error: pipesError,
  apiMissing: pipesApiMissing,
  load: loadPipes
} = usePipes()

// Resolved off the loaded list rather than a per-id fetch: the mock layer is one
// JSON file, and a list already in memory is the same data.
const source = computed(
  () => sources.value.find(s => s.id === route.params.id) ?? null
)

const sourcePipes = computed(() =>
  source.value ? allPipes.value.filter(p => p.sourceId === source.value.id) : []
)

// Where this source's events already go, for the setup tab's "events are
// arriving" result. Read off the pipes this page has already loaded and joined,
// so it costs nothing extra. Empty while the pipes read is still in flight or
// failed — the guide falls back to its generic "add a destination" line rather
// than claiming a destination that may not exist. An enabled pipe only: a paused
// one is not delivering, and saying it is would be the confident-zero mistake in
// sentence form.
const deliversTo = computed(() => {
  const live = sourcePipes.value.find(p => p.isEnabled)
  return live?.eventDestinationName || ''
})

// The pipes read is its own request, and it is allowed to be in flight, to
// fail, or to have no endpoint behind it. A bare `.length` would print a
// confident 0 for all three — the same lie `vundefined` told, only quieter.
const pipeCountLabel = computed(() =>
  pipesLoading.value || pipesError.value || pipesApiMissing.value
    ? NOT_KNOWN
    : formatCount(sourcePipes.value.length)
)

const pipesHint = computed(() =>
  deliversTo.value ? `Delivering to ${deliversTo.value}` : ''
)

const updatedHint = computed(() =>
  source.value?.updatedAt ? `Updated ${formatDate(source.value.updatedAt)}` : ''
)

const subtitle = computed(() => {
  if (!source.value) return 'Event stream'
  const type = sourceTypeLabel(source.value.sourceType)
  return source.value.description
    ? `${type} · ${source.value.description}`
    : type
})

const facts = computed(() => {
  const s = source.value
  if (!s) return []
  return [
    { label: 'Slug', value: s.slug },
    { label: 'Source id', value: s.id },
    { label: 'Type', value: sourceTypeLabel(s.sourceType) },
    { label: 'Created', value: formatDateTime(s.createdAt) },
    { label: 'Last updated', value: formatDateTime(s.updatedAt) },
    { label: 'Description', value: s.description }
  ]
})

const toggleMessage = computed(() => {
  const s = source.value
  if (!s) return ''
  return s.isEnabled
    ? `“${s.name}” stops collecting events straight away. Anything already delivered stays where it is, and you can enable it again at any time.`
    : `“${s.name}” starts collecting events again straight away.`
})

const deleteTitle = computed(() =>
  source.value ? `Delete “${source.value.name}”?` : 'Delete this source?'
)

// The last sentence is the interim one. Restoring a deleted source needs a
// backend that keeps one, and none of that exists yet — no soft delete, no
// trash listing, no restore. Promising 30 days of recovery over a hard DELETE
// is the one wrong thing a destructive confirm can say.
const deleteMessage = computed(() =>
  source.value
    ? `“${source.value.name}” stops collecting events straight away, and any pipe reading from it stops delivering. Events already written to a destination are untouched; they live in the warehouse, not here. Restoring from trash is not available yet, so this cannot be undone.`
    : ''
)

async function toggle() {
  const s = source.value
  const wasEnabled = s.isEnabled
  const res = await setEnabled(s.id, !wasEnabled)
  notifyMutationResult($q, res, {
    success: `${s.name} ${wasEnabled ? 'paused' : 'enabled'}`,
    apiMissing: `Can't ${wasEnabled ? 'pause' : 'enable'} ${s.name} yet.`
  })
}

async function remove() {
  const s = source.value
  const res = await removeSource(s.id)
  notifyMutationResult($q, res, {
    success: `${s.name} deleted`,
    apiMissing: `Can't delete ${s.name} yet.`
  })
  if (res.ok) router.push({ name: 'sources' })
}

// Clipboard access is permission-gated and unavailable outside a secure context,
// so a failure has to be reported rather than thrown.
async function copyValue({ label, value }) {
  let message = `${label} copied to clipboard`
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    message = `Couldn't copy the ${label.toLowerCase()} . Select it and copy by hand.`
  }
  $q.notify({ message, color: 'dark', timeout: 2500 })
}

function openPipe(pipe) {
  router.push({ name: 'pipes-detail', params: { id: pipe.id } })
}

onMounted(() => {
  load()
  loadPipes()
})
</script>
