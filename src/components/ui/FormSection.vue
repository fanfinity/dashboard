<template>
  <CardPanel>
    <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink">{{
      title
    }}</h2>
    <p v-if="description" class="mt-1 text-xs text-muted">{{ description }}</p>
    <div class="mt-4 flex flex-col gap-4">
      <slot />
    </div>
  </CardPanel>
</template>

<script setup>
import CardPanel from '@/components/ui/CardPanel.vue'

// Grouping wrapper for a run of FormFields. The heading uses the same
// `text-sm! font-semibold! tracking-[-0.35px]!` treatment as the section titles
// on DashboardHomePage; note the Tailwind v4 important *suffix*, which is what
// beats Quasar's own h2 rules.
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' }
})
</script>
