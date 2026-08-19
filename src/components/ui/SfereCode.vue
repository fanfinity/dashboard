<template>
  <div
    class="overflow-hidden rounded-sfere-xl border border-sfere-hairline bg-sfere-ink"
  >
    <div
      v-if="filename || $slots.actions"
      class="flex items-center justify-between gap-3 border-b border-sfere-hairline px-4 py-2.5"
    >
      <span class="font-sfere-mono text-sfere-label uppercase text-white/45">
        {{ filename }}
      </span>
      <slot name="actions" />
    </div>

    <pre
      class="overflow-x-auto px-4 py-3.5 font-sfere-mono text-sfere-xs leading-relaxed text-white/80"
    ><code><slot>{{ code }}</slot></code></pre>
  </div>
</template>

<script setup>
// Always on ink, never on the light surface. Code is the one thing on the site
// that keeps a dark background in a light section — the contrast is what marks
// it as "machine output" without needing a border or a label.
//
// The <pre> scrolls inside its own box so a long line never widens the page.
defineProps({
  code: { type: String, default: '' },
  filename: { type: String, default: '' }
})
</script>
