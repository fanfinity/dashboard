<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="(dimension, i) in modelValue"
      :key="i"
      class="flex flex-col gap-2 rounded-lg border border-line2 bg-sidebar p-3 sm:flex-row sm:items-center"
    >
      <input
        :value="dimension.name"
        type="text"
        :placeholder="`e.g. ${placeholderFor(i)}`"
        :aria-label="`Dimension ${i + 1} name`"
        class="h-9 flex-1 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
        @input="patch(i, { name: $event.target.value })"
      />

      <q-select
        :model-value="dimension.type"
        dense
        outlined
        emit-value
        map-options
        options-dense
        :options="typeOptions"
        :aria-label="`Dimension ${i + 1} type`"
        class="w-full bg-white sm:w-44"
        @update:model-value="value => patch(i, { type: value })"
      />

      <q-toggle
        :model-value="dimension.isSingleValue"
        dense
        label="Single value"
        class="text-sm text-muted"
        @update:model-value="value => patch(i, { isSingleValue: value })"
      />

      <button
        type="button"
        :disabled="modelValue.length < 2"
        title="Remove this dimension"
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40"
        @click="removeAt(i)"
      >
        Remove
      </button>
    </div>

    <div>
      <button
        type="button"
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click="addRow"
      >
        Add dimension
      </button>
    </div>
  </div>
</template>

<script setup>
// The repeating part of the attribute form: every value the attribute writes
// onto the profile, with its type and whether it keeps one value or a list.
//
// A dumb component — props in, one event out. The parent owns the array, the
// validation and the option lists, so this file never imports a composable.
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  typeOptions: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

// Two hints, because the first dimension is nearly always the value itself and
// later ones are the context around it.
function placeholderFor(index) {
  return index === 0 ? 'value' : 'campaign_name'
}

function patch(index, changes) {
  emit(
    'update:modelValue',
    props.modelValue.map((d, i) => (i === index ? { ...d, ...changes } : d))
  )
}

function removeAt(index) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index)
  )
}

function addRow() {
  emit('update:modelValue', [
    ...props.modelValue,
    { name: '', type: 'string', isSingleValue: true }
  ])
}
</script>
