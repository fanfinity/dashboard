<template>
  <CardPanel v-if="visible">
    <template #header>
      <span class="text-sm font-semibold text-ink">Web SDK setup</span>
      <div class="flex items-center gap-2">
        <StatusBadge tone="brand" :label="stepsLabel" />
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
              :disabled="!writeKey"
              @click="copySnippet"
            >
              Copy snippet
            </button>
            <p v-if="!writeKey" class="text-xs text-amber-600">
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
              :disabled="checking"
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
import { computed, onMounted, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { checkSourceEvents } from '@/lib/sourceEventCheck'
import { webSdkSnippet } from '@/lib/webSdkSnippet'
import { snippetWriteKey } from '@/composables/useSourceWriteKeys'

// The Web SDK counterpart of ZidSetupWizard. The backend already provisioned
// the whole pipeline at creation (Jitsu stream -> browser write key ->
// ClickHouse destination + pipe), so going live is two steps: paste the
// snippet, then confirm events are landing. Clipboard work stays with the page
// (the `copy` emit), same as the other source panels.
//
// IT ASKS THE BACKEND BEFORE IT ASKS THE READER, and that is the fix to the bug
// this panel shipped with. Both steps used to be pure `localStorage` flags, so a
// source that had been receiving events for a month greeted anyone on a second
// machine — or after a cleared cache — with "2 steps to go live" over a live
// pipeline. Worse, the step-2 button was disabled until step 1 was ticked, and
// the only thing that ticked step 1 was clicking **Copy snippet**: somebody whose
// tag was already installed (by a teammate, through a tag manager, in an earlier
// session) had to copy a snippet they did not need in order to unlock the check
// that would have told them they were done. Reality is one request away, so the
// panel asks first and only renders once it has an answer.
const props = defineProps({
  source: { type: Object, required: true }
})

const emit = defineEmits(['copy', 'complete'])

const copiedKey = computed(() => `web_snippet_copied_${props.source.id}`)
const verifiedKey = computed(() => `web_verified_${props.source.id}`)
const dismissKey = computed(() => `web_wizard_dismissed_${props.source.id}`)

const dismissed = ref(localStorage.getItem(dismissKey.value) === '1')
// Step 1 (copied) is persisted so a reload doesn't lose progress, and it is now
// decoration only — it draws a tick, it no longer gates anything. Step 2 is
// persisted too, but only ever set after the backend confirmed events exist, so
// a stale flag can't claim data that was never seen.
const step1Done = ref(localStorage.getItem(copiedKey.value) === '1')
const step2Done = ref(localStorage.getItem(verifiedKey.value) === '1')

const checking = ref(false)
const verifyMsg = ref('')
const verifyError = ref('')

// True until the mount-time check settles. Rendering through it would flash
// "2 steps to go live" over an already-live source for the length of one request
// and then yank the card away, which reads as a glitch rather than as an answer.
const probing = ref(true)

const visible = computed(
  () =>
    props.source.sourceType === 'web' &&
    !probing.value &&
    !dismissed.value &&
    !step2Done.value
)

// Derived, because "2 steps to go live" above a ticked step 1 was counting work
// that was already done.
const stepsLabel = computed(() => {
  const left = (step1Done.value ? 0 : 1) + (step2Done.value ? 0 : 1)
  return `${left} step${left === 1 ? '' : 's'} to go live`
})

// `snippetWriteKey`, not `source.writeKey`: a key minted on the Settings tab
// wins, because the backend never moves `Source.write_key` onto a rotated key
// and this panel and the Setup instructions tab must not print two different
// snippets for the same source.
const writeKey = computed(() => snippetWriteKey(props.source))

const snippet = computed(() => webSdkSnippet(writeKey.value))

function markLive() {
  localStorage.setItem(verifiedKey.value, '1')
  step2Done.value = true
}

function copySnippet() {
  emit('copy', { label: 'Web snippet', value: snippet.value })
  localStorage.setItem(copiedKey.value, '1')
  step1Done.value = true
}

// Does this source already have events? Asked once, on arrival, silently: a
// source that is already live has no setup left, so the honest render is no
// panel at all. Deliberately says nothing when it finds nothing — the reader has
// not pressed anything yet, so an amber "no events yet" here would be the panel
// answering a question nobody asked. `unsupported` and `error` both leave the
// panel up: neither is evidence that events are arriving.
async function probe() {
  if (step2Done.value || dismissed.value) {
    probing.value = false
    return
  }
  const { state } = await checkSourceEvents(props.source.id)
  if (state === 'found') markLive()
  probing.value = false
}

// The same question, asked on purpose. This one reports what it found, because
// here the reader pressed a button and an unanswered click is worse than bad
// news.
async function verify() {
  verifyMsg.value = ''
  verifyError.value = ''
  checking.value = true
  const { state, message } = await checkSourceEvents(props.source.id)
  checking.value = false

  if (state === 'found') {
    markLive()
    emit('complete')
    return
  }
  if (state === 'error') {
    verifyError.value = `Couldn't check for events: ${message}`
    return
  }
  verifyMsg.value =
    state === 'unsupported'
      ? 'This source has no event log to read yet. That is normal until the snippet has run once — load a page on your site, then check again.'
      : 'No events yet. Load a page on your site with the snippet installed, wait a few seconds, then check again.'
}

function dismiss() {
  localStorage.setItem(dismissKey.value, '1')
  dismissed.value = true
}

onMounted(probe)
</script>
