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
    <!-- THE SURFACE IS THE HOUSE DIALOG STRING, COPIED VERBATIM:
         `rounded-sfere-xl border border-sfere-line bg-sfere-surface
         shadow-sfere-pop`, the same four utilities ConfirmDialog,
         SecretRevealDialog, SettingsNotificationChannelDialog,
         SettingsApiTokenCreateDialog, ProfileBuilderEditDialog and
         SourceSyncRunLogsDialog carry. This one had improvised
         `rounded-xl border-line2 bg-white shadow-lg`, and two of those four are
         visibly wrong rather than merely off-token: Tailwind's `rounded-xl` is
         12px where the Sfere card radius is 16px — so the panel was LESS rounded
         than the SelectableCards nested inside it, which is what reads as out of
         sync — and `shadow-lg` is a tight neutral drop where every other dialog
         in the app sits on the wide plum-tinted `shadow-sfere-pop`. The other two
         (`border-line2`, `bg-white`) resolve to the same values as their tokens
         today and are switched anyway, because the alias layer only keeps the
         brand in one place if nothing bypasses it.

         Radius has NO alias layer in `tailwind.css`, unlike colour: `rounded-lg`
         and `rounded-xl` resolve to Tailwind's own 8px/12px scale, not to
         `--radius-sfere-*`. So an off-system radius is silent — it looks
         plausible and is simply the wrong number.

         AND IT NEEDS THE IMPORTANT SUFFIX, which is a cascade collision that was
         not on CLAUDE.md's list. Quasar ships unlayered
         `.q-dialog__inner > div { border-radius: 4px }` — the same selector as
         the 560px max-width in collision #3 — so a layered `rounded-*` of any
         value loses to it and EVERY dialog in this app renders at 4px, including
         the six that correctly declare `rounded-sfere-xl`. The class was not the
         wrong number, it was dead. `rounded-sfere-xl!` is what beats it, for the
         reason `flex-nowrap!` does: layered `!important` outranks unlayered
         non-important. The tell is a dialog whose corners are visibly squarer
         than the cards nested inside it. -->
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-question-title"
      aria-describedby="persona-question-scope"
      class="flex max-h-[86vh] w-[760px]! max-w-[92vw]! flex-col flex-nowrap! gap-6 overflow-y-auto rounded-sfere-xl! border border-sfere-line bg-sfere-surface p-6 shadow-sfere-pop sm:p-7"
    >
      <div class="flex flex-col gap-1.5">
        <!-- An h2, never an h1. scripts/smoke.mjs asserts on the FIRST <h1> on
             every route, so a heading here would shadow the page's own and the
             gate would silently stop checking Home. -->
        <h2
          id="persona-question-title"
          class="font-sfere-display! text-xl! font-semibold! leading-7! tracking-[-0.01em]! text-ink"
        >
          Before we start, what do you do?
        </h2>
        <!-- ONE sentence about the stakes, not two in two places. The subtitle
             used to say "It sets what you see first" and a footer rule below the
             cards said "Nothing is locked by this answer. Every screen stays in
             the sidebar whichever you pick." — two reassurances about the same
             answer, 400px apart, and the first of them vague about what actually
             changes. Merged here, next to the question they qualify, and made
             specific: the role sets the ORDER of the sidebar and what the
             dashboard leads with, and that is all it does.
             `aria-describedby` points at it so the promise is read out with the
             question rather than found by exploring the dialog. -->
        <p
          id="persona-question-scope"
          class="max-w-[64ch] text-pretty text-sm text-muted"
        >
          It sets the order of your sidebar and what the dashboard leads with.
          Nothing is hidden, and you can change it any time in Settings →
          General.
        </p>
      </div>

      <!-- Labelled group rather than three loose buttons: with the heading tied
           to the set, a screen reader hears "what do you do?" before the first
           option instead of three unrelated controls. Not a `radiogroup` — these
           commit on click rather than holding a selection, and radio semantics
           would promise arrow-key roving and a separate submit that do not
           exist here. -->
      <div
        role="group"
        aria-labelledby="persona-question-title"
        class="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <!-- CENTRED, and both utilities need the important SUFFIX. SelectableCard
             is `items-start ... text-left` because every other picker in the app
             is a left-aligned card with a paragraph of body copy; these three
             have no body copy left, so left alignment left the divider and the
             Start row looking like the remains of something. Quasar ships
             unlayered `.items-start` and `.text-left`, which beat any layered
             utility — but both are non-important, so layered `!important` wins.
             A bare `items-center` here would silently lose to the card's own
             class. -->
        <SelectableCard
          v-for="persona in personas"
          :key="persona.key"
          class="items-center! text-center! active:translate-y-px"
          @select="emit('choose', persona.key)"
        >
          <SfereIconChip size="sm">
            <PersonaIcon :persona="persona.key" />
          </SfereIconChip>

          <!-- Two lines and nothing else — no third line, and NO `Start →` row.
               The third line this used to carry described the onboarding run
               ("Fire a real event and follow it all the way to delivery"), which
               is an answer to "should I start the tour?" — a question nobody is
               asking two seconds into their first sign-in, and one the tour
               cannot answer yet either.

               The `Start →` under it went for a different reason: the card IS
               the control, so the word was a second, smaller call to action
               inside the thing you already click — printed three times, which
               reads as three CTAs rather than one question with three answers.
               No other SelectableCard in the app labels itself, and matching the
               picker vocabulary on `/sources/new` matters more here than a
               per-card verb. What signals the affordance is what signals it
               everywhere else: the hover border and lift, the focus outline, and
               `active:translate-y-px` acknowledging the press.

               WRAPPED, AND SPACED BY `gap` RATHER THAN `mt-*`, which is rule 11
               rather than taste. Quasar's unlayered `p { margin: 0 0 16px }` is
               the shorthand, so it sets `margin-top: 0` on every paragraph in
               the app and a layered `mt-0.5` between these two computes to
               nothing. The wrapper's `items-center` then trips sfere.css's
               `[class~='items-center'] > p { margin: 0 }`, which kills the
               trailing 16px that would otherwise sit under the last line of a
               card whose neighbours have none. `gap` has no Quasar counterpart
               and therefore actually applies. -->
          <div class="mt-3.5 flex flex-col items-center gap-1">
            <p class="text-sm font-semibold text-ink">{{ persona.label }}</p>
            <p class="text-xs font-medium text-muted">{{
              persona.cardTitle
            }}</p>
          </div>
        </SelectableCard>
      </div>

      <!-- Skip is a QUIET TEXT CONTROL, and that is a hierarchy fix rather than
           a restyle. It used to be a bordered, shadowed, white button — the only
           element on the overlay that looked like a button at all, since the
           three answers are outlined cards. So the escape hatch carried more
           visual weight than the question, and the most button-shaped thing on
           a screen asking you to choose a role was the one that declines to.
           The three cards are the emphasis now; this is the way past them.

           No rule above it either: a full-width border over a single quiet link
           announces a section boundary, which is the same thing that took the
           divider off the cards.

           `py-2.5` rather than the `py-1` a text control looks right with:
           measured at 420px the button was 28px tall, which is under any touch
           minimum, and the padding is invisible on a borderless control. The
           negative right margin pulls the padding back off the card's edge so
           the label still optically aligns with the last card. -->
      <div class="flex justify-end">
        <button
          type="button"
          class="-mr-2 rounded-sfere px-2 py-2.5 text-sm text-subtle underline-offset-4 transition-colors duration-200 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sfere-brand"
          @click="emit('skip')"
        >
          Skip, just show me the app
        </button>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import { PERSONAS } from '@/config/personas'
import PersonaIcon from './PersonaIcon.vue'

// The onboarding fork: one question, three cards, one escape hatch.
//
// It is an OVERLAY OVER A FULLY-RENDERED HOME PAGE, never a route, and that is a
// gate decision as much as a UX one. scripts/smoke.mjs waits for
// [data-smoke="nav"] after signing in and then requires a non-empty <h1> on every
// route: a full-screen /welcome route has no nav in the DOM, so the entire
// behavioural gate would fail at sign-in rather than on one screen. Because this
// is a q-dialog, the page beneath stays mounted and visible — which is also
// Meiro's rule about not hiding the product behind the wizard, and what makes
// Home's zeroes filling in later legible.
//
// `persistent` is deliberate: the two ways out are picking a card and Skip, and
// a stray backdrop click that dismissed the question without recording an answer
// would bring it back on the next load looking like a bug. MainLayout only mounts
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
// TWO IMPORTANT SUFFIXES IN THE TEMPLATE, both the Quasar cascade collision
// documented in CLAUDE.md rather than taste. Quasar ships an unlayered
// `.q-dialog__inner--minimized > div { max-width: 560px }`, which silently
// shrinks a three-card row to two-and-a-bit columns, so `w-[760px]!` is the only
// form that widens it; and unlayered `.items-start` / `.text-left` on
// SelectableCard's own class list, which only a layered `!important` beats.
//
// Not in the kit and not prefixed Sfere*: it is one product surface, not a
// primitive, so the "one Quasar dependency" carve-out in docs/ui-conventions.md
// does not apply here — MainLayout, which owns it, is Quasar throughout.
defineProps({
  open: { type: Boolean, default: false }
})

// `choose` carries the persona key; `skip` records the answer as skipped. Neither
// writes state — the layout owns useOnboarding, the same way pages own data and
// components own appearance.
const emit = defineEmits(['choose', 'skip'])

const personas = PERSONAS
</script>
