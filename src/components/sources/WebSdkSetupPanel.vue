<template>
  <CardPanel v-if="visible">
    <template #header>
      <span class="text-sm font-semibold text-ink">Web SDK setup</span>
      <div class="flex items-center gap-2">
        <StatusBadge tone="brand" label="2 steps to go live" />
        <button class="text-xs text-subtle hover:text-muted" @click="dismiss">
          Skip setup
        </button>
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <!-- Step 1: Install the snippet -->
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          :class="
            step1Done
              ? 'bg-success-bg text-success border border-success-line'
              : 'bg-brand/10 text-brand border border-brand/30'
          "
        >
          {{ step1Done ? '✓' : '1' }}
        </div>
        <div class="flex flex-1 flex-col gap-2">
          <div>
            <p class="text-sm font-medium text-ink"
              >Add the snippet to your site</p
            >
            <p class="mt-0.5 text-xs text-muted">
              Paste this tag into the &lt;head&gt; of every page you want to
              track. The write key was generated for this source, so everything
              else is fixed configuration.
            </p>
          </div>
          <pre
            class="overflow-x-auto rounded-lg border border-line2 bg-sidebar p-3 font-mono text-xs leading-5 text-muted"
            >{{ snippet }}</pre
          >
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              :disabled="!source.writeKey"
              @click="copySnippet"
            >
              Copy snippet
            </button>
            <p v-if="!source.writeKey" class="text-xs text-amber-600">
              The write key is still provisioning. Reload in a moment.
            </p>
          </div>
        </div>
      </div>

      <!-- Step 2: Verify events are flowing -->
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
            <p class="text-sm font-medium text-ink"
              >Verify events are arriving</p
            >
            <p class="mt-0.5 text-xs text-muted">
              Open your site with the snippet installed, then check that its
              events reached this source's ClickHouse destination.
            </p>
          </div>
          <div v-if="!step2Done">
            <button
              :disabled="!step1Done || checking"
              class="flex h-8 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-xs text-ink shadow-sm hover:bg-fill disabled:opacity-40"
              @click="verify"
            >
              {{ checking ? 'Checking…' : 'Check for events' }}
            </button>
          </div>
          <p v-if="verifyMsg" class="text-xs text-amber-600">{{ verifyMsg }}</p>
          <p v-if="verifyError" class="text-xs text-rose-500">{{
            verifyError
          }}</p>
        </div>
      </div>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { listSourceEvents } from '@/api/fanfinity'
import { currentAccount, waitForAccount } from '@/composables/useMe'
import { webSdkSnippet } from '@/lib/webSdkSnippet'

// The Web SDK counterpart of ZidSetupWizard. The backend already provisioned
// the whole pipeline at creation (Jitsu stream -> browser write key ->
// ClickHouse destination + pipe), so going live is two steps: paste the
// snippet, then confirm events are landing. Clipboard work stays with the page
// (the `copy` emit), same as the other source panels.
const props = defineProps({
  source: { type: Object, required: true }
})

const emit = defineEmits(['copy', 'complete'])

const copiedKey = computed(() => `web_snippet_copied_${props.source.id}`)
const verifiedKey = computed(() => `web_verified_${props.source.id}`)
const dismissKey = computed(() => `web_wizard_dismissed_${props.source.id}`)

const dismissed = ref(localStorage.getItem(dismissKey.value) === '1')
// Step 1 (copied) is persisted so a reload doesn't lose progress. Step 2 is
// persisted too, but only ever set after the backend confirmed events exist —
// a stale flag can't claim data that was never seen.
const step1Done = ref(localStorage.getItem(copiedKey.value) === '1')
const step2Done = ref(localStorage.getItem(verifiedKey.value) === '1')

const checking = ref(false)
const verifyMsg = ref('')
const verifyError = ref('')

const visible = computed(
  () =>
    props.source.sourceType === 'web' && !dismissed.value && !step2Done.value
)

const snippet = computed(() => webSdkSnippet(props.source.writeKey ?? ''))

function copySnippet() {
  emit('copy', { label: 'Web snippet', value: snippet.value })
  localStorage.setItem(copiedKey.value, '1')
  step1Done.value = true
}

// Ask the backend whether any browser events have landed in this source's
// ClickHouse database — the honest end-to-end check, not just "the tag is on
// the page".
async function verify() {
  verifyMsg.value = ''
  verifyError.value = ''
  checking.value = true
  try {
    await waitForAccount()
    const accountId = currentAccount.value?.id
    if (!accountId) throw new Error('No account selected')
    const { data } = await listSourceEvents(accountId, props.source.id, {
      page: 1,
      size: 1
    })
    if ((data?.total ?? 0) > 0) {
      localStorage.setItem(verifiedKey.value, '1')
      step2Done.value = true
      emit('complete')
    } else {
      verifyMsg.value =
        'No events yet. Load a page on your site with the snippet installed, wait a few seconds, then check again.'
    }
  } catch (e) {
    verifyError.value = `Couldn't check for events: ${e.message || 'request failed'}`
  } finally {
    checking.value = false
  }
}

function dismiss() {
  localStorage.setItem(dismissKey.value, '1')
  dismissed.value = true
}
</script>
