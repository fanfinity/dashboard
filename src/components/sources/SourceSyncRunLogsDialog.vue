<template>
  <q-dialog v-model="open">
    <div :class="cardClasses">
      <div
        class="flex shrink-0 items-start justify-between gap-4 border-b border-sfere-line px-5 py-4"
      >
        <div class="min-w-0">
          <h2 class="font-sfere-display! text-sfere-h4! text-sfere-fg"
            >Sync run log</h2
          >
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted">{{ subtitle }}</p>
        </div>
        <button
          v-close-popup
          type="button"
          aria-label="Close"
          class="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-sfere text-sfere-fg-muted transition-colors duration-150 hover:bg-sfere-fill hover:text-sfere-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sfere-500/60"
        >
          <!-- Inlined rather than added to `sfereIcons.js`: the registry has
               no `close` glyph, ConfirmDialog inlines this exact path for the
               same control, and one shared dialog affordance is not worth a
               registry entry every icon button would then be able to pick. -->
          <svg
            class="size-4"
            viewBox="0 0 256 256"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128L50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"
            />
          </svg>
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <LoadingState v-if="loading" variant="form" :rows="6" />

        <ErrorState
          v-else-if="error"
          title="Couldn't load this run's log."
          :message="error"
          @retry="emit('retry')"
        />

        <NoticeBanner
          v-else-if="apiMissing"
          tone="info"
          title="No API yet"
          message="Sync-run logs are live as of backend PR #16. Demo data mode has no fixture for them."
        />

        <EmptyState
          v-else-if="!entries.length"
          title="No log lines"
          description="This run wrote nothing to its log. A run that failed before it started can look like this."
        />

        <!-- A log is read top to bottom, so it is a list of lines rather than a
             DataTable: there is nothing here worth sorting by, and a monospace
             column of timestamps beside wrapped prose is easier to scan than
             four cells. -->
        <ol v-else class="flex flex-col gap-1">
          <li
            v-for="(entry, index) in entries"
            :key="`${entry.timestamp}-${index}`"
            class="flex items-start gap-3 rounded-sfere border-l-2 bg-sfere-fill px-3 py-2"
            :class="LEVEL_BORDER[entry.level] ?? 'border-sfere-line'"
          >
            <code
              class="shrink-0 font-sfere-mono text-[11px] text-sfere-fg-subtle"
              >{{ timeOf(entry.timestamp) }}</code
            >
            <span class="min-w-0 flex-1">
              <span
                class="block text-sm break-words"
                :class="LEVEL_TEXT[entry.level] ?? 'text-sfere-fg'"
                >{{ entry.message }}</span
              >
              <span
                v-if="entry.entity"
                class="block font-sfere-mono text-[11px] text-sfere-fg-subtle"
                >{{ entry.entity }}</span
              >
            </span>
          </li>
        </ol>
      </div>

      <div
        class="flex shrink-0 items-center justify-between gap-2 border-t border-sfere-line px-5 py-3.5"
      >
        <p class="text-xs text-sfere-fg-subtle">{{ countNote }}</p>
        <SfereButton v-close-popup size="sm" variant="secondary"
          >Close</SfereButton
        >
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed } from 'vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import { formatDateTime } from '@/composables/useSources'

// `GET …/sync-runs/{id}/logs`, live as of backend PR #16. One `SyncRunLogEntry`
// is `{timestamp, level: info|warn|error, message, entity?}`.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  run: { type: Object, default: null },
  entries: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'retry'])

// Both halves needed, and a `min()` rather than a flat pixel max-width, because
// Quasar's unlayered `.q-dialog__inner--minimized > div { max-width: 560px }` is
// a max-width and would otherwise win — and a flat one would stop the dialog
// shrinking on a narrow window. A log line is long, hence 820px.
const cardClasses = [
  'flex max-h-[80vh] w-[min(820px,94vw)]! max-w-[min(820px,94vw)]! flex-col flex-nowrap! overflow-hidden',
  'rounded-sfere-xl! border border-sfere-line bg-sfere-surface shadow-sfere-pop'
]

const LEVEL_BORDER = {
  info: 'border-sfere-line',
  warn: 'border-amber-400',
  error: 'border-rose-500'
}

const LEVEL_TEXT = {
  info: 'text-sfere-fg',
  warn: 'text-amber-700',
  error: 'text-rose-700'
}

const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const subtitle = computed(() => {
  const run = props.run
  if (!run) return ''
  return `${run.mode} run · ${run.status || NOT_KNOWN} · started ${formatDateTime(run.startedAt, NOT_KNOWN)}`
})

const countNote = computed(() => {
  if (props.loading || props.error || props.apiMissing) return ''
  // The read asks for 200 and the endpoint pages, so a full page means there may
  // be more. Said rather than silently truncated.
  return props.entries.length >= 200
    ? 'Showing the first 200 lines; the run wrote more.'
    : `${props.entries.length} line${props.entries.length === 1 ? '' : 's'}`
})

/** Just the clock part — the date is already in the subtitle. */
function timeOf(iso) {
  if (!iso) return '--:--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--:--'
  return d.toISOString().slice(11, 19)
}
</script>
