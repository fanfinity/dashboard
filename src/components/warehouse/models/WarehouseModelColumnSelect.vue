<template>
  <FormField
    :label="label"
    :required="required"
    :error="error"
    :hint="hint"
    :for-id="options.length ? '' : id"
  >
    <q-select
      v-if="options.length"
      :model-value="modelValue"
      dense
      outlined
      emit-value
      map-options
      options-dense
      clearable
      :options="options"
      class="bg-white"
      @update:model-value="emit('update:modelValue', $event ?? '')"
    />

    <!-- No parsed columns to choose from (an unvalidated query, or a star the
         parse cannot expand), so the field falls back to typing the name. -->
    <input
      v-else
      :id="id"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="h-9 rounded-lg border border-line2 bg-white px-2.5 font-mono text-sm text-ink outline-none placeholder:text-subtle"
      @input="emit('update:modelValue', $event.target.value)"
    />
  </FormField>
</template>

<script setup>
import { computed } from 'vue'
import FormField from '@/components/ui/FormField.vue'

// One of a model's three mapped columns (primary key / identifier / timestamp).
//
// It picks its own control: a select while the query's columns are known, a
// text input while they are not. Three fields needed the same pair of branches,
// and inlining them three times on the create page buried the form.
const props = defineProps({
  modelValue: { type: String, default: '' },
  // From `parseModelColumns()` — only the named ones are selectable.
  columns: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  id: { type: String, default: '' },
  placeholder: { type: String, default: 'column_name' }
})
const emit = defineEmits(['update:modelValue'])

const options = computed(() =>
  props.columns.filter(c => c.name).map(c => ({ value: c.name, label: c.name }))
)
</script>
