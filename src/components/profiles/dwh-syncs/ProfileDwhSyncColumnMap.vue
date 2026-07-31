<template>
  <FormField :label="label" :hint="hint" :error="error" :required="required">
    <EmptyState
      v-if="!items.length"
      variant="inline"
      :title="emptyTitle"
      :description="emptyDescription"
    />

    <div
      v-else
      class="divide-y divide-line overflow-hidden rounded-lg border border-line2 bg-white"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-start justify-between gap-3 px-3 py-2.5"
      >
        <div class="min-w-0">
          <q-toggle
            dense
            :model-value="selected.has(item.id)"
            :label="item.label"
            class="text-sm text-ink"
            @update:model-value="toggle(item.id)"
          />
          <p v-if="item.description" class="mt-1 pl-8 text-xs text-subtle">{{
            item.description
          }}</p>
        </div>

        <!-- The point of the row: what this becomes in the warehouse. -->
        <code
          class="shrink-0 rounded bg-fill px-1.5 py-0.5 font-mono text-xs text-muted"
          >{{ item.column }}</code
        >
      </div>

      <!-- Footer rather than a line under the box: below it, the count sits
           next to FormField's hint and the two read as one confused sentence. -->
      <div
        class="flex items-center justify-between bg-sidebar px-3 py-2 text-xs text-subtle"
      >
        <span>{{ modelValue.length }} of {{ items.length }} selected</span>
        <button
          v-if="modelValue.length"
          type="button"
          class="font-medium text-brand hover:underline"
          @click="emit('update:modelValue', [])"
        >
          Clear
        </button>
      </div>
    </div>
  </FormField>
</template>

<script setup>
import { computed } from 'vue'
import FormField from '@/components/ui/FormField.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

// Which profile fields a DWH sync writes, and what each one is called in the
// target table.
//
// Same shape as DestinationParamFields: the catalog drives the controls, so an
// attribute added to `attributes.json` appears here with no code change. The
// difference is that a param schema produces one control per key, while a
// column map produces one *row* per key — a toggle plus the column name it
// maps to — because the decision being made is inclusion, not a value.
//
// The rendered column name is derived by the caller (`columnName()` in
// useProfileDwhSyncs) rather than here: attributes and identifier types derive
// theirs differently, and this component should not know which it is showing.
const props = defineProps({
  // [{ id, label, column, description? }]
  items: { type: Array, default: () => [] },
  // Selected ids.
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  emptyTitle: { type: String, default: 'Nothing to map' },
  emptyDescription: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const selected = computed(() => new Set(props.modelValue))

// Never mutate the prop array — emit a fresh one so the parent owns the state.
// Order follows `items` rather than click order, so the payload preview and the
// warehouse column order match what the user is looking at.
function toggle(id) {
  const next = selected.value.has(id)
    ? props.modelValue.filter(v => v !== id)
    : [...props.modelValue, id]
  emit(
    'update:modelValue',
    props.items.map(i => i.id).filter(i => next.includes(i))
  )
}
</script>
