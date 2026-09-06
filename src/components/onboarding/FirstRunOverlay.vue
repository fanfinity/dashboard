<template>
  <!-- Explicit fade in and out, rather than Quasar's default `scale`. The
       default hide is a transform-based scale-out running against a backdrop
       fading on its own curve, so for a frame a shrinking surface sits over
       already-visible page content. A fade moves nothing, so there is nothing to
       catch mid-flight, and 180ms is short enough that the click feels acted on
       rather than animated. -->
  <q-dialog
    :model-value="open"
    maximized
    persistent
    transition-show="fade"
    transition-hide="fade"
    :transition-duration="180"
  >
    <!-- FULL PAGE AND LIGHT, which is a reversal of what this file used to be.
         It shipped as an 860px dark card on the brand's ink canvas, defended in
         CLAUDE.md as the app's one deliberate dark dialog. Two things retired
         that. The prototype this is ported from is a full-viewport light flow on
         `--page`, and — the reason that reading is right — a dark card floating
         over a dimmed Dashboard says "this is a modal interrupting your work",
         which is exactly backwards on a first sign-in: there IS no work behind
         it yet, and the three beats are the only thing on screen worth reading.
         Taking the whole viewport is what makes it a place rather than an
         interruption.

         `maximized` IS WHAT MAKES THAT SAFE INSIDE A q-dialog. Quasar's
         unlayered `.q-dialog__inner--maximized > div` sets width, height and
         both maxima to 100% and zeroes the radius, so none of the three
         collisions the minimized branch causes apply here: no 560px cap to beat
         with `w-[…]! max-w-[…]!` (collision #3), and no 4px radius to beat with
         `rounded-sfere-xl!` (collision #8). Checked against `quasar.css` rather
         than assumed. What the dialog still buys is exactly what a hand-rolled
         `fixed inset-0` would have to reimplement: focus trap, scroll lock and
         the teleport to `<body>`.

         STILL AN OVERLAY, NEVER A ROUTE. A `/welcome` route would replace
         MainLayout, so `[data-smoke="nav"]` would never appear and
         `scripts/smoke.mjs` would fail at sign-in for all 51 routes rather than
         on one screen. The page beneath stays mounted the whole time, which is
         also what lets Home's counts fill in behind this.

         `persistent`: the ways out are the CTA, Back and Skip. A stray backdrop
         click that closed it without recording anything would bring it back on
         the next load looking like a bug. -->
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      aria-describedby="first-run-scope"
      class="first-run-page relative min-h-full w-full overflow-y-auto bg-sfere-bg"
    >
      <!-- The wordmark, top left, exactly where the app's own sits. It is the
           only thing on this surface that is not part of a beat, and it is what
           says which product the reader has landed in before they have seen a
           single screen of it.

           `h-6` DOES THE SIZING, not the `height` prop: that prop is inert
           app-wide because Tailwind preflight ships `img, video { height: auto }`
           in `@layer base` and the component only sets a `height` attribute,
           which any author rule beats. It stays for the intrinsic ratio. -->
      <div
        class="pointer-events-none absolute inset-x-0 top-0 px-6 py-5 sm:px-7"
      >
        <SfereLogo :height="24" class="h-6" />
      </div>

      <!-- SKIP IS PINNED TO THE CORNER, AND NOT ON THE WELCOME BEAT. The
           prototype shows it from the category beat onward and that is the right
           rule rather than an accident: on the welcome nothing has been asked,
           so the only thing a skip could mean there is "close the page I have
           read one sentence of". From the moment there is a question on screen
           there is something to postpone, and this is how you postpone it.

           IT PARKS, IT DOES NOT DISMISS. The record remembers which beat this
           was pressed on and the Dashboard offers the way back in. That reverses
           what `useOnboarding` used to do, and the reasoning is on the composable
           — briefly: nothing here reopens by itself, so the "modal people learn
           to click past" the old rule guarded against cannot happen.

           IT IS ON EVERY BEAT EXCEPT THE LAST, which is two departures from the
           prototype in opposite directions and both are deliberate.

           IT IS ON THE WELCOME, where the prototype hides it. That rule is right
           there and wrong here for a structural reason: its welcome has no
           application behind it, and ours covers a working Dashboard.
           `persistent` means no Esc and no backdrop dismiss, and Back from the
           category beat lands on the welcome — so under the prototype's rule the
           welcome held exactly one control and it pointed forwards. That is a
           trap, and it was reported as one.

           IT IS NOT ON `ready`, where the prototype also hides it, for the
           prototype's own reason: by then the source exists, events are arriving
           and the beat's own control already says "Go to dashboard". Offering to
           skip a setup that has finished is offering to skip nothing.

           `top-5 right-6` rather than the footer: a skip that moves between
           beats reads as a different control each time. -->
      <button
        v-if="step !== 'ready'"
        type="button"
        class="absolute right-6 top-5 z-10 rounded-sfere-lg border border-sfere-line bg-sfere-surface/95 px-3 py-2 text-sfere-xs font-semibold text-sfere-fg-muted shadow-sm transition-colors duration-200 hover:border-sfere-300 hover:bg-sfere-surface hover:text-sfere-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sfere-brand sm:right-7"
        @click="emit('skip')"
      >
        {{ skipLabel }}
      </button>

      <!-- `min-h-screen` plus centring is the prototype's `.onboarding`: the
           beats are short enough to sit in the middle of a tall window and long
           enough to scroll a short one, and the surface has to fill the viewport
           either way or the Dashboard shows through at the bottom.

           `py-20` rather than the prototype's 48px, because the wordmark and the
           skip control both sit inside that top strip and a 48px pad would run
           the first beat's eyebrow underneath them. -->
      <div
        class="flex min-h-screen w-full items-center justify-center px-6 py-20"
      >
        <!-- ONE PANEL, SWAPPED IN PLACE, never three dialogs. The wordmark, the
             canvas and the skip control stay continuous across the beats
             instead of closing one moment to open another, and `mode="out-in"`
             is what stops the two panels overlapping mid-swap and doubling the
             page height for a frame. -->
        <!-- EVERY BRANCH IS A PLAIN `<div>` WRAPPING THE BEAT, and that is a bug
             fix rather than markup for its own sake. A `<Transition>` child has
             to be a single ELEMENT vnode for the leave to run, and an SFC whose
             template opens with a comment does not render one: in dev the
             compiler keeps comments, so the component's root is a
             DEV_ROOT_FRAGMENT (comment + div), and unmounting a fragment root
             removes its nodes directly without ever running the element's leave
             hooks. Under `mode="out-in"` that is fatal rather than merely
             unanimated — `afterLeave` is what clears `isLeaving` and re-renders,
             so it never fired, and the surface rendered the empty placeholder
             comment and NOTHING ELSE. Reported as "I click the CTA and get a
             blank page": the wordmark and Skip are outside this transition, so
             they stayed, which is exactly what the screenshot showed.

             It is dev-only, which is why `pnpm build` and `pnpm smoke:dist` are
             both blind to it: a production build strips comments and each beat
             compiles to the single root it appears to have.

             FIXED HERE RATHER THAN BY MOVING THE THREE COMMENTS INSIDE THE THREE
             ROOTS. That works and re-arms itself: every SFC in this repo opens
             its template with a comment, so the next beat added — or anyone
             tidying one back to the house style — reinstates a blank screen with
             no error, no warning and nothing the smoke gate can see. A wrapper
             this file owns cannot be broken from another file.

             The interleaved comments BETWEEN the branches below are safe and
             stay: `v-else`/`v-else-if` resolution removes comment siblings, which
             is checked in the compiled output rather than assumed. -->
        <transition name="first-run-beat" mode="out-in" @enter="focusBeat">
          <div
            v-if="step === 'welcome'"
            key="welcome"
            class="w-full max-w-[56.25rem]"
          >
            <FirstRunWelcome ref="beatRef" @advance="emit('advance')" />
          </div>
          <div
            v-else-if="step === 'category'"
            key="category"
            class="w-full max-w-[56.25rem]"
          >
            <FirstRunCategory
              ref="beatRef"
              @choose="key => emit('choose', key)"
              @back="emit('back')"
            />
          </div>
          <!-- `v-else-if`, and the CATEGORY beat is the fallback rather than
               this one. As a bare `v-else` this branch caught every step value
               that was not 'welcome' or 'category', including a 'platform' with
               no category behind it — and `PLATFORM_CHOICES[undefined]` has no
               entry, so the beat rendered its own empty fallback: a blank
               surface with nothing on it but the wordmark and Skip, reported as
               exactly that. A beat that cannot answer its own question must fall
               back to the question that produces the answer, never to nothing. -->
          <div
            v-else-if="step === 'platform' && hasPlatformGroup"
            key="platform"
            class="w-full max-w-[56.25rem]"
          >
            <FirstRunPlatform
              ref="beatRef"
              :intent="intent"
              @choose="option => emit('choose-platform', option)"
              @back="emit('back')"
            />
          </div>
          <!-- The store grant. Guarded on a template the same way the platform
               beat is guarded on a group: an `authorize` step with nothing to
               authorize would render a panel that cannot resolve a provider, so
               it falls back to the question that produces one. -->
          <div
            v-else-if="step === 'authorize' && templateId"
            key="authorize"
            class="w-full max-w-[56.25rem]"
          >
            <FirstRunAuthorize
              ref="beatRef"
              :template-id="templateId"
              :store-id="storeId"
              @update:store-id="value => emit('update:storeId', value)"
              @advance="emit('advance')"
              @back="emit('back')"
            />
          </div>
          <div
            v-else-if="step === 'connect'"
            key="connect"
            class="w-full max-w-[56.25rem]"
          >
            <FirstRunConnect
              ref="beatRef"
              :intent="intent"
              :source="setupSource"
              :preview="setupPreview"
              :creating="setupCreating"
              :create-error="setupCreateError"
              @advance="emit('advance')"
              @back="emit('back')"
              @retry="emit('retry-create')"
              @connected="emit('connected')"
            />
          </div>
          <div
            v-else-if="step === 'verify'"
            key="verify"
            class="w-full max-w-[56.25rem]"
          >
            <FirstRunVerify
              ref="beatRef"
              :intent="intent"
              :checking="checking"
              :verified="verified"
              :check-result="checkResult"
              :last-checked-at="lastCheckedAt"
              :can-test-connection="canTestConnection"
              :testing="testing"
              :test-result="testResult"
              @check="checkEvents"
              @test="testConnection"
              @advance="emit('advance')"
              @back="emit('back')"
            />
          </div>
          <div
            v-else-if="step === 'setup'"
            key="setup"
            class="w-full max-w-[56.25rem]"
          >
            <FirstRunSetup
              ref="beatRef"
              :intent="intent"
              :state="provisioningState"
              :pipe="provisionedPipe"
              :destination="provisionedDestination"
              :preview="setupPreview"
              @advance="emit('advance')"
              @retry="discoverProvisioning"
            />
          </div>
          <div
            v-else-if="step === 'ready'"
            key="ready"
            class="w-full max-w-[56.25rem]"
          >
            <FirstRunReady
              ref="beatRef"
              :intent="intent"
              :source="setupSource"
              :pipe="provisionedPipe"
              :destination="provisionedDestination"
              :provisioned="provisioned"
              :verified="verified"
              :preview="setupPreview"
              @finish="emit('finish')"
            />
          </div>
          <div v-else key="category-fallback" class="w-full max-w-[56.25rem]">
            <FirstRunCategory
              ref="beatRef"
              @choose="key => emit('choose', key)"
              @back="emit('back')"
            />
          </div>
        </transition>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'
import FirstRunWelcome from '@/components/onboarding/FirstRunWelcome.vue'
import FirstRunCategory from '@/components/onboarding/FirstRunCategory.vue'
import FirstRunPlatform from '@/components/onboarding/FirstRunPlatform.vue'
import FirstRunAuthorize from '@/components/onboarding/FirstRunAuthorize.vue'
import FirstRunConnect from '@/components/onboarding/FirstRunConnect.vue'
import FirstRunVerify from '@/components/onboarding/FirstRunVerify.vue'
import FirstRunSetup from '@/components/onboarding/FirstRunSetup.vue'
import FirstRunReady from '@/components/onboarding/FirstRunReady.vue'
import { FIRST_RUN_SKIP, needsPlatformStep } from '@/config/firstRun'
import { useFirstRunSetup } from '@/composables/useFirstRunSetup'

// The arrival: what Sfere does, then where this account's customer activity
// happens, then which platform. Three beats on one full-page light surface,
// ported from the prototype.
//
// IT REPLACED PersonaQuestion.vue, and then it replaced its own dark self. The
// persona surface asked "what do you do?" and used the answer to reorder the
// sidebar and the dashboard; that ordering is gone (see CLAUDE.md) and with it
// the only thing the role decided. The dark-card version of THIS flow is what
// the light full-page one above replaces, and the reasoning is on the surface in
// the template.
//
// IT OWNS APPEARANCE AND EVERY DECISION IS STILL AN EMIT. `MainLayout` owns
// `useOnboarding`, decides what a category means, creates the source and
// navigates; nothing here chooses what happens next. The two pieces of behaviour
// that ARE here: focus, because focus belongs to whichever element actually
// swapped, and reading `useFirstRunSetup` for what the later beats DISPLAY.
//
// THAT READ IS DELIBERATE AND IT IS NOT A DECISION. Beats four to seven show a
// created source, an event count and a provisioning result — a dozen values that
// would otherwise be threaded MainLayout → here → beat as props, where a renamed
// field fails silently in the middle file. The composable is a module singleton
// for the same reason `useOnboarding` is, so both files read one object in the
// same tick. What stays on the layout is every branch: which beat follows which,
// what a category means, when a source gets created and where the reader lands.
//
// ALL SEVEN PROTOTYPE BEATS LIVE HERE NOW, which reverses what this comment used
// to say. It used to stop after three and hand off to `/sources/new`, defending
// that on the grounds that a second install guide and a second event checker
// would have to be kept in agreement with the first. The beats moved and the
// components did not: `FirstRunConnect` renders the real `SourceInstallGuide`,
// `FirstRunVerify` runs the same `listSourceEvents` check, and `FirstRunSetup`
// reads the real `useSourceProvisioning`. There is still exactly one of each.
const props = defineProps({
  open: { type: Boolean, default: false },
  // 'welcome' | 'category' | 'platform' | 'authorize' | 'connect' | 'verify' |
  // 'setup' | 'ready'. The layout advances it; this never advances itself,
  // because what happens between the beats is the layout's.
  step: { type: String, default: 'welcome' },
  // The category the later beats are about. Every beat from `connect` on words
  // its copy around it, so it is not only the platform beat's input.
  intent: { type: String, default: '' },
  // The platform beat's answer, as a source-template id. The authorize beat
  // needs it to know which provider's panel to render.
  templateId: { type: String, default: '' },
  // The granted store's id, read off the backend by the authorize beat's panel.
  // Empty means "not authorized yet".
  storeId: { type: String, default: '' }
})

// `advance` IS ONE EMIT FOR EVERY BEAT rather than one emit per beat, and the
// layout switches on the step it is currently showing. Seven named forward
// emits would put the beat order in two files, and the two would disagree the
// first time a beat was inserted.
const emit = defineEmits([
  'advance',
  'back',
  'choose',
  'choose-platform',
  'update:storeId',
  'retry-create',
  'connected',
  'finish',
  'skip'
])

// Read for display, never for decisions — see the note above. Destructured so
// the template gets Vue's top-level ref unwrapping: `setupSource` in a
// template works but reads like a leak, and every beat below binds several.
const {
  source: setupSource,
  preview: setupPreview,
  creating: setupCreating,
  createError: setupCreateError,
  checking,
  verified,
  checkResult,
  lastCheckedAt,
  canTestConnection,
  testing,
  testResult,
  checkEvents,
  testConnection,
  provisioningState,
  provisionedPipe,
  provisionedDestination,
  provisioned,
  discoverProvisioning
} = useFirstRunSetup()

const skipLabel = FIRST_RUN_SKIP

// Whether the platform beat has anything to ask. Checked HERE rather than
// trusted from the caller, because this component decides what renders and the
// cost of being wrong is a blank full-screen surface with no way to tell what
// happened.
const hasPlatformGroup = computed(() => needsPlatformStep(props.intent))

// FOCUS HAS TO BE MOVED BY HAND WHEN THE BEAT SWAPS, and this is a correctness
// fix rather than polish. The surface is `role="dialog" aria-modal="true"`, and
// Quasar focus-manages a q-dialog when it OPENS, not when its contents change —
// so the control someone just activated unmounts under their cursor and focus
// falls back to `<body>`. A keyboard or screen-reader user would answer and land
// nowhere, inside a modal.
//
// EACH BEAT NAMES ITS OWN FIRST CONTROL through `focusFirst`, rather than this
// file reaching for "the first button": the welcome wants its CTA and the two
// question beats deliberately want Back, so that an Enter held down from the
// previous beat cannot answer the next one.
const beatRef = ref(null)

function focusBeat() {
  beatRef.value?.focusFirst?.()
}

// THE SWAP ANNOUNCES ITSELF, IT IS NOT WAITED OUT ON A TICK COUNT. This used to
// be one watcher on `[step, open]` that awaited two `nextTick`s and then focused
// — and under `mode="out-in"` two ticks is nowhere near long enough. The
// incoming beat is not mounted until the OUTGOING one has finished leaving, 140ms
// and many ticks later, so `beatRef` was still null when the watcher ran, the
// optional chain swallowed it, and focus sat on `<body>` inside a modal: the
// exact failure this hand-rolled focus exists to prevent, failing silently.
// `@enter` on the transition fires when the new beat is actually in the DOM,
// which is the only moment this file can know about.
//
// THE WATCHER IS STILL NEEDED, for the first beat only. The dialog is not
// `appear`, so opening it mounts the welcome with no enter transition and
// therefore no hook to fire. Two ticks are right here — there is no leave to
// wait out, only Quasar's portal.
watch(
  () => props.open,
  async isOpen => {
    if (!isOpen) return
    await nextTick()
    await nextTick()
    focusBeat()
  },
  { immediate: true }
)
</script>

<style scoped>
/* The prototype's `fadeUp`. Scoped and named rather than a utility because a
   Vue `<transition>` needs the enter/leave class hooks, and this is the only
   place in the app that has them.

   `transform` and `opacity` only — both compositor properties, so the swap does
   not lay the page out twice on a beat that is a full screen tall. */
.first-run-beat-enter-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s ease;
}

.first-run-beat-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.first-run-beat-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.first-run-beat-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* The beats are a sequence somebody is reading, not feedback on an action, so
   an OS-level request for less motion should leave them still rather than
   faster. */
@media (prefers-reduced-motion: reduce) {
  .first-run-beat-enter-active,
  .first-run-beat-leave-active {
    transition: none;
  }
}
</style>
