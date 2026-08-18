<template>
  <ul v-if="items.length" class="flex flex-col">
    <li
      v-for="item in items"
      :key="item.id"
      class="flex items-start justify-between gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="truncate text-sm font-medium text-ink">{{
            item.title
          }}</span>
          <StatusBadge
            v-if="item.badge"
            :tone="item.badge.variant"
            :label="item.badge.label"
          />
        </div>
        <p v-if="item.meta" class="mt-0.5 truncate text-xs text-muted">{{
          item.meta
        }}</p>
      </div>
      <span
        v-if="item.right"
        class="shrink-0 whitespace-nowrap text-xs text-subtle"
        >{{ item.right }}</span
      >
    </li>
  </ul>

  <!-- A quiet sub-list, not a whole screen: EmptyState's default bordered card
       would nest inside the CardPanel that wraps every use of this component,
       so this is `inline`. It still carries data-smoke="empty", which the
       hand-rolled <p> it replaced did not. -->
  <EmptyState v-else variant="inline" :title="emptyText" />
</template>

<script setup>
import EmptyState from '@/components/ui/EmptyState.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// Shared row shape for the three short lists on the dashboard home: recent
// events, recent errors and recently updated profiles. Items are
// `{ id, title, meta?, right?, badge? }`; `badge` is `{ variant, label }` and is
// passed straight to StatusBadge.
defineProps({
  items: { type: Array, default: () => [] },
  emptyText: { type: String, default: 'Nothing yet.' }
})
</script>
