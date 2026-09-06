<template>
  <!-- The first screen anyone sees, so it carries the brand rather than being a
       bare form on grey. Two panes: the dark pane says what the product does,
       the light pane does the one job this page has.

       ONE COMPONENT, TWO ROUTES. `/login` and `/signup` are separate entries in
       routes.js pointing here, and the mode is read off `route.name` rather than
       held in a ref — so each view is linkable, the browser's back button moves
       between them, and a marketing CTA can deep-link straight at sign-up. Both
       routes carry `redirect` through the switch, so someone bounced off a deep
       link who decides to register still lands where they were going.

       THREE SELECTORS ON THIS PAGE ARE LOAD-BEARING. scripts/smoke.mjs — the
       only behavioural gate in the repo — drives `input[type=email]`,
       `input[type=password]` and `button[type=submit]`, and it fills them by
       type with Playwright's strict matching. Keep exactly one of each. That is
       why sign-up has no confirm-password field: a second password input would
       fail the gate for all 54 routes before a single screen rendered. It is
       also why the show/hide toggle is `type="button"` and starts on
       `type="password"` — a bare <button> in a <form> submits by default, which
       would give the gate two matches for `button[type=submit]`. -->
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

        <!-- `novalidate`: the messages below are ours. Left to the browser, an
             invalid address raises a native bubble that disappears on the next
             keystroke, is styled by the OS, and cannot say the sign-up-specific
             things this form needs to say about passwords. -->
        <form class="mt-8 flex flex-col gap-4" novalidate @submit="submit">
          <FormField
            label="Work email"
            required
            for-id="login-email"
            :error="emailError"
          >
            <SfereInput
              id="login-email"
              v-model="email"
              type="email"
              placeholder="you@yourcompany.com"
              name="email"
              autocomplete="email"
              :invalid="Boolean(emailError)"
              :described-by="emailError ? 'login-email-error' : ''"
            />

            <!-- A warning, not an error, and never a blocker. A consumer
                 mailbox is a legitimate address for a contractor or a small
                 company; what it cannot do is domain-match anyone into a
                 shared workspace, so signing up with one means a workspace of
                 one. Better said here than discovered when a colleague signs
                 up and lands somewhere else. -->
            <p
              v-if="showsPersonalEmailWarning"
              class="flex items-start gap-1.5 text-sfere-xs text-sfere-warn"
            >
              <svg
                viewBox="0 0 256 256"
                class="mt-px size-3.5 shrink-0"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24m-8 56a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0Zm8 104a12 12 0 1 1 12-12a12 12 0 0 1-12 12"
                />
              </svg>
              <!-- `min-w-0 flex-1`: Quasar's unlayered `.flex` sets
                   `flex-wrap: wrap`, so a text child wider than the row drops
                   below the icon instead of sitting beside it. -->
              <span class="min-w-0 flex-1"
                >This looks like a personal email. You can carry on, but
                teammates on
                <strong class="font-medium">{{ personalDomain }}</strong> will
                not be matched into your workspace. Use your company address if
                you want them to join it.</span
              >
            </p>
          </FormField>

          <FormField
            label="Password"
            required
            for-id="login-password"
            :error="passwordError"
            :hint="isSignUp && !passwordError ? PASSWORD_HINT : ''"
          >
            <SfereInput
              id="login-password"
              v-model="password"
              :type="passwordVisible ? 'text' : 'password'"
              placeholder="••••••••"
              name="password"
              :autocomplete="isSignUp ? 'new-password' : 'current-password'"
              :invalid="Boolean(passwordError)"
              :described-by="
                passwordError
                  ? 'login-password-error'
                  : isSignUp
                    ? 'login-password-hint'
                    : ''
              "
            >
              <template #trailing>
                <!-- `type="button"` is load-bearing, not tidiness: a bare
                     <button> inside a <form> defaults to submit, which would
                     give scripts/smoke.mjs two matches for
                     `button[type=submit]` and fail sign-in for all 54 routes. -->
                <button
                  type="button"
                  class="grid size-7 place-items-center rounded-sfere-sm text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sfere-400"
                  :aria-label="
                    passwordVisible ? 'Hide password' : 'Show password'
                  "
                  :aria-pressed="passwordVisible ? 'true' : 'false'"
                  @click="passwordVisible = !passwordVisible"
                >
                  <SfereIcon
                    :name="passwordVisible ? 'eye-slash' : 'eye'"
                    size="lg"
                  />
                </button>
              </template>
            </SfereInput>

            <!-- The meter reports; `signUpPasswordProblem` decides. They are
                 separate on purpose: a password can clear the rule and still be
                 worth improving, and a bar that only ever showed pass/fail
                 would say nothing the error message does not. -->
            <div v-if="isSignUp && password" class="flex flex-col gap-1.5 pt-1">
              <div class="flex items-center gap-1" aria-hidden="true">
                <span
                  v-for="segment in 4"
                  :key="segment"
                  class="h-1 flex-1 rounded-full transition-colors duration-200"
                  :class="
                    segment <= strength.score ? strengthBarClass : 'bg-line2'
                  "
                ></span>
              </div>
              <!-- No `aria-live`. It would announce "Weak... Fair... Good" on
                   every keystroke; the moment that actually needs announcing is
                   a rejected submit, and FormField's error carries
                   `role="alert"` for that. -->
              <p class="text-sfere-xs" :class="strengthTextClass"
                >Password strength: {{ strength.label }}</p
              >
            </div>
          </FormField>

          <!-- Enabled unless a request is already in flight. The button used to
               be disabled until both fields passed, which is what QA filed as
               "invalid input is rejected completely silently" — a control that
               does nothing and says nothing gives the user no way to find out
               what is wrong with what they typed. Validation now runs on submit
               and puts a sentence under the offending field. -->
          <SfereButton type="submit" :loading="loading" block class="mt-2">{{
            isSignUp ? 'Create account' : 'Sign in'
          }}</SfereButton>
        </form>

        <!-- `sfere-flush` and a `gap`, not `mt-6` on each <p>. A layered
             `mt-*` on a paragraph computes to 0 against Quasar's unlayered
             paragraph margin, so the two lines below used to sit against the
             button on a rhythm nobody chose. See CLAUDE.md collision 5. -->
        <div class="sfere-flush mt-6 flex flex-col gap-5">
          <p class="text-center text-sm text-muted">
            <template v-if="isSignUp">
              Already have an account?
              <router-link
                :to="otherModeRoute"
                class="font-medium text-brand hover:underline"
              >
                Sign in
              </router-link>
            </template>
            <template v-else>
              Don't have an account?
              <router-link
                :to="otherModeRoute"
                class="font-medium text-brand hover:underline"
              >
                Create one
              </router-link>
            </template>
          </p>

          <!-- Said here rather than discovered at the approval queue: someone
               signing up second on a domain needs to know why they are
               waiting. -->
          <p v-if="isSignUp" class="text-center text-xs text-subtle">
            The first person from a company domain becomes the workspace Owner.
            Anyone after that joins the same workspace once an Owner or Admin
            approves them.
          </p>
        </div>
      </div>
    </main>

    <!-- The post-registration transition, and SIGN-UP ONLY. It exists because a
         brand-new account really is being provisioned behind it; a returning
         user has nothing being set up, and telling them otherwise for two and a
         half seconds on every sign-in is both untrue and a delay. Sign-in now
         goes straight to the destination. Mounted only after auth succeeded, so
         it can never be the thing standing between a bad password and its error
         message. -->
    <AccountSetupOverlay v-if="settingUp" @done="finish" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Notify } from 'quasar'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { loadMe, accountMissing } from '@/composables/useMe'
import {
  emailDomain,
  emailProblem,
  isPersonalEmail,
  passwordStrength,
  signInPasswordProblem,
  signUpPasswordProblem
} from '@/lib/authValidation'
import AccountSetupOverlay from '@/components/onboarding/AccountSetupOverlay.vue'
import { useOnboarding } from '@/composables/useOnboarding'
import FormField from '@/components/ui/FormField.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereLogo from '@/components/ui/SfereLogo.vue'

const router = useRouter()
const route = useRoute()
const { loading, signIn, signUp, logOut } = useAuth()
const { beginFirstRun } = useOnboarding()

const email = ref('')
const password = ref('')
const passwordVisible = ref(false)
const emailError = ref('')
const passwordError = ref('')
const settingUp = ref(false)

// The mode is the route, not a ref. Both routes render this component, so
// vue-router reuses the instance and whatever has been typed survives the
// switch — which is the point of making it navigation rather than a toggle.
const isSignUp = computed(() => route.name === 'signup')

const PASSWORD_HINT =
  'At least 8 characters, mixing three of: lower case, upper case, numbers, symbols.'

// Carries `redirect` across the switch. Without it, someone who followed a deep
// link to /errors, got bounced to sign-in and then decided to register would
// land on Home instead of where they were going.
const otherModeRoute = computed(() => ({
  name: isSignUp.value ? 'login' : 'signup',
  query: route.query.redirect ? { redirect: route.query.redirect } : {}
}))

const personalDomain = computed(() => emailDomain(email.value))

const showsPersonalEmailWarning = computed(
  () =>
    isSignUp.value &&
    !emailError.value &&
    !emailProblem(email.value) &&
    isPersonalEmail(email.value)
)

const strength = computed(() => passwordStrength(password.value))

const STRENGTH_BAR = {
  danger: 'bg-sfere-danger',
  warning: 'bg-sfere-warn',
  success: 'bg-sfere-success'
}

const STRENGTH_TEXT = {
  danger: 'text-sfere-danger',
  warning: 'text-sfere-warn',
  success: 'text-sfere-success'
}

const strengthBarClass = computed(() => STRENGTH_BAR[strength.value.tone])
const strengthTextClass = computed(() => STRENGTH_TEXT[strength.value.tone])

// An error is a verdict on what was submitted, so it goes the moment the value
// it judged changes — leaving it up while someone fixes the field is how a form
// ends up shouting at a value that is already correct.
watch(email, () => (emailError.value = ''))
watch(password, () => (passwordError.value = ''))

// Switching between sign-in and sign-up changes the password rule, so a message
// written under the other rule must not survive the trip.
watch(isSignUp, () => {
  emailError.value = ''
  passwordError.value = ''
})

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

// Where to go once auth settles. Captured at submit time rather than read later
// so a query change mid-flight cannot redirect somewhere the user never asked
// for.
const destination = ref('/')

// SfereInput owns its <input> and exposes no ref, so the id it was given is the
// handle. Focusing the first field that failed is the difference between a
// message you have to go looking for and one you are standing in.
function focusField(id) {
  document.getElementById(id)?.focus()
}

// Returns true when the form is worth sending. Both fields are always checked,
// so someone with two problems is told about both rather than one per attempt.
function validate() {
  emailError.value = emailProblem(email.value)
  passwordError.value = isSignUp.value
    ? signUpPasswordProblem(password.value)
    : signInPasswordProblem(password.value)

  if (emailError.value) {
    focusField('login-email')
    return false
  }
  if (passwordError.value) {
    focusField('login-password')
    return false
  }
  return true
}

async function submit(event) {
  event.preventDefault()
  if (loading.value) return
  if (!validate()) return

  // Sign-up provisions the backend account (POST /v1/register) then signs in,
  // so a success here already means a real account exists.
  if (isSignUp.value) {
    if (await signUp(email.value.trim(), password.value)) {
      // THE ONE PLACE THE FIRST-RUN ARRIVAL IS ARMED. `useOnboarding` used to
      // treat an absent record as "ask", which made the welcome a property of
      // the browser rather than of the account — an existing user signing in on
      // a new machine, in a private window, or after clearing storage was met by
      // a full-page welcome over a workspace they had been using for months.
      // Arming it here means a sign-in can never reach it. `signUp` has already
      // awaited `loadMe()`, so the record gets a real uid to be scoped to.
      beginFirstRun()
      destination.value = route.query.redirect || '/'
      settingUp.value = true
    }
    return
  }

  // Sign-in: auth can succeed for an identity that has no backend account
  // (self-provisioning is disabled server-side). Confirm the account exists via
  // GET /v1/me; if not, sign back out rather than strand the user.
  if (!(await signIn(email.value.trim(), password.value))) return
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
  // No setup overlay for a returning user: nothing is being set up, and a
  // fixed 2.5s of "Opening your workspace" on every sign-in is a delay
  // pretending to be work.
  router.replace(route.query.redirect || '/')
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
