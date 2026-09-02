<template>
  <!-- A GROWING ROW, not the fixed tracks SourceIntentPicker uses, because this
       picker's card count is whatever the chosen intent covers — two, today,
       for every intent that reaches this step. Three fixed columns would leave a
       two-template choice sitting in two thirds of the row with a hole beside
       it. `grow basis-64` fills the row at any count and wraps when it cannot:
       two cards take half each, three take a third. Quasar's `.flex` already
       wraps (its unlayered `flex-wrap: wrap` is the collision every other flex
       row in this repo fights); here that is the wanted behaviour, and
       `flex-wrap` is written out so it does not read as an accident. -->
  <div class="flex flex-wrap gap-5">
    <!-- A template with nothing behind it is greyed and labelled, never
         silently offered. Shopify and Stripe create a real source row and then
         the install guide says "Nothing to install", because there is no OAuth
         handshake and no connector wiring: the source is inert and the person
         who built it finds out by waiting for data that never comes.
         The look is COLOUR AND BORDER STYLE, not a fade — Quasar's unlayered
         `[disabled] { opacity: .6 }` (collision #2) means SelectableCard's own
         `disabled:opacity-50` is a dead class, so a layered utility has to win
         on something Quasar does not set. Which ids these are lives in
         src/config/sourceIntents.js, not in a `t.id === 'shopify'` here. -->
    <SelectableCard
      v-for="t in templates"
      :key="t.id"
      class="max-w-full grow basis-64"
      :class="isTemplateComingSoon(t.id) && 'border-dashed! bg-sfere-fill!'"
      :selected="modelValue === t.id"
      :disabled="isTemplateComingSoon(t.id)"
      @select="emit('update:modelValue', t.id)"
    >
      <!-- Grid rows, not margins, for the reason SourceIntentPicker spells out
           at length: the `mt-2` this card used to space itself with computed to
           `margin-top: 0` behind Quasar's unlayered paragraph margin, so the
           rhythm was never the one written here and the tag row never sat on the
           card's bottom edge. `grid-rows-[1fr_auto]` pins it. -->
      <div class="grid h-full w-full grid-rows-[1fr_auto] gap-4">
        <div class="grid content-start gap-2">
          <div class="grid grid-cols-[1fr_auto] items-start gap-2">
            <span
              class="min-w-0 text-sm font-semibold"
              :class="
                isTemplateComingSoon(t.id) ? 'text-sfere-fg-muted' : 'text-ink'
              "
              >{{ t.name }}</span
            >
            <!-- Two badges that can never co-occur: an unpickable card has no
                 selected state to report. -->
            <StatusBadge
              v-if="isTemplateComingSoon(t.id)"
              tone="neutral"
              label="Coming soon"
            />
            <StatusBadge
              v-else-if="modelValue === t.id"
              tone="brand"
              label="Selected"
            />
          </div>

          <p class="m-0! text-xs leading-5 text-muted">{{ t.description }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone="neutral" :label="`v${t.version}`" />
          <StatusBadge
            v-for="tag in t.tags"
            :key="tag"
            tone="neutral"
            :label="tag"
          />
        </div>
      </div>
    </SelectableCard>
  </div>
</template>

<script setup>
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { isTemplateComingSoon } from '@/config/sourceIntents'

// The create flow's step 2, once an intent covers more than one template: which
// template a new source is built from.
//
// A radio group would be the semantic control, but each option is a card with
// its own body copy and chips, so each option is a SelectableCard — a real
// <button> carrying `aria-pressed` and the selection ring. That is also what
// makes the coming-soon cards genuinely unreachable rather than merely
// unstyled: `disabled` on a <button> takes it out of the tab order and stops
// Enter and Space as well as the click, which a div-with-a-handler could not.
//
// The 20px gutter and the card's internal rhythm match SourceIntentPicker
// deliberately — the two pickers are consecutive steps of the same page, and a
// step that respaces its cards under the reader reads as a different screen. The
// column behaviour is the one thing that does not match, for the reason in the
// template.
defineProps({
  templates: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
</script>
