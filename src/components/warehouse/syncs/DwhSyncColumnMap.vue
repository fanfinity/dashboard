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
            :disable="Boolean(item.locked)"
            :label="item.label"
            class="text-sm text-ink"
            @update:model-value="toggle(item)"
          />
          <p v-if="item.description" class="mt-1 pl-8 text-xs text-subtle">{{
            item.description
          }}</p>
        </div>

        <!-- The point of the row: what this becomes in the warehouse. -->
        <div class="flex shrink-0 items-center gap-2">
          <StatusBadge v-if="item.locked" variant="neutral" label="Always" />
          <code
            class="rounded bg-fill px-1.5 py-0.5 font-mono text-xs text-muted"
            >{{ item.column }}</code
          >
        </div>
      </div>

      <!-- Footer rather than a line under the box: below it, the count sits
           next to FormField's hint and the two read as one confused sentence. -->
      <div
        class="flex items-center justify-between bg-sidebar px-3 py-2 text-xs text-subtle"
      >
        <span>{{ modelValue.length }} of {{ items.length }} selected</span>
        <button
          v-if="optionalSelected.length"
          type="button"
          class="font-medium text-brand hover:underline"
          @click="clearOptional"
        >
          Clear optional
        </button>
      </div>
    </div>
  </FormField>
</template>

<script setup>
import { computed } from 'vue'
import FormField from '@/components/ui/FormField.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// Which event-envelope fields a DWH sync writes, and what each is called in the
// target table.
//
// The profile packet's ProfileDwhSyncColumnMap does the same job for profile
// attributes; the difference here is `locked`. An event row is keyed on its id,
// type and timestamp — deselecting those produces a table nothing can be joined
// on — so those rows render disabled with an "Always" badge rather than being
// hidden, which would leave the user guessing what the table actually contains.
const props = defineProps({
  // [{ id, label, column, description?, locked? }]
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

const optionalSelected = computed(() =>
  props.items.filter(i => !i.locked && selected.value.has(i.id))
)

// Never mutate the prop array — emit a fresh one so the parent owns the state.
// Order follows `items` rather than click order, so the summary and the
// warehouse column order match what the user is looking at.
function emitIds(ids) {
  const wanted = new Set(ids)
  emit(
    'update:modelValue',
    props.items.map(i => i.id).filter(id => wanted.has(id))
  )
}

function toggle(item) {
  if (item.locked) return
  emitIds(
    selected.value.has(item.id)
      ? props.modelValue.filter(v => v !== item.id)
      : [...props.modelValue, item.id]
  )
}

function clearOptional() {
  emitIds(props.items.filter(i => i.locked).map(i => i.id))
}
</script>
