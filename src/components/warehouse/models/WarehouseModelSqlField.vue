<template>
  <FormField
    label="Query"
    required
    for="model-query"
    :error="error"
    hint="One read-only select. It is stored as written and re-run on every refresh."
  >
    <div class="overflow-hidden rounded-lg border border-line2 bg-white">
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2"
      >
        <span class="font-mono text-xs text-subtle">{{ dialectLabel }}</span>
        <button
          type="button"
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click="emit('validate')"
        >
          Validate &amp; read columns
        </button>
      </div>

      <!-- There is no code-editor primitive and the CSP forbids loading one, so
           this is a plain textarea wearing the house tokens: mono type on the
           sidebar fill, no ring of its own. -->
      <textarea
        id="model-query"
        :value="modelValue"
        rows="10"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        :placeholder="placeholder"
        class="block w-full resize-y bg-sidebar px-3 py-2.5 font-mono text-sm leading-6 text-ink outline-none placeholder:text-subtle"
        @input="emit('update:modelValue', $event.target.value)"
      ></textarea>

      <div
        class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-subtle"
      >
        <span>{{ sizeLabel }}</span>
        <span
          >Fanfinity only reads — nothing is written back to the
          warehouse.</span
        >
      </div>
    </div>
  </FormField>
</template>

<script setup>
import { computed } from 'vue'
import FormField from '@/components/ui/FormField.vue'

// The SQL body of a warehouse model.
//
// Deliberately not a code editor: the repo has no editor primitive, and the CSP
// blocks pulling one off a CDN. A textarea styled with the house tokens keeps
// selection, undo and screen readers working, which a div-based highlighter
// would each have to re-implement.
//
// The component owns no validation. It emits `validate` and the page decides
// what that means, so the same field can sit on a future edit screen without
// carrying a second copy of the rules.
const props = defineProps({
  modelValue: { type: String, default: '' },
  error: { type: String, default: '' },
  // Shown in the header bar so the user knows which dialect they are writing.
  dialect: { type: String, default: 'SQL' },
  placeholder: {
    type: String,
    default:
      'select profile_id, order_total, ordered_at from FAN_PROD.PUBLIC.MERCH_ORDERS'
  }
})
const emit = defineEmits(['update:modelValue', 'validate'])

const dialectLabel = computed(() => `${props.dialect} · select only`)

const sizeLabel = computed(() => {
  if (!props.modelValue) return 'Empty — nothing to validate yet'
  const lines = props.modelValue.split('\n').length
  const chars = props.modelValue.length
  return `${lines} line${lines === 1 ? '' : 's'} · ${chars} character${chars === 1 ? '' : 's'}`
})
</script>
