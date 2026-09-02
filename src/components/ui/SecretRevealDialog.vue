<template>
  <q-dialog v-model="open" persistent>
    <div :class="cardClasses">
      <div
        class="flex shrink-0 items-start justify-between gap-4 border-b border-sfere-line px-5 py-4"
      >
        <div class="min-w-0">
          <h2 class="font-sfere-display! text-sfere-h4! text-sfere-fg">{{
            title
          }}</h2>
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted">{{ subtitle }}</p>
        </div>
      </div>

      <div class="flex flex-col gap-4 px-5 py-5">
        <!-- Amber rather than red: nothing has gone wrong, but this is the one
             screen where closing without acting loses something. -->
        <NoticeBanner
          tone="warn"
          title="This is the only time you will see this value"
          :message="warning"
        />

        <div class="flex flex-col gap-2">
          <p
            class="text-xs font-medium uppercase tracking-[0.4px] text-sfere-fg-subtle"
            >{{ label }}</p
          >
          <div class="flex items-stretch gap-2">
            <!-- readonly, not disabled: Quasar's unlayered
                 `[disabled] { opacity: .6 }` would grey out the one string on
                 screen someone has to read and select by hand. -->
            <code
              class="min-w-0 flex-1 overflow-x-auto rounded-sfere border border-sfere-line bg-sfere-fill px-3 py-2.5 font-sfere-mono text-sfere-sm text-sfere-fg"
              >{{ secret }}</code
            >
            <SfereButton
              class="shrink-0"
              size="sm"
              :variant="copied ? 'secondary' : 'primary'"
              @click="copy"
              >{{ copied ? 'Copied' : 'Copy' }}</SfereButton
            >
          </div>
          <p v-if="copyError" class="text-xs text-rose-600">{{ copyError }}</p>
        </div>

        <slot />
      </div>

      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-sfere-line px-5 py-3.5"
      >
        <!-- No v-close-popup and `persistent` on the dialog: an accidental
             backdrop click or Esc here throws the value away, and there is no
             endpoint that can give it back. Closing is a deliberate button. -->
        <SfereButton size="sm" @click="close">{{ doneLabel }}</SfereButton>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import NoticeBanner from './NoticeBanner.vue'
import SfereButton from './SfereButton.vue'

// A value the backend returns exactly once and can never serve again.
//
// Both write-once secrets in the API behave this way: `ApiTokenCreated` and
// `WriteKeyCreated` each carry a `plaintext` alongside the record, and every
// later read gives you only a four-character `hint`. The backend stores a hash
// (`app/services/api_tokens.py`), so "show it again" is not a missing feature —
// there is nothing to show.
//
// That makes this a different component from ConfirmDialog rather than a use of
// it. Three things it does that a confirm must not:
//
//  - it is `persistent`, and neither Esc nor the backdrop closes it, because a
//    stray click costs the user a credential they then have to re-mint;
//  - it has no Cancel, since there is nothing to cancel — the token already
//    exists whether or not this dialog is read;
//  - it offers Copy as the primary action and keeps the value selectable as
//    text, for the browsers and contexts where the clipboard API is refused.
//
// The value is a prop and is never stored anywhere else. Closing clears the
// caller's copy — see the `close` emit.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** The secret itself. Held for the life of the dialog and nowhere else. */
  secret: { type: String, default: '' },
  title: { type: String, default: 'Copy this value now' },
  subtitle: { type: String, default: '' },
  label: { type: String, default: 'Value' },
  warning: {
    type: String,
    default:
      'It is stored as a hash, so it cannot be shown or recovered later. If you lose it, delete this credential and create another.'
  },
  doneLabel: { type: String, default: "I've saved it" }
})

const emit = defineEmits(['update:modelValue', 'close'])

const copied = ref(false)
const copyError = ref('')

const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

// Written out as literal utilities, not interpolated from a prop: Tailwind v4
// extracts arbitrary values from source text, so a class built at runtime is
// never generated and the dialog silently falls back to Quasar's unlayered
// `.q-dialog__inner--minimized > div { max-width: 560px }`. Both halves of the
// pair are needed for the same reason — that Quasar rule is a `max-width`, so
// the override has to be one too — and it is a `min()` rather than a flat pixel
// value so the dialog can still shrink on a narrow window. A token is one long
// unbroken string, hence the wider 620px.
const cardClasses = [
  'flex w-[min(620px,92vw)]! max-w-[min(620px,92vw)]! flex-col overflow-hidden',
  'rounded-sfere-xl border border-sfere-line bg-sfere-surface shadow-sfere-pop'
]

// Reset per opening, so a second token does not open showing "Copied" from the
// first one.
watch(open, isOpen => {
  if (isOpen) {
    copied.value = false
    copyError.value = ''
  }
})

// Clipboard access is permission-gated and unavailable outside a secure
// context, so a refusal has to be reported rather than thrown — and here it
// matters more than usual: the fallback is "select it by hand", and someone who
// thinks they copied a token they did not is going to close this dialog.
async function copy() {
  try {
    await navigator.clipboard.writeText(props.secret)
    copied.value = true
    copyError.value = ''
  } catch {
    copied.value = false
    copyError.value =
      'The browser refused clipboard access. Select the value above and copy it by hand before closing.'
  }
}

function close() {
  emit('close')
  open.value = false
}
</script>
