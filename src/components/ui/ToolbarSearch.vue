<template>
  <div
    class="flex h-9 w-full max-w-[280px] items-center gap-2 rounded-lg border border-line2 bg-white px-2.5 shadow-sm"
  >
    <img :src="icSearch" alt="" class="size-4 shrink-0" />
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
      @input="emit('update:modelValue', $event.target.value)"
    />
  </div>
</template>

<script setup>
import icSearch from '@/assets/dashboard/ic-search.svg'

// Search box for a PageHeader `actions` slot or a DataTable `toolbar` slot.
// Lifted verbatim from ContactsPage (ConnectorsPage is the same box at
// max-w-[320px]); 280px is the house width.
defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Search…' }
})
const emit = defineEmits(['update:modelValue'])
</script>
