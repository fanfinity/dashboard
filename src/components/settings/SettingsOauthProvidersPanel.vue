<template>
  <CardPanel>
    <template #header>
      <span class="text-sm font-semibold text-ink">OAuth providers</span>
      <StatusBadge variant="neutral" :label="String(providers.length)" />
    </template>

    <LoadingState v-if="loading" variant="form" :rows="3" />

    <!-- The catalog is supporting detail on this screen: a failure here costs
         this panel and nothing else, so it keeps its own retry. -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load the provider catalog."
      :message="error"
      @retry="emit('retry')"
    />

    <EmptyState
      v-else-if="!providers.length"
      variant="inline"
      title="No providers available"
      description="An instance admin configures client credentials before a provider can be authorized."
    />

    <ul v-else class="flex flex-col divide-y divide-line">
      <li
        v-for="provider in providers"
        :key="provider.id"
        class="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate text-sm font-medium text-ink">{{
              provider.displayName
            }}</p>
            <StatusBadge
              :variant="provider.isConnected ? 'success' : 'neutral'"
              :label="provider.isConnected ? 'Connected' : 'Not connected'"
            />
          </div>
          <p class="mt-0.5 truncate font-mono text-xs text-subtle">{{
            formatScopes(provider.scopes)
          }}</p>
        </div>

        <button
          class="shrink-0 rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
          @click="emit('connect', provider)"
        >
          Authorize
        </button>
      </li>
    </ul>

    <template #footer>
      <p class="text-xs text-subtle"
        >Authorizing sends you to the provider to sign in and approve the scopes
        it asks for. Fanfinity stores the refresh token, never your password.</p
      >
    </template>
  </CardPanel>
</template>

<script setup>
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatScopes } from '@/composables/useSettingsAuthorizations'

// The third parties this instance can authorize against, each decorated by the
// page with whether a live grant already points at it. Presentation only — the
// page owns the connect flow and the toast.
defineProps({
  providers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null }
})
const emit = defineEmits(['retry', 'connect'])
</script>
