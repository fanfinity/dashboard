<template>
  <!-- Beat one: what Sfere is for, before it asks for anything.

       `grid gap-*` for every vertical rhythm on this screen, never `flex
       flex-col` and never `mt-*` on a paragraph. Two separate Quasar collisions
       make the obvious spellings dead: `.flex` is unlayered `flex-wrap: wrap`,
       and `p { margin: 0 0 16px }` is the shorthand form, so a layered `mt-3` on
       a `<p>` computes to zero. Grid `gap` has no Quasar counterpart.

       `sfere-flush` on each block whose children are paragraphs spaced by that
       gap: without it every non-final `<p>` adds Quasar's 16px on top, and the
       block reads loose while editing the gap changes nothing. -->
  <div class="grid gap-8">
    <div
      class="sfere-flush mx-auto grid max-w-[47.5rem] justify-items-center gap-4 text-center"
    >
      <p
        class="font-sfere-mono text-sfere-eyebrow uppercase text-sfere-brand-text"
        >{{ welcome.eyebrow }}</p
      >

      <!-- AN H2, NEVER AN H1. `scripts/smoke.mjs` reads the first `<h1>` on
           every route and fails the route when it is empty; Home's own belongs
           to `PageHeader`, and this surface covers Home rather than replacing
           it. A heading here would be a second one competing for that assertion
           for no semantic gain — the size is the point, and the size is a token.

           `text-sfere-h2!` rising to `text-sfere-h1!`: the prototype's 48px is
           `--text-sfere-h1` exactly, and 36px is `--text-sfere-h2`. ONE token
           rather than four utilities, because each bundles size, leading,
           tracking AND weight — which is also why a single important suffix
           covers everything Quasar sets on a bare heading. -->
      <h2
        id="first-run-title"
        class="text-balance text-sfere-h2! text-sfere-fg sm:text-sfere-h1!"
      >
        {{ welcome.headline }}
      </h2>

      <p
        id="first-run-scope"
        class="max-w-[42.5rem] text-pretty text-sfere-lead text-sfere-fg-muted"
      >
        {{ welcome.lede }}
      </p>
    </div>

    <!-- The warehouse claim gets its own band because it is the thing on this
         screen most likely to be disbelieved: every other CDP asks you to bring
         a warehouse. A bullet among bullets would not carry it.

         GREEN, NOT PURPLE, and that is the prototype's reading rather than a
         stray. Purple is the accent every clickable thing on this screen already
         wears — the CTA, the eyebrow, the card hovers — so a purple band reads as
         one more of those. This band is not an action, it is the one cost the
         reader was braced for being taken off the table, and success green is the
         only colour on the page that says "already handled".

         `items-start`, not `items-center`, and that is load-bearing rather than
         taste: `sfere.css` ships an unlayered `[class~='items-center'] > p` rule
         precisely because centring a row centres each child's MARGIN box, so a
         paragraph beside a chip sits eight pixels high. Starting them avoids the
         question. -->
    <div
      class="sfere-flush mx-auto flex w-full max-w-[50rem] flex-nowrap! items-start gap-3 rounded-sfere-lg border border-sfere-success/25 bg-sfere-success-soft p-4"
    >
      <span
        class="grid size-[2.125rem] shrink-0 place-items-center rounded-sfere-lg bg-sfere-success/10 text-sfere-success"
      >
        <FlowNodeIcon kind="destination" subtype="clickhouse" :size="18" />
      </span>
      <div class="sfere-flush grid min-w-0 flex-1 gap-1">
        <p class="text-sfere-sm font-semibold text-sfere-fg">{{
          welcome.warehouse.title
        }}</p>
        <p class="text-pretty text-sfere-xs text-sfere-fg-muted">{{
          welcome.warehouse.body
        }}</p>
      </div>
    </div>

    <!-- An ordered list, because the order IS the content: the reader does one
         of these and Sfere does the other two.

         `repeat(3, minmax(0,1fr))` via `sm:grid-cols-3`, never `auto-fit`. An
         `auto-fit` track measures its cell at min-content in the first pass and
         keeps the answer, which on cards like these resolved to 637px tall
         columns on `/sources/new` — collision #6. -->
    <ol
      role="list"
      class="sfere-flush mx-auto grid w-full max-w-[50rem] grid-cols-1 gap-3.5 sm:grid-cols-3"
    >
      <li
        v-for="item in welcome.steps"
        :key="item.key"
        class="sfere-flush relative grid min-w-0 content-start gap-1.5 overflow-hidden rounded-sfere-lg border border-sfere-line bg-sfere-surface p-4 shadow-sfere-soft"
      >
        <!-- The purple underline the prototype draws with `:after`. A real
             element rather than a pseudo-element so it needs no arbitrary
             `content-['']`, and `overflow-hidden` on the cell is what keeps its
             fade inside the rounded corners. -->
        <span
          class="pointer-events-none absolute inset-x-4 bottom-0 h-0.5 bg-[linear-gradient(90deg,transparent,var(--color-sfere-400),transparent)] opacity-45"
          aria-hidden="true"
        ></span>

        <!-- The number is absolute so it does not push the title down a line,
             which is what a flow-positioned kicker did on the two-line titles. -->
        <span
          class="absolute right-4 top-4 font-sfere-mono text-sfere-eyebrow text-sfere-fg-muted/70"
          aria-hidden="true"
          >{{ item.number }}</span
        >

        <SfereIconChip size="sm" class="mb-2">
          <FlowNodeIcon
            :kind="item.mark === 'warehouse' ? 'destination' : 'source'"
            :subtype="item.mark"
            :size="18"
          />
        </SfereIconChip>

        <p class="pr-7 text-sfere-sm font-semibold text-sfere-fg">{{
          item.title
        }}</p>
        <p class="text-pretty text-sfere-xs text-sfere-fg-muted">{{
          item.body
        }}</p>
      </li>
    </ol>

    <div class="mx-auto w-full max-w-[53.75rem]">
      <OnboardingFlowDiagram />
    </div>

    <!-- ONE CONTROL, AND NO SKIP. The prototype offers `Skip setup` from the
         category beat onward and not here, and that is right rather than an
         omission: nothing has been asked yet, so there is nothing to skip — the
         only thing a skip on this beat could mean is "close the page I have read
         one sentence of". The shell mounts the skip control itself, keyed on the
         beat, so this component has no opinion about it. -->
    <div class="flex justify-center">
      <SfereButton
        ref="ctaRef"
        variant="primary"
        size="lg"
        @click="emit('advance')"
        >{{ welcome.cta }}</SfereButton
      >
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import FlowNodeIcon from '@/components/flow/FlowNodeIcon.vue'
import OnboardingFlowDiagram from '@/components/onboarding/OnboardingFlowDiagram.vue'
import { FIRST_RUN_WELCOME } from '@/config/firstRun'

// The arrival's first beat. Renders from config and emits; it owns no state, for
// the reason every beat here does — what happens between them (recording the
// answer, arming the walkthrough, navigating) is MainLayout's.
const emit = defineEmits(['advance'])

const welcome = FIRST_RUN_WELCOME

// Exposed so the shell can put focus on the one control when this beat arrives.
// Quasar focus-manages a dialog when it OPENS, not when its contents change, so
// a beat swap otherwise drops focus to `<body>` — inside a modal, which is a
// correctness bug rather than polish.
const ctaRef = ref(null)
defineExpose({
  focusFirst: () => ctaRef.value?.$el?.focus?.({ preventScroll: true })
})
</script>
