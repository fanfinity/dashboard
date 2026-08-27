<template>
  <div class="flex flex-col gap-4">
    <NoticeBanner
      tone="info"
      title="A warehouse comes with the plan"
      message="ClickHouse is included on every plan and needs no credentials — it is provisioned per account when you create it. The other warehouses are add-ons, marked below; everything else is included at no extra cost."
    />

    <div class="flex flex-wrap items-center gap-2">
      <ToolbarSearch
        v-model="localQuery"
        placeholder="Search destinations..."
      />
      <!-- Category filter as pills, because the same row also has to work as an
           "everything" reset. TabNav's pill variant is the shape the kit already
           uses for filtering one list. -->
      <TabNav v-model="category" :tabs="categoryTabs" variant="pill" />
    </div>

    <template v-if="groups.length">
      <section
        v-for="group in groups"
        :key="group.name"
        class="flex flex-col gap-3"
      >
        <div class="flex items-baseline gap-2">
          <!-- The important SUFFIX, not the prefix. Quasar's unlayered `h2`
               rule sets its own font-size, and a layered Tailwind `text-*`
               utility loses to it regardless of specificity — this heading
               rendered at 36px without it. docs/ui-conventions.md rules 2-3. -->
          <h2
            class="font-sfere-mono text-sfere-label! uppercase tracking-[0.12em] text-subtle"
            >{{ group.name }}</h2
          >
          <span class="text-xs text-subtle">{{ group.items.length }}</span>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DestinationTemplateCard
            v-for="t in group.items"
            :key="t.id"
            :template="t"
            @select="emit('select', t)"
          />
        </div>
      </section>
    </template>

    <EmptyState
      v-else
      title="No destinations match"
      :description="`None of the ${templates.length} destinations match your search or filter.`"
    >
      <template #cta>
        <SfereButton variant="secondary" size="sm" @click="reset"
          >Clear filters</SfereButton
        >
      </template>
    </EmptyState>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import DestinationTemplateCard from '@/components/destinations/DestinationTemplateCard.vue'

// The destinations catalog, grouped. A flat 29-card grid is a wall: nobody
// scanning it can tell that eight of them are warehouses and four are
// client-side tags. Grouping by `category` is the difference between browsing
// and hunting.
//
// The group order is fixed here rather than derived from the data, because
// alphabetical would open on Advertising and the warehouse — the thing most
// people are here for, and the only one with an included tier — would be
// halfway down.
const props = defineProps({
  templates: { type: Array, default: () => [] },
  query: { type: String, default: '' }
})

const emit = defineEmits(['select', 'update:query'])

const CATEGORY_ORDER = [
  'Data warehouse',
  'Product analytics',
  'Advertising',
  'CRM',
  'Object storage',
  'Device destinations',
  'Special'
]

const category = ref('all')
const localQuery = ref(props.query)

// Two-way with the parent's query so the page keeps owning the search term —
// it is part of the create screen's state, not this component's.
watch(localQuery, v => emit('update:query', v))
watch(
  () => props.query,
  v => {
    if (v !== localQuery.value) localQuery.value = v
  }
)

// A template with no `category` is a template added before this grouping
// existed. It lands in Other rather than vanishing from the catalog.
function categoryOf(t) {
  return t.category || 'Other'
}

const presentCategories = computed(() => {
  const seen = new Set(props.templates.map(categoryOf))
  const ordered = CATEGORY_ORDER.filter(c => seen.has(c))
  const extra = [...seen].filter(c => !CATEGORY_ORDER.includes(c)).sort()
  return [...ordered, ...extra]
})

const categoryTabs = computed(() => [
  { key: 'all', label: 'All', count: props.templates.length },
  ...presentCategories.value.map(c => ({
    key: c,
    label: c,
    count: props.templates.filter(t => categoryOf(t) === c).length
  }))
])

const matching = computed(() => {
  const q = localQuery.value.trim().toLowerCase()
  return props.templates.filter(t => {
    if (category.value !== 'all' && categoryOf(t) !== category.value) {
      return false
    }
    if (!q) return true
    return [t.name, t.description, categoryOf(t), ...(t.tags ?? [])]
      .filter(Boolean)
      .some(field => String(field).toLowerCase().includes(q))
  })
})

const groups = computed(() =>
  presentCategories.value
    .map(name => ({
      name,
      items: matching.value.filter(t => categoryOf(t) === name)
    }))
    .filter(g => g.items.length)
)

function reset() {
  localQuery.value = ''
  category.value = 'all'
}
</script>
