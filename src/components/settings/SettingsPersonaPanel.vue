<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <CardPanel>
      <template #header>
        <span class="text-sm font-semibold text-ink">Your role</span>
        <StatusBadge
          :tone="personaMeta ? 'brand' : 'neutral'"
          :label="personaMeta ? personaMeta.label : 'Not set'"
        />
      </template>

      <p class="mb-4 max-w-[70ch] text-sm text-muted">{{ scopeMessage }}</p>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectableCard
          v-for="option in personas"
          :key="option.key"
          :selected="persona === option.key"
          @select="onSelect(option)"
        >
          <div class="flex w-full items-start justify-between gap-2">
            <SfereIconChip size="sm">
              <PersonaIcon :persona="option.key" />
            </SfereIconChip>
            <StatusBadge
              v-if="persona === option.key"
              tone="brand"
              label="Selected"
            />
          </div>

          <p class="mt-3.5 text-sm font-semibold text-ink">{{
            option.label
          }}</p>
          <p class="mt-0.5 text-xs font-medium text-muted">{{
            option.cardTitle
          }}</p>
          <!-- The job, not the onboarding outcome and not the time estimate:
               those two answer "should I start the tour?", and by the time
               someone is in Settings changing their role the question is
               "which one of these is me?". -->
          <p class="mt-1.5 text-xs leading-5 text-muted">{{ option.job }}</p>
        </SelectableCard>
      </div>

      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- "Every screen stays where it is" was true when this answer only
               steered onboarding. It is not any more: the role sets the ORDER of
               the sidebar and what the Dashboard leads with, so a screen does
               move. What it still cannot do is remove one, which is the promise
               worth keeping and the one this sentence now makes. The question
               overlay's own footer says "stays IN THE SIDEBAR", which is still
               exactly right — that one does not need this edit. -->
          <p class="max-w-[64ch] text-xs text-subtle">
            It sets the order of the sidebar and what the dashboard leads with.
            Nothing is removed or locked: every screen your workspace has is
            still in the sidebar whichever you pick.
          </p>
          <button
            type="button"
            :disabled="!hasAnswered"
            class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
            @click="onAskAgain"
          >
            Ask me again
          </button>
        </div>
      </template>
    </CardPanel>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import PersonaIcon from '@/components/onboarding/PersonaIcon.vue'
import { useOnboarding } from '@/composables/useOnboarding'

// The other place the persona lives besides the onboarding question, so changing
// it never means re-running a tour. Same registry, same three cards, same marks —
// recognising the card you picked at sign-in matters more here than a
// settings-flavoured list of radio buttons would.
const $q = useQuasar()
const {
  personas,
  persona,
  personaMeta,
  skipped,
  hasAnswered,
  setPersona,
  askAgain
} = useOnboarding()

// Where the answer is kept, said out loud. The panel is one card rather than a
// NoticeBanner plus a card: a banner over a three-card picker is two boxes
// saying one thing, and the sentence belongs next to the choice it qualifies.
const scopeMessage = computed(() => {
  const where =
    'Your role is stored in this browser for your account. There is no backend to keep it in yet, so a different browser asks again.'
  if (skipped.value)
    return `You skipped the question, so nothing is tailored to you yet. ${where}`
  if (!persona.value) return `No role picked yet. ${where}`
  // Falls through to the storage sentence alone: the badge in the header already
  // names the role, so repeating it here would be the third time on one card.
  return where
})

function onSelect(option) {
  if (persona.value === option.key) return
  setPersona(option.key)
  $q.notify({
    message: `Your role is now “${option.label}”`,
    caption: 'This browser only. Nothing in the workspace changed.',
    color: 'dark',
    timeout: 2500
  })
}

function onAskAgain() {
  askAgain()
  $q.notify({
    message: 'Role cleared',
    caption: 'You will be asked again on the dashboard home.',
    color: 'dark',
    timeout: 2500
  })
}
</script>
