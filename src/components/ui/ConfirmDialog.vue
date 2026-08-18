<template>
  <q-dialog v-model="open">
    <div :class="cardClasses">
      <div
        class="flex shrink-0 items-start justify-between gap-4 border-b border-sfere-line px-5 py-4"
      >
        <h2 class="font-sfere-display! text-sfere-h4! text-sfere-fg">{{
          title
        }}</h2>
        <button
          v-close-popup
          type="button"
          aria-label="Close"
          class="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-sfere text-sfere-fg-muted transition-colors duration-150 hover:bg-sfere-fill hover:text-sfere-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60"
        >
          <svg
            class="size-4"
            viewBox="0 0 256 256"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128L50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"
            />
          </svg>
        </button>
      </div>

      <div class="flex flex-col gap-3 px-5 py-5">
        <p v-if="message" class="text-sfere-sm text-sfere-fg-muted">{{
          message
        }}</p>
        <slot />
      </div>

      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-sfere-line px-5 py-3.5"
      >
        <SfereButton v-close-popup variant="secondary" size="sm">{{
          cancelLabel
        }}</SfereButton>
        <SfereButton
          :variant="destructive ? 'danger' : 'primary'"
          size="sm"
          :loading="loading"
          @click="onConfirm"
          >{{ confirmLabel }}</SfereButton
        >
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'
import SfereButton from './SfereButton.vue'

// Yes/no confirmation — the surface behind every Delete and every Restore on
// the nine Trash screens.
//
// THE ONE QUASAR DEPENDENCY IN THIS KIT, and a deliberate one. Everything a
// modal owes the user is invisible: a focus trap, Escape to dismiss, scroll
// lock on the page behind it, a backdrop click, and a teleport out of whatever
// `overflow: hidden` ancestor it was declared in. q-dialog has all five and
// hand-rolling them correctly is a great deal of subtle code for a kit that
// never ships outside this app. Only the shell is borrowed — the card, the
// buttons and the type are all Sfere, so it does not read as a Quasar dialog.
// This exception is recorded in docs/sfere-design-system.md; do not treat it as
// licence to reach for q-* elsewhere.
//
// The props are carried over from the dialog this replaced, plus `loading` for
// a confirm that has to wait on something.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  // Swaps the confirm button to the danger variant. Set it for anything that
  // destroys data, and only for that — a red button on a routine confirm
  // teaches people to ignore red buttons.
  destructive: { type: Boolean, default: false },
  // Spinner on the confirm button, and it stops being clickable. NOT a way to
  // hold the dialog open through an async action — see onConfirm below.
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const cardClasses = [
  'flex w-[440px] max-w-[92vw] flex-col overflow-hidden',
  'rounded-sfere-xl border border-sfere-line bg-sfere-surface shadow-sfere-pop'
]

// The dialog always closes on confirm, which is what all nine Trash screens
// want: the work happens on the page behind it, and a modal that lingers over
// its own result is a second thing to dismiss.
//
// A caller that genuinely needs it to stay open — a confirm that can fail and
// has to show why — drives `modelValue` itself and reopens. `loading` is not
// that mechanism: it disables the confirm button, so by the time it is true
// there is nothing left to click.
function onConfirm() {
  emit('confirm')
  open.value = false
}
</script>
