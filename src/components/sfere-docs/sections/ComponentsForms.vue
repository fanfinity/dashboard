<template>
  <DocSection
    id="forms"
    eyebrow="Components"
    title="Forms"
    description="Every control is a real form element with appearance-none, not a div wearing a costume. Keyboard behaviour, mobile pickers, autofill and screen-reader semantics come free, and nothing about the Sfere look needed them replaced."
  >
    <DocSpecimen
      title="FormField + SfereInput"
      usage="The error message replaces the hint rather than stacking beneath it — two lines of guidance under one field is how a form starts to look frightening."
      code='<FormField label="Workspace name" for-id="ws" required hint="Shown in the tenant switcher.">
  <SfereInput id="ws" v-model="name" placeholder="Al Nassr FC" />
</FormField>'
    >
      <div class="grid max-w-2xl gap-5 sm:grid-cols-2">
        <FormField
          label="Workspace name"
          for-id="doc-ws"
          required
          hint="Shown in the tenant switcher."
        >
          <SfereInput id="doc-ws" v-model="name" placeholder="Al Nassr FC" />
        </FormField>

        <FormField label="Ingest key" for-id="doc-key" optional>
          <SfereInput id="doc-key" v-model="key" placeholder="key_live_…">
            <template #leading>
              <svg class="size-4" viewBox="0 0 256 256" fill="currentColor">
                <path
                  d="m209 81l-33 31l32 88l-24 24l-48-72l-24 24v24l-24 24l-16-40l-40-16l24-24h24l24-24l-72-48l24-24l88 32l31-33a24 24 0 0 1 34 34"
                  opacity="0.2"
                />
                <path
                  d="m185.33 114.21l29.14-27.43l.17-.16a32 32 0 0 0-45.26-45.26l-.16.17l-27.43 29.14l-83-30.2a8 8 0 0 0-8.39 1.86l-24 24a8 8 0 0 0 1.22 12.31l63.89 42.59L76.69 136H48a8 8 0 0 0-5.66 2.34l-24 24a8 8 0 0 0 2.5 13l40.06 16l16 40.05A8 8 0 0 0 84 236h.4a8 8 0 0 0 5.87-3.21l24-24A8 8 0 0 0 116 204v-28.69l14.87-14.87l42.61 63.9a8 8 0 0 0 12.31 1.22l24-24a8 8 0 0 0 1.86-8.39Z"
                />
              </svg>
            </template>
          </SfereInput>
        </FormField>

        <FormField
          label="Primary region"
          for-id="doc-region"
          hint="Where events are stored at rest."
        >
          <SfereSelect id="doc-region" v-model="region" :options="regions" />
        </FormField>

        <FormField
          label="Contact email"
          for-id="doc-email"
          error="That address is already in use."
        >
          <SfereInput id="doc-email" v-model="email" invalid type="email" />
        </FormField>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereTextarea"
      usage="Same border, radius and focus ring as the input; only the height differs. Vertical resize only — horizontal resize breaks every layout it is in."
    >
      <FormField
        label="Why are you requesting access?"
        for-id="doc-note"
        class="max-w-xl"
        hint="Two or three lines is plenty."
      >
        <SfereTextarea
          id="doc-note"
          v-model="note"
          placeholder="We run the fan app for…"
        />
      </FormField>
    </DocSpecimen>

    <DocSpecimen
      title="SfereToggle · SfereCheckbox"
      usage="A switch takes effect immediately; a checkbox takes effect on submit. Screen readers announce the difference, so picking the wrong one misreports what will happen."
      code='<SfereToggle v-model="live" label="Stream events live" />
<SfereCheckbox v-model="agreed" label="I have read the DPA" />'
    >
      <div class="flex flex-col gap-5">
        <div class="flex items-center gap-3">
          <SfereToggle v-model="live" label="Stream events live" />
          <span class="text-sfere-sm text-sfere-fg">
            Stream events live
            <span class="text-sfere-fg-muted">— applies immediately</span>
          </span>
        </div>

        <SfereCheckbox
          v-model="agreed"
          label="I have read the data processing agreement"
        />
        <SfereCheckbox :model-value="false" disabled label="Disabled option" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="On ink"
      on-dark
      usage="Every control takes on-dark. Set it on the field as well as the control, or the label stays black on black."
    >
      <div class="grid max-w-xl gap-5 sm:grid-cols-2">
        <FormField label="Work email" for-id="doc-dark-email" on-dark required>
          <SfereInput
            id="doc-dark-email"
            v-model="email"
            on-dark
            placeholder="you@club.com"
          />
        </FormField>
        <FormField label="Region" for-id="doc-dark-region" on-dark>
          <SfereSelect
            id="doc-dark-region"
            v-model="region"
            on-dark
            :options="regions"
          />
        </FormField>
        <div class="sm:col-span-2">
          <SfereCheckbox
            v-model="agreed"
            on-dark
            label="Send me the quarterly benchmark report"
          />
        </div>
      </div>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import { ref } from 'vue'
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import SfereCheckbox from '@/components/ui/SfereCheckbox.vue'
import FormField from '@/components/ui/FormField.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereSelect from '@/components/ui/SfereSelect.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'

// Local state so the specimens are genuinely interactive — a form documented
// with disabled inputs hides exactly the states worth reviewing.
const name = ref('Al Nassr FC')
const key = ref('')
const email = ref('salem@club.com')
const note = ref('')
const region = ref('me-central-1')
const live = ref(true)
const agreed = ref(false)

const regions = [
  { value: 'me-central-1', label: 'Middle East (Riyadh)' },
  { value: 'eu-west-1', label: 'Europe (Dublin)' },
  { value: 'us-east-1', label: 'US East (Virginia)' }
]
</script>
