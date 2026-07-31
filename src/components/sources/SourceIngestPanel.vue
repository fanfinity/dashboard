<template>
  <CardPanel>
    <template #header>
      <span class="text-sm font-semibold text-ink">Ingest</span>
      <StatusBadge
        :variant="source.writeKey ? 'brand' : 'neutral'"
        :label="source.writeKey ? 'Push' : 'Pull'"
      />
    </template>

    <!-- Cloud apps are polled by a connector, so no write key is ever issued. -->
    <p v-if="!source.writeKey" class="text-sm text-muted">
      {{ source.name }} is a cloud app: Fanfinity pulls from it on a schedule,
      so there is no write key or ingest endpoint to configure here. Credentials
      are managed with the connector.
    </p>

    <div v-else class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <p class="text-xs font-medium text-subtle">Endpoint</p>
        <div class="flex items-center gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded-lg border border-line2 bg-sidebar px-2.5 py-2 font-mono text-xs text-ink"
            >{{ endpoint }}</code
          >
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="emit('copy', { label: 'Endpoint', value: endpoint })"
          >
            Copy
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <p class="text-xs font-medium text-subtle">Write key</p>
        <div class="flex items-center gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded-lg border border-line2 bg-sidebar px-2.5 py-2 font-mono text-xs text-ink"
            >{{ shownKey }}</code
          >
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-muted hover:bg-fill"
            @click="revealed = !revealed"
          >
            {{ revealed ? 'Hide' : 'Reveal' }}
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="
              emit('copy', { label: 'Write key', value: source.writeKey })
            "
          >
            Copy
          </button>
        </div>
        <p class="text-xs text-subtle"
          >Treat this like a password. Rotating it stops every client using the
          old key.</p
        >
      </div>

      <div class="flex flex-col gap-1">
        <p class="text-xs font-medium text-subtle">{{ snippet.label }}</p>
        <pre
          class="overflow-x-auto rounded-lg border border-line2 bg-sidebar p-3 font-mono text-xs leading-5 text-muted"
          >{{ snippet.code }}</pre
        >
        <div class="mt-1">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="emit('copy', { label: snippet.label, value: fullSnippet })"
          >
            Copy snippet
          </button>
        </div>
      </div>
    </div>
  </CardPanel>
</template>

<script setup>
import { computed, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'

// How a client actually pushes into this source: endpoint, write key and the
// integration snippet for the template it was created from.
//
// The component owns no data and performs no clipboard work — it emits `copy`
// with `{ label, value }` and the page decides what to do with it, so the
// permission-sensitive `navigator.clipboard` call and its toast live in one
// place instead of in every panel.
const props = defineProps({
  source: { type: Object, required: true }
})
const emit = defineEmits(['copy'])

const revealed = ref(false)

const endpoint = computed(
  () => `https://ingest.fanfinity.io/v1/${props.source.slug}`
)

// The key is masked by default; `shownKey` is what the eye sees, `source.writeKey`
// is what Copy puts on the clipboard.
const shownKey = computed(() => {
  const key = props.source.writeKey ?? ''
  if (revealed.value) return key
  return `${key.slice(0, 11)}${'•'.repeat(Math.max(key.length - 11, 4))}`
})

// A closing script tag cannot appear anywhere inside an SFC script block — the
// parser ends the block at the first one, string literal or comment included —
// so the web snippet's closing tag is assembled rather than written out.
const CLOSE_SCRIPT = `</${'script'}>`

// Snippets are keyed on the template a source was created from, falling back to
// the server-side HTTP example — which is correct for anything hand-configured.
function buildSnippet(templateId, key, slug) {
  if (templateId === 'web-sdk') {
    return {
      label: 'Web snippet',
      code: `<script src="https://cdn.fanfinity.io/fp.js" data-write-key="${key}" defer>${CLOSE_SCRIPT}`
    }
  }
  if (templateId === 'ios-sdk') {
    return {
      label: 'iOS snippet',
      code: `import Fanfinity\n\nFanfinity.start(writeKey: "${key}")`
    }
  }
  if (templateId === 'android-sdk') {
    return {
      label: 'Android snippet',
      code: `import io.fanfinity.sdk.Fanfinity\n\nFanfinity.start(context = this, writeKey = "${key}")`
    }
  }
  return {
    label: 'Server-side example',
    code:
      `curl -X POST https://ingest.fanfinity.io/v1/${slug} \\\n` +
      `  -H "Authorization: Bearer ${key}" \\\n` +
      `  -H "Content-Type: application/json" \\\n` +
      `  -d '[{"event_type":"ticket_purchased","event_time":"2026-07-31T12:00:00Z"}]'`
  }
}

const snippet = computed(() =>
  buildSnippet(props.source.templateId, shownKey.value, props.source.slug)
)

// What Copy hands over always carries the real key, masked or not.
const fullSnippet = computed(
  () =>
    buildSnippet(
      props.source.templateId,
      props.source.writeKey ?? '',
      props.source.slug
    ).code
)
</script>
