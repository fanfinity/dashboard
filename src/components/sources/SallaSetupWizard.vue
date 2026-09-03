<template>
  <CardPanel v-if="visible">
    <template #header>
      <span class="text-sm font-semibold text-ink">Salla setup</span>
      <div class="flex items-center gap-2">
        <StatusBadge tone="brand" label="3 steps to go live" />
        <button class="text-xs text-subtle hover:text-muted" @click="dismiss">
          Skip setup
        </button>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <!-- Step 1: Authorize -->
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          :class="
            connected
              ? 'bg-success-bg text-success border border-success-line'
              : 'bg-brand/10 text-brand border border-brand/30'
          "
        >
          {{ connected ? '✓' : '1' }}
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <div>
            <p class="text-sm font-medium text-ink">Authorize with Salla</p>
            <p class="mt-0.5 text-xs text-muted">
              Open the Salla OAuth page and grant Fanfinity access to your
              store.
            </p>
          </div>
          <div v-if="!connected" class="flex flex-wrap items-center gap-2">
            <button
              class="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              :disabled="!authorizeHref"
              @click="openOAuth"
            >
              Authorize with Salla
            </button>
            <button
              class="flex h-8 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-xs text-ink shadow-sm hover:bg-fill disabled:opacity-40"
              :disabled="checking"
              @click="verifyOAuth"
            >
              {{ checking ? 'Checking…' : "I've authorized" }}
            </button>
          </div>
          <p v-if="verifyMsg" class="text-xs text-amber-600">{{ verifyMsg }}</p>
          <!-- Says which of the two ways the button is unusable, because they
               need different people: an unset env var is ours to fix, a source
               with no store id is the record's. -->
          <p
            v-else-if="!connected && !authorizeHref"
            class="text-xs text-muted"
          >
            No authorization link is available for this source yet.
            <template v-if="!source.storeId"
              >It has no Salla store id on record.</template
            >
            <template v-else
              >The backend did not return one and
              <code class="font-sfere-mono">VITE_SALLA_APP_URL</code> is
              unset.</template
            >
          </p>
        </div>
      </div>

      <!-- Step 2: Register webhooks -->
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          :class="
            step2Done
              ? 'bg-success-bg text-success border border-success-line'
              : 'bg-brand/10 text-brand border border-brand/30'
          "
        >
          {{ step2Done ? '✓' : '2' }}
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <div>
            <p class="text-sm font-medium text-ink">Register webhooks</p>
            <p class="mt-0.5 text-xs text-muted">
              Register Fanfinity as a Salla webhook receiver so live events are
              forwarded in real time.
            </p>
          </div>
          <div v-if="!step2Done">
            <button
              :disabled="!connected || connecting"
              class="flex h-8 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-xs text-ink shadow-sm hover:bg-fill disabled:opacity-40"
              @click="registerWebhooks"
            >
              {{ connecting ? 'Connecting…' : 'Connect' }}
            </button>
          </div>
          <p v-if="connectError" class="text-xs text-rose-500">{{
            connectError
          }}</p>
        </div>
      </div>

      <!-- Step 3: First sync -->
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          :class="
            step3Done
              ? 'bg-success-bg text-success border border-success-line'
              : 'bg-brand/10 text-brand border border-brand/30'
          "
        >
          {{ step3Done ? '✓' : '3' }}
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <div>
            <p class="text-sm font-medium text-ink">Run first sync</p>
            <p class="mt-0.5 text-xs text-muted">
              Pull all existing records from the Salla store into Fanfinity.
            </p>
          </div>
          <div v-if="!step3Done">
            <button
              :disabled="!step2Done || syncing"
              class="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              @click="runFirstSync"
            >
              {{ syncing ? 'Syncing…' : 'Run first sync' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useSourcesAPI } from '@/composables/useSourcesAPI'
import { useSourceSyncAPI } from '@/composables/useSourceSyncAPI'
import { legacyAuthorizeUrl, openAuthorize } from '@/lib/sallaAuthorize'

const props = defineProps({
  source: { type: Object, required: true }
})

const emit = defineEmits(['complete'])

const { connectSalla, sallaStatus } = useSourcesAPI()
const { triggerSync } = useSourceSyncAPI()

const webhooksKey = computed(() => `salla_webhooks_${props.source.id}`)
const syncKey = computed(() => `salla_sync_${props.source.id}`)
const dismissKey = computed(() => `salla_wizard_dismissed_${props.source.id}`)

const dismissed = ref(localStorage.getItem(dismissKey.value) === '1')
// Step 2/3 completions are actions the user took, persisted so the panel can be
// swapped out (e.g. during a source reload) without losing progress. Step 1 is
// NOT persisted — it's re-verified against the backend every mount, so a stale
// flag can never let Connect run before OAuth actually completed.
const step2Done = ref(localStorage.getItem(webhooksKey.value) === '1')
const step3Done = ref(localStorage.getItem(syncKey.value) === '1')

const connected = ref(false)
const checking = ref(false)
const connecting = ref(false)
const syncing = ref(false)
const verifyMsg = ref('')
const connectError = ref('')

const visible = computed(
  () =>
    props.source.sourceType === 'salla' &&
    !props.source.lastSyncedAt &&
    !dismissed.value &&
    !step3Done.value
)

// The start code the backend last minted for this source. Single-use, so it is
// re-read after every open rather than held for the life of the panel.
const backendAuthorizeUrl = ref('')

// The backend's signed start hop, or the legacy `/redirect-url` entry otherwise.
// See src/lib/sallaAuthorize.js for why the first is not reconstructable in the
// browser and what the second gives up.
const authorizeHref = computed(
  () => backendAuthorizeUrl.value || legacyAuthorizeUrl(props.source.storeId)
)

async function refreshConnected() {
  checking.value = true
  try {
    const status = await sallaStatus(props.source.id)
    connected.value = status.connected
    backendAuthorizeUrl.value = status.authorizeUrl
  } catch {
    // A failed status check reads as "not connected yet" — the merchant just
    // stays on the authorize step rather than seeing an error.
    connected.value = false
  } finally {
    checking.value = false
  }
  return connected.value
}

function openOAuth() {
  // Opened straight from the click. Minting a fresh code first would put an
  // await between the gesture and the open, which popup blockers stop — so the
  // held URL is spent now and a replacement is fetched behind it.
  if (!openAuthorize(authorizeHref.value)) return
  backendAuthorizeUrl.value = ''
  refreshConnected()
}

// Verify against the backend that the store actually finished OAuth (tokens are
// held) before letting the merchant move on. This is what stops a premature
// Connect from 502-ing.
async function verifyOAuth() {
  verifyMsg.value = ''
  const ok = await refreshConnected()
  if (!ok) {
    verifyMsg.value =
      "We can't see an authorization for this store yet. Finish granting access in the Salla tab, then click “I've authorized” again."
  }
}

async function registerWebhooks() {
  connectError.value = ''
  // Guard: never call connect-salla until tokens are confirmed.
  if (!connected.value && !(await refreshConnected())) {
    verifyMsg.value =
      'Authorize the store with Salla first. Its OAuth token is needed to register webhooks.'
    return
  }
  connecting.value = true
  try {
    await connectSalla(props.source.id)
    localStorage.setItem(webhooksKey.value, '1')
    step2Done.value = true
  } catch (e) {
    connectError.value = `Couldn't register webhooks: ${e.message || 'request failed'}`
  } finally {
    connecting.value = false
  }
}

async function runFirstSync() {
  connectError.value = ''
  syncing.value = true
  try {
    await triggerSync(props.source.id, { mode: 'full' })
    localStorage.setItem(syncKey.value, '1')
    step3Done.value = true
    emit('complete')
  } catch (e) {
    connectError.value = `Couldn't start sync: ${e.message || 'request failed'}`
  } finally {
    syncing.value = false
  }
}

function dismiss() {
  localStorage.setItem(dismissKey.value, '1')
  dismissed.value = true
}

// Re-check OAuth status on mount so a store that already authorized shows step 1
// as done immediately (and Connect enabled).
onMounted(refreshConnected)
</script>
