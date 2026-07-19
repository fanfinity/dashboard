<template>
  <q-dialog v-model="open" @hide="onHide">
    <q-card style="width: 620px; max-width: 92vw" class="flex flex-col">
      <!-- Header -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5"
      >
        <span class="text-sm font-semibold text-ink">New dynamic segment</span>
        <q-btn flat round dense icon="close" size="sm" v-close-popup />
      </div>

      <q-card-section class="flex flex-col gap-5 overflow-y-auto">
        <!-- Name -->
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-subtle">Segment name</span>
          <input
            v-model="name"
            type="text"
            placeholder="e.g. Sign-up completers"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </div>

        <!-- Match mode -->
        <div class="flex items-center gap-3">
          <span class="text-xs font-medium text-subtle">Match</span>
          <div class="flex overflow-hidden rounded-lg border border-line2">
            <button
              v-for="m in matchModes"
              :key="m.value"
              class="px-3 py-1.5 text-xs font-medium"
              :class="
                match === m.value
                  ? 'bg-brand text-white'
                  : 'bg-white text-muted hover:bg-fill'
              "
              @click="match = m.value"
            >
              {{ m.label }}
            </button>
          </div>
          <span class="text-xs text-muted">of the following rules</span>
        </div>

        <!-- Rules -->
        <div class="flex flex-col gap-2">
          <div
            v-for="(rule, i) in rules"
            :key="i"
            class="flex items-center gap-2"
          >
            <q-select
              v-model="rule.field"
              dense
              outlined
              emit-value
              map-options
              options-dense
              :options="fieldOptions"
              style="min-width: 150px"
              class="bg-white"
            />
            <q-select
              v-model="rule.operator"
              dense
              outlined
              emit-value
              map-options
              options-dense
              :options="operatorOptions"
              style="min-width: 110px"
              class="bg-white"
            />
            <input
              v-if="needsValue(rule.operator)"
              v-model="rule.value"
              type="text"
              placeholder="value"
              class="h-9 flex-1 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
            />
            <div v-else class="flex-1" />
            <q-btn
              flat
              round
              dense
              icon="close"
              size="sm"
              :disable="rules.length === 1"
              @click="removeRule(i)"
            />
          </div>

          <button
            class="mt-1 flex w-fit items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 py-1.5 text-xs font-medium text-brand shadow-sm hover:bg-fill"
            @click="addRule"
          >
            <q-icon name="add" size="14px" /> Add rule
          </button>
        </div>

        <!-- Live preview -->
        <div class="rounded-xl border border-line2 bg-sidebar p-4">
          <p class="text-xs font-medium text-subtle">
            Matches in recent events
          </p>
          <div class="mt-2 flex gap-6">
            <div>
              <p class="text-2xl font-semibold tracking-[-0.5px] text-ink">
                {{ preview.fanCount.toLocaleString() }}
              </p>
              <p class="text-xs text-muted">fans</p>
            </div>
            <div>
              <p class="text-2xl font-semibold tracking-[-0.5px] text-ink">
                {{ preview.eventCount.toLocaleString() }}
              </p>
              <p class="text-xs text-muted">events</p>
            </div>
          </div>
          <p class="mt-2 text-xs text-subtle">
            Computed from {{ (events || []).length.toLocaleString() }} recently
            loaded events.
          </p>
        </div>
      </q-card-section>

      <!-- Footer -->
      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3"
      >
        <button
          class="rounded-lg border border-line2 bg-white px-3.5 py-1.5 text-sm font-medium text-muted hover:bg-fill"
          v-close-popup
        >
          Cancel
        </button>
        <button
          class="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          :disabled="!canSave"
          @click="save"
        >
          Create segment
        </button>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FIELDS, OPERATORS, countMatches } from '@/composables/useSegments'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  events: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'save'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const matchModes = [
  { value: 'all', label: 'ALL' },
  { value: 'any', label: 'ANY' }
]
const fieldOptions = FIELDS.map(f => ({ label: f.label, value: f.value }))
const operatorOptions = OPERATORS.map(o => ({ label: o.label, value: o.value }))

function needsValue(op) {
  return OPERATORS.find(o => o.value === op)?.needsValue !== false
}

const name = ref('')
const match = ref('all')
const rules = ref([newRule()])

function newRule() {
  return { field: 'type', operator: 'is', value: '' }
}
function addRule() {
  rules.value.push(newRule())
}
function removeRule(i) {
  rules.value.splice(i, 1)
}

// Reset the form each time the dialog opens.
watch(open, isOpen => {
  if (isOpen) {
    name.value = ''
    match.value = 'all'
    rules.value = [newRule()]
  }
})

const draft = computed(() => ({
  name: name.value,
  match: match.value,
  rules: rules.value
}))

const preview = computed(() => countMatches(props.events, draft.value))

const canSave = computed(
  () =>
    name.value.trim().length > 0 &&
    rules.value.every(
      r =>
        r.field &&
        r.operator &&
        (!needsValue(r.operator) || String(r.value).trim())
    )
)

function save() {
  if (!canSave.value) return
  emit('save', {
    name: name.value.trim(),
    match: match.value,
    // Clone rules and drop the value for value-less operators.
    rules: rules.value.map(r => ({
      field: r.field,
      operator: r.operator,
      value: needsValue(r.operator) ? String(r.value).trim() : ''
    }))
  })
  open.value = false
}

function onHide() {
  // nothing extra — form resets on next open
}
</script>
