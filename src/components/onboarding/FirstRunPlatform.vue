<template>
  <!-- Beat three: which platform, for the two categories that cover more than
       one.

       IT IS SKIPPED ENTIRELY WHERE IT WOULD HAVE ONE ANSWER. "Website" has only
       `web-sdk` behind it and "Something else" is not a template at all, so the
       shell sends both straight on. A screen asking a question with one option
       is a click that teaches the reader their answers do not matter. -->
  <div class="grid gap-8">
    <div
      class="sfere-flush mx-auto grid max-w-[42.5rem] justify-items-center gap-3 text-center"
    >
      <p
        class="font-sfere-mono text-sfere-eyebrow font-semibold uppercase text-sfere-brand-text"
        >{{ eyebrow }}</p
      >
      <h2
        id="first-run-title"
        class="text-balance text-sfere-h3! text-sfere-fg sm:text-sfere-h2!"
      >
        {{ group?.headline }}
      </h2>
      <p
        id="first-run-scope"
        class="text-pretty text-sfere-body text-sfere-fg-muted"
      >
        {{ group?.lede }}
      </p>
    </div>

    <div
      role="group"
      aria-labelledby="first-run-title"
      class="@container mx-auto w-full max-w-[56.25rem]"
    >
      <div
        class="grid grid-cols-1 gap-3.5 @min-[32rem]:grid-cols-2 @min-[46rem]:grid-cols-3"
      >
        <SelectableCard
          v-for="option in options"
          :key="option.key"
          :disabled="option.comingSoon"
          class="min-h-[8.4375rem] active:translate-y-px"
          :class="
            option.comingSoon &&
            'border-dashed! bg-sfere-fill! active:translate-y-0'
          "
          @select="emit('choose', option)"
        >
          <!-- One grid child, for the reason FirstRunCategory gives: the card's
               own root is a Quasar-wrapping flex column. -->
          <div
            class="sfere-flush grid h-full w-full grid-rows-[auto_1fr_auto] gap-2"
          >
            <p class="text-sfere-h4! text-sfere-fg">{{ option.title }}</p>
            <p class="text-pretty text-sfere-sm text-sfere-fg-muted">{{
              option.body
            }}</p>

            <!-- COMING SOON IS MARKED, NOT DIMMED. `disabled:opacity-*` is a
                 dead class everywhere in this repo — Quasar ships an unlayered
                 `[disabled] { opacity: .6; cursor: not-allowed }` that beats it
                 (collision #2) — so the state has to change something Quasar
                 does not set. A dashed border, a flat fill and a badge do that,
                 and they also survive being read without colour.

                 The card is a real `<button disabled>`, so it is out of the tab
                 order and Enter and Space are dead on it. That is the same
                 treatment `/sources/new` gives the same template, from the same
                 single switch: `COMING_SOON_TEMPLATE_IDS` in sourceIntents.js. -->
            <span v-if="option.comingSoon" class="justify-self-start">
              <StatusBadge tone="neutral" label="Coming soon" />
            </span>
          </div>
        </SelectableCard>
      </div>
    </div>

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
      <span class="text-sfere-sm text-sfere-fg-muted">{{ hint }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { FIRST_RUN_PLATFORM, PLATFORM_CHOICES } from '@/config/firstRun'
import { isTemplateComingSoon } from '@/config/sourceIntents'

const props = defineProps({
  // A SOURCE_INTENTS key that has an entry in PLATFORM_CHOICES. The shell only
  // shows this beat for one that does, so there is no empty branch here.
  intent: { type: String, required: true }
})

// `choose` carries the whole option, not just the template id: the shell records
// the id AND needs the key for the record, and passing the object keeps the two
// from being looked up twice against a registry that could change between them.
const emit = defineEmits(['choose', 'back'])

const eyebrow = FIRST_RUN_PLATFORM.eyebrow
const hint = FIRST_RUN_PLATFORM.hint

// A missing group is a shell bug, and it USED TO FALL BACK TO AN EMPTY SHAPE —
// `{ headline: '', lede: '', options: [] }` — on the reasoning that a beat with
// no cards is "visibly wrong and recoverable with Back". It is not: an empty
// headline, an empty lede and no cards render as a completely blank full-screen
// surface carrying only the wordmark and Skip, which is indistinguishable from
// the app having crashed and was reported as exactly that. There is no Back
// button on a blank screen either, because the footer renders inside the same
// panel.
//
// The overlay now refuses to mount this beat without a group at all (it shows
// the category question instead), so this is the second line of defence rather
// than the first. It throws loudly in dev and renders the category question's
// job — "pick again" — in production, instead of failing silently either way.
const group = computed(() => {
  const found = PLATFORM_CHOICES[props.intent]
  if (found) return found
  console.warn(
    `[FirstRunPlatform] no platform group for intent "${props.intent}" — ` +
      'this beat should not have been mounted; emitting back.'
  )
  return null
})

// Emitted rather than rendered, so a mount that should not have happened returns
// the reader to a screen that works instead of parking them on a broken one.
watchEffect(() => {
  if (!group.value) emit('back')
})

// Coming-soon is DERIVED from the shared switch, never authored here. The day
// Shopify's connector ships, deleting its id from COMING_SOON_TEMPLATE_IDS
// re-enables the card here, the intent on `/sources/new` and the submit, with no
// second list to find.
const options = computed(() =>
  (group.value?.options ?? []).map(option => ({
    ...option,
    comingSoon: isTemplateComingSoon(option.templateId)
  }))
)

const backRef = ref(null)
defineExpose({
  focusFirst: () => backRef.value?.$el?.focus?.({ preventScroll: true })
})
</script>
