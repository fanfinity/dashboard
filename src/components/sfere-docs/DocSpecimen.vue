<template>
  <div
    class="overflow-hidden rounded-sfere-xl border border-sfere-line bg-sfere-surface"
  >
    <div
      v-if="title || note"
      class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-sfere-line px-5 py-3"
    >
      <h3
        class="font-sfere-mono! text-sfere-label! uppercase! text-sfere-fg-muted"
      >
        {{ title }}
      </h3>
      <p v-if="note" class="text-sfere-xs text-sfere-fg-muted">{{ note }}</p>
    </div>

    <div :class="stageClasses">
      <slot />
    </div>

    <div
      v-if="usage"
      class="border-t border-sfere-line bg-sfere-fill/50 px-5 py-3"
    >
      <p class="text-sfere-xs leading-relaxed text-sfere-fg-muted">
        <span class="font-semibold text-sfere-fg">When to use.</span>
        {{ usage }}
      </p>
    </div>

    <div v-if="code" class="border-t border-sfere-line">
      <pre
        class="overflow-x-auto bg-sfere-ink px-5 py-3.5 font-sfere-mono text-sfere-xs leading-relaxed text-white/80"
      ><code>{{ code }}</code></pre>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// A framed example: label, live render, a line on when to reach for it, and the
// markup that produced it. Every component in the kit gets one, because a
// swatch of a button tells you nothing about which button to pick.
const props = defineProps({
  title: { type: String, default: '' },
  note: { type: String, default: '' },
  usage: { type: String, default: '' },
  code: { type: String, default: '' },
  // Stage the example on ink when the variants being shown are the on-dark set.
  onDark: { type: Boolean, default: false },
  // Drop the padding for examples that need to reach the frame edge.
  bleed: { type: Boolean, default: false }
})

const stageClasses = computed(() => [
  props.bleed ? '' : 'p-6',
  props.onDark ? 'sfere-dot-grid bg-sfere-ink' : 'bg-sfere-bg'
])
</script>
