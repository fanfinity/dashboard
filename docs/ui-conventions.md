# UI conventions

Everything under `src/components/ui/` is the house style. 54 screens are being
built in parallel; these primitives exist so all 54 look like one product and so
the smoke test can assert on a single selector across every route.

**Read this before writing a screen.**

---

## Hard rules

1. **Never write a `<style>` block.** There is not one in the entire repo, and
   there must never be. Tailwind utility classes only. If you think you need
   custom CSS, you need a different composition of utilities.

2. **The Tailwind v4 important modifier is a _suffix_.** `text-2xl!`, not
   `!text-2xl`. The prefix form is Tailwind v3 syntax and silently does nothing
   in v4. You need the suffix wherever Quasar ships its own rule for the element
   — headings (`h1`–`h6`), `q-skeleton` border radius, `q-btn` internals.

   ```html
   <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink">Title</h1>
   <q-skeleton height="74px" class="rounded-xl!" />
   ```

3. **Design tokens only.** Defined in `src/css/tailwind.css` under `@theme`:

   | Token          | Hex       | Use                                        |
   | -------------- | --------- | ------------------------------------------ |
   | `brand`        | `#3800c1` | accent, active nav, primary buttons, links |
   | `ink`          | `#030712` | primary text                               |
   | `muted`        | `#4a5565` | body / secondary text, table cell text     |
   | `subtle`       | `#6a7282` | placeholders, column headers, hints        |
   | `sidebar`      | `#f9fafb` | sidebar bg, table row hover                |
   | `fill`         | `#f3f4f6` | chip bg, button hover                      |
   | `line`         | `#e7e9ed` | dividers (table rows, card header/footer)  |
   | `line2`        | `#e5e7eb` | control + card borders                     |
   | `success`      | `#029855` | success text                               |
   | `success-bg`   | `#edfdf2` | success chip bg                            |
   | `success-line` | `#bce9cd` | success chip border                        |

   Opacity variants of `brand` are in play too: `border-brand/30`, `bg-brand/5`,
   `bg-brand/10`.

   Stock Tailwind colours are allowed **only** for semantic states, and only
   these ramps: **amber** (warning), **rose** (error/danger/destructive),
   **violet** (anonymous/unknown). Never introduce a fourth.

4. **Tables are hand-rolled.** Never `q-table`. Use `DataTable.vue`. If a screen
   needs a shape `DataTable` cannot express, hand-roll a `<table>` copying the
   class strings out of `DataTable.vue` — do not reach for Quasar.

5. **These primitives are frozen after Phase 0.** Story agents must **not** edit
   anything in `src/components/ui/`. If a primitive is inadequate for your
   screen, compose raw Tailwind inside one of its slots (every primitive has an
   escape hatch) and **report the gap** in your PR/ticket so it can be folded in
   deliberately. Fifty-four agents editing the same thirteen files is how a design
   system dies.

6. **Primitives are dumb.** Props in, slots out. No `useRouter`, no `useRoute`,
   no composables, no `fetch`. Pages own all data and navigation; primitives own
   only appearance.

7. **`data-smoke="error"` lives on `ErrorState` and nowhere else.** It is the one
   hook `scripts/smoke.mjs` uses to detect a broken screen on every route. Never
   put that attribute on another element, and never render a bespoke error card
   instead of `ErrorState`. `EmptyState` carries `data-smoke="empty"` for the
   same reason — an intentionally-empty screen must be distinguishable from a
   broken one.

8. **Every screen renders all four states**: loading, error, empty, populated.
   `DataTable` does this for you. A form or detail page must do it by hand with
   `LoadingState` / `ErrorState` / `EmptyState`.

---

## Component reference

All components live in `src/components/ui/` and are imported by path:

```js
import DataTable from '@/components/ui/DataTable.vue'
```

### PageHeader.vue

Page title block. Sits at the top of every `q-page`.

| Prop       | Type   | Default | Notes                               |
| ---------- | ------ | ------- | ----------------------------------- |
| `title`    | String | —       | required                            |
| `subtitle` | String | `''`    | one line of context under the title |

| Slot       | Scope | Notes                                          |
| ---------- | ----- | ---------------------------------------------- |
| `subtitle` | —     | overrides the `subtitle` prop for rich content |
| `actions`  | —     | right-hand buttons / search box                |

No events.

### EmptyState.vue

"Nothing here yet" panel. Renders `data-smoke="empty"`.

| Prop          | Type   | Default                    |
| ------------- | ------ | -------------------------- |
| `title`       | String | — (required)               |
| `description` | String | `''`                       |
| `icon`        | String | `''` — an imported SVG url |

| Slot  | Scope |
| ----- | ----- |
| `cta` | —     |

No events.

### CardPanel.vue

Generic white surface: `rounded-xl border border-line2 bg-white shadow-sm`.

| Prop     | Type    | Default | Notes                                         |
| -------- | ------- | ------- | --------------------------------------------- |
| `padded` | Boolean | `true`  | `false` for full-bleed content (e.g. a table) |

| Slot     | Scope | Notes                                         |
| -------- | ----- | --------------------------------------------- |
| default  | —     | body                                          |
| `header` | —     | adds a `border-b border-line px-5 py-3.5` bar |
| `footer` | —     | adds a `border-t border-line px-5 py-3` bar   |

No events.

### ErrorState.vue

The failure surface. **Renders `data-smoke="error"` on its root.**

| Prop      | Type   | Default                   |
| --------- | ------ | ------------------------- |
| `title`   | String | `'Something went wrong'`  |
| `message` | String | `''` — the raw error text |

| Event   | Payload                                |
| ------- | -------------------------------------- |
| `retry` | — (fired by the built-in Retry button) |

No slots.

### LoadingState.vue

Skeleton placeholder.

| Prop      | Type                          | Default   | Notes                                     |
| --------- | ----------------------------- | --------- | ----------------------------------------- |
| `variant` | `'table' \| 'grid' \| 'form'` | `'table'` |                                           |
| `rows`    | Number                        | `6`       | bars for `table`/`form`, cards for `grid` |

No slots, no events.

### DataTable.vue

The list-screen workhorse. Hand-rolled `<table>`; owns sorting, paging and all
three non-populated states.

| Prop               | Type           | Default              | Notes                                                                                                                   |
| ------------------ | -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `columns`          | Array          | `[]`                 | `{ key, label, sortable?, align?, width? }`; `align` is `'left' \| 'center' \| 'right'`, `width` is a CSS length string |
| `rows`             | Array          | `[]`                 | the **full** set — the component slices it                                                                              |
| `loading`          | Boolean        | `false`              | renders `LoadingState variant="table"`                                                                                  |
| `error`            | String \| null | `null`               | renders `ErrorState`                                                                                                    |
| `rowKey`           | String         | `'id'`               | falls back to array index                                                                                               |
| `emptyTitle`       | String         | `'Nothing here yet'` |                                                                                                                         |
| `emptyDescription` | String         | `''`                 |                                                                                                                         |
| `perPage`          | Number         | `25`                 |                                                                                                                         |
| `clickableRows`    | Boolean        | `false`              | adds `cursor-pointer` and enables `row-click`                                                                           |

| Slot         | Scope            | Notes                                                 |
| ------------ | ---------------- | ----------------------------------------------------- |
| `cell-<key>` | `{ row, value }` | one per column key; default renders `row[key]`        |
| `toolbar`    | —                | search / filter chips, above the card, in every state |
| `empty`      | —                | replaces the default `EmptyState`                     |

| Event       | Payload                           |
| ----------- | --------------------------------- |
| `row-click` | `row` (only when `clickableRows`) |
| `retry`     | — (forwarded from `ErrorState`)   |

State precedence: `loading` → `error` → empty → populated.

### StatusBadge.vue

| Prop      | Type                                                      | Default     | Notes                                          |
| --------- | --------------------------------------------------------- | ----------- | ---------------------------------------------- |
| `variant` | `'success' \| 'warn' \| 'neutral' \| 'danger' \| 'brand'` | `''`        | wins over `enabled`                            |
| `enabled` | Boolean                                                   | `undefined` | shorthand: `true` → success, `false` → neutral |
| `label`   | String                                                    | `''`        |                                                |

| Slot    | Scope                     |
| ------- | ------------------------- |
| default | — (falls back to `label`) |

No events.

### StatCard.vue

| Prop             | Type                       | Default      | Notes                                       |
| ---------------- | -------------------------- | ------------ | ------------------------------------------- |
| `label`          | String                     | — (required) |                                             |
| `value`          | String \| Number           | `''`         | pre-formatted — the card does no formatting |
| `delta`          | String                     | `''`         | e.g. `'4%'`; hidden when empty              |
| `deltaDirection` | `'up' \| 'down' \| 'flat'` | `'up'`       | ↑ success / ↓ rose / → muted                |

No slots, no events.

### ToolbarSearch.vue

| Prop          | Type   | Default     |
| ------------- | ------ | ----------- |
| `modelValue`  | String | `''`        |
| `placeholder` | String | `'Search…'` |

| Event               | Payload |
| ------------------- | ------- |
| `update:modelValue` | String  |

Use with `v-model`. No slots.

### FormSection.vue

A `CardPanel` with a heading, for grouping fields.

| Prop          | Type   | Default      |
| ------------- | ------ | ------------ |
| `title`       | String | — (required) |
| `description` | String | `''`         |

| Slot    | Scope                                  |
| ------- | -------------------------------------- |
| default | — (fields, in a `flex flex-col gap-4`) |

No events.

### FormField.vue

Label + control + hint/error. The control goes in the slot, so a page can use
`q-input`, `q-select` or a raw `<input>`.

| Prop       | Type    | Default | Notes                                       |
| ---------- | ------- | ------- | ------------------------------------------- |
| `label`    | String  | `''`    |                                             |
| `hint`     | String  | `''`    | suppressed while `error` is set             |
| `error`    | String  | `''`    | renders in `text-rose-500`                  |
| `required` | Boolean | `false` | appends a rose asterisk                     |
| `for`      | String  | `''`    | `<label for>`; pair with the control's `id` |

| Slot    | Scope           |
| ------- | --------------- |
| default | — (the control) |

No events.

The house raw input, when not using Quasar:

```html
<input
  class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
/>
```

### ConfirmDialog.vue

| Prop           | Type    | Default           |
| -------------- | ------- | ----------------- |
| `modelValue`   | Boolean | `false`           |
| `title`        | String  | `'Are you sure?'` |
| `message`      | String  | `''`              |
| `confirmLabel` | String  | `'Confirm'`       |
| `cancelLabel`  | String  | `'Cancel'`        |
| `destructive`  | Boolean | `false`           |

| Slot    | Scope                                  |
| ------- | -------------------------------------- |
| default | — (extra body content under `message`) |

| Event               | Payload                             |
| ------------------- | ----------------------------------- |
| `update:modelValue` | Boolean                             |
| `confirm`           | — (dialog closes itself afterwards) |

### TabNav.vue

Underline tabs.

| Prop         | Type   | Default | Notes                                            |
| ------------ | ------ | ------- | ------------------------------------------------ |
| `modelValue` | String | `''`    | the active tab's `key`                           |
| `tabs`       | Array  | `[]`    | `{ key, label, count? }`; `count` renders a pill |

| Event               | Payload          |
| ------------------- | ---------------- |
| `update:modelValue` | String (tab key) |

No slots.

---

## Buttons

There is no `Button.vue` — buttons are one-liners and vary too much. Use these
exact strings:

```html
<!-- primary -->
<button
  class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
>
  <!-- secondary -->
  <button
    class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
  >
    <!-- tertiary / inline -->
    <button
      class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
    >
      <!-- destructive -->
      <button
        class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
      ></button></button></button
></button>
```

Add `disabled:opacity-50` (or `disabled:cursor-not-allowed disabled:opacity-40`
for pagination-style controls) wherever a button can be disabled.

---

## Worked example 1 — a list page

All four states, zero bespoke markup. `DataTable` selects between them.

```vue
<template>
  <q-page class="p-6">
    <PageHeader
      title="Destinations"
      subtitle="Where resolved fan data is sent."
    >
      <template #actions>
        <ToolbarSearch v-model="query" placeholder="Search destinations..." />
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          @click="router.push({ name: 'destination-new' })"
        >
          New destination
        </button>
      </template>
    </PageHeader>

    <DataTable
      :columns="columns"
      :rows="filtered"
      :loading="loading"
      :error="error"
      row-key="id"
      clickable-rows
      empty-title="No destinations yet"
      empty-description="Connect a destination to start activating segments."
      @retry="load"
      @row-click="
        row => router.push({ name: 'destination', params: { id: row.id } })
      "
    >
      <template #cell-name="{ row }">
        <p class="font-medium text-ink">{{ row.name }}</p>
        <p class="text-xs text-subtle">{{ row.packageId }}</p>
      </template>

      <template #cell-enabled="{ value }">
        <StatusBadge :enabled="value" :label="value ? 'Enabled' : 'Paused'" />
      </template>
    </DataTable>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ToolbarSearch from '@/components/ui/ToolbarSearch.vue'
import { useDestinations } from '@/composables/useDestinations'

const router = useRouter()
const { destinations, loading, error, load } = useDestinations()
const query = ref('')

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'enabled', label: 'Status' },
  { key: 'updatedAt', label: 'Updated', sortable: true, align: 'right' }
]

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return destinations.value
  return destinations.value.filter(d => d.name.toLowerCase().includes(q))
})

onMounted(load)
</script>
```

- **loading** → `DataTable` renders `LoadingState variant="table"`.
- **error** → `DataTable` renders `ErrorState` (`data-smoke="error"`), and its
  Retry button re-emits `retry` → `load()`.
- **empty** → `DataTable` renders `EmptyState` with the two `empty*` props.
- **populated** → the table, sorted and paged internally.

The header and its search box render in all four states, which is deliberate:
the user can always retry or navigate away.

## Worked example 2 — a create-form page

A form has no `DataTable` to lean on, so it switches on the states itself.

```vue
<template>
  <q-page class="p-6">
    <PageHeader
      title="New destination"
      subtitle="Pick a target and give it credentials."
    />

    <LoadingState v-if="loadingCatalog" variant="form" :rows="4" />

    <ErrorState
      v-else-if="catalogError"
      title="Couldn't load the destination catalog."
      :message="catalogError"
      @retry="loadCatalog"
    />

    <EmptyState
      v-else-if="!catalog.length"
      title="No destination types available"
      description="Your workspace has no destination packages enabled yet."
    />

    <form v-else class="flex max-w-2xl flex-col gap-4" @submit.prevent="submit">
      <FormSection
        title="Basics"
        description="How this destination appears in lists."
      >
        <FormField label="Name" required for="dest-name" :error="errors.name">
          <input
            id="dest-name"
            v-model="formState.name"
            type="text"
            placeholder="e.g. Meta CAPI — production"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>

        <FormField
          label="Type"
          required
          hint="Determines which credentials are required."
          :error="errors.type"
        >
          <q-select
            v-model="formState.type"
            dense
            outlined
            emit-value
            map-options
            options-dense
            :options="catalog"
            class="bg-white"
          />
        </FormField>
      </FormSection>

      <FormSection title="Credentials">
        <FormField label="API key" required :error="errors.apiKey">
          <input
            v-model="formState.apiKey"
            type="password"
            class="h-9 rounded-lg border border-line2 bg-white px-2.5 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </FormField>
      </FormSection>

      <div class="flex items-center gap-2">
        <button
          type="submit"
          :disabled="saving"
          class="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          {{ saving ? 'Creating…' : 'Create destination' }}
        </button>
        <button
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm text-ink shadow-sm hover:bg-fill"
          @click="router.back()"
        >
          Cancel
        </button>
      </div>

      <!-- Submit failure reuses the same surface as a load failure. -->
      <ErrorState
        v-if="saveError"
        title="Couldn't create the destination."
        :message="saveError"
        @retry="submit"
      />
    </form>
  </q-page>
</template>
```

Note the two `ErrorState` usages: a whole-page failure (catalog didn't load) and
an inline failure (submit rejected). Both carry `data-smoke="error"`, which is
correct — either one means the screen did not do its job.

## Worked example 3 — a trash page

Trash is a list plus a destructive confirm, and its empty state is the _good_
outcome.

```vue
<template>
  <q-page class="p-6">
    <PageHeader title="Trash" subtitle="Deleted items are kept for 30 days.">
      <template #actions>
        <button
          :disabled="!items.length"
          class="rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          @click="confirmEmpty = true"
        >
          Empty trash
        </button>
      </template>
    </PageHeader>

    <TabNav v-model="tab" :tabs="tabs" />

    <DataTable
      :columns="columns"
      :rows="visible"
      :loading="loading"
      :error="error"
      row-key="id"
      empty-title="Trash is empty"
      empty-description="Nothing has been deleted in the last 30 days."
      @retry="load"
    >
      <template #cell-kind="{ value }">
        <StatusBadge variant="neutral" :label="value" />
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-2">
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
            @click="restore(row)"
          >
            Restore
          </button>
          <button
            class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-fill"
            @click="ask(row)"
          >
            Delete forever
          </button>
        </div>
      </template>
    </DataTable>

    <ConfirmDialog
      v-model="confirmOne"
      title="Delete forever?"
      :message="`“${target?.name}” will be permanently removed. This cannot be undone.`"
      confirm-label="Delete forever"
      destructive
      @confirm="purge(target)"
    />

    <ConfirmDialog
      v-model="confirmEmpty"
      title="Empty trash?"
      :message="`All ${items.length} items will be permanently removed.`"
      confirm-label="Empty trash"
      destructive
      @confirm="purgeAll"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import TabNav from '@/components/ui/TabNav.vue'
import DataTable from '@/components/ui/DataTable.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useTrash } from '@/composables/useTrash'

const { items, loading, error, load, restore, purge, purgeAll } = useTrash()

const tab = ref('all')
const confirmOne = ref(false)
const confirmEmpty = ref(false)
const target = ref(null)

const tabs = computed(() => [
  { key: 'all', label: 'All', count: items.value.length },
  {
    key: 'segments',
    label: 'Segments',
    count: items.value.filter(i => i.kind === 'Segment').length
  },
  {
    key: 'destinations',
    label: 'Destinations',
    count: items.value.filter(i => i.kind === 'Destination').length
  }
])

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'kind', label: 'Type', sortable: true },
  { key: 'deletedAt', label: 'Deleted', sortable: true },
  { key: 'actions', label: '', align: 'right', width: '220px' }
]

const visible = computed(() =>
  tab.value === 'all'
    ? items.value
    : items.value.filter(i =>
        i.kind.toLowerCase().startsWith(tab.value.slice(0, 4))
      )
)

function ask(row) {
  target.value = row
  confirmOne.value = true
}

onMounted(load)
</script>
```

Points worth copying: an action column is `{ key: 'actions', label: '', align:
'right', width: '220px' }` with a `cell-actions` slot; destructive confirmation
always goes through `ConfirmDialog` with `destructive`; and the four states are
still entirely `DataTable`'s job.
