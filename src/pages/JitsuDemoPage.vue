<template>
  <q-page class="p-6 lg:p-8">
    <!-- Header -->
    <div class="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div class="max-w-2xl">
        <h1
          class="text-[26px]! font-semibold! leading-tight! tracking-[-0.6px]! text-ink"
        >
          Events Demo
        </h1>
        <p class="mt-2 text-[15px] leading-relaxed text-muted">
          Answer the cookie banner, then fire a sample anonymous session or a
          full beIN SPORTS subscriber journey. Events appear on the
          <router-link
            to="/live-events"
            class="font-medium text-brand hover:underline"
            >Live Events</router-link
          >
          page.
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          class="flex h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors"
          :class="
            consentGranted
              ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
              : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
          "
          @click="openConsent"
        >
          <span
            class="size-2 rounded-full"
            :class="consentGranted ? 'bg-green-500' : 'bg-red-500'"
          />
          {{ consentGranted ? 'Consent granted' : 'Consent not granted' }}
        </button>

        <button
          class="flex h-9 items-center gap-2 rounded-lg border border-line2 bg-white px-3.5 text-sm font-medium text-muted transition-colors hover:bg-fill"
          @click="resetConsent"
        >
          <q-icon name="restart_alt" size="16px" />
          Reset consent
        </button>
      </div>
    </div>

    <!-- Consent (embedded in the page, not an overlay) -->
    <JitsuConsentBanner ref="banner" class="mb-5" @change="onConsentChange" />

    <!-- Suppression notice: nothing is sent to Jitsu until consent is granted. -->
    <div
      v-if="!consentGranted"
      class="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"
    >
      <q-icon name="info" size="20px" class="mt-0.5 shrink-0 text-amber-600" />
      <div>
        <p class="text-sm! font-semibold! text-amber-800">
          Requests are not being sent
        </p>
        <p class="mt-0.5 text-[13px] leading-snug text-amber-700">
          You haven't accepted consent, so Jitsu's privacy
          <code class="rounded bg-amber-100 px-1 py-0.5 text-[12px]"
            >dontSend</code
          >
          is suppressing every request — that's why the network tab stays empty.
          <button
            class="font-medium underline hover:no-underline"
            @click="openConsent"
          >
            Accept consent
          </button>
          to start collecting.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <!-- Scenarios -->
      <div class="flex flex-col gap-5 xl:col-span-2">
        <section
          v-for="sc in scenarios"
          :key="sc.key"
          class="rounded-2xl border border-line2 bg-white shadow-sm"
        >
          <header
            class="flex items-start justify-between gap-3 border-b border-line px-5 py-4"
          >
            <div class="flex items-start gap-3">
              <span
                class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-fill text-sm font-semibold text-brand"
              >
                {{ sc.badge }}
              </span>
              <div>
                <h2 class="text-base! font-semibold! text-ink">{{
                  sc.title
                }}</h2>
                <p class="mt-0.5 text-[13px] leading-snug text-muted">
                  {{ sc.desc }}
                </p>
              </div>
            </div>
            <button
              v-if="sc.key === 'known'"
              class="h-8 shrink-0 rounded-lg border border-line2 bg-white px-3 text-xs font-medium text-muted hover:bg-fill"
              @click="resetIdentity"
            >
              Reset identity
            </button>
          </header>

          <ol class="divide-y divide-line">
            <li v-for="(step, i) in sc.steps" :key="step.label">
              <button
                class="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-fill disabled:opacity-50"
                :disabled="running"
                @click="fireStep(step)"
              >
                <span
                  class="flex size-6 shrink-0 items-center justify-center rounded-full border border-line2 text-xs font-medium text-subtle"
                >
                  {{ i + 1 }}
                </span>
                <span class="flex-1 text-sm text-ink">{{ step.label }}</span>
                <span
                  class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  :class="kindClass(step.kind)"
                >
                  {{ step.kind }}
                </span>
              </button>
            </li>
          </ol>

          <footer class="border-t border-line px-5 py-4">
            <button
              class="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              :disabled="running"
              @click="runSequence(sc.steps)"
            >
              <q-icon
                v-if="running"
                name="refresh"
                size="16px"
                class="animate-spin"
              />
              {{ sc.runLabel }}
            </button>
          </footer>
        </section>
      </div>

      <!-- Last event -->
      <aside class="xl:col-span-1">
        <section
          class="sticky top-4 rounded-2xl border border-line2 bg-white shadow-sm"
        >
          <header class="border-b border-line px-5 py-4">
            <h2 class="text-base! font-semibold! text-ink">Last event</h2>
            <p class="mt-0.5 text-[13px] text-muted">
              The most recent call sent to your stream.
            </p>
          </header>

          <div class="p-5">
            <p
              v-if="error"
              class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600"
            >
              {{ error }}
            </p>

            <template v-if="lastEvent">
              <div class="flex items-center gap-2">
                <span
                  class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  :class="kindClass(lastEventKind)"
                >
                  {{ lastEventKind }}
                </span>
                <span class="text-sm font-medium text-ink">{{
                  lastEventName
                }}</span>
              </div>
              <p class="mt-1 text-[11px] text-subtle">{{ lastEvent.at }}</p>
              <pre
                class="mt-3 max-h-[460px] overflow-auto rounded-xl bg-fill p-3 text-[11px] leading-relaxed text-ink"
                >{{ pretty(lastEvent.args) }}</pre
              >
            </template>

            <div v-else class="py-8 text-center">
              <p class="text-sm text-muted">No events sent yet.</p>
              <p class="mt-1 text-[13px] text-subtle">
                Accept the banner and fire a scenario.
              </p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import JitsuConsentBanner from '@/components/JitsuConsentBanner.vue'
import { useJitsu } from '@/composables/useJitsu'

const $q = useQuasar()

const {
  page,
  track,
  identify,
  group,
  resetIdentity,
  lastEvent,
  error,
  privacy
} = useJitsu()

const banner = ref(null)
const running = ref(false)
const contact = ref(null)

// Context shared by every event so payloads read like a real beIN deployment.
const ctx = {
  app: 'bein-sports',
  platform: 'web',
  locale: 'ar-SA',
  region: 'KSA'
}

const matchId = 'spl-2026-derby-01'

// Small colour map so each call type reads at a glance.
function kindClass(kind) {
  return (
    {
      page: 'bg-sky-50 text-sky-600',
      track: 'bg-violet-50 text-violet-600',
      identify: 'bg-emerald-50 text-emerald-600',
      group: 'bg-amber-50 text-amber-600'
    }[kind] || 'bg-fill text-subtle'
  )
}

// last-event method/name split for the side panel header.
const lastEventKind = computed(() => lastEvent.value?.method || '')
const lastEventName = computed(() =>
  (lastEvent.value?.name || '').replace(/^(page|track|identify|group):\s*/, '')
)

// --- Scenario A: anonymous ---
const anonSteps = [
  {
    label: 'View home',
    kind: 'page',
    run: () =>
      page('Home', {
        ...ctx,
        path: '/',
        category: 'home',
        title: 'beIN SPORTS — Home'
      })
  },
  {
    label: 'Browse competitions',
    kind: 'track',
    run: () =>
      track('Browse Competitions', {
        ...ctx,
        competitions: ['LaLiga', 'Serie A', 'Ligue 1', 'AFC Champions League']
      })
  },
  {
    label: 'View match page',
    kind: 'page',
    run: () =>
      page('Match', {
        ...ctx,
        path: '/match/alhilal-alnassr',
        competition: 'Saudi Pro League',
        matchId
      })
  },
  {
    label: 'View match details',
    kind: 'track',
    run: () =>
      track('View Match Page', {
        ...ctx,
        matchId,
        homeTeam: 'Al-Hilal',
        awayTeam: 'Al-Nassr',
        status: 'upcoming'
      })
  }
]

// --- Scenario B: known subscriber onboarding ---
const knownSteps = [
  {
    label: 'View packages',
    kind: 'page',
    run: () =>
      page('Subscription Packages', {
        ...ctx,
        path: '/subscribe',
        plansShown: ['beIN_lite', 'beIN_sports', 'beIN_ultimate']
      })
  },
  {
    label: 'Browse packages',
    kind: 'track',
    run: () =>
      track('Browse Subscription Packages', {
        ...ctx,
        plans: ['beIN_lite', 'beIN_sports', 'beIN_ultimate'],
        currency: 'SAR'
      })
  },
  {
    label: 'Sign up',
    kind: 'track',
    run: () =>
      track('Signed Up', {
        ...ctx,
        method: 'email',
        plan_interest: 'beIN_sports'
      })
  },
  {
    label: 'Identify',
    kind: 'identify',
    run: () => {
      const c = contact.value
      return identify(c?.email || 'Saud.dossari370@mail.com', {
        name: c?.name || 'Saud Al-Dossari',
        email: c?.email || 'Saud.dossari370@mail.com',
        phone: c?.phone,
        city: c?.city,
        segment: c?.segment,
        source: c?.source,
        optedIn: c?.optedIn
      })
    }
  },
  {
    label: 'Join favourite competitions & teams',
    kind: 'group',
    run: async () => {
      const groups = [
        ['comp-laliga', { type: 'competition', name: 'LaLiga' }],
        ['comp-seriea', { type: 'competition', name: 'Serie A' }],
        ['comp-ligue1', { type: 'competition', name: 'Ligue 1' }],
        ['comp-afc-cl', { type: 'competition', name: 'AFC Champions League' }],
        ['team-alhilal', { type: 'team', name: 'Al-Hilal' }],
        ['team-alnassr', { type: 'team', name: 'Al-Nassr' }]
      ]
      for (const [id, traits] of groups) {
        await group(id, { ...ctx, ...traits })
        await delay(120)
      }
    }
  },
  {
    label: 'Select package',
    kind: 'track',
    run: () =>
      track('Select Package', {
        ...ctx,
        plan: 'beIN_sports',
        price: 69,
        currency: 'SAR',
        billing: 'monthly'
      })
  },
  {
    label: 'Start live stream',
    kind: 'track',
    run: () =>
      track('Start Live Stream', {
        ...ctx,
        matchId,
        homeTeam: 'Al-Hilal',
        awayTeam: 'Al-Nassr',
        quality: '1080p',
        stream_type: 'live'
      })
  },
  {
    label: 'Watch highlights',
    kind: 'track',
    run: () =>
      track('Watch Highlights', {
        ...ctx,
        matchId,
        clip: 'goals',
        duration_sec: 180
      })
  },
  {
    label: 'Set notification preferences',
    kind: 'track',
    run: () =>
      track('Set Notification Preferences', {
        ...ctx,
        channels: ['push', 'whatsapp'],
        teams: ['Al-Hilal'],
        goal_alerts: true
      })
  },
  {
    label: 'Share match',
    kind: 'track',
    run: () =>
      track('Share Content', {
        ...ctx,
        contentType: 'match',
        matchId,
        channel: 'whatsapp'
      })
  }
]

const scenarios = computed(() => [
  {
    key: 'anon',
    badge: 'A',
    title: 'Anonymous viewer',
    desc: 'Browsing with an anonymous id only — no identity attached.',
    steps: anonSteps,
    runLabel: 'Run anonymous session'
  },
  {
    key: 'known',
    badge: 'B',
    title: 'New subscriber onboarding',
    desc: contact.value
      ? `${contact.value.name} signs up, is identified, then subscribes and watches.`
      : 'A known fan signs up, is identified, then subscribes and watches.',
    steps: knownSteps,
    runLabel: 'Run onboarding journey'
  }
])

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// Warns (once per click) that nothing will be sent while consent is withheld,
// then points the user at the banner. Returns false to skip firing.
function warnSuppressed() {
  $q.notify({
    type: 'warning',
    message:
      'Consent not granted — Jitsu is suppressing this request (dontSend).',
    caption: 'Accept consent to start sending events.',
    timeout: 3500,
    actions: [{ label: 'Accept consent', color: 'white', handler: openConsent }]
  })
  openConsent()
  return false
}

function fireStep(step) {
  if (!consentGranted.value) return warnSuppressed()
  return step.run()
}

async function runSequence(steps) {
  if (!consentGranted.value) return warnSuppressed()
  running.value = true
  try {
    for (const s of steps) {
      await s.run()
      await delay(300)
    }
  } finally {
    running.value = false
  }
}

// Consent is "granted" once collection is enabled (analytics and/or marketing).
const consentGranted = computed(() => !privacy.value.dontSend)

function openConsent() {
  banner.value?.openBanner()
}

// Clears the stored decision and returns to the restrictive (undecided) state,
// so the consent value visibly flips back to "not granted" for the demo.
function resetConsent() {
  banner.value?.resetConsent()
  $q.notify({
    type: 'info',
    message: 'Consent reset — back to "not granted" (events suppressed).',
    timeout: 2500
  })
}

function onConsentChange() {
  // privacy ref already updated by the composable; nothing else needed here.
}

function pretty(args) {
  return JSON.stringify(args, null, 2)
}

// Load the real mock contact so the identify payload matches the dashboard data.
onMounted(async () => {
  try {
    const res = await fetch('/data/contacts.json')
    const list = await res.json()
    contact.value =
      (Array.isArray(list) ? list : []).find(
        c => c.email === 'Saud.dossari370@mail.com'
      ) || null
  } catch {
    contact.value = null
  }
})
</script>
