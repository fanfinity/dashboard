<template>
  <q-page class="p-6">
    <PageHeader
      eyebrow="Account"
      title="Billing"
      subtitle="Plan, usage and invoices for this workspace. Visible to the Owner and Billing roles."
    >
      <template v-if="!apiMissing" #actions>
        <SfereButton variant="secondary" size="sm" @click="notReal('Invoices')"
          >Download all invoices</SfereButton
        >
        <SfereButton size="sm" @click="planOpen = true"
          >Change plan</SfereButton
        >
      </template>
    </PageHeader>

    <!-- 1. Loading -->
    <div v-if="showSkeleton" class="flex flex-col gap-4">
      <LoadingState variant="grid" :rows="3" />
      <LoadingState variant="table" :rows="5" />
    </div>

    <!-- 2. Error -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load billing."
      :message="error"
      @retry="load"
    />

    <!-- 3. No endpoint. Deliberately explicit: a billing screen that renders a
         zero looks like a credit, and a fabricated amount is worse. -->
    <EmptyState
      v-else-if="apiMissing"
      title="No billing API yet"
      description="Plan tiers, add-on pricing and the invoicing provider are not decided yet, so there is no endpoint behind this screen. Switch Settings → Data source to Demo data to review the agreed shape."
    >
      <template #cta>
        <SfereButton variant="secondary" :to="{ name: 'settings' }"
          >Open data source settings</SfereButton
        >
      </template>
    </EmptyState>

    <!-- 4. Populated -->
    <div v-else class="flex flex-col gap-5">
      <NoticeBanner
        tone="warn"
        title="Illustrative pricing"
        message="The tiers, add-on prices and invoice amounts below are placeholder shape for Product and Finance to react to. Nothing here is approved pricing, and no payment provider is connected."
      />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Current plan. The one spotlight card on this page. -->
        <CardPanel gradient-border class="lg:col-span-1">
          <SfereEyebrow label="Current plan" />
          <p class="mt-3 font-sfere-display text-2xl! font-bold! text-ink">{{
            plan?.name
          }}</p>
          <p class="mt-1 flex items-baseline gap-1">
            <span
              class="font-sfere-display text-3xl font-bold tabular-nums text-ink"
              >{{ plan?.priceLabel }}</span
            >
            <span class="text-sm text-muted">/{{ plan?.period }}</span>
          </p>
          <p class="mt-2 text-xs text-subtle"
            >Renews {{ formatDate(plan?.renewsOn, NOT_SET) }}</p
          >

          <dl class="mt-5 flex flex-col">
            <div
              v-for="item in plan?.includes ?? []"
              :key="item.label"
              class="flex items-center justify-between gap-3 border-t border-sfere-line py-2.5 first:border-t-0"
            >
              <dt class="min-w-0 flex-1 text-sm text-ink">{{ item.label }}</dt>
              <dd class="shrink-0 text-sm text-muted">{{ item.value }}</dd>
            </div>
          </dl>
        </CardPanel>

        <!-- Usage against the plan's ceilings — the number an Owner actually
             opens this page to check. -->
        <CardPanel class="lg:col-span-2">
          <template #header>
            <span class="text-sm font-semibold text-ink"
              >Usage this billing period</span
            >
            <p class="text-xs text-subtle"
              >Resets {{ formatDate(plan?.renewsOn, NOT_SET) }}</p
            >
          </template>

          <div class="flex flex-col gap-5">
            <!-- SfereProgress renders `label` itself, and uses it as the bar's
                 aria-label. A hand-rolled label row above it printed the name
                 twice, so the row underneath carries the numbers instead. -->
            <div v-for="meter in meters" :key="meter.key">
              <SfereProgress
                :value="meter.pct"
                :tone="meter.tone"
                :label="meter.label"
                show-value
              />
              <p
                class="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-subtle"
              >
                <span class="min-w-0 flex-1">{{ meter.note }}</span>
                <span class="shrink-0"
                  ><span class="font-medium tabular-nums text-ink">{{
                    meter.usedLabel
                  }}</span>
                  of {{ meter.limitLabel }} {{ meter.unit }}</span
                >
              </p>
            </div>
          </div>
        </CardPanel>
      </div>

      <!-- Add-ons -->
      <CardPanel>
        <template #header>
          <div>
            <span class="text-sm font-semibold text-ink">Add-ons</span>
            <p class="mt-0.5 text-xs text-muted"
              >Extra warehouse connections and retention beyond what the plan
              includes.</p
            >
          </div>
        </template>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div
            v-for="addOn in addOns"
            :key="addOn.id"
            class="flex flex-col rounded-sfere-lg border p-4"
            :class="
              addOn.active
                ? 'border-sfere-300 bg-sfere-50'
                : 'border-sfere-line bg-sfere-surface'
            "
          >
            <div class="flex items-start justify-between gap-2">
              <p class="min-w-0 flex-1 text-sm font-medium text-ink">{{
                addOn.name
              }}</p>
              <StatusBadge
                :tone="addOn.active ? 'success' : 'neutral'"
                :label="addOn.active ? 'Active' : 'Available'"
              />
            </div>
            <p class="mt-1.5 grow text-xs text-muted">{{
              addOn.description
            }}</p>
            <p class="mt-3 text-sm font-semibold text-ink"
              >{{ addOn.priceLabel
              }}<span class="text-xs font-normal text-muted"
                >/{{ addOn.period }}</span
              ></p
            >
            <div class="mt-3">
              <SfereButton
                :variant="addOn.active ? 'ghost' : 'secondary'"
                size="sm"
                block
                @click="notReal(addOn.name)"
                >{{ addOn.active ? 'Remove' : 'Add to plan' }}</SfereButton
              >
            </div>
          </div>
        </div>
      </CardPanel>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Invoices -->
        <CardPanel class="lg:col-span-2" :padded="false">
          <template #header>
            <span class="text-sm font-semibold text-ink">Invoices</span>
            <p class="text-xs text-subtle">{{ invoices.length }} on file</p>
          </template>

          <SfereTable :columns="invoiceColumns" :rows="invoices" row-key="id">
            <template #cell-issuedAt="{ row }">
              <span class="whitespace-nowrap text-ink">{{
                formatDate(row.issuedAt)
              }}</span>
            </template>
            <template #cell-amountLabel="{ row }">
              <span class="font-medium tabular-nums text-ink">{{
                row.amountLabel
              }}</span>
            </template>
            <template #cell-status="{ row }">
              <StatusBadge
                :tone="row.status === 'paid' ? 'success' : 'warn'"
                :label="row.status === 'paid' ? 'Paid' : 'Due'"
              />
            </template>
            <template #cell-actions="{ row }">
              <div class="flex justify-end">
                <SfereButton
                  variant="ghost"
                  size="sm"
                  @click="notReal(`Invoice ${formatDate(row.issuedAt)}`)"
                  >Download</SfereButton
                >
              </div>
            </template>
          </SfereTable>
        </CardPanel>

        <!-- Payment method -->
        <CardPanel>
          <template #header>
            <span class="text-sm font-semibold text-ink">Payment method</span>
          </template>

          <div
            class="flex items-center gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill p-4"
          >
            <span
              class="rounded-sfere-sm border border-sfere-line bg-white px-2 py-1 font-sfere-mono text-sfere-label font-bold text-ink"
              >{{ paymentMethod?.brand }}</span
            >
            <div>
              <p class="font-sfere-mono text-sm text-ink"
                >•••• {{ paymentMethod?.last4 }}</p
              >
              <p class="text-xs text-subtle"
                >Expires {{ paymentMethod?.expiry }}</p
              >
            </div>
          </div>

          <DefinitionList class="mt-4" :items="paymentFacts" :columns="1" />

          <div class="mt-4 flex gap-2">
            <SfereButton
              variant="secondary"
              size="sm"
              @click="notReal('Payment method')"
              >Update card</SfereButton
            >
            <SfereButton
              variant="ghost"
              size="sm"
              @click="notReal('Billing email')"
              >Change email</SfereButton
            >
          </div>
        </CardPanel>
      </div>
    </div>

    <!-- Plan comparison. Placeholder tiers, labelled as such. -->
    <q-dialog v-model="planOpen">
      <!-- Both width utilities carry the important suffix. Quasar ships an
           unlayered `.q-dialog__inner--minimized > div { max-width: 560px }`, so
           `w-[Npx]!` alone still renders at 560 and `max-w-full` (layered) loses
           to it as well. The max-width is the one that actually has to win, and
           it is a `min()` rather than a flat pixel value so the dialog still
           shrinks on a narrow window instead of overflowing it. -->
      <div
        class="w-[min(820px,92vw)]! max-w-[min(820px,92vw)]! rounded-sfere-xl border border-sfere-line bg-white p-6"
      >
        <h2 class="font-sfere-display text-lg! font-semibold! text-ink"
          >Plans</h2
        >
        <p class="mt-1 text-sm text-muted"
          >Placeholder tiers. Product and Finance have not signed off on names,
          limits or prices.</p
        >

        <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div
            v-for="tier in TIERS"
            :key="tier.name"
            class="flex flex-col rounded-sfere-lg border p-4"
            :class="
              tier.name === plan?.name
                ? 'border-sfere-300 bg-sfere-50'
                : 'border-sfere-line'
            "
          >
            <div class="flex items-center justify-between gap-2">
              <p class="min-w-0 flex-1 text-sm font-semibold text-ink">{{
                tier.name
              }}</p>
              <StatusBadge
                v-if="tier.name === plan?.name"
                tone="brand"
                label="Current"
              />
            </div>
            <p class="mt-2 font-sfere-display text-xl font-bold text-ink"
              >{{ tier.price
              }}<span class="text-xs font-normal text-muted">/mo</span></p
            >
            <ul class="mt-3 flex grow flex-col gap-1.5">
              <li
                v-for="line in tier.lines"
                :key="line"
                class="text-xs text-muted"
                >{{ line }}</li
              >
            </ul>
            <div class="mt-4">
              <SfereButton
                :variant="tier.name === plan?.name ? 'ghost' : 'secondary'"
                size="sm"
                block
                :disabled="tier.name === plan?.name"
                @click="notReal(tier.name)"
                >{{
                  tier.name === plan?.name ? 'Current plan' : 'Choose'
                }}</SfereButton
              >
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <SfereButton variant="secondary" @click="planOpen = false"
            >Close</SfereButton
          >
        </div>
      </div>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { NOT_KNOWN, NOT_SET } from '@/lib/emptyValue'
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereEyebrow from '@/components/ui/SfereEyebrow.vue'
import SfereProgress from '@/components/ui/SfereProgress.vue'
import SfereTable from '@/components/ui/SfereTable.vue'
import { formatUsage, useBilling } from '@/composables/useBilling'
import { formatDate } from '@/composables/useTeam'

const $q = useQuasar()

const {
  plan,
  usage,
  addOns,
  invoices,
  paymentMethod,
  loading,
  error,
  apiMissing,
  load
} = useBilling()

const loaded = ref(false)
const showSkeleton = computed(() => loading.value && !loaded.value)
const planOpen = ref(false)

const invoiceColumns = [
  { key: 'issuedAt', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'amountLabel', label: 'Amount' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '', align: 'right' }
]

// Placeholder tiers live here rather than in the fixture: they are a sales
// artefact, not workspace state, and the fixture describes one account.
const TIERS = [
  {
    name: 'Starter',
    price: '$99',
    lines: [
      '1M events / month',
      '50K resolved profiles',
      'ClickHouse warehouse included',
      'Up to 3 team members',
      '30-day retention'
    ]
  },
  {
    name: 'Growth',
    price: '$499',
    lines: [
      '10M events / month',
      '1M resolved profiles',
      'ClickHouse warehouse included',
      'Up to 10 team members',
      '90-day retention'
    ]
  },
  {
    name: 'Scale',
    price: 'Talk to us',
    lines: [
      'Unlimited events',
      'Unlimited profiles',
      'Any warehouse, no add-on fee',
      'Unlimited team members',
      '400-day retention'
    ]
  }
]

const meters = computed(() =>
  usage.value.map(m => {
    const pct = m.limit
      ? Math.min(100, Math.round((m.used / m.limit) * 100))
      : 0
    return {
      ...m,
      pct,
      usedLabel: formatUsage(m.used),
      limitLabel: formatUsage(m.limit),
      // Colour is a finding, not decoration: amber past 75%, red past 90%.
      tone: pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : 'brand',
      // The percentage is SfereProgress's own `show-value`, so the note says
      // what the number MEANS rather than repeating it.
      note:
        pct >= 90
          ? 'You will hit the ceiling before the period ends.'
          : pct >= 75
            ? 'Worth watching before the period ends.'
            : 'Comfortable.'
    }
  })
)

const paymentFacts = computed(() => [
  {
    label: 'Billing email',
    value: paymentMethod.value?.billingEmail ?? NOT_SET
  },
  { label: 'Provider', value: 'Not connected' }
])

function notReal(what) {
  $q.notify({
    message: `${what} is not wired up`,
    caption: 'There is no billing provider behind this screen yet.',
    color: 'dark',
    position: 'top-right'
  })
}

onMounted(async () => {
  await load()
  loaded.value = true
})
</script>
