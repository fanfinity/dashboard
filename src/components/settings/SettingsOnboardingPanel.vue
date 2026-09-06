<template>
  <CardPanel>
    <template #header>
      <span class="text-sm font-semibold text-ink">Onboarding</span>
      <StatusBadge :tone="statusTone" :label="statusLabel" />
    </template>

    <!-- `grid gap-*` rather than `flex flex-col gap-*`: Quasar's unlayered
         `.flex` wraps (collision #4), and `sfere-flush` kills the unlayered
         16px bottom margin every <p> carries (collision #5), which is what
         `gap-3` would otherwise be added on top of. -->
    <div class="sfere-flush grid gap-3">
      <p class="text-xs leading-5 text-muted"
        >Replays the three-beat welcome — what Sfere does, then where your
        customer activity happens — and hands the answers to the source create
        flow, exactly as it did the first time you signed up.</p
      >
      <p class="text-xs leading-5 text-muted"
        >It clears the category and platform recorded for your account and ends
        any walkthrough currently running. Nothing you have already created is
        touched: your sources, destinations and pipes are untouched, and the
        record lives in this browser only.</p
      >

      <div>
        <SfereButton variant="secondary" size="sm" @click="confirmOpen = true"
          >Restart onboarding</SfereButton
        >
      </div>
    </div>

    <!-- Its own dialog rather than SettingsPage's shared one, which is
         hardcoded `destructive`: nothing is deleted here. The copy names BOTH
         consequences, and the second one is the important half — this leaves
         Settings and opens a full-page persistent surface whose first beat has
         no skip control, so somebody expecting a preference toggle would find
         themselves somewhere they did not ask to be. -->
    <ConfirmDialog
      v-model="confirmOpen"
      title="Restart onboarding?"
      message="Your recorded category and platform are cleared, and you are taken to the Dashboard where the welcome opens over it. Answering it again is the way out; nothing you have created is affected."
      confirm-label="Restart onboarding"
      cancel-label="Keep it as it is"
      @confirm="restart"
    />
  </CardPanel>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import CardPanel from '@/components/ui/CardPanel.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import { SOURCE_INTENTS } from '@/config/sourceIntents'

// The way back into the arrival for somebody who has already answered it.
//
// The Dashboard's SetupResumeBand is the other door and the two are not the
// same door: that one is for a reader who PARKED the arrival part-way and is
// keyed on `paused`, so it is absent for everybody else. This is for anybody at
// any time — it re-arms the record rather than resuming it, which is why it
// warns that the recorded answers go.
//
// NO TOAST ON SUCCESS, deliberately. A toast is what the pause branch needs
// because nothing else on screen changes when it is pressed; here a full-page
// overlay appears over a different route, which is the acknowledgement.
const router = useRouter()
const { intent, paused, hasOnboarded, askAgain } = useOnboarding()

const confirmOpen = ref(false)

const intentLabel = computed(
  () => SOURCE_INTENTS.find(i => i.key === intent.value)?.title ?? ''
)

// What the record actually says, rather than a generic "Configured". A parked
// arrival is the one state with a second surface behind it (the Dashboard
// band), so it is worth telling apart from an answered one.
const statusLabel = computed(() => {
  if (paused.value) return 'Paused part-way'
  if (intentLabel.value) return intentLabel.value
  if (hasOnboarded.value) return 'Answered'
  return 'Not answered yet'
})

const statusTone = computed(() => {
  if (paused.value) return 'warn'
  return intent.value ? 'success' : 'neutral'
})

function restart() {
  askAgain()
  // Only `/` opens the arrival — MainLayout binds it to `route.path` so a deep
  // link from Slack is never met by it — so the control has to take you there.
  // A re-armed record on /settings would otherwise be an invisible no-op until
  // the next time somebody happened to visit Home.
  router.push('/')
}
</script>
