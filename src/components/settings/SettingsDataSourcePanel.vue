<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <NoticeBanner
      :tone="notice.tone"
      :title="notice.title"
      :message="notice.message"
    />

    <CardPanel>
      <template #header>
        <span class="text-sm font-semibold text-ink">Data source</span>
        <StatusBadge
          :tone="notice.tone === 'warn' ? 'warn' : 'neutral'"
          :label="activeOption.label"
        />
      </template>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectableCard
          v-for="option in options"
          :key="option.mode"
          :selected="mode === option.mode"
          @select="onSelect(option)"
        >
          <div class="flex w-full items-start justify-between gap-2">
            <span class="text-sm font-semibold text-ink">{{
              option.label
            }}</span>
            <StatusBadge
              v-if="mode === option.mode"
              tone="brand"
              label="Active"
            />
          </div>
          <p class="mt-1.5 text-xs leading-5 text-muted">{{
            option.description
          }}</p>
        </SelectableCard>
      </div>
    </CardPanel>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useDataSource } from '@/composables/useDataSource'

// Two states — see useDataSource.js. The footer banner (DemoModeBanner) and
// SettingsPage's tab label read the same `mode` this panel writes. "Real" is
// listed first because it is the default.
const $q = useQuasar()
const { mode, setMode } = useDataSource()

const options = [
  {
    mode: 'real',
    label: 'Real API',
    description:
      'Calls the Fanfinity backend with your account. Screens whose endpoint is still drafted show “No API yet”. The default.'
  },
  {
    mode: 'mock',
    label: 'Demo data',
    description:
      'Every screen reads the bundled mock JSON in public/data/ instead. Nothing is saved to a server, and every screen has data, which is what makes this the mode to demo in.'
  }
]

const activeOption = computed(
  () => options.find(o => o.mode === mode.value) ?? options[0]
)

const notice = computed(() => {
  if (mode.value === 'real')
    return {
      tone: 'info',
      title: 'Reading your real account',
      message:
        'The default. A screen whose endpoint is still drafted shows "No API yet" rather than silently falling back to mock data. That is deliberate, so a missing backend is never mistaken for a working one.'
    }
  return {
    // The unusual state now that real is the default, so it gets the badge.
    tone: 'warn',
    title: 'You are viewing demo data',
    message:
      'Nothing you do here is saved to a server, and what you see is the same fixture for everyone. Switch back to Real API to work with your own account.'
  }
})

function onSelect(option) {
  if (mode.value === option.mode) return
  setMode(option.mode)
  $q.notify({
    message: `Switched to ${option.label}`,
    caption: option.description,
    color: 'dark',
    timeout: 2500
  })
}
</script>
