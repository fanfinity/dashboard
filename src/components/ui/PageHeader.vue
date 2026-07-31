<template>
  <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink">{{
        title
      }}</h1>
      <p v-if="subtitle || $slots.subtitle" class="mt-1 text-sm text-muted">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
// Page title block. Class strings are lifted verbatim from the pre-existing
// ContactsPage/ConnectorsPage headers so new screens match the ones already
// shipped. Note the Tailwind v4 important *suffix* (`text-2xl!`) — it beats
// Quasar's own heading CSS; the `!text-2xl` prefix form does not work here.
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})
</script>
