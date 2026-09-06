<template>
  <div class="flex flex-col gap-4">
    <!-- Verified hero. Rendered above the instructions rather than below them:
         once this is true the instructions are reference material, not the task,
         and the answer to "did it work?" should not need a scroll. -->
    <CardPanel v-if="verified" tone="surface" class="border-sfere-success/40!">
      <div class="flex items-start gap-4">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-full bg-sfere-success-soft text-sfere-success"
        >
          <svg
            viewBox="0 0 20 20"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 10.5l3.5 3.5L15 6" />
          </svg>
        </span>
        <div>
          <p class="text-sm font-semibold text-ink"
            >Verified. {{ source.name }} is live</p
          >
          <p class="mt-1! text-sm text-muted">{{ verifiedMessage }}</p>
        </div>
      </div>
    </CardPanel>

    <!-- Cloud apps are pulled on a schedule, so there is nothing to install.
         Saying that plainly beats an empty tab bar. -->
    <CardPanel v-if="!methods.length">
      <template #header>
        <span class="text-sm font-semibold text-ink">Nothing to install</span>
        <StatusBadge tone="neutral" label="Pull source" />
      </template>
      <p class="text-sm text-muted">
        {{ source.name }} is a cloud app, so Sfere signs in and pulls from it on
        a schedule, so there is no snippet, no write key and no endpoint to wire
        up. Its credentials live with the connector, and the first sync starts
        on its own.
      </p>
    </CardPanel>

    <template v-else>
      <!-- The write key, once, at the top. Every snippet below already has it
           inlined; this row exists for the person who is pasting it into a
           config file the guide does not cover.

           IT IS NOT `source.writeKey`. That field is a snapshot of the first key
           the source was ever issued and the backend never moves it onto a
           rotated one, so it is right only until somebody rotates — see
           `snippetWriteKey()`. -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill px-4 py-3"
      >
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-subtle"
            >Browser write key for {{ source.name }}</p
          >
          <code class="font-sfere-mono text-sm text-ink">{{ shownKey }}</code>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <SfereButton
            v-if="writeKey"
            variant="ghost"
            size="sm"
            @click="revealed = !revealed"
            >{{ revealed ? 'Hide' : 'Reveal' }}</SfereButton
          >
          <SfereButton
            variant="secondary"
            size="sm"
            :disabled="!writeKey"
            @click="emit('copy', { label: 'Write key', value: writeKey })"
            >Copy key</SfereButton
          >
        </div>
      </div>

      <!-- Rotated in this session. Said out loud because the snippets below have
           silently changed under anyone who had them open, and because this key
           is held in memory only — a reload puts the record's key back on
           screen, and somebody who has not pasted it yet needs to know that
           before they reload. -->
      <NoticeBanner
        v-if="mintedKey"
        tone="success"
        title="Showing the key you just created"
        message="Every snippet below now carries it. It is held for this browser tab only — the backend shows a key's value once — so paste it before you reload, or come back and mint another."
      />

      <!-- The key on the source's record has been revoked. The snippets carry a
           placeholder rather than a dead key: a snippet that looks complete and
           silently collects nothing is the worst thing this page could hand
           somebody, and it is what shipped before this branch existed. -->
      <NoticeBanner
        v-else-if="recordKeyRevoked"
        tone="warn"
        title="The key this source was created with has been revoked"
        :message="revokedMessage"
      />

      <NoticeBanner
        tone="info"
        title="This key is public by design"
        message="It sits in client-side code, the same way a Google Analytics or Meta Pixel id does. The key that must stay private is a server-to-server key, which is issued separately from the source's Settings tab."
      />

      <CardPanel>
        <!-- A source is only offered the methods that fit it, so a mobile
             source has exactly one. A one-item tab bar is decoration that looks
             like a choice, so it is not rendered — the lede below already names
             the method. -->
        <TabNav
          v-if="methodTabs.length > 1"
          v-model="method"
          :tabs="methodTabs"
        />

        <p v-if="active?.lede" class="mb-4! text-sm text-muted">{{
          active.lede
        }}</p>

        <div class="flex flex-col gap-5">
          <div v-for="(block, i) in active?.blocks ?? []" :key="i">
            <p v-if="block.title" class="mb-1! text-sm font-medium text-ink">{{
              block.title
            }}</p>
            <p v-if="block.body" class="mb-2! text-xs text-muted">{{
              block.body
            }}</p>
            <SfereCode :code="block.code" :filename="block.filename">
              <template #actions>
                <button
                  class="rounded-sfere-sm border border-sfere-hairline px-2 py-1 font-sfere-mono text-sfere-label uppercase text-white/60 hover:text-white"
                  @click="
                    emit('copy', {
                      label: block.filename || 'Snippet',
                      value: block.code
                    })
                  "
                >
                  Copy
                </button>
              </template>
            </SfereCode>
          </div>
        </div>

        <!-- Optional attributes, for the tab that has them. A table rather than
             prose: the reader is scanning for one row, not reading. -->
        <div v-if="active?.attributes?.length" class="mt-5">
          <p class="mb-2! text-sm font-medium text-ink">Optional attributes</p>
          <SfereTable
            :columns="ATTRIBUTE_COLUMNS"
            :rows="active.attributes"
            row-key="name"
          >
            <template #cell-name="{ row }">
              <code class="font-sfere-mono text-xs text-sfere-brand-text">{{
                row.name
              }}</code>
            </template>
          </SfereTable>
        </div>

        <p v-if="active?.note" class="mt-4! text-xs text-muted">{{
          active.note
        }}</p>
      </CardPanel>

      <!-- Confirmation. ONE check, and it is the real one: has a real event
           arrived. The proposal also wanted a "paste your URL and we'll look for
           the script" checker; that is a cross-origin fetch the CSP blocks
           outright and it would only ever prove the tag is on the page, not that
           an event reached us. Asking the backend what it actually received is
           strictly stronger, so there is one panel rather than two.

           `verify` TURNS IT OFF, AND EXACTLY ONE CALLER DOES SO. The first-run
           arrival makes confirmation a beat of its own — the prototype's
           "Confirm it's working" screen — so rendering this panel there would put
           two identical checks on consecutive screens, and this one fires
           confetti and ends the guided tour on first success, one beat before the
           screen whose whole job is that check. It defaults to ON so neither
           existing call site changes. -->
      <CardPanel v-if="verify">
        <template #header>
          <span class="text-sm font-semibold text-ink"
            >Confirm it is working</span
          >
          <StatusBadge
            :tone="verified ? 'success' : 'neutral'"
            :label="verified ? 'Receiving events' : 'Waiting for first event'"
            dot
          />
        </template>

        <p class="text-sm text-muted">
          Load a page with the snippet installed, then check. We look for a real
          event that reached this source, not just whether the tag is on the
          page, because a tag can be present and still be blocked by a consent
          tool or a mistyped key.
        </p>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <SfereButton
            :loading="checking"
            :disabled="checking"
            size="sm"
            data-tour="source-verify"
            @click="check()"
            >{{ verified ? 'Check again' : 'Check for events' }}</SfereButton
          >
          <p v-if="lastChecked" class="text-xs text-subtle"
            >Last checked {{ lastChecked }}</p
          >
        </div>

        <NoticeBanner
          v-if="result"
          class="mt-4"
          :tone="result.tone"
          :title="result.title"
        >
          <p class="text-sm">{{ resultMessage }}</p>
          <ul
            v-if="result.fixes"
            class="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm"
          >
            <li v-for="fix in result.fixes" :key="fix">{{ fix }}</li>
          </ul>
        </NoticeBanner>
      </CardPanel>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereCode from '@/components/ui/SfereCode.vue'
import SfereTable from '@/components/ui/SfereTable.vue'
import { methodsForSource } from '@/lib/sourceInstallSnippets'
import { checkSourceEvents } from '@/lib/sourceEventCheck'
import { useConfetti } from '@/composables/useConfetti'
import { useGuidedTour } from '@/composables/useGuidedTour'
import {
  mintedWriteKeyFor,
  snippetWriteKey,
  useSourceWriteKeys,
  writeKeyIdOf
} from '@/composables/useSourceWriteKeys'

// Step 3 of the guided source flow, and also the "Setup instructions" tab on a
// source's detail page — the same content in both places, because the person who
// closed the tab mid-setup and the person coming back a week later want exactly
// the same thing.
const props = defineProps({
  source: { type: Object, required: true },
  // `preview` means the source was never persisted (mock data mode). The
  // snippets are still correct shape, but the key is not a real key and the
  // event check has nothing to ask, so both say so rather than failing oddly.
  preview: { type: Boolean, default: false },
  // Where this source's events already land, when something has established
  // that. Creating a web or Zid source provisions a ClickHouse destination and
  // the pipe feeding it, so "add a destination next" is wrong advice for most
  // sources that reach this component — but it is still right for a cloud app,
  // and for a source whose pipe nobody looked up. Empty string means "not
  // established", not "there is none", which is why the caller passes a name
  // rather than this deriving one from the source type.
  deliversTo: { type: String, default: '' },
  // Whether to render the "Confirm it is working" panel. DEFAULT ON, so both
  // existing call sites — `/sources/new` step 3 and the source detail page's
  // Setup instructions tab — are unchanged. The first-run arrival passes `false`
  // because it makes confirmation a beat of its own; see the template.
  verify: { type: Boolean, default: true }
})

const emit = defineEmits(['copy', 'verified'])

// Referenced by the optional-attributes table on the HTML tab.
const ATTRIBUTE_COLUMNS = [
  { key: 'name', label: 'Attribute', width: '30%' },
  { key: 'what', label: 'What it does' }
]

const revealed = ref(false)
const checking = ref(false)
const verified = ref(false)
const result = ref(null)
const lastChecked = ref('')
// How many events the last successful check saw. Held apart from `result` so the
// sentence beside it can be DERIVED rather than frozen at check time: the arrival
// probe below runs on mount, which is usually before the detail page's own pipes
// read has resolved, so a message baked then would tell a source with a
// provisioned ClickHouse pipe to go and add a destination.
const eventTotal = ref(0)

// The first real event is the moment the whole setup was for, so it gets the
// same burst the provisioned pipeline does.
//
// GATED ON THE RESULT, NOT ON `verified`, and that distinction is the bug this
// avoids rather than a style choice: the preview branch below also sets
// `verified` and emits, while reporting `tone: 'info'` and saying plainly that
// nothing was checked. Celebrating there would be confetti for a source that was
// never saved.
//
// ONE-WAY, because the button becomes "Check again" and every later click
// re-enters the same success branch — a burst per click would turn the
// celebration into a toy.
const { fire: fireConfetti } = useConfetti()
// The last step of the walkthrough is this button, so a real event is also where
// the walkthrough ends. Ended here rather than on the create page because this
// component is the one that learns the answer — and because it is shared with
// the source detail page, so somebody who closed the tab mid-setup and came back
// a week later finishes the same walkthrough on the same control.
const { end: endTour } = useGuidedTour()
let celebrated = false

// ------------------------------------------------------------- the write key
//
// WHICH KEY THE SNIPPETS CARRY, AND WHY IT IS NOT SIMPLY `source.writeKey`.
// `Source.write_key` is written once, when the source is created, and no
// backend route moves it: `POST …/write-keys` mints a key and
// `DELETE …/write-keys/{id}` revokes one, and neither touches the field. So a
// rotation changed nothing on this page — the snippet went on inlining the
// original key — and once the original was revoked the page was handing out a
// key that ingest rejects, with no sign anything was wrong. That is the bug
// this block exists for, and it has two halves:
//
//  1. A key minted in this session is preferred, so a rotation is visible in
//     the snippet immediately. `snippetWriteKey()` owns that lookup; the Web
//     SDK panel reads the same function, so the two snippets on the detail
//     screen cannot disagree.
//  2. Failing that, the record's key is CHECKED against the live list before it
//     is printed. The list carries ids and hints, never values, which is enough:
//     the record's key is a `keyId:secret` pair, so a key id that no longer
//     appears in the list has been revoked.
//
// The check is skipped wherever it could only guess — preview mode (no backend
// behind the source), a record whose key is the bare `jitsu_site_id` fallback
// (no id half to match), and whenever a session-minted key already answers the
// question. `keysChecked` gates the verdict so a read still in flight, or one
// that came back `noSite`/`apiMissing`/failed, prints the record's key exactly
// as it always did rather than accusing it of being revoked.
const { keys: liveKeys, load: loadWriteKeys } = useSourceWriteKeys()
const keysChecked = ref(false)

const mintedKey = computed(() => mintedWriteKeyFor(props.source?.id))

// Newest first, because the one worth naming in the banner below is the one
// most likely to be the replacement somebody just minted.
const livePublicKeys = computed(() =>
  liveKeys.value
    .filter(k => k.kind === 'public')
    .slice()
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
)

const recordKeyRevoked = computed(() => {
  if (mintedKey.value) return false
  if (!keysChecked.value || !liveKeys.value.length) return false
  const id = writeKeyIdOf(props.source?.writeKey)
  if (!id) return false
  return !liveKeys.value.some(k => k.id === id)
})

// '' rather than the record's key once that key is known to be revoked, which
// is what makes the snippets fall back to their `your-write-key` placeholder.
const writeKey = computed(() =>
  recordKeyRevoked.value ? '' : snippetWriteKey(props.source)
)

async function checkRecordKey() {
  keysChecked.value = false
  if (props.preview) return
  if (!props.source?.id) return
  if (mintedKey.value) return
  if (!writeKeyIdOf(props.source.writeKey)) return
  await loadWriteKeys(props.source.id)
  keysChecked.value = true
}

onMounted(checkRecordKey)
watch(() => props.source?.id, checkRecordKey)

const methods = computed(() => methodsForSource(props.source, writeKey.value))

const method = ref(methods.value[0]?.key ?? '')

// A source swapped underneath us (detail page navigation) can invalidate the
// selected tab, so fall back to the first available method rather than rendering
// an empty panel.
watch(methods, list => {
  if (!list.some(m => m.key === method.value)) {
    method.value = list[0]?.key ?? ''
  }
})

const methodTabs = computed(() =>
  methods.value.map(m => ({ key: m.key, label: m.label }))
)

const active = computed(
  () => methods.value.find(m => m.key === method.value) ?? null
)

const shownKey = computed(() => {
  const key = writeKey.value
  if (!key) return recordKeyRevoked.value ? 'revoked' : 'provisioning…'
  if (revealed.value) return key
  return `${key.slice(0, 12)}${'•'.repeat(Math.max(key.length - 12, 6))}`
})

const revokedMessage = computed(() => {
  const live = livePublicKeys.value
  const replacement = live.length
    ? `Another browser key (…${live[0].hint}) is live, but a key's value is only ever shown once, when it is created — paste the value you copied then in place of “your-write-key” below.`
    : 'This source has no live browser key at all, so nothing sent to it can be accepted.'
  return `Anything still sending on it is being rejected. ${replacement} You can mint a replacement on the Settings tab; do that here and every snippet on this page picks it up straight away.`
})

const verifiedMessage = computed(() =>
  props.preview
    ? 'Simulated for this preview. No events were actually received, because nothing was saved to the backend.'
    : 'A real event reached this source, so the whole path (snippet, key, ingest) is working end to end.'
)

// The sentence after "N events received". Two different truths, and the old copy
// only ever told one of them.
const arrivedNext = computed(() =>
  props.deliversTo
    ? `They are already being delivered to ${props.deliversTo}, so there is nothing else to set up.`
    : 'Nothing else to do here. Add a destination next so they have somewhere to go.'
)

// The banner body. Only the success case is computed — the rest carry their own
// wording and nothing about them changes after the check.
const resultMessage = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.tone !== 'success') return r.message ?? ''
  const n = eventTotal.value
  return `${n} event${n === 1 ? '' : 's'} received so far. ${arrivedNext.value}`
})

const FIXES = [
  'Did you save and publish the page after adding the snippet?',
  'View the page source, not the editor. Is the tag actually in the served HTML?',
  'Is an ad blocker or a consent tool on that page blocking third-party scripts?',
  'Does the write key in the snippet match the one shown above?',
  'Behind a CDN or a cache? A change can take a few minutes to go live.'
]

function stamp() {
  lastChecked.value = new Date().toLocaleTimeString()
}

// One request, two entry points. `silent` is the arrival probe: it updates the
// badge and the hero but writes no banner and fires no confetti, because nobody
// pressed anything. A loud version would greet every visit to this tab with
// either a celebration for work done last month or an amber troubleshooting list
// for a snippet the reader has not pasted yet.
async function check({ silent = false } = {}) {
  if (!silent) {
    checking.value = true
    result.value = null
  }

  // Preview mode has no backend to ask. Rather than call and fail with a
  // confusing 404, say what this would do and let the flow continue.
  if (props.preview) {
    if (silent) return
    await new Promise(r => setTimeout(r, 700))
    verified.value = true
    stamp()
    result.value = {
      tone: 'info',
      title: 'Nothing to check in preview mode',
      message:
        'This source was not saved, so there is no ingest endpoint behind it. Switch Settings → Data source to real and create the source again to run the live check.'
    }
    emit('verified')
    checking.value = false
    return
  }

  const { state, total, message } = await checkSourceEvents(props.source.id)
  if (!silent) {
    checking.value = false
    stamp()
  }

  if (state === 'found') {
    verified.value = true
    // The success panel is worth showing even on the silent pass: it carries the
    // count and where the events are going, which is the answer somebody opened
    // this tab for. What the silent pass suppresses is the celebration and the
    // failure states, not the good news.
    eventTotal.value = total
    result.value = { tone: 'success', title: 'Events are arriving' }
    if (!celebrated && !silent) {
      celebrated = true
      // Lower and smaller than the create page's burst: this one sits over a
      // result panel someone is reading, not over a full-screen overlay.
      fireConfetti({ count: 80, origin: { x: 0.5, y: 0.55 } })
      endTour()
    }
    // Not on the silent pass. The create page answers this emit with a "Source
    // verified" toast, and a toast for a check nobody ran is the same category of
    // noise as the confetti above it.
    if (!silent) emit('verified')
    return
  }

  if (silent) return

  if (state === 'unsupported') {
    // A 400 means the source has no queryable event log yet, which is the normal
    // state of every `event_stream` source until its SDK has initialised. Red is
    // the wrong colour for "you have not finished installing it".
    result.value = {
      tone: 'info',
      title: 'No event log to read yet',
      message:
        'This source has not received anything yet, so there is nothing to query. Run the app or load the page with the snippet installed, then check again.'
    }
    return
  }

  if (state === 'error') {
    result.value = {
      tone: 'danger',
      title: "Couldn't run the check",
      message
    }
    return
  }

  result.value = {
    tone: 'warn',
    title: 'No events yet',
    message:
      'Nothing has reached this source. If you just pasted the snippet, load a page on your site and check again in a few seconds. If you already did:',
    fixes: FIXES
  }
}

// ASK ON ARRIVAL, DON'T MAKE THEM CLICK. This guide is the source detail page's
// Setup instructions tab as well as the create flow's last step, so most of the
// people who open it are coming back to a source that has been live for weeks —
// and it used to greet all of them with "Waiting for first event" until they
// pressed a button to be told what the backend already knew.
onMounted(() => {
  if (props.verify) check({ silent: true })
})
</script>
