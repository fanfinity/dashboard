<template>
  <div class="flex flex-col gap-5">
    <NoticeBanner
      tone="info"
      message="Not sure which one? Pick the closest match — you can add more sources later, and every option leads to the exact setup steps for that platform."
    />

    <!-- CONTAINER QUERIES, NOT VIEWPORT BREAKPOINTS, and NOT `auto-fit`.
         MainLayout's sidebar collapses without changing the viewport width, so a
         `lg:` breakpoint keeps three cramped columns on an expanded rail and two
         sparse ones on a collapsed rail at the same 1024px. The obvious fix,
         `grid-cols-[repeat(auto-fit,minmax(260px,1fr))]`, is a trap here: an
         `auto-fit` track is min-content-sized in the first pass, and the
         min-content height of SelectableCard's Quasar wrapping flex at that width
         is enormous — it sized these 219px cards at 637px and kept it, at every
         viewport. Measured, not guessed; `repeat(N,minmax(0,1fr))` behind a
         container query is the form that stays honest. -->
    <div class="@container">
      <div
        class="grid grid-cols-1 gap-5 @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3"
      >
        <SelectableCard
          v-for="intent in available"
          :key="intent.key"
          :selected="modelValue === intent.key"
          @select="emit('update:modelValue', intent.key)"
        >
          <!-- LAYOUT IS GRID, NOT MARGINS, and that is the whole point of this
             wrapper. Two collisions from CLAUDE.md meet inside this card:
             Quasar's unlayered paragraph margin beats Tailwind's layered `mt-*`,
             so the `mt-3` / `mt-1.5` rhythm this card used to carry computed to
             `margin-top: 0` and every gap rendered as Quasar's 16px
             `margin-bottom` instead — including sixteen pixels of slack under
             the last line, which is what pushed the footer off the card's
             baseline. And `mt-auto` cannot pin that footer either, because
             SelectableCard's `flex` is Quasar's *wrapping* flex, where auto
             margins resolve per flex line.
             Grid `gap` has no Quasar equivalent, so it actually applies, and
             `grid-rows-[1fr_auto]` puts the footer on the card's bottom edge by
             construction rather than by leftover space. `m-0!` on each <p> is
             what stops the inert margin adding itself to the gap — suffix, not
             prefix (ui-conventions rules 2-3). -->
          <div class="grid h-full w-full grid-rows-[1fr_auto] gap-5">
            <div class="grid content-start gap-3.5">
              <span
                class="grid size-11 place-items-center rounded-sfere-lg border transition duration-200 ease-sfere-ui"
                :class="
                  modelValue === intent.key
                    ? 'border-sfere-300 bg-sfere-100 text-sfere-brand-text'
                    : 'border-sfere-line bg-sfere-fill text-sfere-fg-muted'
                "
              >
                <SourceIntentIcon :intent="intent.key" />
              </span>

              <div class="grid min-w-0 gap-1.5">
                <p class="m-0! text-sm font-semibold text-ink">
                  {{ intent.title }}
                </p>
                <p class="m-0! text-xs leading-5 text-muted">{{
                  intent.body
                }}</p>
              </div>
            </div>

            <div
              class="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-sfere-line pt-4 text-sfere-brand-text"
            >
              <p class="m-0! truncate text-xs font-semibold">
                {{ intent.outcome }}
              </p>
              <svg
                class="size-3 shrink-0"
                viewBox="0 0 256 256"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="m221.66 133.66l-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32"
                />
              </svg>
            </div>
          </div>
        </SelectableCard>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SourceIntentIcon from '@/components/sources/SourceIntentIcon.vue'
import { SOURCE_INTENTS } from '@/config/sourceIntents'

// Step 1 of the guided flow: what are you connecting, in the reader's words.
//
// An intent whose templates are all absent is dropped rather than shown and
// then dead-ending on an empty step 2 — the template list is workspace-scoped,
// so a workspace with Stripe disabled should not be offered Payments. The
// `connector` intent has no templates and always survives: it navigates
// somewhere else entirely.
//
// The grid gutter is 20px to match SelectableCard's own `p-5`: a gutter tighter
// than the card padding reads as six cards crowding each other rather than six
// choices. Column count is container-driven — see the template.
const props = defineProps({
  modelValue: { type: String, default: '' },
  // Template ids this workspace actually has, from useSourceTemplates().
  availableTemplateIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const available = computed(() =>
  SOURCE_INTENTS.filter(
    intent =>
      intent.to ||
      intent.templates.some(id => props.availableTemplateIds.includes(id))
  )
)
</script>
