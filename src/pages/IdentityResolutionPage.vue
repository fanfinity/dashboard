<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5">
      <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
        >Identity Resolution</h1
      >
      <p class="mt-1 max-w-3xl text-sm text-muted">
        Probabilistic matches inferred from live event signals — when two
        profiles are likely the <span class="font-medium text-ink">same person</span>
        without ever sharing an email or user ID. Each match is scored across
        device, location, behavior and timing, and weighted by how
        <span class="font-medium text-ink">rare</span> the shared signals are, so
        only meaningful overlaps surface.
      </p>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="rounded-xl border border-line2 bg-white p-10 text-center text-muted shadow-sm"
      >Resolving identities…</div
    >

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-xl border border-line2 bg-white p-10 text-center text-rose-500 shadow-sm"
      >Couldn't load events for matching: {{ error }}</div
    >

    <!-- Empty -->
    <div
      v-else-if="!matches.length"
      class="rounded-xl border border-line2 bg-white p-10 text-center shadow-sm"
    >
      <p class="text-muted"
        >No confident matches found in the current event window.</p
      >
      <p class="mt-1 text-xs text-subtle"
        >Anonymous visitors need overlapping signals with another profile to be
        probabilistically linked.</p
      >
    </div>

    <!-- Match cards -->
    <div v-else class="flex flex-col gap-4">
      <article
        v-for="m in matches"
        :key="m.id"
        class="rounded-xl border border-line2 bg-white p-5 shadow-sm"
      >
        <!-- Top row: the two profiles + confidence -->
        <div class="flex flex-wrap items-center gap-4">
          <ProfileChip :contact="m.anon" />

          <div class="flex flex-col items-center px-1 text-subtle">
            <span class="text-[11px] font-medium uppercase tracking-[0.4px]"
              >likely</span
            >
            <span class="text-lg leading-none">↔</span>
            <span class="text-[11px]">same person</span>
          </div>

          <ProfileChip :contact="m.candidate" />

          <div class="ml-auto flex items-center gap-4">
            <div class="text-right">
              <p
                class="text-2xl font-semibold leading-none"
                :class="confidenceClass(m.confidence)"
                >{{ m.confidence }}%</p
              >
              <p class="mt-1 text-xs text-muted">{{ m.verdict }}</p>
            </div>
            <button
              v-if="!merged.has(m.id)"
              class="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
              @click="merge(m.id)"
              >Merge identities</button
            >
            <span
              v-else
              class="inline-flex items-center gap-1.5 rounded-lg border border-success-line bg-success-bg px-3 py-2 text-sm font-medium text-success"
            >
              ✓ Merged
            </span>
          </div>
        </div>

        <!-- Signal breakdown -->
        <div class="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div v-for="s in m.signals" :key="s.key">
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="font-medium text-ink">{{ s.label }}</span>
              <span class="text-muted">{{ pct(s.score) }}%</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-fill">
              <div
                class="h-full rounded-full"
                :class="barClass(s.score)"
                :style="{ width: pct(s.score) + '%' }"
              />
            </div>
            <p class="mt-1 text-xs text-subtle">{{ s.reason }}</p>
          </div>
        </div>

        <!-- How the confidence is calculated -->
        <div class="mt-5 rounded-lg border border-line bg-sidebar p-4">
          <p
            class="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
            >How this {{ m.confidence }}% is calculated</p
          >
          <table class="w-full text-xs">
            <thead>
              <tr class="text-left text-subtle">
                <th class="py-1 pr-3 font-medium">Signal</th>
                <th class="py-1 pr-3 text-right font-medium">Score</th>
                <th class="py-1 pr-3 text-center font-medium">×</th>
                <th class="py-1 pr-3 text-right font-medium">Weight</th>
                <th class="py-1 text-right font-medium">= Points</th>
              </tr>
            </thead>
            <tbody class="font-mono">
              <tr v-for="s in m.signals" :key="s.key" class="text-muted">
                <td class="py-0.5 pr-3 font-sans">{{ s.label }}</td>
                <td class="py-0.5 pr-3 text-right">{{ pct(s.score) }}%</td>
                <td class="py-0.5 pr-3 text-center text-subtle">×</td>
                <td class="py-0.5 pr-3 text-right">{{ s.weight.toFixed(2) }}</td>
                <td class="py-0.5 text-right text-ink"
                  >{{ s.contribution.toFixed(1) }}</td
                >
              </tr>
            </tbody>
            <tfoot>
              <tr class="border-t border-line2 font-mono font-semibold">
                <td class="py-1 pr-3 font-sans text-ink" colspan="4"
                  >Total confidence</td
                >
                <td class="py-1 text-right" :class="confidenceClass(m.confidence)"
                  >{{ sumContributions(m).toFixed(1) }}
                  <span class="text-subtle">→ {{ m.confidence }}%</span></td
                >
              </tr>
            </tfoot>
          </table>
          <p class="mt-2 text-[11px] leading-relaxed text-subtle">
            Each signal score already factors in <span class="font-medium">rarity</span> —
            a shared value common across all visitors scores low, a near-unique
            one scores high. Scores are weighted by dimension
            (device 0.30, geo 0.25, behavioral 0.25, temporal 0.20) and summed to
            the confidence above.
          </p>
        </div>
      </article>
    </div>
  </q-page>
</template>

<script setup>
import { ref, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useIdentityResolution } from '@/composables/useIdentityResolution'

const router = useRouter()
const { matches, loading, error, loadMatches } = useIdentityResolution()

// Local, demo-only record of which matches the user has "merged" — there is no
// write-back to the CDP, this just acknowledges the action in the UI.
const merged = ref(new Set())
function merge(id) {
  merged.value = new Set(merged.value).add(id)
}

onMounted(loadMatches)

function pct(score) {
  return Math.round(Math.max(0, Math.min(1, score)) * 100)
}

// Raw weighted sum (before rounding to the displayed confidence), so the math
// in the breakdown table adds up to what's shown.
function sumContributions(m) {
  return m.signals.reduce((sum, s) => sum + s.contribution, 0)
}

function confidenceClass(confidence) {
  if (confidence >= 75) return 'text-emerald-600'
  if (confidence >= 60) return 'text-amber-600'
  return 'text-muted'
}

function barClass(score) {
  if (score >= 0.75) return 'bg-emerald-500'
  if (score >= 0.4) return 'bg-amber-500'
  return 'bg-line2'
}

function initials(name) {
  return String(name)
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
}

// A compact, clickable profile cell reused for both sides of a match.
const ProfileChip = (props) => {
  const c = props.contact
  return h(
    'button',
    {
      class:
        'flex min-w-0 items-center gap-3 rounded-lg border border-line2 bg-white px-3 py-2 text-left hover:bg-fill',
      onClick: () =>
        router.push({
          name: 'contact-detail',
          params: { email: c.routeKey ?? c.email }
        })
    },
    [
      h(
        'span',
        {
          class: `flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${c.color}`
        },
        initials(c.name)
      ),
      h('span', { class: 'min-w-0' }, [
        h(
          'span',
          { class: 'block max-w-[180px] truncate text-sm font-medium text-ink' },
          c.name
        ),
        h(
          'span',
          {
            class: `mt-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
              c.isAnonymous
                ? 'border-violet-200 bg-violet-50 text-violet-600'
                : 'border-success-line bg-success-bg text-success'
            }`
          },
          c.isAnonymous ? 'Anonymous' : 'CDP · Identified'
        )
      ])
    ]
  )
}
</script>
