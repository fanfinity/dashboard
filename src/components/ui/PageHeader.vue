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
      <!-- The back link sits ABOVE the title, not beside it. Beside it would
           have to align a 40px control against an `items-start` row whose first
           text is a 24px cap height, and it would compete with the actions group
           on the same line. Above, it reads as the trail it is. It is an <a>, so
           the <h1> underneath is still the first heading on the page — which is
           what scripts/smoke.mjs asserts on.

           `secondary`, not `ghost`, and that is the point of the control rather
           than a styling preference: as a ghost it was bare text on the page
           background that only grew a surface on hover, so on 15 sub-screens
           the one way back out of a drill-down did not look like anything you
           could press until you happened to be over it. Bordered and filled at
           rest it reads as a control from across the page. Do not quieten it
           back down. The `-ml-4` went with the ghost: that negative margin
           existed to pull ghost PADDING off the left so its TEXT lined up with
           the <h1>, and on a bordered pill it hangs the border into the gutter
           instead. No instance class softens the weight or colour either —
           `font-medium` against the variant's `font-semibold` is two layered
           utilities in one layer, so which wins is Tailwind's ordering and not
           the order written here. At 13px beside a 24px display <h1> there is
           nothing to soften. -->
      <SfereButton
        v-if="backTarget"
        :to="{ name: backTarget.name }"
        variant="secondary"
        size="sm"
        class="mb-2"
      >
        <template #icon>
          <SfereIcon name="arrow-left" size="sm" />
        </template>
        {{ backTarget.label }}
      </SfereButton>

      <!-- The eyebrow slot exists for the one line that is not a section label:
           the Dashboard's greeting. `SfereEyebrow` is mono, uppercase and
           0.18em-tracked by design and deliberately exposes no way to soften
           that, so "Hello Anas 👋" through the prop would be shouted in the
           voice reserved for 'COLLECT' and 'ACT'. The prop is still the normal
           way in and still renders the same component. -->
      <div v-if="$slots.eyebrow || eyebrow" class="mb-2.5">
        <slot name="eyebrow">
          <SfereEyebrow :label="eyebrow" :on-dark="onDark" />
        </slot>
      </div>

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
import { useRoute } from 'vue-router'
import SfereEyebrow from './SfereEyebrow.vue'
import SfereButton from './SfereButton.vue'
import SfereIcon from './SfereIcon.vue'

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
  onDark: { type: Boolean, default: false },
  // Where "back" goes, as `{ name, label }`. Left undefined — the normal case —
  // the header reads `route.meta.parent` from the screen manifest, so a screen
  // gets its back link by being declared a child rather than by remembering to
  // pass a prop. Pass an object to override the target, or `null` to suppress it
  // on a screen that has a parent but should not offer the trip back.
  back: { type: [Object, null], default: undefined }
})

// This is the one route-aware thing in the kit. The alternative was 23 pages
// each hand-rolling the same link, which is how the seven that had one ended up
// with three different labels for it.
const route = useRoute()

const backTarget = computed(() => {
  if (props.back !== undefined) return props.back
  return route.meta?.parent ?? null
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
