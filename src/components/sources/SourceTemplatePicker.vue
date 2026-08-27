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
    <SelectableCard
      v-for="t in templates"
      :key="t.id"
      class="max-w-full grow basis-64"
      :selected="modelValue === t.id"
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
            <span class="min-w-0 text-sm font-semibold text-ink">{{
              t.name
            }}</span>
            <StatusBadge
              v-if="modelValue === t.id"
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

// The create flow's step 2, once an intent covers more than one template: which
// template a new source is built from.
//
// A radio group would be the semantic control, but each option is a card with
// its own body copy and chips, so each option is a SelectableCard — a real
// <button> carrying `aria-pressed` and the selection ring.
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
