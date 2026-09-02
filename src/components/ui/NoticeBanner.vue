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
      <!-- Collapsible: the title becomes the disclosure control. A real
           <button type="button"> with aria-expanded/aria-controls rather than a
           clickable <p> — this banner is the only thing standing between the
           reader and the detail, so it has to be reachable by keyboard and it
           has to announce its state. `type="button"` because the kit is used
           inside forms and a bare <button> submits. -->
      <button
        v-if="collapsible && $slots.default"
        type="button"
        class="-m-1 flex w-full items-center gap-1.5 rounded-sfere p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60"
        :aria-expanded="expanded ? 'true' : 'false'"
        :aria-controls="bodyId"
        @click="expanded = !expanded"
      >
        <span :class="titleClasses" class="min-w-0 flex-1">{{ title }}</span>
        <!-- Conditional class, never a `rotate-0` variant: Quasar ships an
             unlayered `.rotate-90`, so a layered utility can turn the rotation
             ON but can never turn it back off (CLAUDE.md collision #2). Absent
             is the only reliable "off". Same pattern as MainLayout's chevron. -->
        <svg
          class="size-3.5 shrink-0 opacity-70 transition-transform duration-200 motion-reduce:transition-none"
          :class="expanded ? 'rotate-90' : ''"
          viewBox="0 0 256 256"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128L90.34 53.66a8 8 0 0 1 11.32-11.32l80 80a8 8 0 0 1 0 11.32"
          />
        </svg>
      </button>
      <p v-else-if="title" :class="titleClasses">{{ title }}</p>
      <p v-if="message" class="text-sfere-sm opacity-80">{{ message }}</p>
      <div
        v-if="$slots.default"
        v-show="!collapsible || expanded"
        :id="bodyId"
        :class="title || message ? 'mt-2' : ''"
      >
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
import { computed, ref, useId } from 'vue'

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
  dismissible: { type: Boolean, default: false },
  // Hide the slot behind the title until clicked. DEFAULT OFF, which is what
  // makes this a safe edit to a file every screen renders: not one existing
  // banner changes. Only meaningful with slot content — a banner whose whole
  // payload is `title` has nothing to disclose, so the branch is guarded on
  // `$slots.default` rather than on this prop alone.
  //
  // WHAT IT IS FOR: a list that is a distraction to one reader and the point of
  // the screen to another. Home's needs-attention list is per-source ingestion
  // detail — an engineer wants it open, a marketer wants the count and the
  // option. Collapsing it is not a way to make a long banner shorter; if the
  // detail is not worth a click, it is not worth the banner.
  collapsible: { type: Boolean, default: false }
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

// Collapsed on mount, since that is the whole point of asking for it. Local
// rather than a v-model: nothing above needs to know, and a parent holding this
// would make every caller invent a ref for a disclosure triangle.
const expanded = ref(false)

// Ties aria-controls to the panel it controls. `useId` rather than a module
// counter so two banners on one screen cannot collide, and so the id is stable
// across the SSR-style hydration Quasar's build can do.
const bodyId = `notice-body-${useId()}`

const rootClasses = computed(() => [
  'flex items-start gap-3 rounded-sfere-lg border px-4 py-3',
  TONES[props.tone]
])

const titleClasses = computed(() => ['text-sfere-sm font-semibold'])
</script>
