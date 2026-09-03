<template>
  <FormField
    v-for="field in fields"
    :key="field.key"
    :label="field.label"
    :required="field.required"
    :hint="field.tooltip"
    :error="errors[field.key] || ''"
    :for-id="field.kind === 'switch' ? '' : `${idPrefix}-${field.key}`"
  >
    <q-toggle
      v-if="field.kind === 'switch'"
      dense
      :model-value="Boolean(modelValue[field.key] ?? field.default)"
      :label="field.label"
      class="text-sm text-ink"
      @update:model-value="set(field.key, $event)"
    />
    <select
      v-else-if="field.kind === 'select'"
      :id="`${idPrefix}-${field.key}`"
      :value="modelValue[field.key] ?? field.default ?? ''"
      class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none"
      @change="set(field.key, $event.target.value)"
    >
      <option
        v-for="option in field.options ?? []"
        :key="option.value"
        :value="option.value"
        >{{ option.label }}</option
      >
    </select>
    <textarea
      v-else-if="MULTILINE_KINDS.has(field.kind)"
      :id="`${idPrefix}-${field.key}`"
      :value="modelValue[field.key] ?? ''"
      :placeholder="field.placeholder"
      rows="4"
      autocomplete="off"
      class="rounded-lg border border-line2 bg-white px-2.5 py-2 text-sm text-ink outline-none placeholder:text-subtle"
      @input="set(field.key, $event.target.value)"
    />
    <input
      v-else
      :id="`${idPrefix}-${field.key}`"
      :value="modelValue[field.key] ?? field.default ?? ''"
      :type="INPUT_TYPES[field.kind] ?? 'text'"
      :placeholder="field.placeholder"
      :min="field.min"
      :max="field.max"
      autocomplete="off"
      class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
      @input="set(field.key, $event.target.value)"
    />
  </FormField>
</template>

<script setup>
import FormField from '@/components/ui/FormField.vue'

// Renders a destination type's config fields (src/config/destinationRegistry.js)
// as form controls on the create screen.
//
// Every registry entry ships a different `fields` array, so the create page
// cannot hard-code its inputs — the field `kind` drives the control here and
// the parsing in `formToConfig`. Values stay raw (one-per-line strings for
// `hosts`/`headers`, unparsed text for `json`); the shape conversion happens in
// `formToConfig` at submit time, which is also where an invalid-JSON error
// comes from.
const props = defineProps({
  // A registry entry's `fields` array.
  fields: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
  // { [fieldKey]: 'message' }
  errors: { type: Object, default: () => ({}) },
  // Prefix for the generated control ids, so a <label for> always points at
  // the right control.
  idPrefix: { type: String, default: 'destination-config' }
})
const emit = defineEmits(['update:modelValue'])

// `hosts` and `headers` are lists/maps on the wire but edited one-per-line;
// `json` and `textarea` are long text. All four want a textarea.
const MULTILINE_KINDS = new Set(['textarea', 'hosts', 'headers', 'json'])

const INPUT_TYPES = { password: 'password', number: 'number' }

// Never mutate the prop object — emit a fresh one so the parent owns the state.
function set(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
</script>
