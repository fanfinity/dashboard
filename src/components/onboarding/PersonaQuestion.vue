<template>
  <!-- Explicit fade in and out, rather than Quasar's default `scale`.
       QA saw a frame of the card overlapping the dashboard on close: the
       default hide is a transform-based scale-out that runs against a backdrop
       fading on its own curve, so for a moment a shrinking card sits over
       already-visible page content. A fade moves nothing, so there is nothing
       to catch mid-flight, and 180ms is short enough that the answer feels
       acted on rather than animated. -->
  <q-dialog
    :model-value="open"
    persistent
    transition-show="fade"
    transition-hide="fade"
    :transition-duration="180"
  >
    <!-- THIS ONE DIALOG IS DARK, AND IT IS THE ONLY EXCEPTION IN THE APP.
         Every other dialog copies the house surface string
         (`rounded-sfere-xl! border border-sfere-line bg-sfere-surface
         shadow-sfere-pop`) and a new one still should — that rule exists to
         stop *improvisation*, which is how this file previously ended up with
         `rounded-xl border-line2 bg-white shadow-lg`, two of which were
         visibly wrong rather than merely off-token.

         What earns the exception is that this is not a dialog in the sense the
         rule is about. Every other one interrupts a task someone chose to
         start — a confirm, an editor, a revealed secret — so it should be the
         quietest possible surface over the work it covers. This is the FIRST
         THING a new account sees, before there is any work to cover, and it is
         the only screen in the product whose job is to feel like an arrival.
         Dark is how the brand does arrivals: sfere.io's hero, deployment band
         and footer are all `--color-sfere-ink`, and the token layer calls dark
         "a section treatment, not a theme" for exactly this use. So someone
         who signs up on the marketing site lands on the same canvas they just
         came from, and then never sees it again.

         THE BOUNDARY, so this does not become a licence: dark is for the
         first-run moment. A second dark dialog is a change worth arguing
         about, not a precedent already set.

         EVERY TOKEN IS THE ON-INK COUNTERPART OF THE HOUSE STRING, swapped
         deliberately rather than left as-is:
           bg-sfere-surface   -> bg-sfere-ink        (the hero canvas)
           border-sfere-line  -> border-sfere-hairline (white-alpha, so the
                                 plum shows through instead of a grey line)
           shadow-sfere-pop   -> shadow-sfere-ink-deep (pop is plum-on-light
                                 and is invisible under a dark card)
         Shipping the light shadow on a dark card would be the exact
         improvisation the house-string rule guards against.

         THREE IMPORTANT SUFFIXES, all of them Quasar cascade collisions rather
         than emphasis, and each verified against `quasar.css` rather than
         assumed:
           `rounded-sfere-xl!` — unlayered `.q-dialog__inner > div
             { border-radius: 4px }` beats a layered radius of any value, so
             all seven Sfere-era dialogs render at 4px unless they carry the
             suffix. The tell is a panel whose corners are squarer than the
             cards inside it.
           `w-[800px]! max-w-[92vw]!` — unlayered
             `.q-dialog__inner--minimized > div { max-width: 560px }`, which
             silently squeezes a three-card row into two-and-a-bit columns.
             The max-width has to be overridden by a max-width; a bare `w-` is
             not enough.
           `flex-nowrap!` — Quasar's `.flex` is `display:flex; flex-wrap:wrap`
             unlayered, and a height-capped flex COLUMN does not scroll when it
             overflows, it wraps into a second column off the card's right
             edge. This card is height-capped (see below), so it needs it.

         `bg-sfere-ink` deliberately carries NO suffix: `.q-dialog__inner > div`
         sets radius, overflow and max-width, and no background at all, so
         there is nothing to beat. Checked, not guessed.

         There is no `max-h-*` here any more. There used to be a
         `max-h-[86vh]`, and it was a dead class: unlayered
         `.q-dialog__inner--minimized > div { max-height: calc(100vh - 48px) }`
         beats it, so Quasar's cap was always the one in force. Keeping a
         number that does nothing is worse than relying on the one that does —
         24px of breathing room top and bottom is the right cap anyway. -->
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-question-title"
      aria-describedby="persona-question-scope"
      class="persona-card sfere-dot-grid relative flex w-[800px]! max-w-[92vw]! flex-col flex-nowrap! overflow-y-auto rounded-sfere-xl! border border-sfere-hairline bg-sfere-ink p-6 shadow-sfere-ink-deep sm:p-8"
    >
      <!-- The purple bloom over the top of the canvas. A CHILD ELEMENT rather
           than a second utility class, because `sfere-dot-grid` and
           `sfere-glow-top` both set `background-image` and the second one
           declared would simply replace the first — two signature treatments
           cannot be stacked on one element. This also lets the bloom be
           stronger than `sfere-glow-top`'s 6%, which is calibrated for light
           sections and is invisible on ink.

           No `overflow-hidden` on the card to clip it, on purpose: that would
           fight the `overflow-y-auto` the card needs when a small window caps
           its height. It does not need clipping — the gradient is 60% of the
           width centred at 50%, so it has already faded to transparent well
           before it reaches either rounded corner. -->
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_60%_at_50%_0%,rgb(153_105_255/0.22),transparent_70%)]"
        aria-hidden="true"
      ></div>

      <!-- `relative` so the content sits above the bloom. `gap` for every
           vertical rhythm in here, never `mt-*` on a paragraph: Quasar's
           unlayered `p { margin: 0 0 16px }` is the shorthand form, so it
           zeroes `margin-top` on every paragraph in the app and a layered
           `mt-*` on one computes to nothing (docs/ui-conventions.md rule 11).

           ONE OVERLAY, TWO BEATS — the question, then the path. The second beat
           is not a second dialog, and that is a rule rather than a convenience:
           this card is the one deliberate dark surface in the app, and CLAUDE.md
           says in as many words that a second dark dialog is a change worth
           arguing about rather than a precedent already set. It is also true to
           what is happening — one arrival, answered and then acted on — so
           swapping the contents in place keeps the canvas, the bloom and the
           wordmark continuous instead of closing one moment to open another. -->
      <div class="relative flex flex-col flex-nowrap! gap-7">
        <div class="flex flex-col items-start gap-5">
          <!-- The wordmark, in its on-dark cut. `public/brand/` ships a real
               light lockup, so this is a file swap and not a filter or a tint
               on the dark one — the sphere is purple on both canvases and
               recolouring it is the one thing that breaks the identity.
               Small and quiet: it says "this is a moment", and the sidebar
               behind the overlay is already carrying the brand. -->
          <!-- `h-6` IS DOING THE SIZING, not the `height` prop, and the prop
               is kept only for the intrinsic aspect ratio it puts on the
               element. SfereLogo's `height` is inert app-wide: Tailwind
               preflight ships `img, video { height: auto }` in `@layer base`,
               and the `height` attribute the component sets is a
               presentational hint, which any author-origin rule beats — so
               every call site renders the file at its intrinsic 190x38. Worth
               fixing in the component (`/design-system` demonstrates it by
               showing `:height="32"` and `:height="22"` as two identical
               logos), but that resizes LoginPage, AccountSetupOverlay and the
               docs page too, so it is not folded into this change. -->
          <SfereLogo on-dark :height="24" class="h-6" />

          <div class="flex flex-col gap-2.5">
            <!-- An h2, never an h1. scripts/smoke.mjs asserts on the FIRST
                 <h1> on every route, so a heading here would shadow the page's
                 own and the gate would silently stop checking Home.

                 ONE type token, not four utilities. `text-sfere-h3` /
                 `text-sfere-h2` each bundle size, leading, tracking AND
                 weight, which is why a single `!` covers all four properties
                 Quasar sets on a bare heading (`h2 { font-size: 3.75rem;
                 font-weight: 300; line-height: 3.75rem; letter-spacing:
                 -0.00833em }`). This used to be
                 `text-xl! font-semibold! leading-7! tracking-[-0.01em]!` —
                 four hand-picked values re-deriving a token that already
                 exists, and 20px on the app's biggest moment.
                 Bricolage comes from the unlayered `h1,h2,…{ font-family }`
                 rule in tailwind.css, so no `font-sfere-display` is needed
                 here; declaring it again would be a class that changes
                 nothing.

                 THE ID IS STABLE ACROSS BOTH BEATS, and so is the one below it:
                 `aria-labelledby` and `aria-describedby` are set on the card,
                 which does not unmount between them, so moving the ids onto
                 per-beat elements would break the association for whichever
                 beat did not own them. -->
            <h2
              id="persona-question-title"
              class="text-balance text-sfere-h3! text-sfere-dark-fg sm:text-sfere-h2!"
            >
              {{ title }}
            </h2>
            <!-- ONE sentence about the stakes, not two in two places. The
                 subtitle used to say "It sets what you see first" and a footer
                 rule below the cards said "Nothing is locked by this answer.
                 Every screen stays in the sidebar whichever you pick." — two
                 reassurances about the same answer, 400px apart, and the first
                 of them vague about what actually changes. Merged here, next to
                 the question they qualify, and made specific: the role sets the
                 ORDER of the sidebar and what the dashboard leads with, and
                 that is all it does.
                 `aria-describedby` points at it so the promise is read out with
                 the question rather than found by exploring the dialog.

                 `text-sfere-dark-fg-muted` (≈#b5b5b5, ~9:1 on ink) rather than
                 EmptyState's on-dark `text-white/55`, which lands near 5.5:1 —
                 both pass, and this is a real token instead of an alpha. Never
                 `text-muted`: that aliases to the same value as `text-subtle`
                 (#737373) and is a light-surface token that would be unreadable
                 here. -->
            <p
              id="persona-question-scope"
              class="max-w-[62ch] text-pretty text-sfere-sm text-sfere-dark-fg-muted"
            >
              {{ scope }}
            </p>
          </div>
        </div>

        <!-- BEAT ONE — the question. -->
        <template v-if="step === 'question'">
          <!-- Labelled group rather than three loose buttons: with the heading
               tied to the set, a screen reader hears "what do you do?" before
               the first option instead of three unrelated controls. Not a
               `radiogroup` — these commit on click rather than holding a
               selection, and radio semantics would promise arrow-key roving and
               a separate submit that do not exist here. -->
          <div
            role="group"
            aria-labelledby="persona-question-title"
            class="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <!-- `on-dark` on BOTH the card and its icon chip. Every kit
                 component that has the pair needs it set on each — a
                 light-surface variant inside a dark section is the one way to
                 get either component wrong, and here it would be black text on
                 a near-black card. The chip's on-dark branch is what puts
                 PersonaIcon's `currentColor` at `text-sfere-300`, so the mark
                 itself needs no change.

                 CENTRED, and both utilities need the important SUFFIX.
                 SelectableCard is `items-start … text-left` because every other
                 picker in the app is a left-aligned card with a paragraph of
                 body copy; these three have no body copy. Quasar ships
                 unlayered `.items-start` and `.text-left`, which beat any
                 layered utility — but both are non-important, so a layered
                 `!important` wins. A bare `items-center` here would silently
                 lose to the card's own class.

                 `p-6!` over the kit's `p-5`: 4px more air per side, because
                 these three are the whole screen rather than one row in a
                 catalog grid. Important suffix for the ordinary reason — it is
                 overriding the component's own layered `p-5`, and a same-layer
                 tie would otherwise be settled by emission order.

                 `active:translate-y-px` is the press. The hover — a purple
                 border and a brand glow — belongs to the component's on-dark
                 branch now rather than to this instance: an instance
                 `hover:border-*` and the component's own are two layered
                 utilities on one property in one layer, so which wins would be
                 Tailwind's emission order rather than the order written
                 here. -->
            <SelectableCard
              v-for="persona in personas"
              :key="persona.key"
              on-dark
              class="items-center! p-6! text-center! active:translate-y-px"
              @select="emit('choose', persona.key)"
            >
              <SfereIconChip size="sm" on-dark>
                <PersonaIcon :persona="persona.key" />
              </SfereIconChip>

              <!-- Two lines and nothing else — no third line, and NO `Start →`
                   row. The third line this used to carry described the
                   onboarding run ("Fire a real event and follow it all the way
                   to delivery"), which answers "should I start the tour?" — a
                   question nobody is asking two seconds into their first
                   sign-in, and one the tour cannot answer yet either.

                   The `Start →` under it went for a different reason: the card
                   IS the control, so the word was a second, smaller call to
                   action inside the thing you already click — printed three
                   times, which reads as three CTAs rather than one question
                   with three answers. No other SelectableCard in the app labels
                   itself.

                   SPACED BY `gap` RATHER THAN `mt-*`, per rule 11 as above. The
                   wrapper's `items-center` also trips sfere.css's
                   `[class~='items-center'] > p { margin: 0 }`, which kills the
                   trailing 16px that would otherwise sit under the last line of
                   a card whose neighbours have none. -->
              <div class="mt-4 flex flex-col items-center gap-1.5">
                <p class="text-sfere-sm font-semibold text-sfere-dark-fg">{{
                  persona.label
                }}</p>
                <p class="text-sfere-xs text-sfere-dark-fg-muted">{{
                  persona.cardTitle
                }}</p>
              </div>
            </SelectableCard>
          </div>

          <!-- Skip is a QUIET TEXT CONTROL, and that is a hierarchy fix rather
               than a restyle. It used to be a bordered, shadowed, white button —
               the only element on the overlay that looked like a button at all,
               since the three answers are outlined cards. So the escape hatch
               carried more visual weight than the question, and the most
               button-shaped thing on a screen asking someone to choose a role
               was the one that declines to. The three cards are the emphasis;
               this is the way past them.

               No rule above it either: a full-width border over a single quiet
               link announces a section boundary, which is the same thing that
               took the divider off the cards.

               `py-2.5` rather than the `py-1` a text control looks right with:
               measured at 420px the button was 28px tall, which is under any
               touch minimum, and the padding is invisible on a borderless
               control. The negative right margin pulls that padding back off the
               card's edge so the label still optically aligns with the last
               card.

               The focus ring is `outline-sfere-brand` (#9969ff) — the same ring
               the cards use, and it clears the ink canvas comfortably. A ring
               inherited from a light-surface token would vanish here. -->
          <div class="flex justify-end">
            <button
              type="button"
              class="-mr-2 rounded-sfere px-2 py-2.5 text-sfere-sm text-sfere-dark-fg-muted underline-offset-4 transition-colors duration-200 hover:text-sfere-dark-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sfere-brand"
              @click="emit('skip')"
            >
              Skip, just show me the app
            </button>
          </div>
        </template>

        <!-- BEAT TWO — the path, and one button onto it.
             `sfere-flush` because this column spaces its own children with
             `gap`: without it every non-final `<p>` in here adds Quasar's
             unlayered 16px on top of the gap, which is rule 11's failure in its
             quiet form — the card just reads loose, and editing the gap changes
             nothing. -->
        <div v-else class="sfere-flush flex flex-col gap-5">
          <!-- An ordered list, because the order is the whole content: a pipe
               cannot exist before its two ends do. `min-w-0` on each node and no
               wire drawn between them — the arrow that belongs here at three
               abreast is a caret the reader has to parse at 12px, and the
               numbers already say the sequence. -->
          <ol role="list" class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <li
              v-for="(node, i) in pathNodes"
              :key="node.key"
              class="flex min-w-0 flex-col gap-1.5 rounded-sfere-xl border px-4 py-3.5"
              :class="
                node.done
                  ? 'border-sfere-400/60 bg-sfere-500/15'
                  : 'border-sfere-hairline bg-sfere-wash'
              "
            >
              <div class="flex items-center gap-2">
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full border text-sfere-xs font-semibold"
                  :class="
                    node.done
                      ? 'border-sfere-400/50 bg-sfere-500/25 text-sfere-success-on-ink'
                      : 'border-sfere-hairline text-sfere-dark-fg-muted'
                  "
                >
                  <!-- The tick is drawn, not spelled, and it is only ever
                       rendered when the three setup reads actually answered —
                       see `stepsKnown`. A green tick over a failed read would be
                       the confident-zero failure this repo keeps writing down. -->
                  <svg
                    v-if="node.done"
                    viewBox="0 0 20 20"
                    class="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4.5 10.5l3.5 3.5L15.5 6" />
                  </svg>
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <p
                  class="min-w-0 flex-1 text-sfere-sm font-semibold text-sfere-dark-fg"
                  >{{ node.label }}</p
                >
              </div>
              <p class="text-sfere-xs text-sfere-dark-fg-muted">{{
                node.note
              }}</p>
            </li>
          </ol>

          <!-- The one caveat, said once. Steps 2 and 3 come free with a `web` or
               `zid` source and with nothing else (see the provisioning table in
               CLAUDE.md), so a flat "we do the rest for you" would be false for
               anyone who picks a mobile SDK or an HTTP API on the very next
               screen. -->
          <p
            class="max-w-[62ch] text-pretty text-sfere-xs text-sfere-dark-fg-muted"
            >For a website or an online store we create the last two along with
            your source. Other platforms add a destination afterwards.</p
          >

          <div class="flex flex-wrap items-center gap-3">
            <!-- `white` is the on-ink primary; `primary` here would be a purple
                 fill on a purple-bloomed near-black card. -->
            <SfereButton ref="ctaRef" variant="white" @click="emit('start')">{{
              ctaLabel
            }}</SfereButton>
            <!-- The same quiet control Skip is, and for the same reason: the way
                 past this beat must not compete with the way through it. It is
                 worded as a choice rather than a dismissal — nothing here is
                 unfinished business, the role is already recorded, and Home is a
                 fine place to end up. -->
            <button
              type="button"
              class="rounded-sfere px-2 py-2.5 text-sfere-sm text-sfere-dark-fg-muted underline-offset-4 transition-colors duration-200 hover:text-sfere-dark-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sfere-brand"
              @click="emit('dismiss')"
            >
              I'll look around first
            </button>
          </div>
        </div>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'
import { PERSONAS } from '@/config/personas'
import PersonaIcon from './PersonaIcon.vue'

// The arrival: one question, three cards, one escape hatch — and then, on the
// same card, the path from an empty account to a working pipeline. On the
// brand's dark canvas, because it is the only screen in the product whose job is
// to feel like an arrival. The reasoning for that exception, and its boundary,
// is on the card element in the template.
//
// The file is still called PersonaQuestion because the question is still what it
// opens with and what every other file refers to it as; the second beat is the
// answer being acted on, not a second surface.
//
// It is an OVERLAY OVER A FULLY-RENDERED HOME PAGE, never a route, and that is a
// gate decision as much as a UX one. scripts/smoke.mjs waits for
// [data-smoke="nav"] after signing in and then requires a non-empty <h1> on every
// route: a full-screen /welcome route has no nav in the DOM, so the entire
// behavioural gate would fail at sign-in rather than on one screen. Because this
// is a q-dialog, the page beneath stays mounted and visible — which is also
// Meiro's rule about not hiding the product behind the wizard, and what makes
// Home's zeroes filling in later legible. The dark card is what makes that
// figure/ground split unambiguous: the product is still there, and this is
// plainly in front of it rather than part of it.
//
// `persistent` is deliberate: on beat one the two ways out are picking a card
// and Skip, and a stray backdrop click that dismissed the question without
// recording an answer would bring it back on the next load looking like a bug.
// It stays persistent on beat two for a weaker but real reason: the answer is
// already recorded by then, so a backdrop click loses nothing — but the two
// controls there are the whole point of the beat, and a card that can be
// swiped away by a misplaced click is a card people dismiss without reading. MainLayout only mounts
// this on `/`, so a deep link from Slack is never ambushed by it.
//
// THERE ARE NO 1/2/3 SHORTCUTS AND NO NUMBER CHIPS ON THE CARDS. The digits were
// printed on the cards so the shortcut was an affordance rather than an easter
// egg, which means the two go together: keeping the binding after dropping the
// chips would leave an undiscoverable hotkey that can silently answer the
// question for someone typing into the header search behind the overlay. They
// also read as a ranking — Engineer 1, Marketer 2 — which is the wrong thing to
// say about three equal roles, and is why they came off.
//
// Not in the kit and not prefixed Sfere*: it is one product surface, not a
// primitive, so the "one Quasar dependency" carve-out in docs/ui-conventions.md
// does not apply here — MainLayout, which owns it, is Quasar throughout.
//
// TWO BEATS, ONE CARD. Answering the question does not close this — it swaps the
// contents for the path: three nodes, one button onto the first of them. That is
// the whole of "the first thing that should happen is to guide them to make
// their first source", and it is deliberately a beat rather than a redirect,
// because being thrown onto a form by a click you thought only recorded a
// preference reads as a misfire. The button is the consent.
//
// IT STILL WRITES NO STATE AND OWNS NO DATA. Both beats are rendered from props
// and every outcome is an emit — MainLayout owns useOnboarding and
// useSetupProgress, the same way pages own data and components own appearance.
// That is also why the setup marks arrive as `steps` + `stepsKnown` rather than
// this file calling the composable: a second useSetupProgress() would repeat
// three list reads the layout has already made.
const props = defineProps({
  open: { type: Boolean, default: false },
  // 'question' | 'path'. The layout advances it; this never advances itself,
  // because what happens between the two beats (record the answer, kick off the
  // setup read, decide whether the path is even worth showing) is the layout's.
  step: { type: String, default: 'question' },
  // The chosen persona's registry entry, for its `onboarding` copy. Null during
  // beat one, and null-safe throughout — a persona key that no longer resolves
  // must degrade to the generic wording, not to a blank card.
  persona: { type: Object, default: null },
  // useSetupProgress()'s `steps`, for the labels and the done marks.
  steps: { type: Array, default: () => [] },
  // Whether those marks mean anything yet: false while the three reads are in
  // flight, and false when any of them failed or has no endpoint. The nodes
  // still render — the path is the same path either way — they just carry a
  // number instead of a tick.
  stepsKnown: { type: Boolean, default: false },
  ctaLabel: { type: String, default: 'Connect your first source →' }
})

// `choose` carries the persona key; `skip` records the answer as skipped;
// `start` takes the offered step; `dismiss` closes the path beat without one.
const emit = defineEmits(['choose', 'skip', 'start', 'dismiss'])

const personas = PERSONAS

const onPath = computed(() => props.step === 'path')

// FOCUS HAS TO BE MOVED BY HAND WHEN THE BEAT SWAPS, and this is a correctness
// fix rather than a polish one. The card is `role="dialog" aria-modal="true"`,
// and Quasar focus-manages a q-dialog when it OPENS, not when its contents
// change — so the SelectableCard someone just activated unmounts under their
// cursor and focus falls back to `<body>`. A keyboard or screen-reader user
// would answer the question and land nowhere, inside a modal, with the button
// that is the whole point of the second beat unannounced and two tab stops away.
const ctaRef = ref(null)

watch(
  () => props.step,
  async step => {
    if (step !== 'path') return
    await nextTick()
    // `$el` because SfereButton renders a `<component :is>` root; optional
    // throughout so a beat rendered without the button never throws.
    ctaRef.value?.$el?.focus?.()
  }
)

const title = computed(() =>
  onPath.value
    ? (props.persona?.onboarding?.headline ?? "Let's build your first pipeline")
    : 'Before we start, what do you do?'
)

const scope = computed(() =>
  onPath.value
    ? (props.persona?.onboarding?.lede ??
      'Connect a source and we provision its warehouse and the pipe feeding it in the same call.')
    : 'It sets the order of your sidebar and what the dashboard leads with. Nothing is hidden, and you can change it any time in Settings → General.'
)

// The three setup steps, plus this beat's own answer to "who does this one?".
// The notes are keyed by POSITION rather than by step key so a fourth step added
// to useSetupProgress later renders with no note instead of throwing; the labels
// come from the composable, so the wording here can never drift from the
// tracker's on the Dashboard.
const PATH_NOTES = [
  'You do this next.',
  'Where the events land.',
  'What carries them there.'
]

const FALLBACK_STEPS = [
  { key: 'source', label: 'Connect a source' },
  { key: 'destination', label: 'Add a destination' },
  { key: 'pipe', label: 'Create a pipe' }
]

const pathNodes = computed(() => {
  const source = props.steps.length ? props.steps : FALLBACK_STEPS
  return source.map((step, i) => ({
    key: step.key,
    label: step.label,
    note: PATH_NOTES[i] ?? '',
    // A tick is a claim that the record exists. Only the reads can make it.
    done: props.stepsKnown && step.done === true
  }))
})
</script>

<style scoped>
/* Selection is a surface nobody draws and the browser always does. The default
   highlight is a system blue calibrated for black-on-white, and on the ink
   canvas it reads as a rendering fault rather than as selected text — this is
   the one screen in the app on a dark background, so it is the one place the
   default is visibly wrong. Scoped, so the other 49 screens keep the platform
   default they are correct with. */
.persona-card ::selection {
  background: rgb(153 105 255 / 0.4);
  color: #fff;
}
</style>
