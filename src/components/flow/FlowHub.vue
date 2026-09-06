<template>
  <div :class="rootClasses">
    <!-- THE HALO IS TWO SIBLINGS, NOT A `shadow`, and it is what makes the
         circle read as the junction every wire points at rather than as a third
         box in the row. Both are absolutely positioned OUTSIDE the circle's own
         border box (`-inset-*`) and sit at `-z-10`: the root creates a stacking
         context (it is `relative` + `z-10`), so a negative-z child paints behind
         the root's CONTENT but not behind its background — and the background is
         clipped to the rounded border box, so only the part of the halo that
         extends past the circle is ever visible. That is the ring, which is
         exactly what we want and what a blur would have cost a repaint for. -->
    <span
      v-if="!onDark"
      class="pointer-events-none absolute -inset-4 -z-10 rounded-full bg-sfere-50/70"
      aria-hidden="true"
    ></span>
    <span
      v-if="!onDark"
      class="pointer-events-none absolute -inset-1.5 -z-10 rounded-full bg-sfere-100/70"
      aria-hidden="true"
    ></span>

    <!-- The lockup on the big variant, the mark on the small ones. The mark
         takes no `on-dark`: the sphere is the one part of the identity that
         never re-colours, so the file is the same on both canvases. The
         wordmark's ink does flip, which is why the lockup is passed the flag. -->
    <SfereLogo
      v-if="variant === 'lockup'"
      variant="lockup"
      :on-dark="onDark"
      :class="LOCKUPS[size]"
    />
    <SfereLogo v-else variant="mark" :class="MARKS[size]" />

    <span v-if="label" :class="labelClasses">{{ label }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'

// The Sfere mark between the two columns of a flow picture — the thing every
// arrow points at. Rendered as a circle so it reads as a junction rather than as
// a third node in the row: the boxes either side are records you can open, and
// this one is the product.
//
// SIZED WITH A CLASS, NEVER SfereLogo's `height` PROP. That prop is inert app
// wide — Tailwind preflight ships `img, video { height: auto }` in `@layer base`
// and the component only sets a `height` attribute, which is a presentational
// hint any author rule beats. `/design-system` demonstrates it by rendering
// `:height="32"` and `:height="22"` as two identical logos.
const props = defineProps({
  // Printed under the mark. Omit inside a tight chain where the circle alone
  // carries it.
  label: { type: String, default: '' },
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md', 'lg'].includes(v)
  },
  // `lockup` names the product in the circle instead of leaving the reader to
  // recognise a sphere. Only `lg` has the inscribed width for it — the lockup is
  // 5:1, so at any smaller diameter it either overflows the circle or shrinks to
  // an unreadable line — which is why the variant is not the default.
  variant: {
    type: String,
    default: 'mark',
    validator: v => ['mark', 'lockup'].includes(v)
  },
  onDark: { type: Boolean, default: false }
})

const SIZES = { sm: 'size-16', md: 'size-24', lg: 'size-32' }
const MARKS = { sm: 'h-5 w-auto', md: 'h-6 w-auto', lg: 'h-7 w-auto' }
// A circle of diameter d inscribes a square of d/√2 ≈ 0.71d, so the widest a
// 5:1 lockup can be inside `size-32` (128px) is ~90px — `h-4` draws 80px.
const LOCKUPS = { sm: 'h-3 w-auto', md: 'h-3.5 w-auto', lg: 'h-4 w-auto' }

const rootClasses = computed(() => [
  'relative z-10 grid shrink-0 place-items-center gap-1 rounded-full border',
  SIZES[props.size],
  props.onDark
    ? 'border-sfere-hairline bg-sfere-ink-raised'
    : 'border-sfere-200 bg-sfere-surface shadow-sfere-soft'
])

const labelClasses = computed(() => [
  'font-sfere-mono text-sfere-eyebrow uppercase',
  props.onDark ? 'text-sfere-dark-fg-muted' : 'text-sfere-fg-muted'
])
</script>
