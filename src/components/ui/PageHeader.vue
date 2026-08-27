<template>
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <!-- `min-w-0 flex-1` on the title block and `shrink-0` on the actions:
         without them the title's max-content width claims the whole row and the
         action group drops to a second line — Quasar's unlayered
         `.flex { flex-wrap: wrap }` beats Tailwind's `flex-nowrap`, so the wrap
         has to be removed at the flex-basis level instead. This is the primitive
         every screen renders, so the bug was every screen's. See
         docs/ui-conventions.md rule 10. -->
    <div class="min-w-0 flex-1">
      <SfereEyebrow
        v-if="eyebrow"
        :label="eyebrow"
        :on-dark="onDark"
        class="mb-2.5"
      />

      <h1 :class="titleClasses">
        <slot name="title">{{ title }}</slot>
      </h1>

      <p v-if="subtitle || $slots.subtitle" :class="subtitleClasses">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>

    <div
      v-if="$slots.actions"
      class="flex shrink-0 flex-wrap items-center gap-2"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereEyebrow from './SfereEyebrow.vue'

// The top of every screen. This is the component that renders the literal <h1>
// scripts/smoke.mjs requires on every route, so a page built from this kit uses
// it rather than a bare <h1> or SfereSectionHeading — that one renders an <h2>
// whatever its `level` prop says, and its ramp starts at 36px.
//
// 24px (text-sfere-h3) in the display face, the same size the header this
// replaced shipped at. The page title is not the biggest thing on the page: it
// is a label for somewhere you already navigated to, and 48px of it would
// out-shout the data underneath. Note the Tailwind v4 important SUFFIX — Quasar's unlayered base
// stylesheet sets h1 size and weight and beats any layered utility without it
// (docs/ui-conventions.md rules 2-3).
//
// `subtitle` is the purpose line, and it is not optional in practice: every
// screen owes one plain sentence saying what this section is for. See the page
// anatomy standard in docs/ui-conventions.md.
const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  // A section label above the title — 'Collect', 'Act', 'Prove'. Says where in
  // the product you are without a second line of prose.
  eyebrow: { type: String, default: '' },
  onDark: { type: Boolean, default: false }
})

const titleClasses = computed(() => [
  'font-sfere-display! text-sfere-h3! text-balance',
  props.onDark ? 'text-white' : 'text-sfere-fg'
])

const subtitleClasses = computed(() => [
  'mt-1.5 max-w-2xl text-sfere-sm',
  props.onDark ? 'text-white/60' : 'text-sfere-fg-muted'
])
</script>
