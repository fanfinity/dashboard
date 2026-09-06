<template>
  <!-- Beat six: has anything actually arrived?

       THIS IS THE ONE BEAT THE PROTOTYPE SIMULATES AND WE DO NOT. Its
       `checkWebsiteEvents()` waits 1100ms and then reports success unconditionally.
       Here the button asks the backend `listSourceEvents(page 1, size 1)` and
       reads `total` — the same question, with the same success test, as the check
       on `/sources/new` and on the source detail page. So "No events yet" is a
       real answer this screen can give, and the gate on the beat after it means
       something.

       "SEND A TEST EVENT" IS NOT HERE FOR EVERY SOURCE, and that is a deliberate
       gap. The dashboard cannot send an event — writing to a collector is the
       backend's job, the CSP names no collector host, and there is no ingestion
       path in this app at all — so a button with that label would report a test
       it never sent, which is the worst possible thing for a screen whose job is
       trust. A STORE source gets the honest version instead:
       `POST …/sources/{id}/test` asks whether the backend can reach the store,
       which is real, and it appears only where it does something. -->
  <div class="grid gap-8">
    <FirstRunBeatHeader
      :eyebrow="copy.eyebrow"
      :headline="copy.headline"
      :lede="lede"
    />

    <div class="mx-auto grid w-full max-w-[51.25rem] gap-4">
      <CardPanel>
        <template #header>
          <span class="text-sfere-sm font-semibold text-sfere-fg">{{
            copy.cardTitle
          }}</span>
          <StatusBadge :tone="statusTone" :label="statusLabel" dot />
        </template>

        <p class="text-sfere-sm text-sfere-fg-muted">{{ instruction }}</p>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <SfereButton
            :loading="checking"
            :disabled="checking"
            size="sm"
            @click="emit('check')"
            >{{ verified ? 'Check again' : copy.check }}</SfereButton
          >
          <SfereButton
            v-if="canTestConnection"
            variant="secondary"
            size="sm"
            :loading="testing"
            :disabled="testing"
            @click="emit('test')"
            >{{ copy.testConnection }}</SfereButton
          >
          <p v-if="lastCheckedAt" class="text-sfere-xs text-sfere-fg-muted"
            >Last checked {{ lastCheckedAt }}</p
          >
        </div>

        <!-- The event check's answer. Four shapes, because there are four
             genuinely different things that can have happened, and "no events
             yet" is NOT one of the failures — an install nobody has exercised is
             the ordinary state of this screen, so it reads as "not yet" and
             keeps the button live. -->
        <NoticeBanner
          v-if="checkResult"
          class="mt-4"
          :tone="checkResult.tone"
          :title="resultTitle"
          :message="resultMessage"
        />

        <!-- Kept apart from the event check rather than folded into it: "we can
             reach your store" and "an event has arrived" are different claims,
             and a green connection test standing in for an event that never came
             is exactly the false reassurance this beat exists to prevent. It
             therefore never sets `verified`. -->
        <NoticeBanner
          v-if="testResult"
          class="mt-4"
          :tone="testResult.tone"
          :title="
            testResult.ok
              ? 'We can reach your store'
              : 'We could not reach your store'
          "
          :message="
            testResult.message ||
            (testResult.ok
              ? 'The connection works. Activity will appear here once the store sends some.'
              : 'The authorization may need to be granted again from the previous step.')
          "
        />
      </CardPanel>
    </div>

    <div
      class="mx-auto flex w-full max-w-[51.25rem] flex-wrap items-center justify-between gap-3"
    >
      <SfereButton
        ref="backRef"
        variant="secondary"
        size="sm"
        @click="emit('back')"
        >{{ copy.back }}</SfereButton
      >
      <div class="flex flex-wrap items-center gap-3">
        <!-- Says why the reader is being let through without a green tick, so
             "Continue" after "No events yet" does not read as the gate having
             quietly given up. -->
        <span
          v-if="checkResult && !verified"
          class="text-sfere-sm text-sfere-fg-muted"
          >{{ copy.continueWithout }}</span
        >
        <SfereButton :disabled="!canContinue" @click="emit('advance')">{{
          copy.cta
        }}</SfereButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import FirstRunBeatHeader from '@/components/onboarding/FirstRunBeatHeader.vue'
import { FIRST_RUN_VERIFY, verifyCopyFor } from '@/config/firstRun'

const props = defineProps({
  intent: { type: String, required: true },
  checking: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  // { tone, state: 'found' | 'empty' | 'error' | 'preview', total?, message? }
  checkResult: { type: Object, default: null },
  lastCheckedAt: { type: String, default: '' },
  canTestConnection: { type: Boolean, default: false },
  testing: { type: Boolean, default: false },
  testResult: { type: Object, default: null }
})

const emit = defineEmits(['check', 'test', 'advance', 'back'])

const copy = FIRST_RUN_VERIFY

const lede = computed(() => verifyCopyFor(props.intent).lede)
const instruction = computed(() => verifyCopyFor(props.intent).instruction)

// THE GATE IS "YOU HAVE TO LOOK", NOT "AN EVENT MUST HAVE ARRIVED", and the
// difference is what keeps the last two beats reachable.
//
// The prototype's check reports success unconditionally after 1100ms, so its
// gate never has to answer this. Ours asks the backend, which means the honest
// answer on a brand-new account is usually "nothing yet" — the snippet has been
// copied but not deployed, or it has been deployed to a site with no traffic at
// this instant, or (the case the install beat's own dev-note names) the reader is
// not the person who can deploy it at all. Requiring a real event to proceed
// would strand every one of those readers on this screen, with the provisioned
// warehouse and pipe the create call ALREADY built sitting one beat away
// undisclosed.
//
// So one completed check unlocks it, whatever it found, and the banner keeps
// saying what was actually found. Nothing downstream claims an event arrived
// unless one did: `verified` travels to the last beat and words it.
const canContinue = computed(() => props.verified || Boolean(props.checkResult))

const statusTone = computed(() => {
  if (props.verified) return 'success'
  if (props.checking) return 'brand'
  return 'neutral'
})

const statusLabel = computed(() => {
  if (props.verified) return copy.statusFound
  if (props.checking) return copy.statusChecking
  return copy.statusWaiting
})

const resultTitle = computed(() => {
  const state = props.checkResult?.state
  if (state === 'found') return copy.confirmed.title
  if (state === 'empty') return copy.notYet.title
  if (state === 'preview') return 'Nothing to check in Demo data mode'
  if (state === 'unsupported') return 'No events to read yet'
  return 'Couldn’t run the check'
})

const resultMessage = computed(() => {
  const result = props.checkResult
  if (!result) return ''
  if (result.state === 'found') {
    // The count is the reassurance, so it is named rather than rounded into a
    // word. `total` is what the endpoint returned, not an estimate.
    const events = result.total === 1 ? '1 event' : `${result.total} events`
    return `${events} received so far. ${copy.confirmed.body}`
  }
  if (result.state === 'empty') return copy.notYet.body
  if (result.state === 'preview')
    return 'No source was created, so there is nothing that could have received an event. Continue to see the rest of the flow.'
  // Not a failure and not "we looked and found none" — there is nothing to look
  // in yet. Said as a state of the setup rather than of the request.
  if (result.state === 'unsupported')
    return 'This source does not have an event log yet — it starts collecting once the SDK runs for the first time. Your source and its key are ready, so you can continue and check back from the source screen later.'
  return result.message || 'The request failed.'
})

const backRef = ref(null)
defineExpose({
  focusFirst: () => backRef.value?.$el?.focus?.({ preventScroll: true })
})
</script>
