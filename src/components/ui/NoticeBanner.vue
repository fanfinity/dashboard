<template>
  <div :class="rootClasses" :role="tone === 'danger' ? 'alert' : 'status'">
    <span :class="['mt-0.5 size-2 shrink-0 rounded-full', DOTS[tone]]" />

    <!-- `grid gap-*` rather than `mt-*` on each line: an `mt-0.5` on a `<p>`
         computes to zero against Quasar's unlayered paragraph margin, so this
         block used to render on a flat 16px rhythm regardless of what it asked
         for, plus 16px of dead space under the last line that pushed the text
         to the top of the banner. Grid gap has no Quasar counterpart and so
         actually applies. -->
    <div class="sfere-flush grid min-w-0 flex-1 gap-1">
      <p v-if="title" :class="titleClasses">{{ title }}</p>
      <p v-if="message" class="text-sfere-sm opacity-80">{{ message }}</p>
      <div v-if="$slots.default" :class="title || message ? 'mt-2' : ''">
        <slot />
      </div>
    </div>

    <button
      v-if="dismissible"
      type="button"
      class="-m-1 shrink-0 rounded-sfere p-1 opacity-50 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60"
      aria-label="Dismiss"
      @click="emit('dismiss')"
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
</template>

<script setup>
import { computed } from 'vue'

// "The screen worked, but there is something you should know." A genuine load
// failure is still an error state, not a danger alert — same distinction the
// existing NoticeBanner draws, and the reason nothing here carries a
// `data-smoke` attribute: a notice must never trip the smoke gate.
const props = defineProps({
  tone: {
    type: String,
    default: 'info',
    validator: v => ['info', 'success', 'warn', 'danger'].includes(v)
  },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  dismissible: { type: Boolean, default: false }
})

const emit = defineEmits(['dismiss'])

const TONES = {
  info: 'border-sfere-200 bg-sfere-50 text-sfere-900',
  success: 'border-emerald-200 bg-sfere-success-soft text-emerald-900',
  warn: 'border-amber-200 bg-sfere-warn-soft text-amber-900',
  danger: 'border-rose-200 bg-sfere-danger-soft text-rose-900'
}

const DOTS = {
  info: 'bg-sfere-brand',
  success: 'bg-sfere-success',
  warn: 'bg-sfere-warn',
  danger: 'bg-sfere-danger'
}

const rootClasses = computed(() => [
  'flex items-start gap-3 rounded-sfere-lg border px-4 py-3',
  TONES[props.tone]
])

const titleClasses = computed(() => ['text-sfere-sm font-semibold'])
</script>
