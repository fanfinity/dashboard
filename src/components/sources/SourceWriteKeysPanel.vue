<template>
  <CardPanel>
    <template #header>
      <div class="min-w-0 flex-1">
        <span class="text-sm font-semibold text-ink">Write keys</span>
        <p class="mt-0.5! text-xs text-muted"
          >Two kinds, and the difference matters: a browser key is public by
          design, a server-to-server key must never leave your backend.</p
        >
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <StatusBadge tone="neutral" :label="countLabel" />
        <SfereButton
          v-if="!noSite && !apiMissing"
          size="sm"
          variant="secondary"
          @click="createOpen = true"
          >New key</SfereButton
        >
      </div>
    </template>

    <LoadingState v-if="loading" variant="form" :rows="2" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load this source's write keys."
      :message="error"
      @retry="emit('retry')"
    />

    <!-- The 400 branch, rendered as the sentence it is. The endpoint answers
         "Source has no Jitsu site; write keys are provisioned with it", and the
         shared read gate would have turned that into a red ErrorState — a
         perfectly ordinary state reported as a fault. -->
    <NoticeBanner
      v-else-if="noSite"
      tone="info"
      title="No write keys on this source"
      message="Write keys are issued when a source is provisioned with an event-collection site, and this one has none. A cloud-app source pulls with stored credentials instead, so it needs no key."
    />

    <NoticeBanner
      v-else-if="apiMissing"
      tone="info"
      title="No API yet"
      message="Write keys are live as of backend PR #16. Demo data mode has no fixture for them — there was no endpoint to model when the fixtures were written — so switch Settings → Data source to Real API to manage them."
    />

    <EmptyState
      v-else-if="!keys.length"
      title="No write keys yet"
      description="Mint one and paste it into whatever is sending events. The value is shown once."
    >
      <template #cta>
        <SfereButton size="sm" @click="createOpen = true"
          >Create a write key</SfereButton
        >
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-4">
      <section
        v-for="group in groups"
        :key="group.kind"
        class="flex flex-col gap-2"
      >
        <div class="flex items-baseline justify-between gap-2">
          <p
            class="text-xs font-semibold uppercase tracking-[0.4px] text-subtle"
            >{{ group.label }}</p
          >
          <p class="text-xs text-subtle">{{ group.description }}</p>
        </div>

        <p v-if="!group.items.length" class="text-sm text-muted">{{
          group.emptyNote
        }}</p>

        <div
          v-for="key in group.items"
          :key="key.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill px-3 py-2.5"
        >
          <!-- min-w-0 flex-1 on the giving-way child and shrink-0 on the
               controls: Quasar's unlayered `.flex { flex-wrap: wrap }` means a
               long key name would otherwise push the buttons onto their own
               line. -->
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ink">{{
              key.name || 'Unnamed key'
            }}</p>
            <p class="text-xs text-subtle">
              <code class="font-sfere-mono">…{{ key.hint }}</code>
              · created {{ formatDate(key.createdAt) }} · last used
              {{ formatDateTime(key.lastUsedAt, NOT_KNOWN) }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <SfereButton variant="ghost" size="sm" @click="askRevoke(key)"
              >Revoke</SfereButton
            >
          </div>
        </div>
      </section>
    </div>

    <template v-if="!apiMissing && !noSite" #footer>
      <!-- The order this states is the only one that can actually be followed.
           The old copy said "update your snippet first, then rotate", which asks
           you to paste a key that does not exist yet. There is no rotate
           endpoint and no overlap window; mint-then-revoke is the rotation, and
           it is the better one because you choose when the old key dies. -->
      <p class="text-xs text-muted"
        >To rotate a key: create a new one, paste it into your snippet and
        redeploy, then revoke the old one. Revoking takes effect immediately
        with no grace period, so leaving both live until the deploy has landed
        is what avoids dropping events. A key's last-used time reads “{{
          NOT_KNOWN
        }}” for anything minted here: the backend has the field and never fills
        it in, and guessing “Never” about a key that may be serving production
        traffic is the one wrong thing this list could say.</p
      >
    </template>

    <!-- Create -->
    <ConfirmDialog
      v-model="createOpen"
      title="Create a write key"
      message="Pick which kind. The key's value is shown once, on the next screen, and cannot be retrieved afterwards."
      confirm-label="Create key"
      :loading="creating"
      @confirm="submitCreate"
    >
      <div class="flex flex-col gap-3">
        <FormField label="Kind" required for-id="write-key-kind">
          <div id="write-key-kind" class="flex flex-col gap-2">
            <label
              v-for="option in WRITE_KEY_KINDS"
              :key="option.value"
              class="flex cursor-pointer items-start gap-2.5 rounded-sfere border border-sfere-line bg-white px-3 py-2.5 hover:bg-sfere-fill"
            >
              <input
                v-model="draft.kind"
                type="radio"
                :value="option.value"
                class="mt-0.5 size-4 shrink-0 accent-sfere-500"
              />
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-sfere-fg">{{
                  option.label
                }}</span>
                <span class="block text-xs text-sfere-fg-muted">{{
                  option.description
                }}</span>
              </span>
            </label>
          </div>
        </FormField>

        <FormField
          label="Label"
          optional
          for-id="write-key-name"
          hint="What is going to use it. Shown in this list, so it is what a later revoke decision has to go on."
        >
          <SfereInput
            id="write-key-name"
            v-model="draft.name"
            placeholder="e.g. Marketing site"
            autocomplete="off"
          />
        </FormField>
      </div>
    </ConfirmDialog>

    <!-- Revoke. Its own ref rather than sharing the create flow's: two dialogs
         reading one piece of state is how a confirm acts on the wrong record. -->
    <ConfirmDialog
      v-model="revokeOpen"
      :title="
        revokeTarget
          ? `Revoke “${revokeTarget.name || 'this key'}”?`
          : 'Revoke this key?'
      "
      :message="revokeMessage"
      confirm-label="Revoke key"
      destructive
      @confirm="submitRevoke"
    />

    <!-- Opened by the page above once the create response is in, by setting
         `plaintext`. Driven by a prop rather than by a method on this component
         so the secret has exactly one owner and this panel never holds a copy
         after the page clears it. -->
    <SecretRevealDialog
      :model-value="Boolean(plaintext)"
      :secret="plaintext"
      title="Copy your write key now"
      :subtitle="revealSubtitle"
      label="Write key"
      @close="emit('reveal-closed')"
      @update:model-value="value => value || emit('reveal-closed')"
    />
  </CardPanel>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, reactive, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SecretRevealDialog from '@/components/ui/SecretRevealDialog.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { WRITE_KEY_KINDS } from '@/composables/useSourceWriteKeys'
import { formatDate, formatDateTime } from '@/composables/useSources'

// Replaces the two disabled key cards this tab used to carry — "Browser write
// keys" with a dead Rotate button, and "Server-to-server keys" with a dead
// Issue button. Both are real endpoints now
// (`GET/POST …/write-keys`, `DELETE …/write-keys/{id}`, backend PR #16), and the
// two sections became one list grouped by `kind`, because a key's kind is a
// field on the record rather than a different feature.
const props = defineProps({
  keys: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false },
  /** The source has no event-collection site, so it has no keys to have. */
  noSite: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  /**
   * The plaintext of a key just created, or ''. Non-empty opens the reveal
   * dialog. The page owns it and clears it on `reveal-closed`, so there is one
   * copy of the secret and one place it is dropped.
   */
  plaintext: { type: String, default: '' }
})

const emit = defineEmits(['retry', 'create', 'revoke', 'reveal-closed'])

const createOpen = ref(false)
// Its own pair of refs, not one derived from the other: the confirm closes the
// dialog on click, and a target derived from `open` would blank the message
// mid-fade. The target is deliberately LEFT in place after the confirm.
const revokeOpen = ref(false)
const revokeTarget = ref(null)
const newKeyName = ref('')

const draft = reactive({ kind: 'public', name: '' })

watch(createOpen, isOpen => {
  if (isOpen) {
    draft.kind = 'public'
    draft.name = ''
  }
})

function askRevoke(key) {
  revokeTarget.value = key
  revokeOpen.value = true
}

const countLabel = computed(() => {
  if (props.apiMissing || props.noSite) return 'Not available'
  return `${props.keys.length} active`
})

const groups = computed(() =>
  WRITE_KEY_KINDS.map(kind => ({
    kind: kind.value,
    label: kind.label,
    description: kind.description,
    emptyNote:
      kind.value === 'public'
        ? 'No browser key yet. One is issued when the source is provisioned.'
        : 'None issued. You only need one if you also send events from your own backend.',
    items: props.keys.filter(k => k.kind === kind.value)
  }))
)

const revokeMessage = computed(() => {
  const key = revokeTarget.value
  if (!key) return ''
  return `Anything still presenting this key is rejected from its next request — immediately, with no grace period. ${
    key.kind === 'public'
      ? 'If it is in a page that is still deployed, that page stops collecting events until you ship a new key.'
      : 'If a backend job is still using it, that job starts failing.'
  } The key cannot be restored; create a replacement instead.`
})

const revealSubtitle = computed(
  () =>
    `“${newKeyName.value || 'New key'}” is live. Paste it into whatever is sending events, then revoke the key it replaces.`
)

function submitCreate() {
  // The dialog closes on confirm (ConfirmDialog always does), so the pending
  // state lives on the page above rather than here.
  const name = draft.name.trim()
  newKeyName.value = name || 'New key'
  emit('create', { kind: draft.kind, name })
}

function submitRevoke() {
  const key = revokeTarget.value
  if (!key) return
  emit('revoke', key)
  // Left in place rather than nulled — the message must not blank out while the
  // dialog fades. It is overwritten by the next `askRevoke`.
}
</script>
