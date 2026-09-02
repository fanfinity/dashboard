<template>
  <q-page class="p-6">
    <!-- The screen's real title, not a generic "Coming soon". You navigated to
         Audiences, so the page says Audiences and the pill carries the status —
         and scripts/smoke.mjs gets the non-empty <h1> it requires on every
         route, which is what lets the gate keep walking all 54 screens instead
         of being narrowed to the handful that are switched on. -->
    <PageHeader :title="title" :subtitle="subtitle">
      <template #actions>
        <StatusBadge tone="warn" label="Coming soon" />
      </template>
    </PageHeader>

    <EmptyState
      :title="`${featureLabel} isn't switched on yet`"
      :description="description"
    >
      <template #cta>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push('/settings')"
        >
          Open feature activation
        </button>
      </template>
    </EmptyState>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { FEATURES } from '@/config/features'

// Stands in for a screen whose module is switched off. MainLayout renders this
// INSTEAD OF <router-view>, so the real page component never mounts: no fetches,
// no console errors, and the URL is preserved — switch the module on and the
// same address renders the actual screen without a second navigation.
const props = defineProps({
  // Feature key from src/config/features.js — the screen's route meta.group.
  feature: { type: String, required: true },
  // The screen's own title from the manifest, so this reads as that screen
  // rather than as one shared dead end.
  title: { type: String, default: 'Coming soon' }
})

const router = useRouter()

const entry = computed(() => FEATURES.find(f => f.key === props.feature))

const featureLabel = computed(() => entry.value?.label ?? props.feature)

const subtitle = computed(
  () => entry.value?.description ?? 'This module is not switched on yet.'
)

const description = computed(
  () =>
    `The screen is already built into the app. It stays switched off until ${featureLabel.value} is ready. Turn it on under Settings → Feature activation to work on it, or leave it dark.`
)
</script>
