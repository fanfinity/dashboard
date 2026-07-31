<template>
  <q-dialog v-model="open">
    <q-card style="width: 440px; max-width: 92vw" class="flex flex-col">
      <!-- Header -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5"
      >
        <span class="text-sm font-semibold text-ink">{{ title }}</span>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </div>

      <q-card-section class="flex flex-col gap-3">
        <p v-if="message" class="text-sm text-muted">{{ message }}</p>
        <slot />
      </q-card-section>

      <!-- Footer -->
      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3"
      >
        <button
          v-close-popup
          class="rounded-lg border border-line2 bg-white px-3.5 py-1.5 text-sm font-medium text-muted hover:bg-fill"
        >
          {{ cancelLabel }}
        </button>
        <button
          class="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          :class="destructive ? 'bg-rose-600' : 'bg-brand'"
          @click="onConfirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'

// Yes/no dialog. Header, footer and both button treatments are lifted verbatim
// from SegmentBuilderDialog; only the destructive `bg-rose-600` swap is
// composed, using the same rose ramp as StatusBadge's danger variant.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  destructive: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

function onConfirm() {
  emit('confirm')
  open.value = false
}
</script>
