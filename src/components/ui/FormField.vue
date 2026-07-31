<template>
  <div class="flex flex-col gap-1">
    <label
      v-if="label"
      :for="props.for || undefined"
      class="text-xs font-medium text-subtle"
    >
      {{ label }}
      <span v-if="required" class="text-rose-500">*</span>
    </label>

    <slot />

    <p v-if="error" class="text-xs text-rose-500">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-subtle">{{ hint }}</p>
  </div>
</template>

<script setup>
// Label + control + hint/error triplet. The control itself is a slot, so a page
// can drop in a q-input, a q-select or the raw
// `h-9 rounded-lg border border-line2 …` input used by SegmentBuilderDialog.
// Label styling is lifted from that dialog's field labels; the error colour is
// the `text-rose-500` ContactsPage already uses for load failures.
//
// `for` is a JS keyword, so the template reads it off `props` explicitly.
const props = defineProps({
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  for: { type: String, default: '' }
})
</script>
