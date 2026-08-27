<template>
  <div class="flex flex-col gap-4">
    <FormSection
      title="Details"
      description="How this source appears everywhere it is referenced."
    >
      <FormField label="Name" for-id="settings-source-name">
        <SfereInput
          id="settings-source-name"
          v-model="draft.name"
          placeholder="Source name"
        />
      </FormField>

      <FormField
        label="Description"
        optional
        for-id="settings-source-description"
        hint="One line of context for whoever inherits this."
      >
        <SfereTextarea
          id="settings-source-description"
          v-model="draft.description"
          :rows="2"
        />
      </FormField>

      <template #actions>
        <div class="flex items-center gap-3">
          <SfereButton size="sm" :disabled="!dirty" @click="save"
            >Save changes</SfereButton
          >
          <SfereButton v-if="dirty" variant="ghost" size="sm" @click="reset"
            >Discard</SfereButton
          >
          <p v-else class="text-xs text-subtle">No unsaved changes.</p>
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
            <p class="mt-0.5 text-xs text-muted"
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
              <SfereButton
                variant="ghost"
                size="sm"
                @click="emit('rotate', 'browser')"
                >Rotate</SfereButton
              >
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-muted"
          >No browser key yet — one is issued when the source is provisioned.</p
        >

        <template #footer>
          <p class="text-xs text-muted"
            >Rotating a key stops every client still using the old one. Update
            your snippet first, then rotate.</p
          >
        </template>
      </CardPanel>

      <CardPanel>
        <template #header>
          <div>
            <span class="text-sm font-semibold text-ink"
              >Server-to-server keys</span
            >
            <p class="mt-0.5 text-xs text-muted"
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
            <SfereButton variant="ghost" size="sm" @click="emit('revoke', key)"
              >Revoke</SfereButton
            >
          </div>
        </div>
        <p v-else class="text-sm text-muted"
          >None issued. You only need one if you also send events from your own
          backend for this source.</p
        >

        <template #footer>
          <SfereButton
            variant="secondary"
            size="sm"
            @click="emit('issue-server-key')"
            >Issue a server-to-server key</SfereButton
          >
        </template>
      </CardPanel>

      <CardPanel>
        <!-- `min-w-0 flex-1`: Quasar's unlayered `.flex { flex-wrap: wrap }`
             would otherwise push this paragraph below the toggle. -->
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-ink">Strict mode</p>
            <p class="mt-1 max-w-2xl text-sm text-muted">
              Off by default. While off, an event arriving without a valid write
              key is still matched to this source by domain, which is forgiving
              while you are wiring things up. Turn it on once you are confident
              everything is correct, so a mistyped key fails loudly instead of
              landing somewhere quietly wrong.
            </p>
          </div>
          <SfereToggle
            v-model="draft.strictMode"
            label="Strict mode"
            @update:model-value="v => emit('strict-mode', v)"
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
      <p class="mt-1 max-w-2xl text-sm text-sfere-danger/85">
        Collection stops immediately and any pipe reading from it stops
        delivering. Events already written to a destination are not touched —
        they live in the warehouse, not here. The source itself moves to the
        trash and can be restored for 30 days.
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
// The panel holds a DRAFT and emits on save — it never mutates the source prop.
// A tab that writes straight through would make the Discard button a lie, and
// there is no per-field endpoint to write to anyway.
const props = defineProps({
  source: { type: Object, required: true }
})

const emit = defineEmits([
  'save',
  'copy',
  'rotate',
  'revoke',
  'issue-server-key',
  'strict-mode',
  'delete'
])

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

const dirty = computed(
  () =>
    draft.name !== (props.source.name ?? '') ||
    draft.description !== (props.source.description ?? '')
)

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

function save() {
  emit('save', {
    name: draft.name.trim(),
    description: draft.description.trim()
  })
}
</script>
