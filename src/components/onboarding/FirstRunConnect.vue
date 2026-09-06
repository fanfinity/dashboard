<template>
  <!-- Beat five: install Sfere, or — for a store — register the webhooks the
       grant made possible.

       IT RENDERS THE REAL INSTALL GUIDE. `SourceInstallGuide` is the component
       `/sources/new` step 3 and the source detail page's "Setup instructions"
       tab both render, narrowed per source type by `methodsForSource()`, with
       the real write key and the real snippets. That is the whole reason the
       arrival can own this beat at all: CLAUDE.md's old objection to porting it
       was that a second install guide would have to be kept in agreement with
       the first, and there is still only one.

       ITS VERIFICATION IS SWITCHED OFF HERE (`:verify="false"`), because the
       prototype makes confirmation its own beat and the guide would otherwise
       put a second, identical check on this screen — including its own confetti
       and its own success banner, one beat before the screen whose entire job is
       that check. -->
  <div class="grid gap-8">
    <FirstRunBeatHeader
      :eyebrow="copy.eyebrow"
      :headline="headline"
      :lede="lede"
    />

    <div class="mx-auto grid w-full max-w-[51.25rem] gap-4">
      <!-- Demo data mode. Said before anything else on the beat, because every
           snippet below it is real markup carrying a key that is not. -->
      <NoticeBanner
        v-if="preview"
        tone="info"
        title="Nothing was saved"
        message="You are in Demo data mode, so no source was created and the write key below is a placeholder. Switch to real data from Settings to create a source for your account."
      />

      <!-- The create is a real request, so it is a real wait. The prototype has
           no such state because it creates nothing. -->
      <CardPanel v-if="creating">
        <div class="flex flex-nowrap! items-center gap-3">
          <SfereSpinner :size="18" />
          <p class="min-w-0 flex-1 text-sfere-body text-sfere-fg-muted">{{
            copy.preparing
          }}</p>
        </div>
      </CardPanel>

      <!-- NOT AN `ErrorState`, deliberately. That component renders
           `data-smoke="error"`, which is the single selector `pnpm smoke:dist`
           fails a route on — and this surface sits on `/`, so an arrival that
           could render one would be an arrival that could fail the gate for the
           Dashboard. A banner says the same thing and carries the retry. -->
      <NoticeBanner
        v-else-if="createError"
        tone="danger"
        title="We could not create your source"
        :message="createError"
      >
        <SfereButton size="sm" variant="secondary" @click="emit('retry')"
          >Try again</SfereButton
        >
      </NoticeBanner>

      <template v-else-if="source">
        <!-- A store installs nothing: the grant happened on the beat before, and
             what is left is registering webhooks and running a first sync. That
             is `ZidSetupWizard`, the same component the source detail page
             renders, and it is the same reasoning as the install guide — one
             implementation, several entry points. -->
        <SallaSetupWizard
          v-if="isSalla"
          :source="source"
          @complete="emit('connected')"
        />
        <ZidSetupWizard
          v-else-if="isZid"
          :source="source"
          @complete="emit('connected')"
        />

        <SourceInstallGuide
          v-else
          :source="source"
          :preview="preview"
          :verify="false"
          @copy="onCopy"
        />

        <p
          v-if="devNote"
          class="sfere-flush border-t border-sfere-line pt-4 text-sfere-sm text-sfere-fg-muted"
        >
          <strong class="font-semibold text-sfere-fg">{{
            devNote.title
          }}</strong>
          {{ ' ' }}{{ devNote.body }}
        </p>
      </template>
    </div>

    <div
      class="mx-auto flex w-full max-w-[51.25rem] flex-wrap items-center justify-between gap-3"
    >
      <SfereButton
        ref="backRef"
        variant="secondary"
        size="sm"
        @click="emit('back')"
        >← Back</SfereButton
      >
      <!-- ENABLED EVEN BEFORE ANYTHING IS INSTALLED, on purpose. The next beat
           is the one that checks, and it checks for real — so gating this button
           on a claim nobody can verify from here would only stop the reader
           reaching the screen that would tell them the truth. -->
      <SfereButton :disabled="!source" @click="emit('advance')">{{
        installsNothing ? copy.ctaConnected : copy.cta
      }}</SfereButton>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereSpinner from '@/components/ui/SfereSpinner.vue'
import SourceInstallGuide from '@/components/sources/SourceInstallGuide.vue'
import ZidSetupWizard from '@/components/sources/ZidSetupWizard.vue'
import SallaSetupWizard from '@/components/sources/SallaSetupWizard.vue'
import FirstRunBeatHeader from '@/components/onboarding/FirstRunBeatHeader.vue'
import {
  FIRST_RUN_CONNECT,
  connectCopyFor,
  devNoteFor
} from '@/config/firstRun'

const props = defineProps({
  intent: { type: String, required: true },
  // The created source, camelCase, carrying `writeKey` and a re-attached
  // `templateId`. Null while the create is in flight or after it failed.
  source: { type: Object, default: null },
  preview: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  createError: { type: String, default: '' }
})

const emit = defineEmits(['advance', 'back', 'retry', 'connected'])

const $q = useQuasar()
const copy = FIRST_RUN_CONNECT

const headline = computed(() => connectCopyFor(props.intent).headline)
const lede = computed(() => connectCopyFor(props.intent).lede)
const devNote = computed(() => devNoteFor(props.intent))

const isZid = computed(() => props.source?.sourceType === 'zid')
const isSalla = computed(() => props.source?.sourceType === 'salla')
const installsNothing = computed(() => isZid.value || isSalla.value)

// THE GUIDE DOES NOT TOUCH THE CLIPBOARD, its host does — so a page can decide
// whether a copied write key deserves a toast, and no component below this can
// log a credential on its own. Same handler as `SourceCreatePage`'s.
async function onCopy({ label, value }) {
  try {
    await navigator.clipboard.writeText(value)
    $q.notify({ message: `${label} copied`, color: 'dark', timeout: 1500 })
  } catch {
    $q.notify({
      message: 'Copy failed',
      caption: 'Select the text and copy it by hand.',
      color: 'negative',
      timeout: 2500
    })
  }
}

const backRef = ref(null)
defineExpose({
  focusFirst: () => backRef.value?.$el?.focus?.({ preventScroll: true })
})
</script>
