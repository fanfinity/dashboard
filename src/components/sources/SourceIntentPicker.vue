<template>
  <!-- GRID, NOT `flex flex-col` — this wrapper is load-bearing, not cosmetic.
       Quasar's unlayered `.flex { flex-wrap: wrap }` outranks Tailwind's layered
       `flex-nowrap` (CLAUDE.md collision #4), so `flex flex-col` here was a
       *wrapping column* flex, and a `container-type: inline-size` child inside
       one is measured at min-content height and keeps the answer: the 458px card
       grid below rendered as a 2314px block, i.e. ~1850px of dead space under
       step 1. Same failure as the `auto-fit` trap in collision #6, reached by a
       different route. Grid `gap` has no Quasar counterpart, so it applies. -->
  <div class="grid gap-5">
    <NoticeBanner
      tone="info"
      message="Not sure which one? Pick the closest match. You can add more sources later, and every option leads to the exact setup steps for that platform."
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
         container query is the form that stays honest.

         TWO ROWS, ONE CONTAINER. Both grids query the same `@container` and
         change shape at the same widths (34rem, then 52rem for the tail), so
         they read as one grid with a heavier first row rather than as two that
         happen to be stacked. The split itself comes from `hero` in the
         registry, and `rows` drops an empty row rather than leaving a gap where
         a filtered-out intent used to be. -->
    <div class="@container grid gap-5">
      <div v-for="row in rows" :key="row.key" :class="row.grid">
        <!-- The coming-soon look is COLOUR, NOT OPACITY. Quasar ships unlayered
             `[disabled] { opacity: .6; cursor: not-allowed }` (collision #2), so
             SelectableCard's own `disabled:opacity-50` never applies and every
             `disabled:*` fade in this repo is a dead class. What a layered
             utility can still win is the surface: a dashed border on the page
             fill reads as a placeholder rather than as a choice. SfereToggle
             makes the same trade for the same reason. -->
        <SelectableCard
          v-for="intent in row.intents"
          :key="intent.key"
          :selected="modelValue === intent.key"
          :disabled="intent.comingSoon"
          :class="intent.comingSoon && 'border-dashed! bg-sfere-fill!'"
          @select="pick(intent)"
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
          <div
            class="grid h-full w-full grid-rows-[1fr_auto]"
            :class="row.hero ? 'gap-6' : 'gap-5'"
          >
            <div
              class="grid content-start"
              :class="row.hero ? 'gap-4' : 'gap-3.5'"
            >
              <span
                class="grid shrink-0 place-items-center rounded-sfere-lg border transition duration-200 ease-sfere-ui"
                :class="[
                  row.hero ? 'size-14' : 'size-11',
                  intent.comingSoon
                    ? 'border-sfere-line bg-sfere-surface text-sfere-fg-muted/60'
                    : modelValue === intent.key
                      ? 'border-sfere-300 bg-sfere-100 text-sfere-brand-text'
                      : 'border-sfere-line bg-sfere-fill text-sfere-fg-muted'
                ]"
              >
                <SourceIntentIcon
                  :intent="intent.key"
                  :class="row.hero && 'size-7!'"
                />
              </span>

              <div class="grid min-w-0 gap-1.5">
                <p
                  class="m-0! font-semibold"
                  :class="[
                    row.hero ? 'text-lg!' : 'text-sm',
                    intent.comingSoon ? 'text-sfere-fg-muted' : 'text-ink'
                  ]"
                >
                  {{ intent.title }}
                </p>
                <!-- The emphasis is authored, not matched. See `body` in
                     src/config/sourceIntents.js for why a regex over the copy
                     was rejected; here it is only ever a loop, and a segment
                     with no `strong` renders as bare text. -->
                <p
                  class="m-0! leading-5"
                  :class="[
                    row.hero ? 'text-sm' : 'text-xs',
                    intent.comingSoon ? 'text-sfere-fg-muted/75' : 'text-muted'
                  ]"
                  ><template v-for="(seg, i) in intent.segments" :key="i"
                    ><strong
                      v-if="seg.strong"
                      class="font-semibold"
                      :class="!intent.comingSoon && 'text-ink'"
                      >{{ seg.text }}</strong
                    ><template v-else>{{ seg.text }}</template></template
                  ></p
                >
              </div>
            </div>

            <div
              class="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-sfere-line pt-4"
              :class="
                intent.comingSoon
                  ? 'text-sfere-fg-muted'
                  : 'text-sfere-brand-text'
              "
            >
              <!-- The badge replaces the outcome line rather than joining it: an
                   intent that cannot be picked has no outcome to promise, and
                   "Payments source →" beside "Coming soon" reads as two answers
                   to the same question. -->
              <StatusBadge
                v-if="intent.comingSoon"
                tone="neutral"
                label="Coming soon"
                class="justify-self-start"
              />
              <template v-else>
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
              </template>
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
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SourceIntentIcon from '@/components/sources/SourceIntentIcon.vue'
import { SOURCE_INTENTS, isIntentComingSoon } from '@/config/sourceIntents'

// Step 1 of the guided flow: what are you connecting, in the reader's words.
//
// An intent whose templates are all absent is dropped rather than shown and
// then dead-ending on an empty step 2 — the template list is workspace-scoped,
// so a workspace with Stripe disabled should not be offered Payments. The
// `connector` intent has no templates and always survives: it navigates
// somewhere else entirely.
//
// A COMING-SOON INTENT IS NOT DROPPED, and that is a different case from an
// absent one. Payments is a thing we are building, so hiding it makes people
// wonder where Stripe went; the card stays, greyed and badged, and says so.
//
// The grid gutter is 20px to match SelectableCard's own `p-5`: a gutter tighter
// than the card padding reads as six cards crowding each other rather than six
// choices. Column count is container-driven — see the template.
const props = defineProps({
  modelValue: { type: String, default: '' },
  // Template ids this workspace actually has, from useSourceTemplates().
  availableTemplateIds: { type: Array, default: () => [] }
})

// `choose` is the whole point of the card now: picking IS continuing. There is
// no Continue button on step 1 any more, because a card that visibly commits on
// click and then asks for a second click on a button 400px below it is one
// decision charged twice. The parent still owns what "continue" means (the
// connector intent navigates; a single-template intent settles the template),
// so this emits the answer rather than acting on it.
const emit = defineEmits(['update:modelValue', 'choose'])

const available = computed(() =>
  SOURCE_INTENTS.filter(
    intent =>
      intent.to ||
      intent.templates.some(id => props.availableTemplateIds.includes(id))
  ).map(intent => ({
    ...intent,
    comingSoon: isIntentComingSoon(intent),
    // A plain-string `body` is still legal in the registry; normalising here
    // means the template only ever loops and never type-checks its own copy.
    segments: Array.isArray(intent.body) ? intent.body : [{ text: intent.body }]
  }))
)

// Two rows, derived from the already-filtered list so a workspace missing
// `web-sdk` gets a one-card hero row rather than a hole in it. An empty row is
// dropped entirely — `v-for` over a row with no intents would still emit the
// grid element and its `gap`.
const rows = computed(() =>
  [
    {
      key: 'hero',
      hero: true,
      // Two up, always: these are the two answers most people are here for, and
      // a half-width card is the layout saying so.
      grid: 'grid grid-cols-1 gap-5 @min-[34rem]:grid-cols-2',
      intents: available.value.filter(i => i.hero)
    },
    {
      key: 'rest',
      hero: false,
      // Breakpoints SHARED with the hero row above: 34rem is where that row
      // goes two-up, so both rows change shape at the same container width. A
      // tail row that split at 30rem while the hero was still one column would
      // read as two unrelated grids that happen to sit on top of each other.
      grid: 'grid grid-cols-1 gap-5 @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-4',
      intents: available.value.filter(i => !i.hero)
    }
  ].filter(row => row.intents.length > 0)
)

function pick(intent) {
  // Belt to SelectableCard's `disabled`: the card cannot be clicked or
  // keyboard-activated while disabled, so this only ever fires if someone wires
  // a new caller past it.
  if (intent.comingSoon) return
  emit('update:modelValue', intent.key)
  emit('choose', intent.key)
}
</script>
