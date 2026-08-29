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
import {
  SFERE_BUTTON_VARIANTS,
  SFERE_BUTTON_VARIANT_NAMES
} from './sfereButtonVariants.js'

// The Sfere action. Pills, not rounded rectangles — that shape is the single
// most load-bearing decision in the kit, which is why there is no `square` prop.
//
// The variant palette lives in `sfereButtonVariants.js` because SfereIconButton
// draws from the same one; see that file for what each variant is for.
const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
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

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-full font-semibold leading-none',
  'transition duration-200 ease-sfere-ui select-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  SIZES[props.size],
  SFERE_BUTTON_VARIANTS[props.variant],
  props.block && 'w-full',
  inert.value && 'cursor-not-allowed opacity-50',
  // Only a link needs this. A <button> is already stopped by its own `disabled`
  // attribute, and pointer-events-none there would suppress the not-allowed
  // cursor that tells the user why nothing happened.
  inert.value && tag.value !== 'button' && 'pointer-events-none'
])
</script>
