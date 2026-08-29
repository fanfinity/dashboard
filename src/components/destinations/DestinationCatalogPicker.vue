<template>
  <div class="flex flex-col gap-4">
    <!-- The included warehouse is not an option in the grid below — there is
         nothing for anyone to configure — so it is said here instead. Rendered
         from the record rather than hardcoded, so the day a second template is
         marked `provisioned` it appears without a code change. -->
    <NoticeBanner
      v-for="t in provisioned"
      :key="t.id"
      tone="info"
      :title="`${t.name} comes with your plan — we provide it for you`"
      :message="provisionedMessage(t)"
    >
      <div class="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone="success" label="Included" />
        <!-- `included` is already the badge to the left of these; a template
             tagged with its own licence would otherwise read "Included …
             included". -->
        <StatusBadge
          v-for="tag in otherTags(t)"
          :key="tag"
          tone="neutral"
          :label="tag"
        />
      </div>
    </NoticeBanner>

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
      :title="
        provisionedMatches.length
          ? 'Nothing to create for that one'
          : 'No destinations match'
      "
      :description="emptyDescription"
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
import StatusBadge from '@/components/ui/StatusBadge.vue'
import TabNav from '@/components/ui/TabNav.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import DestinationTemplateCard from '@/components/destinations/DestinationTemplateCard.vue'

// The destinations catalog, grouped. A flat 28-card grid is a wall: nobody
// scanning it can tell that seven of them are warehouses and four are
// client-side tags. Grouping by `category` is the difference between browsing
// and hunting.
//
// A template marked `provisioned` never reaches the grid: we run it for the
// account, so "create one" is not a thing anyone can do with it. It becomes the
// notice above the catalog instead — see `pickable` / `provisioned` below, which
// every count on this screen is derived from so the tab totals cannot disagree
// with the cards.
//
// The group order is fixed here rather than derived from the data, because
// alphabetical would open on Advertising and the warehouses — the thing most
// people are here for — would be halfway down.
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

// Split once, at the top: everything below reads `pickable`, never `templates`.
const provisioned = computed(() => props.templates.filter(t => t.provisioned))
const pickable = computed(() => props.templates.filter(t => !t.provisioned))

// The record's own description carries the "no credentials" half; this adds why
// it is absent from the grid, and what the rest of the catalog costs.
function provisionedMessage(t) {
  return `${t.description} It is not in the catalog below because there is nothing for you to create. The other warehouses are add-ons, marked below; everything else is included at no extra cost.`
}

function otherTags(t) {
  return (t.tags ?? []).filter(tag => tag.toLowerCase() !== 'included')
}

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
  const seen = new Set(pickable.value.map(categoryOf))
  const ordered = CATEGORY_ORDER.filter(c => seen.has(c))
  const extra = [...seen].filter(c => !CATEGORY_ORDER.includes(c)).sort()
  return [...ordered, ...extra]
})

const categoryTabs = computed(() => [
  { key: 'all', label: 'All', count: pickable.value.length },
  ...presentCategories.value.map(c => ({
    key: c,
    label: c,
    count: pickable.value.filter(t => categoryOf(t) === c).length
  }))
])

// One predicate for both lists, so a search for a provisioned template can be
// recognised by exactly the rule that hid it from the grid.
function matchesFilters(t) {
  const q = localQuery.value.trim().toLowerCase()
  if (category.value !== 'all' && categoryOf(t) !== category.value) return false
  if (!q) return true
  return [t.name, t.description, categoryOf(t), ...(t.tags ?? [])]
    .filter(Boolean)
    .some(field => String(field).toLowerCase().includes(q))
}

const matching = computed(() => pickable.value.filter(matchesFilters))

// "clickhouse" is the single likeliest thing anyone types here, and it now
// matches nothing in the grid. Without this the empty state would answer the
// one search the notice above it already answers — with "none of the 28
// destinations match", which reads as "we do not have it".
const provisionedMatches = computed(() =>
  provisioned.value.filter(matchesFilters)
)

const emptyDescription = computed(() => {
  const names = provisionedMatches.value.map(t => t.name)
  if (!names.length) {
    return `None of the ${pickable.value.length} destinations match your search or filter.`
  }
  return `${names.join(' and ')} comes with your plan — see the note above; there is nothing to create for it. Nothing else in the catalog matches your search or filter.`
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
