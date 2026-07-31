<template>
  <div class="flex flex-wrap items-center gap-2">
    <code
      class="rounded-lg border border-line2 bg-sidebar px-2.5 py-1.5 font-mono text-xs text-ink"
      >{{ maskSecret(preview, revealed) }}</code
    >

    <button
      v-if="revealable"
      class="rounded-lg border border-line2 bg-white px-2.5 py-1 text-xs font-medium text-muted hover:bg-fill"
      @click.stop="revealed = !revealed"
    >
      {{ revealed ? 'Hide' : 'Reveal' }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  hasRevealablePreview,
  maskSecret
} from '@/composables/useSettingsFormat'

// One credential, rendered the way ProfileApiTokensPanel already established:
// masked by default, behind an explicit per-row Reveal, and the most a Reveal
// can ever show is the stored preview. The full value is never in the payload,
// so there is nothing here that a screenshot could leak.
//
// There is deliberately no copy control: a masked preview is useless on the
// clipboard, and the string a function author actually wants — the
// `secrets.KEY_NAME` reference — sits next to the key, not next to the value.
const props = defineProps({
  preview: { type: String, default: '' }
})

const revealed = ref(false)

// A value stored as bare bullets has no tail to show, so offering a Reveal
// that changes nothing would be a lie about what is held.
const revealable = computed(() => hasRevealablePreview(props.preview))
</script>
