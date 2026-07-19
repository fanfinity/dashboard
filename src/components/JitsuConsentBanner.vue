<template>
  <!-- Embedded (non-overlay) consent card. Always present in the page flow;
       shows the prompt before a decision and a compact summary after. -->
  <section
    ref="root"
    class="scroll-mt-4 rounded-2xl border border-line2 bg-white shadow-sm"
  >
    <div class="flex flex-wrap items-start justify-between gap-4 p-5">
      <div class="flex items-start gap-3">
        <span
          class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-fill text-brand"
        >
          <q-icon name="lock" size="18px" />
        </span>
        <div class="max-w-xl">
          <p class="text-sm! font-semibold! text-ink">We value your privacy</p>
          <p class="mt-1 text-[13px] leading-snug text-muted">
            <template v-if="decided">
              Your choice is saved. Necessary cookies are always on — you can
              change Analytics and Marketing any time.
            </template>
            <template v-else>
              We use cookies and similar tools to measure usage and personalise
              your beIN SPORTS experience. Necessary cookies are always on; you
              choose the rest. Your choice controls what we collect.
            </template>
          </p>
          <div
            v-if="decided && !managing"
            class="mt-2 flex flex-wrap gap-1.5 text-[11px]"
          >
            <span
              v-for="cat in categories"
              :key="cat.key"
              class="rounded-md px-2 py-0.5 font-medium"
              :class="
                consentValue(cat.key)
                  ? 'bg-green-50 text-green-700'
                  : 'bg-fill text-subtle'
              "
            >
              {{ cat.label }}: {{ consentValue(cat.key) ? 'On' : 'Off' }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="!managing"
          class="h-9 rounded-lg border border-line2 bg-white px-3 text-sm font-medium text-muted hover:bg-fill"
          @click="managing = true"
        >
          {{ decided ? 'Change preferences' : 'Manage preferences' }}
        </button>
        <button
          v-else
          class="h-9 rounded-lg border border-line2 bg-white px-3 text-sm font-medium text-brand hover:bg-fill"
          @click="savePreferences"
        >
          Save preferences
        </button>
        <button
          class="h-9 rounded-lg border border-line2 bg-white px-3 text-sm font-medium text-muted hover:bg-fill"
          @click="rejectAll"
        >
          Reject all
        </button>
        <button
          class="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:opacity-90"
          @click="acceptAll"
        >
          Accept all
        </button>
      </div>
    </div>

    <!-- Preferences (expanded via "Manage / Change preferences") -->
    <div
      v-if="managing"
      class="flex flex-col gap-3 border-t border-line px-5 py-4"
    >
      <div
        v-for="cat in categories"
        :key="cat.key"
        class="flex items-start justify-between gap-4"
      >
        <div>
          <p class="text-sm font-medium text-ink">{{ cat.label }}</p>
          <p class="text-xs text-muted">{{ cat.desc }}</p>
        </div>
        <q-toggle
          v-model="draft[cat.key]"
          :disable="cat.locked"
          color="primary"
          dense
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { useJitsu, CONSENT_KEY } from '@/composables/useJitsu'

const emit = defineEmits(['change'])
const { setConsent, applyRestrictive } = useJitsu()

const categories = [
  {
    key: 'necessary',
    label: 'Strictly necessary',
    desc: 'Required for the site to work. Always on.',
    locked: true
  },
  {
    key: 'analytics',
    label: 'Analytics',
    desc: 'Lets us identify you and keep full IPs to measure engagement.',
    locked: false
  },
  {
    key: 'marketing',
    label: 'Marketing',
    desc: 'Allows event collection for campaigns (IP stripped, no user IDs).',
    locked: false
  }
]

const root = ref(null)
const managing = ref(false)
const consent = ref(null) // stored decision, or null when undecided
const draft = reactive({ necessary: true, analytics: false, marketing: false })

const decided = computed(() => !!consent.value)
const consentValue = key => !!consent.value?.[key]

function persistAndApply(state) {
  const full = {
    necessary: true,
    ...state,
    decidedAt: new Date().toISOString()
  }
  localStorage.setItem(CONSENT_KEY, JSON.stringify(full))
  consent.value = full
  draft.analytics = !!full.analytics
  draft.marketing = !!full.marketing
  setConsent(full)
  managing.value = false
  emit('change', full)
}

function acceptAll() {
  persistAndApply({ analytics: true, marketing: true })
}

function rejectAll() {
  persistAndApply({ analytics: false, marketing: false })
}

function savePreferences() {
  persistAndApply({ analytics: draft.analytics, marketing: draft.marketing })
}

// Clears the stored decision and returns to the undecided prompt.
function resetConsent() {
  localStorage.removeItem(CONSENT_KEY)
  consent.value = null
  draft.analytics = false
  draft.marketing = false
  applyRestrictive()
  managing.value = false
  emit('change', null)
}

// Expands the preferences and scrolls the card into view (header button hook).
function openBanner() {
  managing.value = true
  root.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

defineExpose({ resetConsent, openBanner })

onMounted(() => {
  let stored = null
  try {
    stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')
  } catch {
    stored = null
  }
  if (stored) {
    consent.value = stored
    draft.analytics = !!stored.analytics
    draft.marketing = !!stored.marketing
    setConsent(stored)
    emit('change', stored)
  } else {
    applyRestrictive()
  }
})
</script>
