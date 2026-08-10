<template>
  <div
    class="flex flex-col gap-3 border-b border-sfere-line py-4 last:border-0 sm:flex-row sm:items-center sm:gap-6"
  >
    <div class="w-full shrink-0 sm:w-44">
      <p class="font-sfere-mono text-sfere-xs text-sfere-fg">{{ name }}</p>
      <p
        v-if="meta"
        class="mt-0.5 font-sfere-mono text-[0.6875rem] text-sfere-fg-muted"
      >
        {{ meta }}
      </p>
    </div>

    <div class="min-w-0 flex-1">
      <slot />
    </div>
  </div>
</template>

<script setup>
// Token name on the left, the thing it produces on the right. Used for the type
// scale, radii and shadows, where the value and its effect need to sit on the
// same line to be comparable.
defineProps({
  name: { type: String, required: true },
  meta: { type: String, default: '' }
})
</script>
