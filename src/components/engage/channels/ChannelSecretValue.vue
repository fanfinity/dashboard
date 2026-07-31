<template>
  <div class="flex flex-wrap items-center gap-2">
    <code
      class="rounded-lg border border-line2 bg-sidebar px-2.5 py-1.5 font-mono text-xs text-ink"
      >{{ maskSecret(value, revealed) }}</code
    >

    <button
      v-if="revealable"
      type="button"
      class="rounded-lg border border-line2 bg-white px-2.5 py-1 text-xs font-medium text-muted hover:bg-fill"
      @click.stop="revealed = !revealed"
    >
      {{ revealed ? 'Hide' : 'Reveal' }}
    </button>

    <button
      v-if="revealable"
      type="button"
      class="rounded-lg border border-line2 bg-white px-2.5 py-1 text-xs font-medium text-muted hover:bg-fill"
      @click.stop="copy"
    >
      Copy
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  hasRevealableSecret,
  maskSecret
} from '@/composables/useEngageChannelsFormat'

// One credential-shaped value, rendered the way SettingsSecretValue already
// established for the settings screens: masked by default, behind an explicit
// Reveal, so nothing legible ends up in a screenshot of the screen.
//
// Copy is offered because the values here (a provider account id) are things an
// operator pastes into a provider console. `navigator.clipboard` rejects on a
// non-secure origin and when the document is not focused, and an unhandled
// rejection is a console error — which is a smoke-gate failure — so the call is
// wrapped and the outcome is handed to the page to toast.
const props = defineProps({
  value: { type: String, default: '' }
})
const emit = defineEmits(['copied', 'copy-failed'])

const revealed = ref(false)

// A value too short to have a tail has nothing to reveal, and offering a
// control that changes nothing is a lie about what is held.
const revealable = computed(() => hasRevealableSecret(props.value))

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    emit('copied')
  } catch {
    emit('copy-failed')
  }
}
</script>
