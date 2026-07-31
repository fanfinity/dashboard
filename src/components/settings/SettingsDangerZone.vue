<template>
  <div class="flex max-w-3xl flex-col gap-4">
    <NoticeBanner
      variant="warn"
      title="These actions are not reversible"
      message="Everything below removes data that no backup on your side can bring back. Read the confirmation carefully."
    />

    <NoticeBanner
      variant="danger"
      title="Purge raw event history"
      :message="purgeMessage"
    >
      <button
        class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        @click="emit('purge')"
      >
        Purge raw events
      </button>
    </NoticeBanner>

    <NoticeBanner
      variant="danger"
      title="Delete this workspace"
      :message="deleteMessage"
    >
      <button
        class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        @click="emit('delete')"
      >
        Delete workspace
      </button>
    </NoticeBanner>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'

// The danger zone. Every action here is styled destructive on purpose — these
// are the two buttons on the whole screen that a mis-click cannot be undone
// from, so they must not look like the rest.
//
// The page owns the ConfirmDialogs; this panel only asks.
const props = defineProps({
  workspaceName: { type: String, default: 'this workspace' },
  regionLabel: { type: String, default: '' }
})
const emit = defineEmits(['purge', 'delete'])

const purgeMessage =
  'Deletes every raw event collected so far. Resolved profiles survive, but nothing can be re-resolved or re-delivered from history afterwards.'

const deleteMessage = computed(
  () =>
    `Removes ${props.workspaceName}, its sources, pipes, destinations and every profile held${props.regionLabel ? ` in ${props.regionLabel}` : ''}. Members lose access immediately.`
)
</script>
