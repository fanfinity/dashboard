<template>
  <div class="flex flex-col gap-4">
    <!-- Everything on this tab except Delete is switched off, and the banner
         says which of them and why. The backend's `SourceUpdate` carries a
         single field, `is_enabled`, and its `Source` record has no
         `description`, no strict-mode flag and no server-key list — so the name
         box, the rotate button and the toggle below were controls with nothing
         behind them, quietly telling the reader they had changed something.
         The sections stay visible: "not available yet" is a useful answer and a
         hidden control is one nobody can plan around. -->
    <NoticeBanner
      tone="warn"
      title="Most of this tab is read-only for now"
      message="Renaming a source, rotating or revoking a key, issuing a server-to-server key and Strict mode all need backend endpoints that do not exist yet, so those controls are disabled rather than silently doing nothing. Pausing a source and deleting it both work today — pause is in the header, delete is at the bottom of this page."
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
        hint="Not stored on a source yet — the backend record has no description field."
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
            >Nothing to save to yet — a source update accepts its enabled flag
            and nothing else.</p
          >
        </div>
      </template>
    </FormSection>

    <!-- Keys. Two kinds, and the difference between them is the whole reason
         this section has prose: one belongs in public HTML and one must never
         leave a server. A single "API keys" list would flatten that. -->
    <template v-if="issuesKeys">
      <CardPanel>
        <template #header>
          <div>
            <span class="text-sm font-semibold text-ink"
              >Browser write keys</span
            >
            <p class="mt-0.5! text-xs text-muted"
              >Public by design — safe in client-side code, the same way a
              Google Analytics id is.</p
            >
          </div>
          <StatusBadge tone="neutral" :label="`${browserKeys.length} active`" />
        </template>

        <div v-if="browserKeys.length" class="flex flex-col gap-2">
          <div
            v-for="key in browserKeys"
            :key="key"
            class="flex items-center justify-between gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill px-3 py-2.5"
          >
            <code class="min-w-0 truncate font-sfere-mono text-xs text-ink">{{
              key
            }}</code>
            <div class="flex shrink-0 items-center gap-1">
              <SfereButton
                variant="ghost"
                size="sm"
                @click="emit('copy', { label: 'Write key', value: key })"
                >Copy</SfereButton
              >
              <SfereButton variant="ghost" size="sm" disabled
                >Rotate</SfereButton
              >
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-muted"
          >No browser key yet — one is issued when the source is provisioned.</p
        >

        <!-- The old line here read "Update your snippet first, then rotate",
             which describes an order nobody can follow: the new key does not
             exist until the rotation issues it. What it should say is the real
             sequence, and that sequence is also why rotation is a backend
             feature rather than a button we can fake — generating a key in the
             browser would be inventing one. -->
        <template #footer>
          <p class="text-xs text-muted"
            >Rotating issues a new key immediately and stops accepting the old
            one, so the order is: rotate, copy the new key into your snippet,
            then redeploy. Plan for the gap between those steps — every client
            still on the old key is dropped for its length. Not available yet:
            there is no rotate endpoint, and there is no overlap period to offer
            until there is.</p
          >
        </template>
      </CardPanel>

      <CardPanel>
        <template #header>
          <div>
            <span class="text-sm font-semibold text-ink"
              >Server-to-server keys</span
            >
            <p class="mt-0.5! text-xs text-muted"
              >Private. For backend calls only — never in client-side code.</p
            >
          </div>
          <StatusBadge tone="neutral" :label="`${serverKeys.length} active`" />
        </template>

        <div v-if="serverKeys.length" class="flex flex-col gap-2">
          <div
            v-for="key in serverKeys"
            :key="key"
            class="flex items-center justify-between gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill px-3 py-2.5"
          >
            <code class="min-w-0 truncate font-sfere-mono text-xs text-ink">{{
              key
            }}</code>
            <SfereButton variant="ghost" size="sm" disabled>Revoke</SfereButton>
          </div>
        </div>
        <p v-else class="text-sm text-muted"
          >None issued. You only need one if you also send events from your own
          backend for this source.</p
        >

        <template #footer>
          <div class="flex flex-wrap items-center gap-3">
            <SfereButton variant="secondary" size="sm" disabled
              >Issue a server-to-server key</SfereButton
            >
            <p class="min-w-0 flex-1 text-xs text-subtle"
              >No endpoint issues one yet.</p
            >
          </div>
        </template>
      </CardPanel>

      <CardPanel>
        <!-- `min-w-0 flex-1`: Quasar's unlayered `.flex { flex-wrap: wrap }`
             would otherwise push this paragraph below the toggle. -->
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
            <p class="mt-2! text-xs text-subtle">
              Not available yet — a source record carries no strict-mode flag,
              so there is nothing to read or write.
            </p>
          </div>
          <SfereToggle
            v-model="draft.strictMode"
            label="Strict mode"
            disabled
          />
        </div>
      </CardPanel>
    </template>

    <!-- Danger zone. Last, bordered in the danger tone, and describing what
         survives as well as what does not — "this cannot be undone" without
         saying what is lost is what makes people afraid to click anything. -->
    <div
      class="rounded-sfere-xl border border-sfere-danger/30 bg-sfere-danger-soft p-5"
    >
      <p class="text-sm font-semibold text-sfere-danger">Delete this source</p>
      <p class="mt-1! max-w-2xl text-sm text-sfere-danger/85">
        Collection stops immediately and any pipe reading from it stops
        delivering. Events already written to a destination are not touched —
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
import { computed, reactive, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import FormField from '@/components/ui/FormField.vue'
import FormSection from '@/components/ui/FormSection.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'

// Everything about a source that is a decision rather than a reading: its name,
// its keys, how strictly it authenticates, and whether it should exist.
//
// The panel holds a DRAFT and never mutates the source prop. Today the draft is
// read-only — every field on it is one the backend does not accept — but it is
// kept rather than collapsed into plain text, so wiring the endpoints up is
// adding a save handler back rather than rebuilding the form.
const props = defineProps({
  source: { type: Object, required: true }
})

// Two events, because two things on this tab do something: copying a key, and
// deleting the source. The five that used to be here — save, rotate, revoke,
// issue-server-key, strict-mode — had no endpoint behind them, so the page
// answered each with a "would be saved" toast. A toast that describes a
// hypothetical is indistinguishable from one describing a save, which is the
// reason those controls are disabled now rather than wired to a placeholder.
const emit = defineEmits(['copy', 'delete'])

const draft = reactive({
  name: '',
  description: '',
  strictMode: false
})

function reset() {
  draft.name = props.source.name ?? ''
  draft.description = props.source.description ?? ''
  draft.strictMode = Boolean(props.source.strictMode)
}

// Re-seed whenever the underlying source changes identity — navigating between
// two sources must not carry the first one's unsaved name into the second.
watch(() => props.source?.id, reset, { immediate: true })

// A cloud app is polled with stored credentials, so it has no write key at all
// and the whole keys section would be describing something that does not exist.
const issuesKeys = computed(() => props.source.sourceType !== 'cloud_app')

const browserKeys = computed(() =>
  props.source.writeKey ? [props.source.writeKey] : []
)

// The backend does not issue server-to-server keys per source yet, so this is
// always empty rather than showing an invented key. The section stays visible
// because "none issued" is the useful answer.
const serverKeys = computed(() => props.source.serverWriteKeys ?? [])
</script>
