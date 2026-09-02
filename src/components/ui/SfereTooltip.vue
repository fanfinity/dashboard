<template>
  <span class="group/tip relative inline-flex">
    <slot />

    <span :class="bubbleClasses" role="tooltip">
      {{ text }}
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

// CSS-only: shown on hover and on keyboard focus inside the wrapper, so it is
// reachable without a pointer. There is no positioning engine here, which is
// the deliberate trade — it will clip inside an `overflow: hidden` ancestor.
//
// A tooltip is never the only place information lives. If the label matters,
// put it on the page; if it is a name for an icon-only button, that button
// still needs its own aria-label.
//
// `align` is the answer to the one clipping case that is not an ancestor's
// fault: the viewport edge. A bubble centred on a 40px button is far wider than
// the button, so the rightmost action in a PageHeader — Delete on the three
// detail screens, New on ten list screens — pushed half its width past the
// right edge of the window and got cut off. `end` pins the bubble's right edge
// to the trigger's, `start` pins its left, and both are pure CSS: no measuring,
// no layout read, nothing that has to run on hover. SfereIconButton defaults to
// `end` because a toolbar action is nearly always at the right of its row; the
// exceptions (MainLayout's nav toggle) pass `start`.
const props = defineProps({
  text: { type: String, required: true },
  placement: {
    type: String,
    default: 'top',
    validator: v => ['top', 'bottom'].includes(v)
  },
  align: {
    type: String,
    default: 'center',
    validator: v => ['center', 'start', 'end'].includes(v)
  }
})

const PLACEMENT = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2'
}

const ALIGN = {
  center: 'left-1/2 -translate-x-1/2',
  start: 'left-0',
  end: 'right-0'
}

const bubbleClasses = computed(() => [
  'pointer-events-none absolute z-50 whitespace-nowrap rounded-sfere px-2.5 py-1.5',
  'bg-sfere-ink text-sfere-xs text-white shadow-sfere-ink',
  'opacity-0 transition-opacity duration-150 ease-sfere-ui',
  'group-hover/tip:opacity-100 group-focus-within/tip:opacity-100',
  'motion-reduce:transition-none',
  PLACEMENT[props.placement],
  ALIGN[props.align]
])
</script>
