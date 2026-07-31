<template>
  <FormField
    v-for="field in fields"
    :key="field.key"
    :label="field.label"
    :required="field.required"
    :hint="field.description"
    :error="errors[field.key] || ''"
    :for="field.type === 'boolean' ? '' : `${idPrefix}-${field.key}`"
  >
    <q-toggle
      v-if="field.type === 'boolean'"
      dense
      :model-value="Boolean(modelValue[field.key])"
      :label="field.description || field.label"
      class="text-sm text-ink"
      @update:model-value="set(field.key, $event)"
    />
    <input
      v-else
      :id="`${idPrefix}-${field.key}`"
      :value="modelValue[field.key] ?? ''"
      type="text"
      :placeholder="field.placeholder"
      class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
      @input="set(field.key, $event.target.value)"
    />
  </FormField>
</template>

<script setup>
import { computed } from 'vue'
import FormField from '@/components/ui/FormField.vue'

// Renders a destination template's `paramsSchema` as form controls.
//
// The schema is a small JSON Schema object — `properties` plus a `required`
// array — and every template ships a different one, so the create screen cannot
// hard-code its fields. Only the two types the catalog actually uses are
// handled (string, boolean); anything else falls back to a text input rather
// than silently rendering nothing.
const props = defineProps({
  // A template's `paramsSchema`; null for a template that takes no params.
  schema: { type: Object, default: null },
  modelValue: { type: Object, default: () => ({}) },
  // { [paramKey]: 'message' }
  errors: { type: Object, default: () => ({}) },
  // Prefix for the generated control ids, so two of these on one page cannot
  // collide and a <label for> always points at the right control.
  idPrefix: { type: String, default: 'param' }
})
const emit = defineEmits(['update:modelValue'])

// 'event_source_id' -> 'Event source id'
function humanize(key) {
  const words = String(key).replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const fields = computed(() => {
  const properties = props.schema?.properties
  if (!properties) return []
  const required = props.schema.required || []
  return Object.entries(properties).map(([key, spec]) => ({
    key,
    label: humanize(key),
    type: spec?.type === 'boolean' ? 'boolean' : 'string',
    description: spec?.description || '',
    placeholder: spec?.type === 'boolean' ? '' : humanize(key),
    required: required.includes(key)
  }))
})

// Never mutate the prop object — emit a fresh one so the parent owns the state.
function set(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>
