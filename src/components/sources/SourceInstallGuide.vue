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
            >Verified — {{ source.name }} is live</p
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
        {{ source.name }} is a cloud app — Sfere signs in and pulls from it on a
        schedule, so there is no snippet, no write key and no endpoint to wire
        up. Its credentials live with the connector, and the first sync starts
        on its own.
      </p>
    </CardPanel>

    <template v-else>
      <!-- The write key, once, at the top. Every snippet below already has it
           inlined; this row exists for the person who is pasting it into a
           config file the guide does not cover. -->
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
            variant="ghost"
            size="sm"
            @click="revealed = !revealed"
            >{{ revealed ? 'Hide' : 'Reveal' }}</SfereButton
          >
          <SfereButton
            variant="secondary"
            size="sm"
            :disabled="!source.writeKey"
            @click="
              emit('copy', { label: 'Write key', value: source.writeKey })
            "
            >Copy key</SfereButton
          >
        </div>
      </div>

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
           strictly stronger, so there is one panel rather than two. -->
      <CardPanel>
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
          event that reached this source — not just whether the tag is on the
          page, because a tag can be present and still be blocked by a consent
          tool or a mistyped key.
        </p>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <SfereButton
            :loading="checking"
            :disabled="checking"
            size="sm"
            @click="check"
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
          <p class="text-sm">{{ result.message }}</p>
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
import { computed, ref, watch } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereCode from '@/components/ui/SfereCode.vue'
import SfereTable from '@/components/ui/SfereTable.vue'
import { methodsForSource } from '@/lib/sourceInstallSnippets'
import { listSourceEvents } from '@/api/fanfinity'
import { currentAccount, waitForAccount } from '@/composables/useMe'

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
  deliversTo: { type: String, default: '' }
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

const methods = computed(() => methodsForSource(props.source))

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
  const key = props.source.writeKey ?? ''
  if (!key) return 'provisioning…'
  if (revealed.value) return key
  return `${key.slice(0, 12)}${'•'.repeat(Math.max(key.length - 12, 6))}`
})

const verifiedMessage = computed(() =>
  props.preview
    ? 'Simulated for this preview — no events were actually received, because nothing was saved to the backend.'
    : 'A real event reached this source, so the whole path — snippet, key, ingest — is working end to end.'
)

// The sentence after "N events received". Two different truths, and the old copy
// only ever told one of them.
const arrivedNext = computed(() =>
  props.deliversTo
    ? `They are already being delivered to ${props.deliversTo} — nothing else to set up.`
    : 'Nothing else to do here — add a destination next so they have somewhere to go.'
)

const FIXES = [
  'Did you save and publish the page after adding the snippet?',
  'View the page source, not the editor — is the tag actually in the served HTML?',
  'Is an ad blocker or a consent tool on that page blocking third-party scripts?',
  'Does the write key in the snippet match the one shown above?',
  'Behind a CDN or a cache? A change can take a few minutes to go live.'
]

function stamp() {
  lastChecked.value = new Date().toLocaleTimeString()
}

async function check() {
  checking.value = true
  result.value = null

  // Preview mode has no backend to ask. Rather than call and fail with a
  // confusing 404, say what this would do and let the flow continue.
  if (props.preview) {
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

  try {
    await waitForAccount()
    const accountId = currentAccount.value?.id
    if (!accountId) throw new Error('No account selected')

    const { data } = await listSourceEvents(accountId, props.source.id, {
      page: 1,
      size: 1
    })
    stamp()

    if ((data?.total ?? 0) > 0) {
      verified.value = true
      result.value = {
        tone: 'success',
        title: 'Events are arriving',
        message: `${data.total} event${data.total === 1 ? '' : 's'} received so far. ${arrivedNext.value}`
      }
      emit('verified')
    } else {
      result.value = {
        tone: 'warn',
        title: 'No events yet',
        message:
          'Nothing has reached this source. If you just pasted the snippet, load a page on your site and check again in a few seconds. If you already did:',
        fixes: FIXES
      }
    }
  } catch (e) {
    stamp()
    result.value = {
      tone: 'danger',
      title: "Couldn't run the check",
      message: e.message || 'The request failed.'
    }
  } finally {
    checking.value = false
  }
}
</script>
