<template>
  <!-- The first screen anyone sees, so it carries the brand rather than being a
       bare form on grey. Two panes: the dark pane says what the product does,
       the light pane does the one job this page has.

       THREE SELECTORS ON THIS PAGE ARE LOAD-BEARING. scripts/smoke.mjs — the
       only behavioural gate in the repo — drives `input[type=email]`,
       `input[type=password]` and `button[type=submit]`, and it fills them by
       type with Playwright's strict matching. Keep exactly one of each. That is
       why sign-up has no confirm-password field: a second password input would
       fail the gate for all 54 routes before a single screen rendered. -->
  <div class="flex min-h-screen">
    <!-- Left: the pitch. Hidden below lg with `max-lg:hidden`, never a bare
         `hidden` — Quasar ships `.hidden { display:none !important }` unlayered,
         so `hidden lg:flex` would be invisible at every width. -->
    <aside
      class="relative w-[46%] shrink-0 overflow-hidden bg-sfere-ink p-12 max-lg:hidden"
    >
      <div
        class="login-glow pointer-events-none absolute -left-40 -top-40 size-[34rem] rounded-full"
        aria-hidden="true"
      ></div>
      <div
        class="login-glow login-glow--b pointer-events-none absolute -bottom-40 -right-32 size-[26rem] rounded-full"
        aria-hidden="true"
      ></div>

      <div class="relative flex h-full flex-col">
        <SfereLogo :height="28" on-dark />

        <div class="mt-auto">
          <p
            class="font-sfere-mono text-sfere-label uppercase tracking-[0.18em] text-white/40"
            >Customer data platform</p
          >
          <h2
            class="mt-4 max-w-md font-sfere-display text-3xl! font-bold! leading-[1.15]! text-white"
          >
            Every interaction is a signal. Sfere turns it into something you can
            act on.
          </h2>

          <ul class="mt-10 flex flex-col gap-4">
            <li
              v-for="point in POINTS"
              :key="point.title"
              class="flex items-start gap-3"
            >
              <span
                class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-sfere-sm border border-sfere-hairline bg-sfere-wash"
              >
                <svg
                  viewBox="0 0 24 24"
                  class="size-4 text-sfere-300"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path :d="point.icon" />
                </svg>
              </span>
              <!-- `min-w-0 flex-1` is not cosmetic. Quasar ships an unlayered
                   `.flex { flex-wrap: wrap }`, which beats Tailwind's layered
                   `flex-nowrap`, so a bare block child whose max-content is
                   wider than the row wraps onto its own line — the icon ends up
                   stranded above the text. Giving the child `flex-basis: 0`
                   removes the wrap decision entirely. -->
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-white">{{ point.title }}</p>
                <p class="mt-0.5 text-sm text-white/50">{{ point.body }}</p>
              </div>
            </li>
          </ul>
        </div>

        <p class="mt-auto pt-12 text-xs text-white/30"
          >Connected to {{ apiHost }}</p
        >
      </div>
    </aside>

    <!-- Right: the form. -->
    <main class="flex flex-1 items-center justify-center bg-sfere-bg p-6">
      <div class="w-full max-w-sm">
        <SfereLogo :height="26" class="mb-8 lg:hidden" />

        <h1 class="font-sfere-display text-2xl! font-bold! text-ink">
          {{ isSignUp ? 'Create your account' : 'Welcome back' }}
        </h1>
        <p class="mt-1.5 text-sm text-muted">
          {{
            isSignUp
              ? 'Use your work email. It is how we match you to your company workspace.'
              : 'Sign in to pick up where your pipeline left off.'
          }}
        </p>

        <form class="mt-8 flex flex-col gap-4" @submit.prevent="submit">
          <FormField label="Work email" required for-id="login-email">
            <SfereInput
              id="login-email"
              v-model="email"
              type="email"
              placeholder="you@yourcompany.com"
              name="email"
              autocomplete="email"
            />
          </FormField>

          <FormField
            label="Password"
            required
            for-id="login-password"
            :hint="isSignUp ? 'At least 8 characters.' : ''"
          >
            <SfereInput
              id="login-password"
              v-model="password"
              type="password"
              placeholder="••••••••"
              name="password"
              :autocomplete="isSignUp ? 'new-password' : 'current-password'"
            />
          </FormField>

          <SfereButton
            type="submit"
            :loading="loading"
            :disabled="!canSubmit"
            block
            class="mt-2"
            >{{ isSignUp ? 'Create account' : 'Sign in' }}</SfereButton
          >
        </form>

        <p class="mt-6 text-center text-sm text-muted">
          <template v-if="isSignUp">
            Already have an account?
            <button
              type="button"
              class="font-medium text-brand hover:underline"
              @click="mode = 'signin'"
            >
              Sign in
            </button>
          </template>
          <template v-else>
            Don't have an account?
            <button
              type="button"
              class="font-medium text-brand hover:underline"
              @click="mode = 'signup'"
            >
              Create one
            </button>
          </template>
        </p>

        <!-- Said here rather than discovered at the approval queue: someone
             signing up second on a domain needs to know why they are waiting. -->
        <p v-if="isSignUp" class="mt-6 text-center text-xs text-subtle">
          The first person from a company domain becomes the workspace Owner.
          Anyone after that joins the same workspace once an Owner or Admin
          approves them.
        </p>
      </div>
    </main>

    <!-- The post-auth transition. Mounted only after auth actually succeeded,
         so it can never be the thing standing between a bad password and its
         error message. -->
    <AccountSetupOverlay v-if="settingUp" @done="finish" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Notify } from 'quasar'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { loadMe, accountMissing } from '@/composables/useMe'
import AccountSetupOverlay from '@/components/onboarding/AccountSetupOverlay.vue'
import FormField from '@/components/ui/FormField.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'

const router = useRouter()
const route = useRoute()
const { loading, signIn, signUp, logOut } = useAuth()

const mode = ref('signin')
const email = ref('')
const password = ref('')
const settingUp = ref(false)

const isSignUp = computed(() => mode.value === 'signup')

// Deliberately not a work-email check. Personal-domain rejection was proposed
// and dropped: it blocks contractors, agencies and anyone whose company uses a
// consumer domain, for a benefit — domain-matching a workspace — the backend
// gets from the address either way.
const canSubmit = computed(
  () =>
    Boolean(email.value) &&
    password.value.length >= (isSignUp.value ? 8 : 1) &&
    !loading.value
)

const POINTS = [
  {
    title: 'Collect once',
    body: 'One script tag, one SDK or one connector. Every event lands in the same shape.',
    icon: 'M4 7h16M4 12h16M4 17h10'
  },
  {
    title: 'Resolve to people',
    body: 'Anonymous sessions stitch onto real profiles as identifiers arrive.',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8 8a8 8 0 0 0-16 0'
  },
  {
    title: 'Send it anywhere',
    body: 'A warehouse, an ad platform, a webhook. One pipe per destination.',
    icon: 'M5 12h14m-6-6 6 6-6 6'
  }
]

const apiHost = computed(() => {
  const base = import.meta.env.VITE_API_BASE || 'http://localhost:8080'
  try {
    return new URL(base).host
  } catch {
    return base
  }
})

// Where to go once the transition finishes. Captured at submit time rather than
// read inside `finish()` so a query change mid-animation cannot redirect
// somewhere the user never asked for.
const destination = ref('/')

async function submit() {
  // Sign-up provisions the backend account (POST /v1/register) then signs in,
  // so a success here already means a real account exists.
  if (isSignUp.value) {
    if (await signUp(email.value, password.value)) {
      destination.value = route.query.redirect || '/'
      settingUp.value = true
    }
    return
  }

  // Sign-in: auth can succeed for an identity that has no backend account
  // (self-provisioning is disabled server-side). Confirm the account exists via
  // GET /v1/me; if not, sign back out rather than strand the user.
  if (!(await signIn(email.value, password.value))) return
  await loadMe()
  if (accountMissing.value) {
    await logOut()
    Notify.create({
      type: 'negative',
      message:
        'No account exists for this login. Please create an account first.'
    })
    return
  }
  destination.value = route.query.redirect || '/'
  settingUp.value = true
}

function finish() {
  router.replace(destination.value)
}
</script>

<style scoped>
.login-glow {
  background: radial-gradient(
    circle,
    var(--color-sfere-600) 0%,
    transparent 70%
  );
  filter: blur(100px);
  opacity: 0.45;
}

.login-glow--b {
  background: radial-gradient(
    circle,
    var(--color-sfere-800) 0%,
    transparent 70%
  );
  opacity: 0.55;
}
</style>
