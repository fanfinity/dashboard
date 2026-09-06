<template>
  <!-- Beat four, for store platforms only: the grant that has to happen before a
       source can exist at all.

       IT IS A BEAT HERE AND A FIELD ON `/sources/new`, which is not an
       inconsistency to tidy away. On the create form the template is settled
       halfway down a form, so growing a step the moment somebody picks Zid would
       be a wizard changing shape under them. Here the platform was settled a
       whole beat ago by a click that has already happened, so the grant is
       simply the next thing to do.

       IT ALSO HAS TO BE A BEAT: the backend answers
       `400 store_id is required for Zid sources`, and the id is READ off
       `…/zid-connections` rather than typed — so an un-granted store means there
       is no source to create, no write key to issue and therefore no install
       guide to show. Nothing after this beat can render until it is done. -->
  <div class="grid gap-8">
    <FirstRunBeatHeader
      :eyebrow="copy.eyebrow"
      :headline="copy.headline"
      :lede="copy.lede"
    />

    <div class="mx-auto w-full max-w-[51.25rem] grid gap-4">
      <!-- The real panel, not a copy of it. It owns the whole grant: reading
           back the connections, telling one authorised store from several, the
           "I've authorized" re-read (Zid returns the merchant to Zid's own
           dashboard, so nothing here can observe the handshake), and the
           `apiMissing` branch that still has to ask for an id because there is
           nowhere to read one off. Re-implementing any of that for the arrival
           would be a second answer to a question with one right answer. -->
      <SallaAuthorizePanel
        v-if="isSalla"
        :model-value="storeId"
        @update:model-value="onStoreId"
      />
      <ZidAuthorizePanel
        v-else
        :model-value="storeId"
        @update:model-value="onStoreId"
      />

      <!-- Says why the button below is dead, rather than leaving a dead button.
           The house rule is that every other problem on a form is a validation
           message on submit; this is the one control in the flow that cannot
           succeed if pressed, because the request it would make is refused by
           the backend, so it is disabled and the reason sits beside it. -->
      <p v-if="!storeId" class="text-sfere-sm text-sfere-fg-muted">
        {{ copy.blocked }}
      </p>
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
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sfere-sm text-sfere-fg-muted">{{ copy.hint }}</span>
        <SfereButton :disabled="!storeId" @click="emit('advance')"
          >Continue →</SfereButton
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import ZidAuthorizePanel from '@/components/sources/ZidAuthorizePanel.vue'
import SallaAuthorizePanel from '@/components/sources/SallaAuthorizePanel.vue'
import FirstRunBeatHeader from '@/components/onboarding/FirstRunBeatHeader.vue'
import { FIRST_RUN_AUTHORIZE } from '@/config/firstRun'

const props = defineProps({
  // 'zid' or 'salla'. Shopify is coming-soon and unpickable on the beat before,
  // so it never reaches this one.
  templateId: { type: String, required: true },
  // The granted store's id, read off the backend by the panel below. Empty means
  // "not authorised yet", which is the single signal the CTA reads.
  storeId: { type: String, default: '' }
})

const emit = defineEmits(['update:storeId', 'advance', 'back'])

const copy = {
  ...FIRST_RUN_AUTHORIZE,
  blocked:
    'Grant access above to continue. A store that has not authorized Sfere cannot send us any activity, so there is nothing to connect yet.'
}

const isSalla = computed(() => props.templateId === 'salla')

function onStoreId(value) {
  emit('update:storeId', value ?? '')
}

// Back, for the reason the two question beats focus Back: an Enter held down
// from the platform beat must not walk straight through a screen that is asking
// the reader to go and sign in somewhere else.
const backRef = ref(null)
defineExpose({
  focusFirst: () => backRef.value?.$el?.focus?.({ preventScroll: true })
})
</script>
