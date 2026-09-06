<template>
  <section
    v-if="!isDismissed"
    :class="rootClasses"
    :aria-labelledby="headingId"
  >
    <!-- A grid with `gap`, not `mt-*` on the children. Every `<p>` in this repo
         carries Quasar's unlayered `margin: 0 0 16px`, so a layered `mt-2` on
         one computes to `margin-top: 0` and the band would render on a flat
         16px rhythm ignoring every value written here. Grid `gap` has no Quasar
         counterpart, so it applies. CLAUDE.md collision #5. -->
    <div class="sfere-flush grid min-w-0 flex-1 gap-2">
      <p
        v-if="eyebrow"
        class="font-sfere-mono text-sfere-eyebrow uppercase text-sfere-brand-text"
        >{{ eyebrow }}</p
      >
      <h2
        :id="headingId"
        class="font-sfere-display text-sfere-h4! font-bold text-sfere-fg"
        >{{ title }}</h2
      >
      <p v-if="body" class="max-w-[62ch] text-sfere-sm text-sfere-fg-muted">{{
        body
      }}</p>

      <ul
        v-if="points.length"
        class="flex flex-wrap gap-x-5 gap-y-1.5 text-sfere-xs text-sfere-fg-muted"
      >
        <li
          v-for="point in points"
          :key="point"
          class="flex flex-nowrap items-center gap-1.5"
        >
          <span aria-hidden="true" class="text-sfere-success">✓</span
          >{{ point }}
        </li>
      </ul>

      <slot />
    </div>

    <!-- The aside is where a band carries a figure rather than more words: the
         ClickHouse card on Destinations, the "what happens next" panel on
         Sources. `shrink-0` and not `flex-1` because it is an illustration of
         the sentence beside it, and a band whose picture wins the width reads
         as a card with a caption. -->
    <div v-if="$slots.aside" class="shrink-0 max-lg:w-full">
      <slot name="aside" />
    </div>

    <!-- Dismiss sits outside the copy column so it stays pinned to the band's
         top-right whether the aside is present or not, and carries a real
         accessible name rather than a bare glyph: "Dismiss" alone does not say
         what is being dismissed when it is read out of context. -->
    <SfereIconButton
      v-if="storageKey"
      icon="close"
      size="sm"
      variant="ghost"
      :label="`Dismiss: ${title}`"
      tooltip-placement="bottom"
      class="shrink-0 self-start max-lg:absolute max-lg:right-3 max-lg:top-3"
      @click="dismiss"
    />
  </section>
</template>

<script setup>
import { computed, useId } from 'vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import { useDismissed } from '@/composables/useDismissed'

// The teaching band at the top of a list screen: what this noun is, and why the
// screen exists. Sources, Destinations, Pipes and Functions each open with one.
//
// IT IS NOT A NoticeBanner, and the two should not be merged. A NoticeBanner is
// "this worked, but you should know" — a state the app is reporting about your
// account right now, and it goes away when the state does. This is editorial:
// it says the same thing on every visit and is true of every account, so it
// needs a dismissal (a banner about your account must not be dismissible; a
// paragraph explaining a noun must be, or it taxes the hundredth visit to pay
// for the first).
//
// `storageKey` IS WHAT MAKES IT DISMISSIBLE, and omitting it is a real choice
// rather than an oversight: a band with no key renders with no close control and
// stays. Used for a band whose copy is a live condition rather than a lesson.
const props = defineProps({
  // Stable id for the dismissal record, e.g. 'sources-intro'. Omit for a band
  // that must not be dismissible.
  storageKey: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  // Short ticked assurances, rendered on one wrapping row. Not sentences.
  points: { type: Array, default: () => [] },
  // The brand-tinted treatment. For the one band per screen that is a value
  // claim rather than a definition — Destinations' included warehouse.
  tone: {
    type: String,
    default: 'plain',
    validator: v => ['plain', 'brand'].includes(v)
  }
})

const headingId = useId()

const { isDismissed, dismiss } = useDismissed(props.storageKey)

// `flex-nowrap!` is not decoration. Quasar ships an unlayered
// `.flex { display:flex; flex-wrap:wrap }`, so every flex container in this repo
// wraps and the layered `flex-nowrap` utility loses to it — see CLAUDE.md
// collision #4. Here the wrap is wanted below `lg`, which is why the row is
// `max-lg:flex-col` rather than relying on it.
const rootClasses = computed(() => [
  'relative flex flex-nowrap items-start gap-6 rounded-sfere-xl border p-5',
  'max-lg:flex-col',
  props.tone === 'brand'
    ? 'border-sfere-200 bg-sfere-50'
    : 'border-sfere-line bg-sfere-surface'
])
</script>
