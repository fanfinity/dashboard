<template>
  <button
    type="button"
    class="group/swatch flex flex-col overflow-hidden rounded-sfere-lg border border-sfere-line bg-sfere-surface text-left transition duration-150 hover:border-sfere-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60"
    :aria-label="`Copy token name ${token}`"
    @click="copy"
  >
    <span :class="['h-16 w-full border-b border-sfere-line', swatchClass]" />

    <span class="flex flex-col gap-0.5 px-3 py-2.5">
      <span class="font-sfere-mono text-sfere-xs text-sfere-fg">{{
        token
      }}</span>
      <span
        class="font-sfere-mono text-[0.6875rem] uppercase text-sfere-fg-muted"
      >
        {{ copied ? 'copied' : value }}
      </span>
      <span
        v-if="usage"
        class="mt-0.5 text-[0.6875rem] leading-snug text-sfere-fg-muted"
      >
        {{ usage }}
      </span>
    </span>
  </button>
</template>

<script setup>
import { ref } from 'vue'

// `swatchClass` is passed in as a complete literal (`'bg-sfere-500'`) rather
// than assembled from a prop. Tailwind scans source text for class names, so a
// name built by concatenation at runtime never makes it into the stylesheet.
const props = defineProps({
  token: { type: String, required: true },
  value: { type: String, default: '' },
  usage: { type: String, default: '' },
  swatchClass: { type: String, required: true }
})

const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.token)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    // Clipboard access can be denied (insecure origin, permissions). The swatch
    // is still readable, so there is nothing to recover from — stay quiet.
  }
}
</script>
