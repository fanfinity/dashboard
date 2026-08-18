<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <NoticeBanner
      :tone="isReal ? 'warn' : 'info'"
      :title="isReal ? 'Real API data is on' : 'You are viewing demo data'"
      :message="noticeMessage"
    />

    <CardPanel>
      <template #header>
        <span class="text-sm font-semibold text-ink">Data source</span>
        <StatusBadge
          :tone="isReal ? 'warn' : 'neutral'"
          :label="isReal ? 'Real API' : 'Demo data'"
        />
      </template>

      <ul class="flex flex-col divide-y divide-line">
        <li class="flex flex-wrap items-start justify-between gap-3 py-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-ink">Use real API data</p>
            <p class="mt-1 text-xs text-subtle">
              Off reads every screen from the bundled mock JSON in
              <code class="font-mono">public/data/</code>, same as today. On
              calls the real backend instead — most modules don't have one yet,
              so those screens will show a load error until their endpoint
              ships.
            </p>
          </div>

          <SfereToggle
            :model-value="isReal"
            :label="`Switch to ${isReal ? 'demo' : 'real'} data`"
            @update:model-value="onToggle"
          />
        </li>
      </ul>
    </CardPanel>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'
import { useDataSource } from '@/composables/useDataSource'

// One global switch, not per-module like Feature activation — no domain has a
// real backend yet, so there is nothing for per-module granularity to control.
// The footer banner (DemoModeBanner) reads the same isMock this panel writes.
const $q = useQuasar()
const { isReal, setMode } = useDataSource()

const noticeMessage = computed(() =>
  isReal.value
    ? 'Screens without a real endpoint yet will show a load error instead of silently falling back to mock data — that is deliberate, so a missing backend is never mistaken for a working one.'
    : 'Nothing you do here is saved to a server. Switch this on once a screen has a real backend behind it.'
)

function onToggle(value) {
  setMode(value ? 'real' : 'mock')
  $q.notify({
    message: value ? 'Switched to real API data' : 'Switched to demo data',
    caption: value
      ? 'Screens without a live endpoint will show an error.'
      : 'Every screen reads from the bundled mock JSON again.',
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}
</script>
