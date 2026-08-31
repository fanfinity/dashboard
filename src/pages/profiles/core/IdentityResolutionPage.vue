<template>
  <q-page class="p-6">
    <PageHeader title="Identity resolution" :subtitle="subtitle">
      <template #actions>
        <router-link
          :to="{ name: 'profiles-search' }"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          >Search a fan</router-link
        >
        <button
          :disabled="loading"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="refresh"
        >
          {{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </template>
    </PageHeader>

    <!-- 1. Loading -->
    <div v-if="showSkeleton" class="flex flex-col gap-4">
      <LoadingState variant="grid" :rows="4" />
      <LoadingState variant="table" :rows="6" />
    </div>

    <!-- 2. Error — the rules are the primary resource; without them the screen
         has nothing to say. -->
    <ErrorState
      v-else-if="error"
      title="Couldn't load the identity rules."
      :message="error"
      @retry="refresh"
    />

    <!-- 3. Empty — no rules configured. A first run, not a fault. -->
    <EmptyState
      v-else-if="isEmpty"
      title="No identifier types configured"
      description="Identity resolution needs at least one identifier type (an email, a phone number, a browser cookie) before it can decide that two signals belong to the same fan. Connect a source and its identifier rules appear here."
    >
      <template #cta>
        <router-link
          :to="{ name: 'sources-new' }"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >Connect a source</router-link
        >
      </template>
    </EmptyState>

    <!-- 4. Populated -->
    <div v-else class="flex flex-col gap-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          v-for="stat in stats"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :hint="stat.hint"
        />
      </div>

      <NoticeBanner
        v-if="probabilisticMerges"
        tone="warn"
        title="Some fans were stitched on inferred signals"
        :message="probabilisticNotice"
      />

      <TabNav v-model="tab" :tabs="tabs" />

      <!-- Rules: what makes two identifiers the same fan. -->
      <template v-if="tab === 'rules'">
        <DataTable
          :columns="ruleColumns"
          :rows="rules"
          row-key="id"
          clickable-rows
          :per-page="10"
          empty-title="No identifier types configured"
          @row-click="row => (selectedRuleId = row.id)"
        >
          <template #cell-displayName="{ row }">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-ink">{{ row.displayName }}</span>
              <StatusBadge
                v-if="row.id === selectedRuleId"
                tone="brand"
                label="Viewing"
              />
            </div>
            <p class="font-mono text-xs text-subtle">{{ row.name }}</p>
          </template>

          <template #cell-rank="{ row }">{{ row.precedenceLabel }}</template>

          <template #cell-method="{ row }">
            <StatusBadge :tone="row.methodVariant" :label="row.method" />
          </template>

          <template #cell-coverageLabel="{ value }">
            <span class="text-ink">{{ value }}</span>
          </template>
        </DataTable>

        <IdentifierRuleDetail
          v-if="selectedRule"
          :rule="selectedRule"
          :facts="selectedRuleFacts"
        />
      </template>

      <!-- Merges: the evidence for each stitch those rules produced. -->
      <template v-else>
        <DataTable
          :columns="mergeColumns"
          :rows="merges"
          :error="profilesError"
          row-key="id"
          clickable-rows
          :per-page="10"
          empty-title="Nothing has been stitched yet"
          empty-description="Every fan on the graph still carries a single identifier, so no rule has had two signals to join. Merges appear here as soon as one does."
          @retry="loadProfiles"
          @row-click="row => (selectedMergeId = row.id)"
        >
          <template #cell-profileName="{ row }">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium text-ink">{{ row.profileName }}</span>
              <StatusBadge
                v-if="row.id === selectedMergeId"
                tone="brand"
                label="Viewing"
              />
            </div>
            <p class="font-mono text-xs text-subtle">{{ row.profileId }}</p>
          </template>

          <template #cell-joinedLabel="{ row }">
            <p class="text-ink">{{ row.joinedLabel }}</p>
            <p class="break-all font-mono text-xs text-subtle">{{
              row.joinedValue
            }}</p>
          </template>

          <template #cell-method="{ row }">
            <StatusBadge :tone="row.methodVariant" :label="row.method" />
          </template>

          <template #cell-confidence="{ row }">
            <div class="flex items-center justify-end gap-2">
              <StatusBadge :tone="row.verdictVariant" :label="row.verdict" />
              <span class="font-medium text-ink">{{ row.confidence }}%</span>
            </div>
          </template>

          <template #cell-joinedAtIso="{ row }">{{ row.joinedOn }}</template>
        </DataTable>

        <MergeEvidence v-if="selectedMerge" :merge="selectedMerge" />
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import DataTable from '@/components/ui/DataTable.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatCard from '@/components/ui/StatCard.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import IdentifierRuleDetail from '@/components/profiles/core/IdentifierRuleDetail.vue'
import MergeEvidence from '@/components/profiles/core/MergeEvidence.vue'
import { useProfilesIdentityResolution } from '@/composables/useProfilesIdentityResolution'

// The rules that decide when two identifiers belong to the same fan, and the
// evidence behind each merge they produced.
//
// NOT /identity-resolution (src/pages/IdentityResolutionPage.vue), which scores
// pairs of live event contacts against each other to guess that two anonymous
// visitors are one person. This screen explains the identifier-type rules a
// *resolved* profile was actually built with. Same idea, different subject —
// see the header comment on useProfilesIdentityResolution.js.

const {
  loading,
  error,
  load,
  profilesError,
  loadProfiles,
  rules,
  ruleFacts,
  findRule,
  merges,
  findMerge,
  stats,
  probabilisticMerges,
  isEmpty
} = useProfilesIdentityResolution()

const tab = ref('rules')
const selectedRuleId = ref('')
const selectedMergeId = ref('')

// The skeleton is for the first paint only — a manual refresh keeps the
// populated screen up rather than collapsing it back to grey bars.
const loaded = ref(false)
const showSkeleton = computed(() => loading.value && !loaded.value)

const subtitle =
  'The rules that decide when two identifiers belong to the same fan, and the evidence behind every merge they made.'

const probabilisticNotice = computed(
  () =>
    `${probabilisticMerges.value} identifier(s) joined a fan through a ` +
    'device-scoped rule rather than a declared key. Those are the merges to ' +
    'audit first: a shared browser or a recycled device looks exactly like ' +
    'one returning fan.'
)

const tabs = computed(() => [
  { key: 'rules', label: 'Matching rules', count: rules.value.length },
  { key: 'merges', label: 'Merge evidence', count: merges.value.length }
])

const ruleColumns = [
  { key: 'displayName', label: 'Identifier type', sortable: true },
  { key: 'rank', label: 'Precedence', sortable: true, width: '140px' },
  { key: 'limitLabel', label: 'Limit per fan', width: '150px' },
  { key: 'method', label: 'Matching', width: '160px' },
  {
    key: 'ruleCount',
    label: 'Rules',
    sortable: true,
    align: 'right',
    width: '100px'
  },
  { key: 'coverageLabel', label: 'Carried by', align: 'right', width: '130px' }
]

const mergeColumns = [
  { key: 'profileName', label: 'Fan', sortable: true },
  { key: 'joinedLabel', label: 'Identifier joined' },
  { key: 'method', label: 'Matching', width: '160px' },
  {
    key: 'confidence',
    label: 'Confidence',
    sortable: true,
    align: 'right',
    width: '230px'
  },
  {
    key: 'joinedAtIso',
    label: 'Joined',
    sortable: true,
    align: 'right',
    width: '150px'
  }
]

const selectedRule = computed(() => findRule(selectedRuleId.value))
const selectedRuleFacts = computed(() => ruleFacts(selectedRule.value))
const selectedMerge = computed(() => findMerge(selectedMergeId.value))

// Both tabs open on their strongest row rather than on a blank panel — the
// evidence panel *is* the screen, and an empty one teaches nothing.
watch(rules, list => {
  if (list.length && !findRule(selectedRuleId.value)) {
    selectedRuleId.value = list[0].id
  }
})

watch(merges, list => {
  if (list.length && !findMerge(selectedMergeId.value)) {
    selectedMergeId.value = list[0].id
  }
})

async function refresh() {
  await load()
  loaded.value = true
}

onMounted(refresh)
</script>
