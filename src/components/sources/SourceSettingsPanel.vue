<template>
  <div class="flex flex-col gap-4">
    <!-- Backend PR #16 closed three of the five items this banner used to list.
         Write keys are real (mint, revoke, and therefore rotate), and so is
         Strict mode with the domain lists it depends on. What is left is the
         name and the description: `SourceUpdate` is still a single field,
         `is_enabled`, and `Source` still carries no `description` — so those two
         boxes stay disabled rather than silently doing nothing. The claim is
         narrowed rather than dropped, because a banner that overstates what is
         missing is as misleading as one that understates it. -->
    <NoticeBanner
      tone="warn"
      title="Renaming a source is not available yet"
      message="A source update accepts its enabled flag and nothing else, and the record has no description field — so the two boxes below are disabled rather than pretending to save. Everything else on this tab is live: write keys can be created and revoked, and Strict mode is real for a Web SDK source. Pausing is in the header; deleting is at the bottom of this page."
    />

    <FormSection
      title="Details"
      description="How this source appears everywhere it is referenced."
    >
      <FormField label="Name" for-id="settings-source-name">
        <SfereInput
          id="settings-source-name"
          v-model="draft.name"
          placeholder="Source name"
          disabled
        />
      </FormField>

      <!-- `Source` carries no description at all, so this is empty on every
           real record rather than merely unsaveable. -->
      <FormField
        label="Description"
        optional
        for-id="settings-source-description"
        hint="Not stored on a source yet. The backend record has no description field."
      >
        <SfereTextarea
          id="settings-source-description"
          v-model="draft.description"
          :rows="2"
          disabled
        />
      </FormField>

      <template #actions>
        <div class="flex items-center gap-3">
          <SfereButton size="sm" disabled>Save changes</SfereButton>
          <p class="text-xs text-subtle"
            >Nothing to save to yet. A source update accepts its enabled flag
            and nothing else.</p
          >
        </div>
      </template>
    </FormSection>

    <!-- Keys. One list grouped by kind rather than the two cards that used to
         sit here, because a key's kind is a field on the record. -->
    <SourceWriteKeysPanel
      v-if="issuesKeys"
      :keys="writeKeys"
      :loading="keysLoading"
      :error="keysError"
      :api-missing="keysApiMissing"
      :no-site="keysNoSite"
      :creating="keyCreating"
      :plaintext="newKeyPlaintext"
      @retry="loadKeys"
      @create="onCreateKey"
      @revoke="onRevokeKey"
      @reveal-closed="newKeyPlaintext = ''"
    />

    <!-- Strict mode. Real now, and `web` only: the route is guarded by
         `is_event_stream()`, which despite its name returns
         `source_type == "web"` — so it 404s for zid, for cloud_app and for a
         source whose type is literally `event_stream`. Hidden rather than
         disabled for those, because the setting does not exist for them at all
         rather than being unbuilt. -->
    <CardPanel v-if="showIngestSettings">
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink">Ingest settings</span>
          <p class="mt-0.5! text-xs text-muted"
            >Which origins may send events for this source, and how strictly a
            missing key is treated.</p
          >
        </div>
        <StatusBadge
          v-if="ingestSettings"
          :tone="ingestDraft.strict ? 'success' : 'neutral'"
          :label="ingestDraft.strict ? 'Strict' : 'Forgiving'"
        />
      </template>

      <LoadingState v-if="ingestLoading" variant="form" :rows="3" />

      <ErrorState
        v-else-if="ingestError"
        title="Couldn't load this source's ingest settings."
        :message="ingestError"
        @retry="loadIngest"
      />

      <NoticeBanner
        v-else-if="ingestApiMissing"
        tone="info"
        title="No API yet"
        message="Ingest settings are live as of backend PR #16, and Demo data mode has no fixture for them. Switch Settings → Data source to Real API to edit them."
      />

      <div v-else class="flex flex-col gap-4">
        <!-- min-w-0 flex-1 on the prose, shrink-0 on the control: Quasar's
             unlayered `.flex { flex-wrap: wrap }` would otherwise drop the
             toggle onto its own line once this paragraph grows. -->
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-ink">Strict mode</p>
            <p class="mt-1! max-w-2xl text-sm text-muted">
              Off by default. While off, an event arriving without a valid write
              key is still matched to this source by domain, which is forgiving
              while you are wiring things up. Turn it on once you are confident
              everything is correct, so a mistyped key fails loudly instead of
              landing somewhere quietly wrong.
            </p>
          </div>
          <SfereToggle
            v-model="ingestDraft.strict"
            class="shrink-0"
            label="Strict mode"
          />
        </div>

        <FormField
          label="Event-collection domains"
          optional
          for-id="ingest-domains"
          hint="One per line. Custom domains that front the ingest endpoint for this source."
        >
          <SfereTextarea
            id="ingest-domains"
            v-model="ingestDraft.domainsText"
            :rows="2"
            placeholder="events.example.com"
          />
        </FormField>

        <FormField
          label="Authorised JavaScript domains"
          optional
          for-id="ingest-js-domains"
          hint="One per line. Origins the browser SDK may post from. With Strict mode off, these are also what an unkeyed event is matched against — which is why leaving this empty and Strict off is the most forgiving combination there is."
        >
          <SfereTextarea
            id="ingest-js-domains"
            v-model="ingestDraft.jsDomainsText"
            :rows="2"
            placeholder="www.example.com"
          />
        </FormField>

        <div class="flex flex-wrap items-center gap-3">
          <SfereButton
            size="sm"
            :loading="ingestSaving"
            :disabled="!ingestDirty"
            @click="saveIngest"
            >Save ingest settings</SfereButton
          >
          <p v-if="ingestDirty" class="min-w-0 flex-1 text-xs text-subtle"
            >Saving replaces all three values at once — the endpoint takes the
            whole record, not a single field.</p
          >
        </div>
      </div>
    </CardPanel>

    <!-- Danger zone. Last, bordered in the danger tone, and describing what
         survives as well as what does not — "this cannot be undone" without
         saying what is lost is what makes people afraid to click anything. -->
    <div
      class="rounded-sfere-xl border border-sfere-danger/30 bg-sfere-danger-soft p-5"
    >
      <p class="text-sm font-semibold text-sfere-danger">Delete this source</p>
      <p class="mt-1! max-w-2xl text-sm text-sfere-danger/85">
        Collection stops immediately and any pipe reading from it stops
        delivering. Events already written to a destination are not touched;
        they live in the warehouse, not here. Restoring a deleted source is not
        available yet, so this cannot be undone.
      </p>
      <div class="mt-4">
        <SfereButton variant="danger" size="sm" @click="emit('delete')"
          >Delete source</SfereButton
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import FormField from '@/components/ui/FormField.vue'
import FormSection from '@/components/ui/FormSection.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'
import SourceWriteKeysPanel from '@/components/sources/SourceWriteKeysPanel.vue'
import { useSourceWriteKeys } from '@/composables/useSourceWriteKeys'
import {
  hasIngestSettings,
  useSourceIngestSettings
} from '@/composables/useSourceIngestSettings'
import { notifyMutationResult } from '@/composables/useMutationFeedback'

// Everything about a source that is a decision rather than a reading: its name,
// its keys, how strictly it authenticates, and whether it should exist.
//
// Two of those four are live as of backend PR #16 — write keys
// (`GET/POST …/write-keys`, `DELETE …/write-keys/{id}`) and ingest settings
// (`GET/PUT …/ingest-settings`, which is where Strict mode lives). The name and
// the description are still read-only, because `SourceUpdate` carries only
// `is_enabled` and `Source` has no `description` at all.
//
// The panel holds a DRAFT and never mutates the source prop. The details draft
// is still read-only for that reason; the ingest draft is real and saves.
const props = defineProps({
  source: { type: Object, required: true }
})

// Copy and delete are still the page's business. The five writes that used to
// answer with a "would be saved" toast are down to two, and both of those now
// go to a real endpoint from inside this component rather than being emitted
// upward to a handler that could only apologise.
const emit = defineEmits(['copy', 'delete'])

const $q = useQuasar()

const draft = reactive({
  name: '',
  description: ''
})

function reset() {
  draft.name = props.source.name ?? ''
  draft.description = props.source.description ?? ''
}

// Re-seed whenever the underlying source changes identity — navigating between
// two sources must not carry the first one's unsaved name into the second.
watch(() => props.source?.id, reset, { immediate: true })

// A cloud app is polled with stored credentials, so it has no write key at all
// and the whole keys section would be describing something that does not exist.
const issuesKeys = computed(() => props.source.sourceType !== 'cloud_app')

// ---------------------------------------------------------------- write keys

const {
  keys: writeKeys,
  loading: keysLoading,
  error: keysError,
  apiMissing: keysApiMissing,
  noSite: keysNoSite,
  load: loadWriteKeys,
  create: createWriteKey,
  revoke: revokeWriteKey
} = useSourceWriteKeys()

const keyCreating = ref(false)
// The one place a new key's value lives, for as long as its dialog is open.
// The backend stores a hash, so this is the only copy in existence — hence one
// owner, and a single line that clears it.
//
// It holds the `keyId:secret` PAIR, not the bare `plaintext` off the response.
// Jitsu accepts only the pair — `Source.write_key` is stored composed, and the
// create route's own comment says the dashboard is what composes it — so
// revealing `plaintext` alone handed people a value that silently failed ingest
// wherever they pasted it. `useSourceWriteKeys.create()` returns both; this is
// the one worth showing.
const newKeyPlaintext = ref('')

function loadKeys() {
  if (issuesKeys.value) loadWriteKeys(props.source.id)
}

async function onCreateKey({ kind, name }) {
  keyCreating.value = true
  try {
    const res = await createWriteKey(props.source.id, { kind, name })
    if (!res.ok) {
      $q.notify({
        message: res.noSite
          ? 'This source has no event-collection site, so it cannot hold a write key.'
          : (res.error ?? "Can't create a write key yet."),
        color: 'dark',
        position: 'top-right',
        timeout: 5000
      })
      return
    }
    if (!res.data.writeKey) {
      // The key exists and its value did not come back. Nothing can show it
      // now, so say that rather than opening a dialog on an empty string.
      $q.notify({
        message: 'The key was created but its value did not come back.',
        caption:
          'Only a hash is stored, so it cannot be shown now. Revoke it and create another.',
        color: 'dark',
        position: 'top-right',
        timeout: 6000
      })
      return
    }
    newKeyPlaintext.value = res.data.writeKey
  } finally {
    keyCreating.value = false
  }
}

async function onRevokeKey(key) {
  const res = await revokeWriteKey(props.source.id, key.id)
  notifyMutationResult($q, res, {
    success: `${key.name || 'Write key'} revoked`,
    apiMissing: "Can't revoke a write key yet."
  })
}

// ------------------------------------------------------------ ingest settings

const {
  settings: ingestSettings,
  loading: ingestLoading,
  saving: ingestSaving,
  error: ingestError,
  apiMissing: ingestApiMissing,
  load: loadIngestSettings,
  save: saveIngestSettings
} = useSourceIngestSettings()

// `web` only, matching `is_event_stream()` in the backend rather than its name.
const showIngestSettings = computed(() => hasIngestSettings(props.source))

const ingestDraft = reactive({
  strict: false,
  domainsText: '',
  jsDomainsText: ''
})

/** One domain per line, blanks dropped. */
function parseLines(text) {
  return String(text ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function seedIngestDraft() {
  const s = ingestSettings.value
  ingestDraft.strict = Boolean(s?.strict)
  ingestDraft.domainsText = (s?.domains ?? []).join('\n')
  ingestDraft.jsDomainsText = (s?.authorizedJavascriptDomains ?? []).join('\n')
}

watch(ingestSettings, seedIngestDraft)

const ingestDirty = computed(() => {
  const s = ingestSettings.value
  if (!s) return false
  return (
    ingestDraft.strict !== s.strict ||
    parseLines(ingestDraft.domainsText).join('\n') !== s.domains.join('\n') ||
    parseLines(ingestDraft.jsDomainsText).join('\n') !==
      s.authorizedJavascriptDomains.join('\n')
  )
})

function loadIngest() {
  if (showIngestSettings.value) loadIngestSettings(props.source.id)
}

async function saveIngest() {
  const res = await saveIngestSettings(props.source.id, {
    strict: ingestDraft.strict,
    domains: parseLines(ingestDraft.domainsText),
    authorizedJavascriptDomains: parseLines(ingestDraft.jsDomainsText),
    // Passed through untouched rather than dropped: the field is optional on
    // the update body, and omitting a value the source already had would reset
    // its deduplication window as a side effect of saving a domain.
    deduplicateWindowMs: ingestSettings.value?.deduplicateWindowMs ?? null
  })
  notifyMutationResult($q, res, {
    success: 'Ingest settings saved',
    apiMissing: "Can't save ingest settings yet."
  })
}

// Both reads follow the source, not the mount: switching between two sources
// with the tab already open has to re-read, and neither read is worth making
// before there is an id.
watch(
  () => props.source?.id,
  id => {
    if (!id) return
    loadKeys()
    loadIngest()
  },
  { immediate: true }
)
</script>
