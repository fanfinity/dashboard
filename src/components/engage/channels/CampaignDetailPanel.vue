<template>
  <CardPanel>
    <template #header>
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span class="truncate text-sm font-semibold text-ink">{{
          campaign.name
        }}</span>
        <StatusBadge :variant="status.variant" :label="status.label" />
      </div>
      <button
        type="button"
        class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:bg-fill"
        @click="emit('close')"
      >
        Close
      </button>
    </template>

    <div class="flex flex-col gap-5">
      <DefinitionList :items="facts" :columns="2">
        <template #value-audience="{ item }">
          <router-link
            :to="{ name: 'audiences' }"
            class="font-medium text-brand hover:underline"
            >{{ item.value }}</router-link
          >
        </template>

        <template #value-journey="{ item }">
          <router-link
            :to="{ name: 'journeys' }"
            class="font-medium text-brand hover:underline"
            >{{ item.value }}</router-link
          >
        </template>
      </DefinitionList>

      <div>
        <h3 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Delivery</h3
        >
        <p class="mt-1 text-xs text-muted"
          >Counted over the whole life of the campaign, not the last send.</p
        >
        <DefinitionList class="mt-3" :items="deliveryFacts" :columns="2" />
      </div>

      <div>
        <h3 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink"
          >Creative</h3
        >
        <p class="mt-1 text-xs text-muted"
          >Assets attached to this campaign. Images are not previewed here —
          nothing off this origin is loaded.</p
        >

        <!-- The asset catalog is SECONDARY to this screen: it names the
             creative, and its failure must not take the campaign with it. -->
        <LoadingState
          v-if="assetsLoading"
          class="mt-3"
          variant="table"
          :rows="2"
        />

        <ErrorState
          v-else-if="assetsError"
          class="mt-3"
          title="Couldn't load the asset catalog."
          :message="assetsError"
          @retry="emit('retry-assets')"
        />

        <EmptyState
          v-else-if="!attached.length"
          variant="inline"
          title="No creative attached"
          description="This campaign sends text only."
        />

        <ul v-else class="mt-3 flex flex-col divide-y divide-line">
          <li
            v-for="asset in attached"
            :key="asset.id"
            class="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
          >
            <div class="min-w-0">
              <p class="truncate text-sm text-ink">{{ asset.name }}</p>
              <p class="text-xs text-subtle">{{ asset.folderName }}</p>
            </div>
            <StatusBadge variant="neutral" :label="asset.type" />
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <p class="text-xs text-subtle"
        >Version {{ campaign.version }} · updated
        {{ formatDateTime(campaign.updatedAt) }}</p
      >
      <router-link
        :to="{ name: 'assets' }"
        class="text-xs font-medium text-brand hover:underline"
        >Asset library</router-link
      >
    </template>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { campaignStatus } from '@/composables/useEngageChannels'
import {
  formatCount,
  formatDateTime,
  formatPercent
} from '@/composables/useEngageChannelsFormat'

// The row a user clicked, opened out. There is no campaign detail route in the
// manifest, so the detail lives on the list screen rather than being invented
// as a route the router does not have.
const props = defineProps({
  campaign: { type: Object, required: true },
  assets: { type: Array, default: () => [] },
  assetsLoading: { type: Boolean, default: false },
  assetsError: { type: String, default: null }
})
const emit = defineEmits(['close', 'retry-assets'])

const status = computed(() => campaignStatus(props.campaign.status))

const attached = computed(() => {
  const ids = props.campaign.assetIds ?? []
  return ids.map(id => props.assets.find(a => a.id === id)).filter(Boolean)
})

const facts = computed(() => {
  const c = props.campaign
  return [
    { label: 'Subject', value: c.subject },
    {
      label: 'From',
      value: c.fromAddress ? `${c.fromName} <${c.fromAddress}>` : null
    },
    { label: 'Audience', value: c.audienceName },
    { label: 'Journey', value: c.journeyName },
    { label: 'Created', value: formatDateTime(c.createdAt) },
    { label: 'Last sent', value: formatDateTime(c.lastSentAt) }
  ]
})

const deliveryFacts = computed(() => {
  const c = props.campaign
  return [
    { label: 'Sent', value: formatCount(c.sentCount) },
    {
      label: 'Delivered',
      value: formatCount(c.deliveredCount),
      hint: formatPercent(c.deliveredRate) + ' of sent'
    },
    {
      label: 'Opened',
      value: formatCount(c.openCount),
      hint: formatPercent(c.openRate) + ' of delivered'
    },
    {
      label: 'Clicked',
      value: formatCount(c.clickCount),
      hint: formatPercent(c.clickRate) + ' of delivered'
    },
    {
      label: 'Bounced',
      value: formatCount(c.bounceCount),
      hint: formatPercent(c.bounceRate) + ' of sent'
    },
    {
      label: 'Unsubscribed',
      value: formatCount(c.unsubscribeCount),
      hint: formatPercent(c.unsubscribeRate) + ' of delivered'
    }
  ]
})
</script>
