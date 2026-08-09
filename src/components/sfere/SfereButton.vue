<template>
  <component
    :is="tag"
    v-bind="linkAttrs"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' && (disabled || loading) ? true : undefined"
    :aria-disabled="inert ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :tabindex="inert && tag !== 'button' ? -1 : undefined"
    :class="classes"
  >
    <SfereSpinner v-if="loading" :size="size === 'lg' ? 18 : 14" />
    <slot name="icon" />
    <slot />
    <slot name="trailing" />
  </component>
</template>

<script setup>
import { computed } from 'vue'
import SfereSpinner from './SfereSpinner.vue'

// The Sfere action. Pills, not rounded rectangles — that shape is the single
// most load-bearing decision in the kit, which is why there is no `square` prop.
//
// `primary` and `white` are the two calls to action; `secondary`/`ghost` and
// `outlineLight` are their quiet counterparts on light and dark surfaces
// respectively. Pairing a light-surface variant with a dark section (or the
// reverse) is the one way to get this component wrong.
const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: v =>
      [
        'primary',
        'secondary',
        'ghost',
        'danger',
        'white',
        'outlineLight'
      ].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: v => ['sm', 'md', 'lg'].includes(v)
  },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
  // Declarative navigation only — an imperative router.push stays in the page.
  to: { type: [String, Object], default: null },
  href: { type: String, default: '' }
})

const inert = computed(() => props.disabled || props.loading)

// The tag is chosen from `to`/`href` ALONE, never from the disabled state.
// Swapping between router-link and button when `loading` flips would remount the
// node and drop focus mid-interaction — a keyboard user who hits Enter on a
// submit-and-navigate button would land back on <body>. Links can't carry the
// `disabled` attribute, so they are neutralised with pointer-events, tabindex
// and aria-disabled instead.
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

const SIZES = {
  sm: 'gap-1.5 px-4 py-2 text-[0.8125rem]',
  md: 'gap-2 px-5 py-2.5 text-sfere-sm',
  lg: 'gap-2 px-6 py-3 text-sfere-body'
}

const VARIANTS = {
  primary:
    'bg-sfere-brand-fill text-white shadow-sfere-btn hover:bg-sfere-brand-text focus-visible:ring-sfere-500/60',
  secondary:
    'border border-sfere-line bg-sfere-surface text-sfere-fg hover:border-sfere-300 hover:text-sfere-brand-text focus-visible:ring-sfere-500/60',
  ghost: 'text-sfere-fg hover:bg-sfere-fill focus-visible:ring-sfere-500/60',
  danger:
    'bg-sfere-danger text-white hover:bg-rose-700 focus-visible:ring-rose-500/60',
  // On-ink pair. `white` is the primary action on a dark section.
  white:
    'bg-white text-sfere-plum hover:bg-sfere-50 focus-visible:ring-white/70 focus-visible:ring-offset-transparent',
  outlineLight:
    'border border-sfere-hairline-strong text-white hover:bg-white/10 focus-visible:ring-white/70 focus-visible:ring-offset-transparent'
}

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-full font-semibold leading-none',
  'transition duration-200 ease-sfere-ui select-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  SIZES[props.size],
  VARIANTS[props.variant],
  props.block && 'w-full',
  inert.value && 'cursor-not-allowed opacity-50',
  // Only a link needs this. A <button> is already stopped by its own `disabled`
  // attribute, and pointer-events-none there would suppress the not-allowed
  // cursor that tells the user why nothing happened.
  inert.value && tag.value !== 'button' && 'pointer-events-none'
])
</script>
