<template>
  <!-- The last beat: what exists now, in three lines.

       THE ROWS ARE READ OFF THE RECORDS, not written here. The prototype prints
       "Website / ClickHouse / Created automatically" as static text; these name
       the source the reader created, the destination the backend provisioned and
       the pipeline joining them, because a summary screen that cannot be wrong is
       a summary screen that is not summarising anything. Where the lookup found
       nothing, the second and third rows say that instead of naming a warehouse
       nobody built.

       THE PROTOTYPE'S EIGHTH BEAT IS NOT HERE. "Waiting for your first event"
       came after this in the prototype, which is a whole screen doing the job of
       one clause: either an event has arrived — in which case waiting for it is
       absurd — or it has not, in which case the `verified` copy below says so in
       a sentence, on a screen that also tells the reader what exists. The beat
       before this one is where an event is actually checked for, and it can be
       returned to from the source's own Setup instructions tab afterwards. -->
  <!-- "SETUP COMPLETE" IS ABOUT THE SETUP, NOT ABOUT THE TRAFFIC. The source,
         its key, and — on a provisioning source type — the warehouse and the
         pipe all exist by the time this renders, whether or not anything has
         been sent yet. The lede is where traffic is spoken about, and it only
         claims arrival when `verified` says so. -->
  <div class="grid gap-8">
    <div class="flex justify-center">
      <StatusBadge tone="success" label="Setup complete" dot />
    </div>

    <FirstRunBeatHeader :headline="headline" :lede="lede" size="lg" />

    <div class="mx-auto grid w-full max-w-[38.75rem] gap-6">
      <NoticeBanner
        v-if="preview"
        tone="info"
        title="Nothing was saved"
        message="You are in Demo data mode. Switch to real data from Settings and run this again to create a source for your account."
      />

      <CardPanel :padded="false">
        <DefinitionList class="px-5 py-1" :items="items" :columns="1" />
      </CardPanel>

      <div class="flex justify-center">
        <SfereButton ref="ctaRef" @click="emit('finish')">{{
          copy.cta
        }}</SfereButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import FirstRunBeatHeader from '@/components/onboarding/FirstRunBeatHeader.vue'
import { FIRST_RUN_READY, readyLedeFor } from '@/config/firstRun'
import { NOT_SET } from '@/lib/emptyValue'
import { useConfetti } from '@/composables/useConfetti'

const props = defineProps({
  intent: { type: String, required: true },
  source: { type: Object, default: null },
  pipe: { type: Object, default: null },
  destination: { type: Object, default: null },
  provisioned: { type: Boolean, default: false },
  // Whether an event has actually been seen. The beat before this one lets a
  // reader through on a check that found nothing, so this beat must not assert
  // traffic on their behalf.
  verified: { type: Boolean, default: false },
  preview: { type: Boolean, default: false }
})

const emit = defineEmits(['finish'])

const copy = FIRST_RUN_READY

const headline = computed(() =>
  props.provisioned ? copy.headline : copy.unprovisioned.headline
)

const lede = computed(() =>
  readyLedeFor(props.intent, props.provisioned, props.verified)
)

const items = computed(() => [
  {
    label: copy.labels.source,
    value: props.source?.name || NOT_SET
  },
  {
    label: copy.labels.destination,
    // `NOT_SET`, never a bare dash and never "ClickHouse" as a hopeful default:
    // `src/lib/emptyValue.js` is the vocabulary for a missing value, and this one
    // is an optional thing nobody has set up yet rather than something unmeasured.
    value: props.provisioned
      ? props.destination?.name || 'Sfere Data Warehouse'
      : copy.unprovisioned.destinationValue
  },
  {
    label: copy.labels.flow,
    value: props.provisioned
      ? props.pipe?.name || copy.flowValue
      : copy.unprovisioned.flowValue
  }
])

// CELEBRATION GOES WHERE THE BACKEND HAS ALREADY MADE SOMETHING TRUE, which is
// the rule the two existing call sites follow. Here that is a provisioned chain
// on a real account: not Demo mode, where nothing was saved, and not the
// unprovisioned branch, where the reader is being told a destination is still
// missing — a burst over that sentence would be celebrating the absence.
//
// The canvas is `MainLayout`'s single `SfereConfetti`; nothing here mounts one.
// Under `prefers-reduced-motion` it draws nothing at all, which is safe because
// this screen states its result in words that stay on it.
const { fire } = useConfetti()
onMounted(() => {
  if (props.provisioned && !props.preview) {
    fire({ count: 120, origin: { x: 0.5, y: 0.45 } })
  }
})

const ctaRef = ref(null)
defineExpose({
  focusFirst: () => ctaRef.value?.$el?.focus?.({ preventScroll: true })
})
</script>
