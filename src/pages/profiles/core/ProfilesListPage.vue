<template>
  <q-page class="p-6">
    <PageHeader title="Profiles" :subtitle="subtitle" />

    <CardPanel class="mb-4">
      <form class="flex flex-wrap items-start gap-3" @submit.prevent="submit">
        <FormField
          class="min-w-[280px] flex-1"
          label="Search by identifier"
          for-id="profile-q"
          hint="Match an email, phone, user id or anonymous id."
        >
          <input
            id="profile-q"
            v-model="q"
            type="text"
            autocomplete="off"
            placeholder="e.g. dania.alzoubi@fanfinity.io"
            class="h-9 w-full rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          class="w-full sm:w-[220px]"
          label="Identifier type"
          hint="Narrow the match to one type."
        >
          <q-select
            v-model="identifierType"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="identifierTypeOptions"
            class="bg-white"
          />
        </FormField>

        <div class="flex items-center gap-2 pt-5">
          <button
            type="submit"
            class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            Search
          </button>
          <button
            v-if="q || identifierType"
            type="button"
            class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
            @click="clear"
          >
            Clear
          </button>
        </div>
      </form>
    </CardPanel>

    <!-- Demo mode, or a backend without the profiles endpoint yet. -->
    <NoticeBanner
      v-if="apiMissing"
      tone="info"
      title="Profiles are not available here yet"
      message="No live profiles endpoint responded. In Demo data mode this shows sample profiles; switch Settings → Data source to real to see your own."
    />

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      row-key="id"
      clickable-rows
      :per-page="size"
      empty-title="No profiles yet"
      empty-description="Profiles appear once your sources send identify events (a Web SDK identify call, or a store customer)."
      @retry="load"
      @row-click="openProfile"
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="font-mono text-xs text-subtle">{{ row.id }}</p>
      </template>

      <template #cell-email="{ value }">
        <span class="text-muted">{{ value || '—' }}</span>
      </template>

      <template #cell-phone="{ value }">
        <span class="text-muted">{{ value || '—' }}</span>
      </template>

      <template #cell-lastSeen="{ row }">
        <span class="whitespace-nowrap text-muted">{{ row.lastSeen }}</span>
      </template>
    </DataTable>

    <!-- Server-side paging: the endpoint returns one page at a time. -->
    <div
      v-if="pages > 1"
      class="mt-3 flex items-center justify-end gap-3 text-sm text-muted"
    >
      <span>Page {{ page }} of {{ pages }}</span>
      <button
        class="flex h-8 items-center rounded-lg border border-line2 bg-white px-3 text-ink shadow-sm hover:bg-fill disabled:opacity-40"
        :disabled="page <= 1 || loading"
        @click="goTo(page - 1)"
      >
        Previous
      </button>
      <button
        class="flex h-8 items-center rounded-lg border border-line2 bg-white px-3 text-ink shadow-sm hover:bg-fill disabled:opacity-40"
        :disabled="page >= pages || loading"
        @click="goTo(page + 1)"
      >
        Next
      </button>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NEVER } from '@/lib/emptyValue'
import PageHeader from '@/components/ui/PageHeader.vue'
import CardPanel from '@/components/ui/CardPanel.vue'
import FormField from '@/components/ui/FormField.vue'
import DataTable from '@/components/ui/DataTable.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import { useProfileList } from '@/composables/useProfileList'
import { formatAgo } from '@/composables/useProfilesFormat'

const router = useRouter()

const {
  page,
  size,
  q,
  identifierType,
  items,
  total,
  pages,
  loading,
  error,
  apiMissing,
  load,
  identifierTypeOptions
} = useProfileList()

const subtitle = computed(() =>
  total.value === 1 ? '1 profile' : `${total.value} profiles`
)

const columns = [
  { key: 'name', label: 'Profile', sortable: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'identifierCount', label: 'Identifiers', align: 'right' },
  { key: 'eventCount', label: 'Events', align: 'right' },
  { key: 'lastSeen', label: 'Last seen', sortable: true }
]

const rows = computed(() =>
  items.value.map(p => {
    const traits = p.traits ?? {}
    return {
      id: p.id,
      name: traits.name || traits.email || traits.phone || p.id,
      email: traits.email ?? null,
      phone: traits.phone ?? null,
      identifierCount: (p.identifiers ?? []).length,
      eventCount: p.eventCount ?? 0,
      lastSeenAt: p.lastSeenAt,
      lastSeen: formatAgo(p.lastSeenAt, NEVER)
    }
  })
)

/** Reset to the first page whenever the filters change, then reload. */
function submit() {
  page.value = 1
  load()
}

function clear() {
  q.value = ''
  identifierType.value = ''
  page.value = 1
  load()
}

function goTo(next) {
  page.value = next
  load()
}

function openProfile(row) {
  router.push({ name: 'profiles-detail', params: { id: row.id } })
}

onMounted(load)
</script>
