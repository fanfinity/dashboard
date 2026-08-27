<template>
  <div :class="classes">
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

// The submit row of a form, pinned to the bottom of the viewport for as long as
// the form is taller than the window. House rule, not a per-screen choice: a
// long create form used to hide its own Save button below the fold, so the way
// to submit was "scroll to the end and hope" — see docs/ui-conventions.md
// rule 13.
//
// WHY `sticky bottom-0` AND NOT `fixed`: sticky resolves against the parent's
// padding box, so the bar is pulled up into view only while its natural
// position is below the fold and it settles exactly where it belongs once the
// end of the form is reached. A fixed bar would hang over short forms too, and
// would need its own escape hatch on every screen that has nothing to scroll.
// Put it LAST in the form, so the containing block spans the whole form.
//
// The offset is `--app-footer-h`, not 0: MainLayout's DemoModeBanner is a
// `q-footer` fixed to the viewport bottom, and `bottom: 0` is viewport-relative,
// so in Demo mode the bar would sit under the banner. MainLayout publishes the
// banner's height on `.q-layout` and this reads it; it is `0px` everywhere else.
//
// `align` is `start` because most action rows read primary-then-secondary from
// the left; `end` is for the single-Continue steps of a guided flow, where the
// button is the end of the sentence the cards above it started.
const props = defineProps({
  align: {
    type: String,
    default: 'start',
    validator: v => ['start', 'end', 'between'].includes(v)
  }
})

const ALIGN = {
  start: 'justify-start',
  end: 'justify-end',
  between: 'justify-between'
}

const classes = computed(() => [
  'sticky bottom-[var(--app-footer-h,0px)] z-10',
  // `-mb-6` cancels q-page's own `p-6` so the bar reaches the bottom edge of the
  // page rather than floating 24px above the fold with page showing beneath it.
  '-mb-6 mt-1 flex flex-wrap items-center gap-3',
  'border-t border-sfere-line bg-sfere-surface py-4',
  ALIGN[props.align]
])
</script>
