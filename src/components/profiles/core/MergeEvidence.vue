<template>
  <CardPanel>
    <template #header>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <span class="text-sm font-semibold text-ink"
            >Why these are the same fan</span
          >
          <p class="mt-0.5 truncate text-xs text-subtle"
            >{{ merge.profileName }} · {{ merge.profileId }}</p
          >
        </div>
        <div class="flex items-center gap-2">
          <StatusBadge :variant="merge.methodVariant" :label="merge.method" />
          <StatusBadge :variant="merge.verdictVariant" :label="merge.verdict" />
        </div>
      </div>
    </template>

    <!-- The two identifiers, and the number the evidence below adds up to. -->
    <div class="flex flex-wrap items-stretch gap-3">
      <div class="min-w-0 flex-1 rounded-lg border border-line2 bg-white p-3">
        <p
          class="text-[11px] font-medium uppercase tracking-[0.4px] text-subtle"
          >Anchor · {{ merge.anchorLabel }}</p
        >
        <p class="mt-1 break-all font-mono text-sm text-ink">{{
          merge.anchorValue
        }}</p>
        <p class="mt-1 text-xs text-subtle">First seen {{ merge.anchorAt }}</p>
      </div>

      <div
        class="flex shrink-0 flex-col items-center justify-center px-1 text-subtle"
      >
        <span class="text-[11px] font-medium uppercase tracking-[0.4px]"
          >stitched</span
        >
        <span class="text-lg leading-none">↔</span>
      </div>

      <div class="min-w-0 flex-1 rounded-lg border border-line2 bg-white p-3">
        <p
          class="text-[11px] font-medium uppercase tracking-[0.4px] text-subtle"
          >Joined · {{ merge.joinedLabel }}</p
        >
        <p class="mt-1 break-all font-mono text-sm text-ink">{{
          merge.joinedValue
        }}</p>
        <p class="mt-1 text-xs text-subtle">Joined {{ merge.joinedAt }}</p>
      </div>

      <div
        class="flex shrink-0 flex-col items-end justify-center pl-2 text-right"
      >
        <p class="text-3xl font-semibold leading-none" :class="confidenceClass"
          >{{ merge.confidence }}%</p
        >
        <p class="mt-1 text-xs text-muted">confidence</p>
      </div>
    </div>

    <!-- Signal breakdown. There is no meter/progress primitive in
         src/components/ui, so the bars are composed here rather than by
         editing a frozen file — see the report on this branch. -->
    <div class="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      <div v-for="s in merge.signals" :key="s.key">
        <div class="mb-1 flex items-baseline justify-between gap-2 text-xs">
          <span class="font-medium text-ink">{{ s.label }}</span>
          <span class="text-muted"
            >{{ s.percent }}% × {{ s.weight.toFixed(2) }} =
            <span class="font-medium text-ink"
              >{{ s.contribution.toFixed(1) }} pts</span
            ></span
          >
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-fill">
          <div
            class="h-full rounded-full"
            :class="barClass(s.score)"
            :style="{ width: `${s.percent}%` }"
          />
        </div>
        <p class="mt-1 text-xs text-subtle">{{ s.reason }}</p>
      </div>
    </div>

    <template #footer>
      <p class="text-xs text-muted">
        <span class="font-medium text-ink"
          >{{ merge.points.toFixed(1) }} points</span
        >
        across four dimensions → {{ merge.confidence }}% confidence.
        {{ merge.methodReason }} Weights are fixed at rule precedence 0.35,
        uniqueness 0.25, corroboration 0.25 and timing 0.15, so two merges are
        always comparable.
      </p>
    </template>
  </CardPanel>
</template>

<script setup>
import { computed } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// The evidence behind one stitch: which two identifiers were joined, what the
// four scored dimensions were, and the arithmetic that turns them into the
// headline percentage.
//
// Showing the full sum is the point. A confidence number nobody can audit is a
// number nobody should act on — and merging two fans who are not the same
// person is the most expensive mistake this product can make.
const props = defineProps({
  merge: { type: Object, required: true }
})

const CONFIDENCE = {
  success: 'text-success',
  warn: 'text-amber-600',
  neutral: 'text-muted'
}

const confidenceClass = computed(
  () => CONFIDENCE[props.merge.verdictVariant] ?? CONFIDENCE.neutral
)

function barClass(score) {
  if (score >= 0.75) return 'bg-brand'
  if (score >= 0.4) return 'bg-brand/40'
  return 'bg-line2'
}
</script>
