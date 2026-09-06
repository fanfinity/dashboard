<template>
  <!-- The way back into an arrival somebody parked.

       WHY IT EXISTS AT ALL. `Skip setup · Go to dashboard` used to be final:
       `useOnboarding.skip()` wrote the run off and nothing brought the beats
       back, on the stated grounds that "a modal that returns after being
       dismissed is the thing people learn to click past without reading". That
       is true of a modal that returns BY ITSELF, and nothing here does — this
       band is inert until it is pressed. What the old rule actually cost was the
       person who pressed Skip to have a look around first and then had no route
       back to the three screens that would have connected their data.

       WHY IT IS NOT A SECOND SETUP TRACKER. `SetupProgressPanel` below answers
       "how far is this workspace?" out of three live list reads, at 0, 1, 2 and
       3 of 3. This answers a different and narrower question — "you left the
       arrival part-way, here is the door back in" — and it is keyed on the
       onboarding record rather than on the count, so it is absent for everybody
       who never parked anything. The two are never the only thing on screen
       together for the same reason.

       IT IS NOT A `NoticeBanner`, DELIBERATELY. That primitive is for a state
       the app is reporting about your account right now, and it must not be
       dismissible. This is neither: it carries a button, it is about a thing the
       reader did rather than a thing the account is, and it removes itself when
       the arrival is finished or a source exists. Nor is it an `IntroBand` — that
       is editorial copy true of every account, and this is true of one. -->
  <div
    :class="[
      'sfere-flush mb-4 flex flex-nowrap! items-start justify-between gap-4 rounded-sfere-xl border p-4',
      pending
        ? 'border-sfere-warn/30 bg-sfere-warn-soft'
        : 'border-sfere-200 bg-sfere-50'
    ]"
  >
    <div class="flex min-w-0 flex-1 flex-nowrap! items-start gap-3">
      <!-- A NUMBER OR A BANG, not a decorative glyph. `1` on the untouched
           branch says the reader is at the first of a sequence; `!` on the
           half-answered one says something is outstanding. Both are
           `aria-hidden` — the sentence beside them says the same thing in
           words, and a screen reader announcing "1" before it is noise.

           `items-start`, never `items-center`: `sfere.css` ships an unlayered
           `[class~='items-center'] > p` rule because centring a row centres each
           child's MARGIN box, which drops a paragraph beside a chip eight pixels
           low. -->
      <span
        :class="[
          'grid size-[1.875rem] shrink-0 place-items-center rounded-sfere-lg text-sfere-sm font-bold',
          pending
            ? 'bg-sfere-warn/15 text-sfere-warn'
            : 'bg-sfere-100 text-sfere-brand-text'
        ]"
        aria-hidden="true"
        >{{ pending ? '!' : '1' }}</span
      >

      <div class="sfere-flush grid min-w-0 flex-1 gap-1">
        <p class="text-sfere-sm font-semibold text-sfere-fg">{{ title }}</p>
        <p class="text-pretty text-sfere-xs text-sfere-fg-muted">{{ body }}</p>
      </div>
    </div>

    <!-- `shrink-0` because the row is a Quasar-wrapping flex: without it a long
         title pushes the button onto a second line rather than squeezing the
         text (collision #4, and `min-w-0 flex-1` on the copy is the other half
         of the same fix). -->
    <SfereButton class="shrink-0" size="sm" @click="emit('resume')">{{
      cta
    }}</SfereButton>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import { intentByKey } from '@/config/sourceIntents'
import { PICKER_COPY } from '@/config/firstRun'

const props = defineProps({
  // The SOURCE_INTENTS key recorded before the arrival was parked, or null. Its
  // presence is what separates the two states: a category was chosen and the
  // platform question was not answered, versus nothing was chosen at all.
  intent: { type: String, default: '' }
})

const emit = defineEmits(['resume'])

const pending = computed(() => Boolean(props.intent))

// The category in the reader's own words, lower-cased for mid-sentence use.
// Falls back to the neutral noun rather than printing a raw key, so a record
// naming an intent that has since been removed degrades to a plainer sentence.
const categoryLabel = computed(() => {
  if (!props.intent) return 'source'
  const label =
    PICKER_COPY[props.intent]?.title ?? intentByKey(props.intent)?.title ?? ''
  return label ? label.toLowerCase() : 'source'
})

const title = computed(() =>
  pending.value
    ? `Finish connecting your ${categoryLabel.value}.`
    : 'Your workspace is ready. Connect your first source when you’re ready.'
)

// THE PROTOTYPE'S BODY COPY IS NOT REPEATED HERE, and the edit is a
// data-honesty one rather than a rewrite for its own sake. It said "Your Sfere
// Data Warehouse is already available and powered by ClickHouse", which is false
// on the account this band is shown to: the backend provisions a ClickHouse
// destination PER SOURCE, so at zero sources there is no warehouse yet. Saying
// it arrives WITH the first source is the same reassurance and is true — and it
// is the same correction the Destinations hero already carries.
//
// The pending branch drops "before Sfere activates the pipe" for the same
// reason: nothing has been created at this point, so there is no pipe waiting on
// anything.
const body = computed(() =>
  pending.value
    ? 'You picked a category but have not finished setup. Nothing has been created yet, so picking it back up starts where you left off.'
    : 'You paused setup before connecting a source. Your warehouse is provisioned with your first source, and Sfere covers its cost.'
)

const cta = computed(() =>
  pending.value ? 'Continue setup' : 'Connect a source'
)
</script>
