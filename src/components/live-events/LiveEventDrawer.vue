<template>
  <q-dialog v-model="open" position="right" full-height>
    <div :class="cardClasses">
      <div
        class="flex shrink-0 items-start justify-between gap-4 border-b border-sfere-line px-5 py-4"
      >
        <div class="sfere-flush grid min-w-0 gap-1">
          <h2 class="font-sfere-display! text-sfere-h4! text-sfere-fg"
            >Event details</h2
          >
          <p class="text-sfere-sm break-words text-sfere-fg-muted">{{
            subtitle
          }}</p>
        </div>

        <button
          v-close-popup
          type="button"
          aria-label="Close"
          class="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-sfere text-sfere-fg-muted transition-colors duration-150 hover:bg-sfere-fill hover:text-sfere-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60"
        >
          <SfereIcon name="close" />
        </button>
      </div>

      <!-- `min-h-0 flex-1` so this and not the card is what scrolls, and a grid
           rather than a flex column so the two blocks are spaced by `gap` —
           `mt-*` on the heading of the second block would be a dead class next
           to Quasar's unlayered paragraph margins. -->
      <div
        class="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-5 py-5"
      >
        <DefinitionList :items="rows" :columns="1">
          <template #value-status>
            <StatusBadge :tone="statusTone(event?.status)" dot>{{
              event?.status || NOT_KNOWN
            }}</StatusBadge>
          </template>

          <template #value-error="{ value }">
            <span class="text-sfere-danger">{{ value }}</span>
          </template>

          <!-- The one outbound link on the screen. `noopener noreferrer`
               because the target is whatever site the event was collected on,
               which is not a page this app has any relationship with. -->
          <template #value-page-url="{ value }">
            <a
              :href="value"
              target="_blank"
              rel="noreferrer noopener"
              class="break-all text-sfere-brand-text underline-offset-2 hover:underline"
              >{{ value }}</a
            >
          </template>
        </DefinitionList>

        <div class="grid gap-2">
          <h3 class="text-sm! font-semibold! tracking-[-0.35px]! text-sfere-fg"
            >Event payload</h3
          >
          <!-- SfereCode's <pre> scrolls inside its own box, so a long line of
               JSON never widens the drawer. -->
          <SfereCode :code="payloadText" />
        </div>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { NONE, NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'
import DefinitionList from '@/components/ui/DefinitionList.vue'
import SfereCode from '@/components/ui/SfereCode.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import {
  formatUTC,
  statusTone,
  trackEventName,
  typeLabel
} from './liveEventFormat.js'

// One event, read out in full: the identity fields the table only summarises,
// plus the raw analytics body.
//
// It is a `q-dialog position="right"` and therefore a THIRD Quasar dependency
// in a kit that names two carve-outs (ConfirmDialog and SecretRevealDialog).
// That is deliberate and it is the same carve-out rather than a new one: this
// owes a focus trap, Escape, scroll lock, a backdrop and a teleport — it is a
// modal, which is exactly what the clause in docs/sfere-design-system.md is
// for. It is also not in `src/components/ui/`, so nothing else in the kit
// inherits the dependency. Note it lives outside the page's 1400px cap for the
// same reason every other dialog does: it teleports to <body>.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // A mapped `LiveEvent` (see useLiveEvents.js), or null before one is picked.
  event: { type: Object, default: null },
  // Resolved by the page from the stream list. The record itself carries only
  // a source id, and an id is not an answer to "which source was this?".
  sourceName: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

// Literal utilities, not a runtime-built string: Tailwind v4 extracts class
// names from source text, so `w-[${n}]` is never generated. A right-positioned
// dialog is not "minimized", so Quasar's 560px cap does not apply here — but
// `.q-dialog__inner > div` is unlayered and sets `overflow: auto` and a 4px
// radius regardless, hence `overflow-hidden!` (so the body scrolls rather than
// the whole card) and no radius utility at all (any value would be a dead
// class, and a full-height panel flush to the right edge wants square corners).
// `flex-nowrap!` because a height-capped `flex flex-col` does not scroll when
// it overflows, it wraps into a second column off the card's right edge.
const cardClasses = [
  'flex w-[min(690px,92vw)]! max-w-[min(690px,92vw)]! flex-col flex-nowrap! overflow-hidden!',
  'border-l border-sfere-line bg-sfere-surface shadow-sfere-pop'
]

const subtitle = computed(() => {
  const ev = props.event
  if (!ev) return ''
  return `${typeLabel(ev)} · ${formatUTC(ev.date)} UTC`
})

// Rows are pushed conditionally where the field does not apply rather than
// printed as "Not known": a `page` event has no track event name and never
// will, which is a different statement from "nothing measured it".
const rows = computed(() => {
  const ev = props.event
  if (!ev) return []

  const items = [
    { label: 'Date (UTC)', value: formatUTC(ev.date) },
    { label: 'Source', value: props.sourceName || ev.streamId },
    { label: 'Message ID', value: ev.messageId },
    { label: 'Type', value: ev.type }
  ]

  const track = trackEventName(ev)
  if (track) items.push({ label: 'Track event name', value: track })

  items.push({ label: 'Status', value: ev.status })
  if (ev.error) items.push({ label: 'Error', value: ev.error })

  items.push(
    { label: 'User ID', value: ev.userId },
    { label: 'Anonymous ID', value: ev.anonymousId },
    {
      label: 'Destinations',
      // A genuinely empty list is NONE. The field is always sent, so this is
      // never the NOT_KNOWN case.
      value: ev.destinations?.length ? ev.destinations.join(', ') : NONE
    }
  )

  if (ev.pageURL) items.push({ label: 'Page URL', value: ev.pageURL })

  return items
})

// The backend redacts credential headers and masks write keys before the record
// leaves the API, so this renders what it is given rather than scrubbing it.
const payloadText = computed(() =>
  props.event?.payload ? JSON.stringify(props.event.payload, null, 2) : NONE
)
</script>
