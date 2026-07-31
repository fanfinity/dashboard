<template>
  <FormField
    label="Refresh schedule"
    required
    :hint="presetHint"
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
    for="model-cron"
    :error="error"
    hint="Five fields: minute, hour, day of month, month, day of week. UTC."
  >
    <input
      id="model-cron"
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
import { SCHEDULE_PRESETS } from '@/composables/useWarehouseModels'

// How often a model re-runs its select.
//
// The model is the cron expression itself, not a preset id, so the page never
// has to reassemble one — "preset or custom" is presentation and stays in here.
// An empty expression means manual only, which is a real choice rather than an
// unset field: a model behind an expensive warehouse is often refreshed by hand.
const props = defineProps({
  // A five-field cron expression, or '' for manual-only.
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

const selectValue = computed(() => (isCustom.value ? CUSTOM : props.modelValue))

const presetHint = computed(() =>
  isCustom.value || props.modelValue
    ? 'Runs on the workspace clock, which is UTC.'
    : 'Nothing is scheduled — attributes over this model recompute only when you refresh it.'
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
