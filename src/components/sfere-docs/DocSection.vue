<template>
  <section
    :id="id"
    class="scroll-mt-24 border-t border-sfere-line pt-12 first:border-0 first:pt-0"
  >
    <SfereEyebrow v-if="eyebrow" :label="eyebrow" class="mb-3" />

    <h2 class="font-sfere-display! text-sfere-h3! text-sfere-fg">{{
      title
    }}</h2>

    <p
      v-if="description"
      class="mt-3 max-w-3xl text-sfere-body text-sfere-fg-muted"
    >
      {{ description }}
    </p>

    <div class="mt-8 flex flex-col gap-10">
      <slot />
    </div>
  </section>
</template>

<script setup>
import SfereEyebrow from '@/components/sfere/SfereEyebrow.vue'

// One documented area of the system. `scroll-mt-24` keeps the heading clear of
// the sticky header when the table of contents jumps here.
defineProps({
  id: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, default: '' }
})
</script>
