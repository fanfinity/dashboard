<template>
  <!-- Beat seven: what the backend built while the reader was installing.

       THE PROTOTYPE ANIMATES TWO `setTimeout`s HERE — 900ms and 1900ms — and
       ticks both rows regardless of what exists. This reads
       `useSourceProvisioning`, which lists the account's pipelines, matches the
       one whose `source_id` is this source, and resolves its destination. So the
       rows report what was provisioned rather than how long the reader waited.

       THE SECOND SHAPE IS THE POINT OF DOING IT THIS WAY. `POST
       …/sources/provisioned` builds a ClickHouse database, a destination and a
       pipeline for a `web` or `zid` source and NOTHING for an `event_stream`
       one — so on an iOS source the prototype's checklist would tick "Preparing
       your included storage" over a warehouse that was never built, and the beat
       after it would name a destination that does not exist. That branch says so
       instead. It is not an error state: a mobile source with no destination yet
       is a perfectly good place to be. -->
  <div class="grid gap-8">
    <FirstRunBeatHeader
      :eyebrow="copy.eyebrow"
      :headline="headline"
      :lede="lede"
    />

    <!-- `tabindex="-1"` so this beat always has something to give focus to. Its
         only control starts disabled while the lookup runs, and a beat that
         focuses nothing drops a keyboard reader onto `<body>` INSIDE a modal —
         the exact failure the overlay's hand-rolled focus exists to prevent. -->
    <div
      ref="panelRef"
      tabindex="-1"
      class="mx-auto grid w-full max-w-[38.75rem] gap-6 outline-none"
    >
      <NoticeBanner
        v-if="preview"
        tone="info"
        title="Nothing was saved"
        message="You are in Demo data mode, so no source, destination or pipeline was created. The steps below are what would run against your real account."
      />

      <!-- `grid` and not `flex flex-col`, per CLAUDE.md collision #4: Quasar's
           unlayered `.flex` makes every flex container in this repo a wrapping
           one, and a wrapping column under a height cap lays its children out
           into a second column. `divide-y` draws the prototype's row rules
           without a border on the last row to undo. -->
      <div
        class="divide-y divide-sfere-line rounded-sfere-xl border border-sfere-line bg-sfere-surface"
      >
        <div
          v-for="row in rows"
          :key="row.key"
          class="flex flex-nowrap! items-center gap-3.5 px-5 py-4"
        >
          <!-- THE MARKER CARRIES THE STATE WITHOUT COLOUR, so a row can be read
               as done, running or waiting in greyscale: a tick, a spinner, or an
               empty ring. Deliberately not `disabled:opacity-*`, which is a dead
               class everywhere in this repo. -->
          <span
            class="grid size-[1.625rem] shrink-0 place-items-center rounded-full"
            :class="markerClass(row.status)"
          >
            <SfereSpinner v-if="row.status === 'running'" :size="14" />
            <span v-else-if="row.status === 'done'" aria-hidden="true">✓</span>
          </span>

          <div class="sfere-flush min-w-0 flex-1 grid gap-0.5">
            <p class="text-sfere-sm font-semibold text-sfere-fg">{{
              row.title
            }}</p>
            <p class="text-sfere-xs text-sfere-fg-muted">{{ row.body }}</p>
          </div>
        </div>
      </div>

      <!-- The teaching sentence, in the brand tint the prototype uses for it. It
           is the one paragraph on the beat that explains a noun rather than
           reporting a fact, which is why it sits apart from the rows. -->
      <p
        v-if="showNote"
        class="sfere-flush rounded-sfere-lg border border-sfere-200 bg-sfere-50 px-4.5 py-4 text-sfere-sm text-sfere-fg"
      >
        <strong class="font-semibold">{{ copy.note.title }}</strong>
        {{ ' ' }}{{ copy.note.body }}
      </p>

      <div class="flex flex-wrap items-center justify-center gap-3">
        <SfereButton
          v-if="state === 'unavailable'"
          variant="secondary"
          size="sm"
          @click="emit('retry')"
          >{{ copy.unavailable.retry }}</SfereButton
        >
        <SfereButton
          ref="ctaRef"
          :disabled="!settled"
          @click="emit('advance')"
          >{{ copy.cta }}</SfereButton
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereSpinner from '@/components/ui/SfereSpinner.vue'
import FirstRunBeatHeader from '@/components/onboarding/FirstRunBeatHeader.vue'
import { FIRST_RUN_SETUP, setupNoun, setupRowsFor } from '@/config/firstRun'

const props = defineProps({
  intent: { type: String, required: true },
  // 'idle' | 'looking' | 'found' | 'none' | 'unavailable', straight off
  // useSourceProvisioning.
  state: { type: String, default: 'idle' },
  pipe: { type: Object, default: null },
  destination: { type: Object, default: null },
  preview: { type: Boolean, default: false }
})

const emit = defineEmits(['advance', 'retry'])

const copy = FIRST_RUN_SETUP

// Settled means the lookup has an answer of any kind — including "nothing was
// provisioned" and "we could not tell". All three are places the reader can move
// on from; only a lookup still in flight is not.
const settled = computed(
  () => props.preview || ['found', 'none', 'unavailable'].includes(props.state)
)

const provisioned = computed(() => props.state === 'found')

const headline = computed(() =>
  props.state === 'none' ? copy.unprovisioned.headline : copy.headline
)

const lede = computed(() =>
  props.state === 'none' ? copy.unprovisioned.lede : copy.lede
)

// The note explains why a pipeline appeared without being asked for. On the
// branch where none appeared it would be explaining something that did not
// happen, so it is not shown there.
const showNote = computed(() => props.state !== 'none')

const rows = computed(() => {
  const base = setupRowsFor(props.intent)
  const noun = setupNoun(props.intent)

  // The first row is true the moment a source exists, which is before this beat
  // can be reached at all.
  const source = { ...base[0], status: 'done' }

  if (props.state === 'none') {
    return [
      source,
      {
        key: 'nothing',
        title: copy.unprovisioned.rowTitle,
        body: copy.unprovisioned.rowBody,
        status: 'idle'
      }
    ]
  }

  if (props.state === 'unavailable') {
    return [
      source,
      {
        key: 'unknown',
        title: copy.unavailable.rowTitle,
        body: copy.unavailable.rowBody,
        status: 'idle'
      }
    ]
  }

  // NAMED FROM THE RECORDS ONCE THEY EXIST. Until then the rows keep the
  // prototype's generic wording, because naming a destination before the lookup
  // has resolved one would be inventing it.
  const storage = {
    ...base[1],
    status: provisioned.value ? 'done' : 'running',
    body:
      provisioned.value && props.destination?.name
        ? `${props.destination.name} is ready.`
        : base[1].body
  }

  const flow = {
    ...base[2],
    status: provisioned.value
      ? 'done'
      : props.state === 'looking'
        ? 'running'
        : 'idle',
    body:
      provisioned.value && props.pipe?.name
        ? `${props.pipe.name} is delivering from ${noun.possessive}.`
        : base[2].body
  }

  return [source, storage, flow]
})

function markerClass(status) {
  if (status === 'done') return 'bg-sfere-success-soft text-sfere-success'
  if (status === 'running') return 'text-sfere-brand'
  return 'border border-dashed border-sfere-line bg-sfere-fill'
}

// THIS BEAT'S FIRST CONTROL IS ITS ONLY CONTROL, and it starts disabled while
// the lookup runs — so there is a real chance there is nothing focusable when the
// beat arrives. The CTA takes focus when it is live and the panel itself takes it
// otherwise, which keeps a keyboard reader inside the modal either way.
const ctaRef = ref(null)
const panelRef = ref(null)
defineExpose({
  focusFirst: () => {
    const cta = ctaRef.value?.$el
    if (cta && !cta.disabled) {
      cta.focus?.({ preventScroll: true })
      return
    }
    panelRef.value?.focus?.({ preventScroll: true })
  }
})
</script>
