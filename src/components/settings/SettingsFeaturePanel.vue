<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <NoticeBanner
      tone="info"
      title="These switches are local to this browser"
      :message="overrideMessage"
    />

    <CardPanel v-for="section in sections" :key="section.key">
      <template #header>
        <span class="text-sm font-semibold text-ink">{{ section.label }}</span>
        <StatusBadge
          tone="neutral"
          :label="`${section.activeCount} of ${section.items.length} on`"
        />
      </template>

      <ul class="flex flex-col divide-y divide-line">
        <li
          v-for="feature in section.items"
          :key="feature.key"
          class="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-sm font-medium text-ink">{{ feature.label }}</p>
              <StatusBadge
                :tone="feature.active ? 'success' : 'neutral'"
                :label="feature.active ? 'Active' : 'Coming soon'"
              />
              <!-- Says the change has not shipped: the committed default in
                   src/config/features.js still disagrees, so a teammate — or you
                   in another browser — sees the old state. -->
              <StatusBadge
                v-if="feature.isOverridden"
                tone="warn"
                label="This browser only"
              />
              <StatusBadge
                v-if="feature.locked"
                tone="neutral"
                label="Locked"
              />
            </div>
            <p class="mt-1 text-xs text-subtle">{{ feature.description }}</p>
            <p v-if="feature.locked" class="mt-1 text-xs text-subtle">
              Settings hosts this panel, so it cannot be switched off from
              inside it.
            </p>
          </div>

          <SfereToggle
            :model-value="feature.active"
            :disabled="feature.locked"
            :label="`${feature.active ? 'Deactivate' : 'Activate'} ${feature.label}`"
            @update:model-value="onToggle(feature, $event)"
          />
        </li>
      </ul>
    </CardPanel>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        :disabled="!overriddenCount"
        class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill disabled:opacity-50"
        @click="onReset"
      >
        Reset to shipped defaults
      </button>
      <p class="text-xs text-subtle">
        Clears every local override and goes back to what
        <code class="font-mono">src/config/features.js</code> ships.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'
import { useFeatures } from '@/composables/useFeatures'

// The switchboard for every module in the sidebar. Switching one on takes effect
// immediately — the nav row stops being inert and its routes render their real
// pages instead of ComingSoonPanel — because useFeatures holds module-level state
// that the layout reads from directly.
const $q = useQuasar()
const { features, overriddenCount, setActive, reset } = useFeatures()

// Two groups, because they answer different questions: "which of these can I use
// today" versus "which am I waiting on". Sorting by state instead would reshuffle
// the list under the user's cursor every time they flipped a switch. This list is
// the shipped-active top-level keys from src/config/features.js — keep it in sync
// whenever a module's `enabled` default flips, or a shipped module stays stuck in
// "Backlog modules" here even after it goes live everywhere else.
const CORE_KEYS = [
  'dashboard',
  'live-events',
  'sources',
  'destinations',
  'pipes',
  'settings',
  'warehouse',
  'monitoring',
  'profiles',
  'secrets',
  'authorizations',
  'team',
  'billing'
]

const sections = computed(() => {
  const core = features.value.filter(f => CORE_KEYS.includes(f.key))
  const rest = features.value.filter(f => !CORE_KEYS.includes(f.key))
  return [
    { key: 'core', label: 'CDP core', items: core },
    { key: 'backlog', label: 'Backlog modules', items: rest }
  ]
    .filter(section => section.items.length)
    .map(section => ({
      ...section,
      activeCount: section.items.filter(f => f.active).length
    }))
})

const overrideMessage = computed(() =>
  overriddenCount.value
    ? `${overriddenCount.value} module${overriddenCount.value === 1 ? '' : 's'} differ${overriddenCount.value === 1 ? 's' : ''} from the shipped defaults. To make a change permanent for everyone, flip its \`enabled\` flag in src/config/features.js.`
    : 'Everything matches the shipped defaults. Flipping a switch here turns a module on for you only. To ship it, flip its `enabled` flag in src/config/features.js.'
)

function onToggle(feature, value) {
  setActive(feature.key, value)
  $q.notify({
    message: `${feature.label} ${value ? 'activated' : 'switched off'}`,
    caption: 'This browser only. Edit src/config/features.js to ship it.',
    color: 'dark',
    timeout: 2500
  })
}

function onReset() {
  reset()
  $q.notify({
    message: 'Feature activation reset to shipped defaults',
    color: 'dark',
    timeout: 2500
  })
}
</script>
