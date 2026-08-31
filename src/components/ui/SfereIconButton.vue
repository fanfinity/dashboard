<template>
  <SfereTooltip
    :text="tooltip || label"
    :placement="tooltipPlacement"
    :align="tooltipAlign"
  >
    <component
      :is="tag"
      v-bind="linkAttrs"
      :type="tag === 'button' ? type : undefined"
      :disabled="tag === 'button' && (disabled || loading) ? true : undefined"
      :aria-label="label"
      :aria-disabled="inert ? 'true' : undefined"
      :aria-busy="loading ? 'true' : undefined"
      :tabindex="inert && tag !== 'button' ? -1 : undefined"
      :class="classes"
    >
      <SfereSpinner v-if="loading" :size="size === 'lg' ? 18 : 14" />
      <SfereIcon v-else :name="icon" :size="size" />
    </component>
  </SfereTooltip>
</template>

<script setup>
import { computed } from 'vue'
import SfereIcon from './SfereIcon.vue'
import SfereSpinner from './SfereSpinner.vue'
import SfereTooltip from './SfereTooltip.vue'
import {
  SFERE_BUTTON_VARIANTS,
  SFERE_BUTTON_VARIANT_NAMES
} from './sfereButtonVariants.js'

// SfereButton with the label moved off the surface. For a toolbar action whose
// noun is already the page title — Trash and New on every list screen — the
// word was restating the `<h1>` next to it, and ten of those rows shipped a
// hand-rolled `<button>` with the palette copied in by hand.
//
// `label` is REQUIRED and does two jobs: it is the `aria-label`, and it is the
// tooltip text. That order matters — SfereTooltip's own note says an icon-only
// button still needs its own label, because a CSS hover bubble is unreachable
// to a screen reader and to a touch user. Pass `tooltip` only to say something
// longer than the name on hover; the name still goes out to assistive tech.
//
// The tooltip defaults to `bottom`. SfereTooltip has no positioning engine, and
// the usual home for this button is a PageHeader at the very top of the page,
// where a bubble placed above renders off the viewport.
const props = defineProps({
  // What the button does, in words. Announced, and shown on hover.
  label: { type: String, required: true },
  // A key from `sfereIcons.js`.
  icon: { type: String, required: true },
  variant: {
    type: String,
    default: 'secondary',
    validator: v => SFERE_BUTTON_VARIANT_NAMES.includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md', 'lg'].includes(v)
  },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  // Declarative navigation only — an imperative router.push stays in the page.
  to: { type: [String, Object], default: null },
  href: { type: String, default: '' },
  tooltip: { type: String, default: '' },
  tooltipPlacement: {
    type: String,
    default: 'bottom',
    validator: v => ['top', 'bottom'].includes(v)
  },
  // `end`, not `center`, and that default is the fix rather than a preference.
  // A centred bubble sticks out roughly half its own width either side of a
  // 40px button, and the home of this control is the right end of a PageHeader
  // actions row — so "Delete this source" ran off the right of the window on
  // every detail screen. Aligning the bubble's right edge to the button's keeps
  // it on screen wherever the row ends. Pass `start` for the rare button pinned
  // to the LEFT edge of the viewport, and `center` where there is room either
  // side and centred simply looks better.
  tooltipAlign: {
    type: String,
    default: 'end',
    validator: v => ['center', 'start', 'end'].includes(v)
  }
})

const inert = computed(() => props.disabled || props.loading)

// Same rule as SfereButton: the tag comes from `to`/`href` ALONE, never from
// the disabled state, so a control never remounts mid-interaction and drops
// focus. Links can't carry `disabled`, hence the pointer-events neutralisation.
const tag = computed(() => {
  if (props.to) return 'router-link'
  if (props.href) return 'a'
  return 'button'
})

const linkAttrs = computed(() => {
  if (tag.value === 'router-link') return { to: props.to }
  if (tag.value === 'a') return { href: props.href }
  return {}
})

// Square, and `md` is 40px so it lines up with SfereInput — which is what
// ToolbarSearch renders, and what sits beside these in every header row.
const SIZES = { sm: 'size-9', md: 'size-10', lg: 'size-11' }

// `grid place-items-center`, not `flex`: Quasar's unlayered `.flex` forces
// `flex-wrap: wrap` and the layered `flex-nowrap` utility loses to it
// (docs/ui-conventions.md rule 10). SfereIconChip centres its glyph the same
// way for the same reason.
const classes = computed(() => [
  'grid shrink-0 place-items-center rounded-full leading-none',
  'transition duration-200 ease-sfere-ui select-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  SIZES[props.size],
  SFERE_BUTTON_VARIANTS[props.variant],
  inert.value && 'cursor-not-allowed opacity-50',
  inert.value && tag.value !== 'button' && 'pointer-events-none'
])
</script>
