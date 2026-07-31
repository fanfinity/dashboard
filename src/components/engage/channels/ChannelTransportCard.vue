<template>
  <CardPanel>
    <template #header>
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span class="truncate text-sm font-semibold text-ink">{{
          transport.label
        }}</span>
        <StatusBadge :variant="status.variant" :label="status.label" />
        <StatusBadge
          v-if="transport.isDefault"
          variant="brand"
          label="Default"
        />
        <StatusBadge
          v-if="!transport.isVerified"
          variant="warn"
          label="Unverified"
        />
      </div>
      <span class="shrink-0 text-xs text-subtle">{{
        providerLabel(transport.provider)
      }}</span>
    </template>

    <DefinitionList :items="facts" :columns="2" />

    <template #footer>
      <p class="text-xs text-subtle">{{ quotaHint }}</p>
      <button
        v-if="!transport.isDefault"
        type="button"
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
        @click.stop="emit('make-default', transport)"
      >
        Make default
      </button>
    </template>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { providerLabel, transportStatus } from '@/composables/useEngageChannels'
import {
  formatCount,
  formatDate,
  formatPercent,
  rate
} from '@/composables/useEngageChannelsFormat'

// One configured transport: who messages come from on this channel, whether it
// can actually send, and how much of today's allowance it has spent.
//
// There is no credential in the transport record — provider keys live in
// `/secrets` — so nothing here needs masking. The sender identity is the whole
// public face of the transport and is meant to be read.
const props = defineProps({
  transport: { type: Object, required: true }
})
const emit = defineEmits(['make-default'])

const status = computed(() => transportStatus(props.transport.status))

const facts = computed(() => {
  const t = props.transport
  return [
    { label: 'From name', value: t.fromName },
    {
      label: t.channel === 'email' ? 'From address' : 'Sender',
      value: t.fromAddress
    },
    { label: 'Reply-to', value: t.replyTo },
    {
      label: 'Daily allowance',
      value: t.dailyQuota === null ? null : formatCount(t.dailyQuota),
      hint: t.dailyQuota === null ? 'Set once the transport is verified.' : ''
    },
    { label: 'Sent today', value: formatCount(t.sentToday) },
    { label: 'Connected', value: formatDate(t.createdAt) }
  ]
})

// Quota use is a sentence rather than a bar: a transport at 6% of its allowance
// says nothing worth a chart, and one at 96% needs words.
const quotaHint = computed(() => {
  const t = props.transport
  const used = rate(t.sentToday, t.dailyQuota)
  if (used === null) return 'No daily allowance is set for this transport yet.'
  return `${formatPercent(used)} of today's allowance used (${formatCount(
    t.sentToday
  )} of ${formatCount(t.dailyQuota)}).`
})
</script>
