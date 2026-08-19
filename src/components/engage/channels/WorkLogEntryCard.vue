<template>
  <CardPanel>
    <template #header>
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span class="font-mono text-xs text-subtle">{{
          formatClock(entry.occurredAt)
        }}</span>
        <StatusBadge :tone="kind.variant" :label="kind.label" />
        <StatusBadge :tone="status.variant" :label="status.label" />
        <StatusBadge :tone="risk.variant" :label="risk.label" />
      </div>
      <span class="shrink-0 text-xs text-subtle">{{ entry.actorName }}</span>
    </template>

    <h3 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink">{{
      entry.title
    }}</h3>
    <p class="mt-1 text-sm leading-6 text-muted">{{ entry.summary }}</p>

    <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
      <span class="uppercase tracking-[0.4px]">{{ entry.entityType }}</span>
      <router-link
        v-if="entityTo"
        :to="entityTo"
        class="font-medium text-brand hover:underline"
        >{{ entry.entityName }}</router-link
      >
      <span v-else class="text-ink">{{ entry.entityName }}</span>
      <code class="font-mono text-subtle">{{ entry.entityId }}</code>
    </div>

    <!-- The outcome, once a human has given one. Rendered as a notice rather
         than another badge: a rejection reason is a sentence. -->
    <NoticeBanner
      v-if="entry.status === 'rejected'"
      class="mt-4"
      tone="warn"
      :title="`Rejected by ${entry.rejectedByName ?? 'a reviewer'}`"
      :message="entry.rejectionReason || 'No reason was recorded.'"
    />

    <p v-else-if="entry.approvedByName" class="mt-4 text-xs text-subtle"
      >Approved by {{ entry.approvedByName }}.</p
    >

    <template v-if="decidable" #footer>
      <p class="text-xs text-subtle"
        >Nothing is applied until this is approved.</p
      >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
          @click.stop="emit('reject', entry)"
        >
          Reject
        </button>
        <button
          type="button"
          class="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click.stop="emit('approve', entry)"
        >
          Approve
        </button>
      </div>
    </template>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import { riskLevel, workLogStatus } from '@/composables/useEngageChannels'
import { formatClock } from '@/composables/useEngageChannelsFormat'

// One entry in the operator's audit trail. Proposals still awaiting a decision
// carry the two buttons; everything else is a read-only record of what already
// happened, which is what an audit trail is for.
const props = defineProps({
  entry: { type: Object, required: true }
})
const emit = defineEmits(['approve', 'reject'])

const KINDS = {
  proposal: { label: 'Proposal', variant: 'brand' },
  action: { label: 'Action', variant: 'neutral' }
}

// The entity a row is about, linked to the list it lives on. There is no detail
// route for any of these in the manifest, so the link lands on the collection
// rather than on a route the router would fail to resolve.
const ENTITY_ROUTES = {
  campaign: 'channels-email',
  journey: 'journeys',
  audience: 'audiences',
  asset: 'assets'
}

const kind = computed(
  () =>
    KINDS[props.entry.kind] ?? {
      label: String(props.entry.kind ?? '—'),
      variant: 'neutral'
    }
)

const status = computed(() => workLogStatus(props.entry.status))
const risk = computed(() => riskLevel(props.entry.riskLevel))

const entityTo = computed(() => {
  const name = ENTITY_ROUTES[props.entry.entityType]
  return name ? { name } : null
})

const decidable = computed(
  () => props.entry.kind === 'proposal' && props.entry.status === 'pending'
)
</script>
