<template>
  <DocSection
    id="layout"
    eyebrow="Foundations"
    title="Layout & shape"
    description="Two section heights, one container width, five radii. Most of why a long Sfere page scans as a single document rather than a stack of unrelated blocks is that nothing uses a bespoke vertical value."
  >
    <DocSpecimen
      title="Section rhythm"
      usage="SfereSection owns the page's vertical rhythm. Use size=sm for supporting bands (logo rails, small proof points) and the default for anything that carries a heading."
    >
      <div class="flex flex-col">
        <DocSpecRow name='size="md"' meta="py-20 → md:py-28">
          <div class="flex items-center gap-3">
            <span class="block h-20 w-1.5 rounded-full bg-sfere-300" />
            <span class="text-sfere-sm text-sfere-fg-muted"
              >80px, 112px from md up — the default</span
            >
          </div>
        </DocSpecRow>
        <DocSpecRow name='size="sm"' meta="py-14 → md:py-20">
          <div class="flex items-center gap-3">
            <span class="block h-14 w-1.5 rounded-full bg-sfere-200" />
            <span class="text-sfere-sm text-sfere-fg-muted"
              >56px, 80px from md up</span
            >
          </div>
        </DocSpecRow>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Container"
      usage="80rem gutter-to-gutter, with padding that steps 20 → 24 → 32px. SfereSection applies it; only opt out with contained=false when a child needs to bleed to the viewport edge."
      code='<SfereSection tone="soft">
  <!-- already inside max-w-sfere-page px-5 sm:px-6 lg:px-8 -->
</SfereSection>'
    >
      <div
        class="rounded-sfere-lg border border-dashed border-sfere-300 bg-sfere-50/40 px-5 py-4"
      >
        <p class="font-sfere-mono text-sfere-xs text-sfere-fg-muted">
          max-w-sfere-page = 80rem / 1280px
        </p>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Radii"
      usage="8px is the workhorse. Full pills are spent on buttons and status chips — using one anywhere else makes those two stop reading as actionable."
    >
      <div class="flex flex-wrap items-end gap-5">
        <div
          v-for="r in radii"
          :key="r.token"
          class="flex flex-col items-center gap-2"
        >
          <span
            :class="[
              'size-16 border border-sfere-300 bg-sfere-50',
              r.className
            ]"
          />
          <span class="font-sfere-mono text-[0.6875rem] text-sfere-fg">{{
            r.token
          }}</span>
          <span class="font-sfere-mono text-[0.6875rem] text-sfere-fg-muted">{{
            r.value
          }}</span>
        </div>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Density"
      usage="One control height across the kit, so an input, a select and a medium button line up on a row without per-form adjustment."
    >
      <div class="flex flex-wrap items-center gap-3">
        <SfereInput model-value="" placeholder="40px tall" class="w-48" />
        <SfereSelect
          :options="['40px tall']"
          model-value="40px tall"
          class="w-40"
        />
        <SfereButton>40px tall</SfereButton>
      </div>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import DocSpecRow from '../DocSpecRow.vue'
import SfereButton from '@/components/sfere/SfereButton.vue'
import SfereInput from '@/components/sfere/SfereInput.vue'
import SfereSelect from '@/components/sfere/SfereSelect.vue'

const radii = [
  { token: 'rounded-sfere-sm', value: '6px', className: 'rounded-sfere-sm' },
  { token: 'rounded-sfere', value: '8px', className: 'rounded-sfere' },
  { token: 'rounded-sfere-lg', value: '12px', className: 'rounded-sfere-lg' },
  { token: 'rounded-sfere-xl', value: '16px', className: 'rounded-sfere-xl' },
  { token: 'rounded-sfere-2xl', value: '24px', className: 'rounded-sfere-2xl' },
  { token: 'rounded-full', value: 'pill', className: 'rounded-full' }
]
</script>
