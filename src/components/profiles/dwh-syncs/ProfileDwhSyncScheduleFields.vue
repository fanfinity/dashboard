<template>
  <FormField
    label="Schedule"
    required
    hint="Runs on the workspace clock, which is UTC."
    :error="isCustom ? '' : error"
  >
    <q-select
      dense
      outlined
      emit-value
      map-options
      options-dense
      :model-value="selectValue"
      :options="options"
      class="bg-white"
      @update:model-value="onPreset"
    />
  </FormField>

  <FormField
    v-if="isCustom"
    label="Cron expression"
    required
    for="sync-cron"
    :error="error"
    hint="Five fields: minute, hour, day of month, month, day of week."
  >
    <input
      id="sync-cron"
      :value="modelValue"
      type="text"
      placeholder="0 3 * * *"
      class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
      @input="emit('update:modelValue', $event.target.value)"
    />
  </FormField>
</template>

<script setup>
import { computed, ref } from 'vue'
import FormField from '@/components/ui/FormField.vue'
import { SCHEDULE_PRESETS } from '@/composables/useProfileDwhSyncs'

// The cron picker for a DWH sync: named presets, with an escape hatch to a raw
// expression.
//
// The model is the cron string itself, not a preset id, so the page never has
// to reassemble one — "custom or not" is presentation and stays in here. A
// picked preset whose expression is then edited by hand stays in custom mode
// rather than snapping back to the preset's name.
const props = defineProps({
  // A five-field cron expression.
  modelValue: { type: String, default: '' },
  error: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const CUSTOM = '__custom__'

const options = [
  ...SCHEDULE_PRESETS.map(p => ({ value: p.value, label: p.label })),
  { value: CUSTOM, label: 'Custom cron expression…' }
]

// An expression that is not one of the presets can only have come from a custom
// entry, so the field opens in the mode that matches the value it was handed.
const isCustom = ref(
  Boolean(props.modelValue) &&
    !SCHEDULE_PRESETS.some(p => p.value === props.modelValue)
)

const selectValue = computed(() =>
  isCustom.value ? CUSTOM : props.modelValue || null
)

function onPreset(value) {
  if (value === CUSTOM) {
    // Keep whatever is in the box as the starting point for editing rather than
    // clearing it, which would fail validation before the user typed anything.
    isCustom.value = true
    return
  }
  isCustom.value = false
  emit('update:modelValue', value)
}
</script>
