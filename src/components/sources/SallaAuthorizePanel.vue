<template>
  <CardPanel>
    <template #header>
      <span class="text-sm font-semibold text-ink">Salla setup</span>
      <StatusBadge
        :tone="authorized ? 'success' : 'brand'"
        :label="authorized ? 'Store authorized' : '1 step before you continue'"
      />
    </template>

    <div class="flex items-start gap-3">
      <div
        class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        :class="
          authorized
            ? 'bg-success-bg text-success border border-success-line'
            : 'bg-brand/10 text-brand border border-brand/30'
        "
      >
        {{ authorized ? '✓' : '1' }}
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p class="text-sm font-medium text-ink">Authorize with Salla</p>
          <p class="mt-0.5 text-xs text-muted">
            Open the Salla OAuth page and grant Sfere access to your store.
            Until the store grants it, this source can read nothing, so there is
            nothing to create yet.
          </p>
        </div>

        <LoadingState v-if="loading" variant="form" :rows="1" />

        <ErrorState
          v-else-if="error"
          title="Couldn't check your Salla authorizations."
          :message="error"
          @retry="load"
        />

        <!-- No endpoint to ask: Demo mode, or a backend without the Salla
             endpoints. The authorization cannot be confirmed here, and the
             backend rejects a Salla source with no store id, so the id is the
             only way forward and it is asked for only in this branch. -->
        <template v-else-if="apiMissing">
          <p class="text-xs text-amber-600">
            {{
              isReal
                ? "This backend can't list your authorized stores yet, so we can't confirm the grant from here. Authorize the store, then enter its id."
                : 'Demo data mode has no live Salla authorization. Enter a store id to walk through the rest of the flow; nothing is saved either way.'
            }}
          </p>

          <SfereInput
            :model-value="modelValue"
            placeholder="Salla store id, e.g. 10098"
            class="max-w-xs"
            @update:model-value="emit('update:modelValue', $event)"
          />

          <div class="flex flex-wrap items-center gap-2">
            <button
              :class="PRIMARY_BTN"
              :disabled="!legacyHref"
              @click="openLegacy"
            >
              Authorize with Salla
            </button>
            <p v-if="!legacyHref" class="min-w-0 flex-1 text-xs text-subtle">{{
              modelValue.trim()
                ? 'VITE_SALLA_APP_URL is unset, so there is no authorization page to open.'
                : 'Enter the store id first.'
            }}</p>
          </div>
        </template>

        <!-- Authorized. The store id is read off the grant rather than typed:
             every store here completed the handshake, so the id cannot be a
             typo and cannot name a store we hold no tokens for. -->
        <template v-else-if="authorized">
          <p class="text-xs text-muted">
            Reading
            <span class="font-medium text-ink">{{ selected?.name }}</span>
            <template v-if="selected?.domain"> ({{ selected.domain }})</template
            >, authorized
            {{ formatDateTime(selected?.connectedAt, NOT_KNOWN) }}.
          </p>

          <!-- Only when the account has authorized more than one store. -->
          <div v-if="connections.length > 1" class="flex flex-wrap gap-2">
            <button
              v-for="store in connections"
              :key="store.storeId"
              type="button"
              class="rounded-sfere px-3 py-1.5 text-xs transition duration-150 ease-sfere-ui"
              :class="
                store.storeId === modelValue
                  ? 'border border-sfere-300 bg-sfere-50 font-medium text-sfere-brand-text'
                  : 'border border-sfere-line bg-white text-muted hover:bg-sfere-fill'
              "
              @click="emit('update:modelValue', store.storeId)"
            >
              {{ store.name }}
            </button>
          </div>

          <div>
            <button :class="SECONDARY_BTN" @click="authorize">
              Authorize another store
            </button>
          </div>
        </template>

        <!-- The state this panel exists for. -->
        <template v-else>
          <div class="flex flex-wrap items-center gap-2">
            <button
              :class="PRIMARY_BTN"
              :disabled="authorizing"
              @click="authorize"
            >
              {{ authorizing ? 'Opening…' : 'Authorize with Salla' }}
            </button>
            <!-- The other half of the same action. Salla's callback returns the
                 merchant to Salla's own dashboard, not to this tab, so nothing
                 here observes the grant — someone has to say so. -->
            <button :class="SECONDARY_BTN" :disabled="loading" @click="load">
              {{ loading ? 'Checking…' : "I've authorized" }}
            </button>
          </div>
          <p class="text-xs text-subtle"
            >Authorizing opens Salla in a new tab. Come back here afterwards and
            press <span class="text-muted">I've authorized</span>.</p
          >
        </template>
      </div>
    </div>
  </CardPanel>
</template>

<script setup>
/**
 * Authorize a Salla store, as the first thing on the create form. Salla port of
 * `ZidAuthorizePanel`.
 *
 * ## It asks for a grant, not for a store id
 *
 * The store id is required — the backend rejects a Salla source without one — but
 * it is **read off the grant** (`…/salla-connections`) rather than typed, which
 * is why an empty `modelValue` is exactly "not authorized yet" and is what the
 * form gates its submit on.
 *
 * ## `apiMissing` is the one branch that still types an id
 *
 * With no `…/salla-connections` there is nothing to read the id off and no way to
 * confirm the grant, and the backend will still refuse a Salla source without one.
 * Saying so and asking beats silently blocking the form.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import CardPanel from '@/components/ui/CardPanel.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { NOT_KNOWN } from '@/lib/emptyValue'
import { formatDateTime } from '@/composables/useSources'
import { useDataSource } from '@/composables/useDataSource'
import { useSallaConnections } from '@/composables/useSallaConnections'
import { legacyAuthorizeUrl, openAuthorize } from '@/lib/sallaAuthorize'

// The wizard's own button classes, copied deliberately so the two panels are one
// continuous flow rather than two designs of the same idea.
const PRIMARY_BTN =
  'flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40'
const SECONDARY_BTN =
  'flex h-8 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-xs text-ink shadow-sm hover:bg-fill disabled:opacity-40'

const props = defineProps({
  /** The authorized store's id. Empty means "not authorized yet". */
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const $q = useQuasar()
const { isReal } = useDataSource()
const { connections, loading, error, apiMissing, load, authorizeUrl } =
  useSallaConnections()

const authorizing = ref(false)

const authorized = computed(
  () => !apiMissing.value && connections.value.length > 0
)

const selected = computed(
  () =>
    connections.value.find(c => c.storeId === props.modelValue) ??
    connections.value[0] ??
    null
)

const legacyHref = computed(() => legacyAuthorizeUrl(props.modelValue.trim()))

// The grant settles the id, so the form never has to ask for it. Re-runs on
// every list read, which is what makes "I've authorized" complete the panel.
watch(connections, list => {
  if (apiMissing.value || !list.length) return
  if (!list.some(c => c.storeId === props.modelValue)) {
    emit('update:modelValue', list[0].storeId)
  }
})

/**
 * Open the backend's authorization URL.
 *
 * Read on click rather than on mount: it is a single-use start code, so one
 * fetched early is likely to be spent or stale by the time anyone presses the
 * button.
 */
async function authorize() {
  authorizing.value = true
  try {
    const res = await authorizeUrl()
    if (!res.ok) {
      $q.notify({
        message: res.apiMissing
          ? 'No authorization link available.'
          : (res.error ?? 'Could not get an authorization link.'),
        caption: res.apiMissing
          ? "This backend doesn't serve Salla authorization yet."
          : undefined,
        color: 'dark',
        position: 'top-right',
        timeout: 6000
      })
      return
    }
    openAuthorize(res.data)
  } finally {
    authorizing.value = false
  }
}

function openLegacy() {
  openAuthorize(legacyHref.value)
}

onMounted(load)
</script>
