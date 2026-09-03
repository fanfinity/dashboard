<template>
  <!-- THE canonical setup tracker, drawn as the pipeline it describes.
       It lives on the Dashboard and nowhere else: Sources, Destinations and
       Pipes each show a one-line reminder pointing back here
       (SetupReminderStrip) rather than each maintaining their own copy of the
       same three steps — four trackers is four things to keep in agreement, and
       the one that drifts is always the one someone is reading.

       IT IS A DIAGRAM NOW, NOT THREE CARDS, and that is the point rather than a
       restyle. Source → destination → pipe is a *chain* with a hard dependency
       order: a pipe cannot exist until both of its ends do. Three same-size
       bordered cards in a row say "here are three things to do" and leave the
       order looking like a suggestion — which is why the old version had to
       print "After step 2" under the third card to recover the one fact its own
       layout had thrown away. A rail of three nodes on a connecting line says it
       structurally: the line between two nodes is either built or it is not, a
       locked node is visibly downstream of what blocks it, and the reader
       does not have to read anything to know which end they are at.
       It is also the vocabulary the app already uses for a pipeline —
       ProvisionedPipePanel, SourceProvisionedOverlay and PipelineFlowPanel are
       all node-and-wire — so the Dashboard's setup story and the diagram of the
       thing it sets up are finally the same picture.

       IT NOW RENDERS AT 0 OF 3 TOO, WHICH IS A REVERSAL. The Dashboard used to
       suppress this panel on a brand-new workspace and show a lone EmptyState
       ("Point your website, app or store at Sfere…") with one button, on the
       argument that at zero "three cards say what one sentence already said".
       That argument was right about the three cards and wrong about the answer:
       what it bought was a first screen that states a goal and hides the shape
       of the work, so the one question a new account actually has — what does
       this involve, and how far is it? — was answered nowhere, and the same
       reader met a completely different-looking surface the moment they
       finished step one. A diagram does not have that problem: at zero it is
       the explanation AND the tracker AND the one call to action, so there is
       one surface across all four counts instead of two that swap.

       Hidden entirely when the three reads cannot be trusted (`unavailable`) —
       "0 of 3" over a failed pipelines endpoint is a guess presented as a fact.
       Also hidden once setup is complete and has been dismissed: a permanent
       "you're all set" banner is clutter on the screen someone opens every
       morning. -->
  <CardPanel v-if="!unavailable" :gradient-border="!complete">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div class="min-w-0 flex-1">
        <h2 class="text-sfere-h4! text-ink">
          {{ headline }}
        </h2>
        <!-- `mt-1` on a <p> would compute to nothing (Quasar's unlayered
             `p { margin: 0 0 16px }` is the shorthand, so it zeroes margin-top
             app-wide). The heading has no bottom margin to remove, so the gap
             comes from the paragraph's own top padding instead. -->
        <p class="max-w-[68ch] pt-1.5 text-sm text-muted">{{ blurb }}</p>
      </div>

      <!-- The count, in the mono face the brand reserves for measurements. It
           is a fraction rather than a percentage because three is small enough
           that "1 / 3" is more precise than "33%" and reads faster. -->
      <div class="flex shrink-0 items-center gap-3">
        <p class="font-sfere-mono text-sfere-label uppercase text-subtle"
          >{{ doneCount }} / {{ total }} done</p
        >
        <button
          v-if="complete"
          class="text-xs font-medium text-subtle hover:text-muted"
          @click="emit('dismiss')"
        >
          Hide
        </button>
      </div>
    </div>

    <!-- THE RAIL. One DOM for both axes rather than two v-if branches: a
         duplicated node list would double the maintenance and, worse, put the
         steps in the accessibility tree twice.

         Stacked on mobile (marker column on the left, its connector running
         down to the next marker, text to the right) and horizontal from `sm`
         (marker, connector running right, text underneath). Each `<li>` flips
         from row to column at the same breakpoint and the rail div inside it
         flips from column to row, so the marker-and-wire group is always
         perpendicular to the text.

         `flex-nowrap!` on both, and it is not belt and braces: Quasar's `.flex`
         is `display:flex; flex-wrap:wrap` UNLAYERED, so every flex container in
         this repo wraps and the layered `flex-nowrap` utility loses to it. A
         wrapped rail would drop a node onto its own line with its connector
         still pointing at where the next node used to be. -->
    <!-- FULL WIDTH OF THE PANEL, deliberately. This shipped briefly capped at
         `max-w-[46rem]` on the reasoning that the card is the page's whole
         1400px and each wire stretched to ~430px, which is long enough that
         the three markers start reading as separate dots rather than one
         chain. Reviewed on screen and reversed: a capped rail left the right
         half of the card empty while the header, the blurb and the footer all
         span it, so the diagram read as a figure dropped into a panel instead
         of as the panel's subject. It spans the card now — the wires are long,
         and that is the accepted trade for the rail owning the width the rest
         of the card already has. Do not re-cap it without also narrowing the
         footer row, or the mismatch comes straight back. -->
    <ol class="mt-6 flex flex-col flex-nowrap! sm:flex-row">
      <li
        v-for="(step, i) in nodes"
        :key="step.key"
        class="flex flex-nowrap! gap-4 sm:min-w-0 sm:flex-1 sm:flex-col sm:gap-0"
        :aria-current="step.current ? 'step' : undefined"
      >
        <div
          class="flex flex-col flex-nowrap! items-center sm:w-full sm:flex-row"
        >
          <!-- The marker. `relative` so the current step's ring can sit
               outside it without affecting layout. -->
          <span class="relative shrink-0">
            <!-- WHERE YOU ARE, and the only motion in the component while
                 setup is unfinished. A slow opacity breathe on a ring outside
                 the marker: it never moves anything, so it cannot pull the eye
                 the way a pulse-and-scale would on a screen someone is trying
                 to read. `animate-sfere-breathe` is the shipped token, and
                 sfere.css already switches every `animate-sfere-*` off under
                 `prefers-reduced-motion` — the end state is the marker's own
                 brand fill, which says the same thing without the ring.
                 It exists only while there IS a current step, so it and the
                 flow lines below can never run at once. -->
            <span
              v-if="step.current"
              class="animate-sfere-breathe absolute -inset-1.5 rounded-full ring-2 ring-sfere-brand-fill/30"
              aria-hidden="true"
            ></span>

            <span
              class="relative grid size-10 place-items-center rounded-full border text-sm font-semibold transition duration-300 ease-sfere-ui"
              :class="markerClasses(step)"
            >
              <!-- Three marks, one per state, all drawn on the same 20 grid
                   with the same stroke weight as the tick in SetupStepper and
                   ProvisionedPipePanel, so the three pipeline surfaces share
                   one icon family. `aria-hidden` because the state is in the
                   text below — the `sr-only` word on the label carries it. -->
              <svg
                v-if="step.done"
                viewBox="0 0 20 20"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M5 10.5l3.5 3.5L15 6" />
              </svg>
              <!-- A drawn padlock, not a 🔒: the glyph would arrive in whatever
                   emoji face the OS ships and match nothing else on screen. -->
              <svg
                v-else-if="step.locked"
                viewBox="0 0 20 20"
                class="size-[18px]"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="4.75" y="8.75" width="10.5" height="7" rx="1.75" />
                <path d="M7.25 8.75V6.5a2.75 2.75 0 0 1 5.5 0v2.25" />
              </svg>
              <template v-else>{{ i + 1 }}</template>
            </span>
          </span>

          <!-- THE WIRE, and it is what carries "blocked by the one before it".
               Solid emerald where the step behind it is done, a dashed hairline
               where it is not — so an unbuilt link in the chain is visibly a
               gap rather than a line of a different colour, which is the one
               reading that cannot be mistaken for a style choice.

               Between nodes only, so the last node has no stub pointing at
               nothing. `aria-hidden`: it is the same fact the text states, and
               nine unlabelled divs is not how a screen reader should learn it.

               The dash pattern is in the scoped style block rather than an
               arbitrary background utility, because it needs a different
               gradient axis per breakpoint and two `bg-[linear-gradient(…)]`
               literals with `bg-[length:…]` beside them is unreadable for what
               is, in CSS, four lines. -->
          <span
            v-if="i < nodes.length - 1"
            class="relative w-px flex-1 overflow-hidden sm:mx-3 sm:h-px sm:w-auto sm:min-w-4 sm:flex-1"
            :class="step.done ? 'bg-sfere-success/45' : 'rail-pending'"
            aria-hidden="true"
          >
            <!-- MOVEMENT ONLY WHEN THE CHAIN IS ACTUALLY JOINED, i.e. all
                 three exist. Deliberately NOT "both ends of this wire are
                 done": with a source and a destination but no pipe, both ends
                 of the first wire are green and nothing whatsoever is moving
                 between them, so animating there would be the panel's one
                 outright false statement. Even at three the claim is kept to
                 "the path is built" — see `blurb`; nothing here measures
                 throughput. -->
            <span
              v-if="complete"
              class="sfere-flow-line-y animate-sfere-flow-y sm:sfere-flow-line sm:animate-sfere-flow absolute inset-0"
            ></span>
          </span>
        </div>

        <!-- The text. Kept to a label and one short state line: a full sentence
             under each of three nodes is how a diagram turns back into three
             cards. The sentence that explains the work is in `blurb` above,
             once, and the sentence about the step in progress is in the footer,
             once. -->
        <div
          class="min-w-0 sm:pr-4 sm:pb-0! sm:pt-4"
          :class="i < nodes.length - 1 ? 'pb-7' : 'pb-0'"
        >
          <p
            class="text-sm font-medium"
            :class="step.locked ? 'text-muted' : 'text-ink'"
          >
            <!-- The state word, for a screen reader only. The marker carries it
                 visually with colour and a mark, and neither survives being
                 read aloud. -->
            <span v-if="statusWord(step)" class="sr-only"
              >{{ statusWord(step) }}. </span
            >{{ step.label }}
          </p>

          <!-- Done: the count, linking to the list rather than the create form
               — the useful next click on a finished step is "show me what I
               built".
               Locked: what has to happen first, naming the IMMEDIATE blocker
               rather than the step number. "After step 2" made the reader map a
               digit back onto a noun they had just read.
               Current: nothing. Its verb is the footer button, and a second
               line here would compete with it. -->
          <div class="pt-1.5">
            <SfereLinkArrow v-if="step.done" :to="listRoute(step.key)">{{
              countLabel(step)
            }}</SfereLinkArrow>
            <p v-else-if="step.locked" class="text-xs text-subtle"
              >Unlocks once you have {{ step.blockedBy }}</p
            >
            <p v-else class="text-xs font-medium text-sfere-brand-text"
              >Next up</p
            >
          </div>
        </div>
      </li>
    </ol>

    <!-- ONE call to action for the whole panel, not one per node. Only ever a
         single step is actionable — that is what the dependency order means —
         so a button on each node would be two disabled controls beside one live
         one, and a disabled button explains nothing (and cannot even be styled
         to, since Quasar's unlayered `[disabled]` rule makes
         `disabled:opacity-*` a dead class everywhere in this repo).
         `items-center` on the row is also what trips sfere.css's
         `[class~='items-center'] > p { margin: 0 }`, without which Quasar's
         phantom 16px would float this sentence 8px above the button beside
         it. -->
    <!-- STACKED BELOW `sm`, and that is a real narrow-width fix rather than
         tidiness. `min-w-0 flex-1` on the sentence next to a `shrink-0` button
         does not wrap the row — it hands the button its full width first and
         squeezes the text into whatever is left, which at 420px was about
         fourteen characters a line and six lines deep.
         `sfere-flush` is the documented opt-in for a container that spaces its
         own children with `gap`: in the mobile column `items-start` does not
         trip sfere.css's `items-center` paragraph reset, so Quasar's phantom
         16px would otherwise stack on top of the gap. -->
    <div
      v-if="current"
      class="sfere-flush mt-6 flex flex-col flex-nowrap! items-start gap-3 border-t border-sfere-line pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-x-6"
    >
      <p class="min-w-0 flex-1 text-sm text-muted">{{ current.description }}</p>
      <SfereButton class="shrink-0" :to="current.to">{{
        ctaLabel
      }}</SfereButton>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'

const props = defineProps({
  // From useSetupProgress(). Passed in rather than called here so the Dashboard
  // owns one load cycle and this stays a dumb renderer.
  steps: { type: Array, default: () => [] },
  doneCount: { type: Number, default: 0 },
  total: { type: Number, default: 3 },
  complete: { type: Boolean, default: false },
  unavailable: { type: Boolean, default: false }
})

const emit = defineEmits(['dismiss'])

const LIST_ROUTES = {
  source: { name: 'sources' },
  destination: { name: 'destinations' },
  pipe: { name: 'pipes' }
}

// What each step produces, as the object of "you have __". Used for the locked
// line, so it names the record the reader is missing rather than a step index.
const NOUNS = {
  source: 'a source',
  destination: 'a destination',
  pipe: 'a pipe'
}

function listRoute(key) {
  return LIST_ROUTES[key] ?? { name: 'dashboard-home' }
}

function countLabel(step) {
  const noun = step.key === 'pipe' ? 'pipe' : step.key
  return `${step.count} ${noun}${step.count === 1 ? '' : 's'}`
}

// Done and locked only. The step in progress is announced by the `<li>`'s
// `aria-current="step"` and by its own visible "Next up" line, so a word here
// would be the third time a screen reader heard the same fact.
function statusWord(step) {
  if (step.done) return 'Done'
  return step.current ? '' : 'Locked'
}

// The three node states, in the same colour grammar the rest of the app uses
// for them: emerald for built, brand purple for the live edge of the work,
// neutral for not-yet. Same palette as SetupStepper's rungs and
// ProvisionedPipePanel's nodes, so the three pipeline surfaces do not each
// invent their own.
//
// LOCKED IS A DASHED BORDER, and that is the one state that has to be legible
// without colour: it pairs with the padlock and with the dashed wire feeding
// it, so "not available yet" survives being read by someone who cannot
// separate grey from green. It is deliberately not `disabled:opacity-*` —
// Quasar's unlayered `[disabled] { opacity: .6 }` makes that a dead class
// everywhere in this repo, and a marker is not a disabled control anyway.
function markerClasses(step) {
  if (step.done) return 'border-sfere-success bg-sfere-success text-white'
  if (step.current) {
    return 'border-sfere-brand-fill bg-sfere-brand-fill text-white shadow-sfere-btn'
  }
  return 'border-dashed border-sfere-line bg-sfere-surface text-subtle'
}

// `locked` and `blockedBy` are DERIVED HERE, not added to useSetupProgress.
// That composable is shared, and its three flags already contain this: a step
// that is neither done nor current is one the chain has not reached, and what
// blocks it is simply the step in front of it. Adding two fields there would be
// a second consumer contract earning nothing, and this component is documented
// as the dumb renderer.
const nodes = computed(() =>
  props.steps.map((step, i) => ({
    ...step,
    locked: !step.done && !step.current,
    blockedBy: i > 0 ? NOUNS[props.steps[i - 1].key] : null
  }))
)

const current = computed(() => nodes.value.find(s => s.current) ?? null)

// "Connect YOUR FIRST source" only on a genuinely empty workspace. It is the
// line the first-run EmptyState this panel replaced used to carry, and it is
// worth keeping for the one reader it is true of; from one source onwards the
// step's own neutral verb is the honest one.
const ctaLabel = computed(() => {
  if (!current.value) return ''
  return props.doneCount === 0 && current.value.key === 'source'
    ? 'Connect your first source'
    : current.value.cta
})

const headline = computed(() => {
  if (props.complete) return 'Your pipeline is live'
  // Deliberately NOT another "Let's …": on a brand-new workspace the page's
  // own <h1> is already "Let's get your activity data flowing", and two
  // first-person-plural exhortations stacked 40px apart read as a template
  // filling itself in. This one names the diagram underneath it instead.
  if (props.doneCount === 0) return 'Three steps to live data'
  // NOT the fraction again. The mono counter sits on the same line as this
  // heading, so "Almost there: 2 of 3 done" beside "2 / 3 DONE" was the same
  // number twice, 1000px apart. The counter measures; the heading says what it
  // means, which is how much is left.
  const left = props.total - props.doneCount
  if (left === 1) return 'One step to go'
  if (left === 2) return 'Two steps to go'
  return `${left} steps to go`
})

const blurb = computed(() => {
  if (props.complete) {
    return 'Events are being collected, routed and delivered. Everything below is the live picture.'
  }
  if (props.doneCount === 0) {
    // Ordered to match the diagram, left to right. It used to read "a source
    // captures it, a pipe moves it, a destination puts it to work" — correct
    // about the product and backwards against the rail directly beneath it,
    // which is the kind of mismatch a reader resolves by distrusting one of
    // the two.
    return 'Sfere turns raw activity into usable data: a source captures it, a destination is where it lands, and a pipe joins the two. Each step unlocks the next.'
  }
  return 'Each step unlocks the next, so there is only ever one thing to do.'
})
</script>

<style scoped>
/* THE TWO WIRE STATES.
   In the stylesheet rather than in arbitrary utilities because the dash runs
   down the rail on mobile and along it from `sm`, which means a different
   gradient axis, background-size and repeat direction per breakpoint — six
   `bg-[…]` literals in a class attribute for what is four lines of CSS.

   The track is exactly 1px in its cross axis (`w-px`, then `sm:h-px`), so a
   1px-wide repeating gradient fills it precisely and no background-position
   centring is needed. */
.rail-pending {
  background-image: linear-gradient(
    to bottom,
    var(--color-sfere-line) 0 5px,
    transparent 5px 10px
  );
  background-size: 1px 10px;
  background-repeat: repeat-y;
}

@media (min-width: 40rem) {
  .rail-pending {
    background-image: linear-gradient(
      to right,
      var(--color-sfere-line) 0 5px,
      transparent 5px 10px
    );
    background-size: 10px 1px;
    background-repeat: repeat-x;
  }
}
</style>
