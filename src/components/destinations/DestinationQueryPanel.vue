<template>
  <div class="flex flex-col gap-4">
    <CardPanel>
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink">SQL console</span>
          <p class="mt-0.5! text-xs text-muted"
            >One read-only SELECT against this destination. The backend refuses
            anything that writes, so there is nothing here that can change your
            data.</p
          >
        </div>
      </template>

      <NoticeBanner
        v-if="apiMissing"
        class="mb-4"
        tone="info"
        title="No API yet"
        message="The SQL console is live as of backend PR #16, and Demo data mode has no fixture for it. Switch Settings → Data source to Real API to run a query."
      />

      <div class="flex flex-col gap-4">
        <FormField
          label="Query"
          required
          for-id="destination-sql"
          hint="A single SELECT. Add your own LIMIT if you want fewer rows than the cap below."
          :error="error"
        >
          <SfereTextarea
            id="destination-sql"
            v-model="sql"
            :rows="5"
            placeholder="SELECT event_type, count() AS n FROM raw_web_events GROUP BY event_type ORDER BY n DESC"
          />
        </FormField>

        <!-- The schema tree, from the table list this page already loaded. One
             call served both, so there is no second read behind this. -->
        <details
          v-if="tables.length"
          class="rounded-sfere border border-sfere-line bg-sfere-fill px-3 py-2"
        >
          <summary class="cursor-pointer text-xs font-medium text-sfere-fg"
            >Tables and columns ({{ tables.length }})</summary
          >
          <div class="mt-2 flex flex-col gap-2">
            <div v-for="table in tables" :key="table.name">
              <button
                type="button"
                class="font-sfere-mono text-xs text-brand underline"
                @click="insertTable(table.name)"
                >{{ table.name }}</button
              >
              <p class="text-[11px] text-sfere-fg-subtle">
                {{
                  table.columns.length
                    ? table.columns.map(c => c.name).join(', ')
                    : NOT_KNOWN
                }}
              </p>
            </div>
          </div>
        </details>

        <div class="flex flex-wrap items-center gap-3">
          <SfereButton size="sm" :loading="querying" @click="run"
            >Run query</SfereButton
          >
          <FormField
            label="Row cap"
            for-id="destination-limit"
            class="min-w-[140px]"
          >
            <SfereInput
              id="destination-limit"
              v-model="limitText"
              type="number"
              min="1"
              max="1000"
            />
          </FormField>
        </div>
      </div>
    </CardPanel>

    <CardPanel v-if="result">
      <template #header>
        <div class="min-w-0 flex-1">
          <span class="text-sm font-semibold text-ink">Result</span>
          <p class="mt-0.5! text-xs text-muted">{{ resultSummary }}</p>
        </div>
        <!-- The whole reason `truncated` is surfaced: a result the backend cut
             short and one that genuinely had that many rows look identical
             otherwise, and reading the second as the first is how someone
             concludes their table is smaller than it is. -->
        <StatusBadge
          v-if="result.truncated"
          class="shrink-0"
          tone="warn"
          label="Truncated"
        />
      </template>

      <EmptyState
        v-if="!result.rows.length"
        title="No rows"
        description="The query ran and matched nothing."
      />

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-max border-collapse text-left">
          <thead>
            <tr class="border-b border-sfere-line">
              <th
                v-for="column in result.columns"
                :key="column.name"
                class="px-3 py-2 text-xs font-semibold text-subtle"
              >
                <span class="block font-sfere-mono text-ink">{{
                  column.name
                }}</span>
                <span class="block font-normal">{{ column.type }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in result.rows"
              :key="index"
              class="border-b border-sfere-line/60"
            >
              <td
                v-for="column in result.columns"
                :key="column.name"
                class="max-w-[320px] truncate px-3 py-2 font-sfere-mono text-xs text-ink"
                :title="cellText(row[column.name])"
              >
                {{ cellText(row[column.name]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CardPanel>
  </div>
</template>

<script setup>
import { NOT_KNOWN } from '@/lib/emptyValue'
import { computed, ref } from 'vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { cellText } from '@/composables/useDestinationBrowser'
import { formatCount } from '@/composables/useSources'

// `POST …/destinations/{id}/query`, live as of backend PR #16. One read-only
// SELECT; the result carries `truncated`, `elapsed_ms`, `offset` and `limit`.
//
// The query error is rendered on the FIELD rather than as an ErrorState: a
// rejected SQL string is the console working, and the message belongs next to
// the box you have to edit. `ErrorState` is what the smoke gate reads as "this
// screen is broken", and a typo in a WHERE clause is not that.
const props = defineProps({
  result: { type: Object, default: null },
  querying: { type: Boolean, default: false },
  error: { type: String, default: null },
  apiMissing: { type: Boolean, default: false },
  /** The table list this page already loaded, reused as the schema tree. */
  tables: { type: Array, default: () => [] }
})

const emit = defineEmits(['run'])

const sql = ref('')
const limitText = ref('100')

const resultSummary = computed(() => {
  const r = props.result
  if (!r) return ''
  const elapsed = r.elapsedMs == null ? '' : ` in ${formatCount(r.elapsedMs)}ms`
  const cap = r.truncated
    ? ` The backend stopped at the ${formatCount(r.limit)}-row cap, so there are more.`
    : ''
  return `${formatCount(r.rowCount)} row${r.rowCount === 1 ? '' : 's'}${elapsed}.${cap}`
})

function insertTable(name) {
  // Appended rather than replacing what is typed: someone clicking a table name
  // mid-query wants the name, not their query gone.
  sql.value = sql.value
    ? `${sql.value.trimEnd()} ${name}`
    : `SELECT * FROM ${name}`
}

function run() {
  const text = sql.value.trim()
  if (!text) return
  const limit = Number(limitText.value)
  emit('run', {
    sql: text,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 1000) : 100
  })
}
</script>
