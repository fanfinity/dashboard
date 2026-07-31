<template>
  <div class="flex items-start gap-3 rounded-xl border p-4" :class="shellClass">
    <span
      class="mt-1 size-2 shrink-0 rounded-full"
      :class="dotClass"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-medium text-ink">{{ title }}</p>
      <p
        v-if="message"
        class="text-sm text-muted"
        :class="title ? 'mt-0.5' : ''"
        >{{ message }}</p
      >
      <div v-if="$slots.default" :class="title || message ? 'mt-2' : ''">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Inline notice for the "this list is fine, but there is something you should
// know" case — PipesTrashPage's "2 of these reference a record that was deleted
// too", and every trash / health screen after it. That page had to put a whole
// sentence inside a StatusBadge, which is a pill sized for one or two words.
//
// This is deliberately NOT ErrorState: `data-smoke="error"` means the screen
// failed, and a notice means the screen worked. Nothing here carries that hook.
//
// Layout (dot + title + body) is DashboardHomePage's "Needs attention" block;
// the three colour ramps are StatusBadge's brand / amber / rose entries.
const props = defineProps({
  variant: {
    type: String,
    default: 'info',
    validator: v => ['info', 'warn', 'danger'].includes(v)
  },
  title: { type: String, default: '' },
  message: { type: String, default: '' }
})

const SHELL = {
  info: 'border-brand/30 bg-brand/5',
  warn: 'border-amber-200 bg-amber-50',
  danger: 'border-rose-200 bg-rose-50'
}

const DOT = {
  info: 'bg-brand',
  warn: 'bg-amber-500',
  danger: 'bg-rose-600'
}

const shellClass = computed(() => SHELL[props.variant] ?? SHELL.info)
const dotClass = computed(() => DOT[props.variant] ?? DOT.info)
</script>
