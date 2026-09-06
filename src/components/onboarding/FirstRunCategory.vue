<template>
  <!-- Beat two: the one question only the reader can answer.

       NO STEPPER ABOVE IT. The prototype numbers these "Step 1" and "Step 2" in
       the eyebrow and draws no rail, and that is right for a flow whose length
       is not known yet: picking "Website" ends the questions here, picking
       "Online store" adds one. A three-rung stepper would grow and shrink a rung
       under the reader depending on which card they hovered towards, which is
       the wizard-changing-shape problem `/sources/new` already avoided when it
       kept its own stepper at three for every template. -->
  <div class="grid gap-8">
    <div
      class="sfere-flush mx-auto grid max-w-[42.5rem] justify-items-center gap-3 text-center"
    >
      <p
        class="font-sfere-mono text-sfere-eyebrow font-semibold uppercase text-sfere-brand-text"
        >{{ copy.eyebrow }}</p
      >

      <!-- An h2 for the same reason the welcome's is: `scripts/smoke.mjs` reads
           the FIRST `<h1>` on the route and Home's belongs to `PageHeader`. -->
      <h2
        id="first-run-title"
        class="text-balance text-sfere-h3! text-sfere-fg sm:text-sfere-h2!"
      >
        {{ copy.headline }}
      </h2>
      <p
        id="first-run-scope"
        class="text-pretty text-sfere-body text-sfere-fg-muted"
      >
        {{ copy.lede }}
      </p>
    </div>

    <!-- A labelled group rather than four loose buttons: with the heading tied
         to the set, a screen reader hears the question before the first option
         instead of four unrelated controls. NOT a `radiogroup` — these commit on
         click rather than holding a selection, and radio semantics would promise
         arrow-key roving and a separate submit that do not exist here.

         Two columns, `repeat(2,minmax(0,1fr))` via `grid-cols-2`, never
         `auto-fit`: an `auto-fit` track measures the card at min-content on the
         first pass and keeps the answer, which is how 219px cards became 637px
         ones on `/sources/new` (collision #6). A CONTAINER query steps it down,
         not `sm:`, because this panel is centred inside a capped page and its
         width is not the window's. -->
    <div
      role="group"
      aria-labelledby="first-run-title"
      class="@container mx-auto w-full max-w-[56.25rem]"
    >
      <div class="grid grid-cols-1 gap-3.5 @min-[38rem]:grid-cols-2">
        <SelectableCard
          v-for="option in options"
          :key="option.key"
          class="min-h-[8.875rem] active:translate-y-px"
          @select="emit('choose', option.key)"
        >
          <!-- ONE child, and it owns the whole card. SelectableCard's root is
               `flex flex-col`, which under Quasar's unlayered `.flex` is a
               WRAPPING column — several children would lay out into a second
               column the moment the card is height-constrained (collision #4).
               One `grid` child sidesteps the question entirely.

               `grid-rows-[auto_auto_1fr_auto]` is what pins the examples line to
               the bottom edge so all four cards' last lines share a baseline.
               NOT `mt-auto` on that line: it is a `<p>`, and Quasar's unlayered
               `p { margin: 0 0 16px }` shorthand zeroes any layered `margin-top`
               — the exact case CLAUDE.md's rule 11 documents. -->
          <div
            class="sfere-flush grid h-full w-full grid-rows-[auto_auto_1fr_auto] gap-2.5"
          >
            <SfereIconChip size="sm">
              <FlowNodeIcon kind="source" :subtype="option.mark" :size="18" />
            </SfereIconChip>

            <p class="text-sfere-h4! text-sfere-fg">{{ option.title }}</p>
            <p class="text-pretty text-sfere-sm text-sfere-fg-muted">{{
              option.body
            }}</p>
            <p
              v-if="option.examples"
              class="text-sfere-xs text-sfere-fg-muted/75"
              >{{ option.examples }}</p
            >
          </div>
        </SelectableCard>
      </div>
    </div>

    <!-- Back on the left where a back control belongs, the reassurance on the
         right. The skip is NOT here: the shell pins it to the top-right corner
         for every beat that offers it, so it does not appear to move between
         beats the way a footer control would. -->
    <div
      class="mx-auto flex w-full max-w-[56.25rem] flex-wrap items-center justify-between gap-3"
    >
      <SfereButton
        ref="backRef"
        variant="secondary"
        size="sm"
        @click="emit('back')"
        >← Back</SfereButton
      >
      <span class="text-sfere-sm text-sfere-fg-muted">{{ copy.hint }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import FlowNodeIcon from '@/components/flow/FlowNodeIcon.vue'
import {
  FIRST_RUN_CATEGORY,
  PICKER_COPY,
  PICKER_INTENTS
} from '@/config/firstRun'
import { SOURCE_INTENTS, isIntentComingSoon } from '@/config/sourceIntents'

const emit = defineEmits(['choose', 'back'])

const copy = FIRST_RUN_CATEGORY

// The picker, built by looking each key up in the shared intent registry rather
// than by re-listing the categories here.
//
// A KEY THAT NO LONGER RESOLVES IS DROPPED, not rendered blank: removing an
// intent from sourceIntents.js must not leave this screen with an empty card
// that navigates nowhere. A coming-soon intent is dropped too — the create flow
// greys those out because a source built from one can never receive an event,
// and offering it as one of four cards on an arrival screen would be worse than
// the greyed card it becomes later.
//
// `mark` is the first template id, which is what FlowNodeIcon keys its glyph
// off. The `connector` intent has no templates, so it falls through to the
// generic node mark — correct, since "Something else" is not a kind of thing.
const options = computed(() =>
  PICKER_INTENTS.map(key => {
    const intent = SOURCE_INTENTS.find(i => i.key === key)
    if (!intent || isIntentComingSoon(intent)) return null
    const entry = PICKER_COPY[key] ?? {}
    return {
      key,
      title: entry.title ?? intent.title,
      body: entry.body ?? '',
      examples: entry.examples ?? '',
      mark: intent.templates[0] ?? ''
    }
  }).filter(Boolean)
)

// Focus lands on Back rather than on the first card, and that is deliberate:
// putting it on a card would make Enter answer the question for anyone who
// arrived here by pressing Enter on the beat before. The shell calls this when
// the beat swaps, because Quasar focus-manages a dialog on OPEN and not on a
// content change, so focus would otherwise fall to `<body>` inside a modal.
const backRef = ref(null)
defineExpose({
  focusFirst: () => backRef.value?.$el?.focus?.({ preventScroll: true })
})
</script>
