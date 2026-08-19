<template>
  <div data-smoke="error" :class="rootClasses">
    <SfereIconChip :on-dark="onDark" size="sm" class="mb-4">
      <svg class="size-5" viewBox="0 0 256 256" fill="currentColor">
        <path
          d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24"
          opacity="0.2"
        />
        <path
          d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88m-8-80V80a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0m20 36a12 12 0 1 1-12-12a12 12 0 0 1 12 12"
        />
      </svg>
    </SfereIconChip>

    <p :class="titleClasses">{{ title }}</p>
    <p v-if="message" :class="messageClasses">{{ message }}</p>

    <SfereButton
      :variant="onDark ? 'outlineLight' : 'secondary'"
      size="sm"
      class="mt-5"
      @click="emit('retry')"
    >
      {{ retryLabel }}
    </SfereButton>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereButton from './SfereButton.vue'
import SfereIconChip from './SfereIconChip.vue'

// The single failure surface for the whole kit, and the one carve-out to the
// "no data-smoke attributes" rule in docs/sfere-design-system.md.
// `data-smoke="error"` on the root is the one selector scripts/smoke.mjs looks
// for on every route — if a screen renders this, the screen is broken. Never
// put that attribute anywhere else, and never hand-roll an error card instead
// of reaching for this: a bespoke one leaves the only behavioural gate in the
// repo with nothing to assert on.
//
// `title`, `message` and `@retry` are carried over verbatim from the error card
// this replaced, so no screen had to change when the kit did.
//
// Note this does NOT use the danger colour as a background. A failed fetch is
// worth one retry button, not an alarm — NoticeBanner tone="danger" is for a
// problem the user has to act on.
const props = defineProps({
  title: { type: String, default: 'Something went wrong' },
  message: { type: String, default: '' },
  retryLabel: { type: String, default: 'Retry' },
  onDark: { type: Boolean, default: false }
})

const emit = defineEmits(['retry'])

const rootClasses = computed(() => [
  'flex flex-col items-center rounded-sfere-xl border px-6 py-12 text-center',
  props.onDark
    ? 'border-sfere-hairline bg-sfere-ink-raised'
    : 'border-sfere-line bg-sfere-surface'
])

const titleClasses = computed(() => [
  'text-sfere-sm font-semibold',
  props.onDark ? 'text-white' : 'text-sfere-fg'
])

const messageClasses = computed(() => [
  'mt-1 max-w-sm text-sfere-sm',
  props.onDark ? 'text-white/55' : 'text-sfere-fg-muted'
])
</script>
