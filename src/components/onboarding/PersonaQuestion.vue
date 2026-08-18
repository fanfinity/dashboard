<template>
  <q-dialog :model-value="open" persistent>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-question-title"
      class="flex max-h-[86vh] w-[820px]! max-w-[92vw]! flex-col gap-6 overflow-y-auto rounded-xl border border-line2 bg-white p-6 shadow-lg sm:p-7"
    >
      <div class="flex flex-col gap-1.5">
        <!-- An h2, never an h1. scripts/smoke.mjs asserts on the FIRST <h1> on
             every route, so a heading here would shadow the page's own and the
             gate would silently stop checking Home. -->
        <h2
          id="persona-question-title"
          class="font-sfere-display! text-xl! font-semibold! leading-7! tracking-[-0.01em]! text-ink"
        >
          Before we start — what do you do?
        </h2>
        <p class="max-w-[62ch] text-sm text-muted">
          It sets what you see first. Change it any time in Settings → Your
          role.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectableCard
          v-for="(persona, index) in personas"
          :key="persona.key"
          class="group"
          @select="emit('choose', persona.key)"
        >
          <div class="flex w-full items-start justify-between gap-2">
            <SfereIconChip size="sm">
              <PersonaIcon :persona="persona.key" />
            </SfereIconChip>
            <!-- The digit is the shortcut below, shown so it is discoverable
                 rather than a secret. No room for it on a stacked phone
                 layout, where there is no keyboard to press it with either. -->
            <SfereKbd :label="String(index + 1)" class="max-sm:hidden" />
          </div>

          <p class="mt-3.5 text-sm font-semibold text-ink">{{
            persona.label
          }}</p>
          <p class="mt-0.5 text-xs font-medium text-muted">{{
            persona.cardTitle
          }}</p>
          <p class="mt-1.5 text-xs leading-5 text-muted">{{
            persona.outcome
          }}</p>

          <!-- `mt-auto!` needs the important suffix: Quasar's unlayered base
               stylesheet sets a margin on bare block elements and beats a
               layered Tailwind utility, which leaves the three meta rows on
               three different baselines when the outcomes wrap unevenly. -->
          <div
            class="mt-auto! flex w-full items-center justify-between gap-2 border-t border-line pt-3"
          >
            <span class="text-xs text-subtle">{{ persona.estimate }}</span>
            <span
              class="flex items-center gap-1 text-xs font-medium text-subtle transition-colors duration-200 group-hover:text-brand"
            >
              Start
              <svg
                class="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                viewBox="0 0 256 256"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="m221.66 133.66-72 72a8 8 0 0 1-11.32-11.32L196.69 136H40a8 8 0 0 1 0-16h156.69l-58.35-58.34a8 8 0 0 1 11.32-11.32l72 72a8 8 0 0 1 0 11.32Z"
                />
              </svg>
            </span>
          </div>
        </SelectableCard>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
      >
        <p class="max-w-[54ch] text-xs text-subtle">
          Nothing is locked by this answer. Every screen stays in the sidebar
          whichever you pick.
        </p>
        <button
          type="button"
          class="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="emit('skip')"
        >
          Skip — just show me the app
        </button>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { onBeforeUnmount, watch } from 'vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import SfereKbd from '@/components/ui/SfereKbd.vue'
import { PERSONAS } from '@/config/personas'
import PersonaIcon from './PersonaIcon.vue'

// The onboarding fork: one question, three cards, one escape hatch.
//
// It is an OVERLAY OVER A FULLY-RENDERED HOME PAGE, never a route, and that is a
// gate decision as much as a UX one. scripts/smoke.mjs waits for
// [data-smoke="nav"] after signing in and then requires a non-empty <h1> on every
// route: a full-screen /welcome route has no nav in the DOM, so the entire
// behavioural gate would fail at sign-in rather than on one screen. Because this
// is a q-dialog, the page beneath stays mounted and visible — which is also
// Meiro's rule about not hiding the product behind the wizard, and what makes
// Home's zeroes filling in later legible.
//
// `persistent` is deliberate: the two ways out are picking a card and Skip, and
// a stray backdrop click that dismissed the question without recording an answer
// would bring it back on the next load looking like a bug. MainLayout only mounts
// this on `/`, so a deep link from Slack is never ambushed by it.
//
// TWO IMPORTANT SUFFIXES IN THE TEMPLATE, both the Quasar cascade collision
// documented in CLAUDE.md rather than taste. Quasar ships an unlayered
// `.q-dialog__inner--minimized > div { max-width: 560px }`, which silently
// shrinks a three-card row to two-and-a-bit columns, and unlayered margins on
// bare block elements, which beat `mt-auto`. Unlayered CSS wins over Tailwind's
// @layer utilities, so `w-[820px]!` and `mt-auto!` are the only forms that work.
//
// Not in the kit and not prefixed Sfere*: it is one product surface, not a
// primitive, so the "one Quasar dependency" carve-out in docs/ui-conventions.md
// does not apply here — MainLayout, which owns it, is Quasar throughout.
const props = defineProps({
  open: { type: Boolean, default: false }
})

// `choose` carries the persona key; `skip` records the answer as skipped. Neither
// writes state — the layout owns useOnboarding, the same way pages own data and
// components own appearance.
const emit = defineEmits(['choose', 'skip'])

const personas = PERSONAS

// 1 / 2 / 3 pick a card. Cheap to add, and the population most likely to be
// annoyed by a modal is the one most likely to try it — the digits are printed on
// the cards so it is an affordance rather than an easter egg.
//
// Bound to the window rather than the dialog because q-dialog teleports its
// content to the end of <body>, outside this component's tree, so a template
// @keydown here would never see the event.
function onKeydown(event) {
  if (!props.open) return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  // Never steal a digit from a field. The backdrop makes this hard to reach by
  // mouse, but focus can be there — the header search is still mounted behind
  // the overlay — and "typing 2 into a search box silently picked marketer and
  // closed the question" is not a bug anyone would think to report.
  const target = event.target
  if (target?.isContentEditable) return
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return
  const index = Number(event.key)
  if (!Number.isInteger(index) || index < 1 || index > personas.length) return
  event.preventDefault()
  emit('choose', personas[index - 1].key)
}

// Only listening while the question is actually up: the layout keeps this
// component mounted for the life of the session, so a permanent listener would
// have 1/2/3 firing on every screen forever.
watch(
  () => props.open,
  isOpen => {
    if (isOpen) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
  { immediate: true }
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
