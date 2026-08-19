<template>
  <CardPanel>
    <template #header>
      <span class="text-sm font-semibold text-ink">Authorized tokens</span>
      <StatusBadge tone="neutral" :label="String(tokens.length)" />
    </template>

    <LoadingState v-if="loading" variant="form" :rows="3" />

    <!-- Tokens are supporting detail on this screen: a failure here degrades
         this card and nothing else, so it keeps its own retry. -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load the API tokens."
      :message="error"
      @retry="emit('retry')"
    />

    <EmptyState
      v-else-if="!tokens.length"
      variant="inline"
      title="No token can read profiles"
      description="Issue a token with the profiles:read scope before pointing a client at these endpoints."
    />

    <ul v-else class="flex flex-col divide-y divide-line">
      <li
        v-for="token in tokens"
        :key="token.id"
        class="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="min-w-0 truncate text-sm font-medium text-ink">{{
            token.name
          }}</p>
          <button
            class="shrink-0 rounded-lg border border-line2 bg-white px-2.5 py-1 text-xs font-medium text-muted hover:bg-fill"
            @click="toggle(token.id)"
          >
            {{ revealed[token.id] ? 'Hide' : 'Reveal' }}
          </button>
        </div>

        <code
          class="truncate rounded-lg border border-line2 bg-sidebar px-2.5 py-1.5 font-mono text-xs text-ink"
          >{{ maskToken(token.tokenPreview, revealed[token.id]) }}</code
        >

        <p class="text-xs text-subtle"
          >Last used {{ formatDateTime(token.lastUsedAt) }}</p
        >
      </li>
    </ul>

    <template #footer>
      <p class="text-xs text-subtle"
        >Only the last four characters of a token are stored. Rotate one in
        Settings → API tokens.</p
      >
    </template>
  </CardPanel>
</template>

<script setup>
import { reactive } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { formatDateTime, maskToken } from '@/composables/useProfileApi'

// Which account tokens may actually call a Profile API endpoint. The page has
// already filtered to the `profiles:read` scope; this only renders.
defineProps({
  tokens: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null }
})
const emit = defineEmits(['retry'])

// Per-token reveal, keyed by id so opening one does not open the rest.
const revealed = reactive({})

function toggle(id) {
  revealed[id] = !revealed[id]
}
</script>
