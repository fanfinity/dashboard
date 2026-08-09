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

3. **Every `<h1>`–`<h6>` needs the important suffix on size, weight _and_
   leading.** This is rule 2's single most expensive case, so it gets its own
   rule. Quasar's base stylesheet styles bare heading elements — `font-size`,
   `font-weight`, `line-height`, `letter-spacing` — and those rules beat an
   un-suffixed utility. A heading that looks fine in isolation renders at
   Quasar's scale inside the app. `PipelineFlowPanel.vue` shipped a section
   label at roughly 4× its intended size for exactly this reason.

   The suffix is needed on `text-*`, `font-*` and `leading-*`. It is **not**
   needed on colour, margin or padding — Quasar does not set those on headings.

   ```html
   <!-- WRONG: Quasar wins; this renders at heading scale -->
   <h3 class="text-[11px] font-semibold uppercase leading-4 text-subtle">
     Sources
   </h3>

   <!-- RIGHT -->
   <h3
     class="text-[11px]! font-semibold! uppercase leading-4! tracking-[0.4px]! text-subtle"
   >
     Sources
   </h3>
   ```

   `PageHeader` and `FormSection` already do this for you — prefer them over a
   bare heading. When you do need one (a section label inside a card), copy the
   `text-sm! font-semibold! tracking-[-0.35px]! text-ink` string the detail
   screens use.

4. **Design tokens only.** Defined in `src/css/tailwind.css` under `@theme`:

   Each one is an alias for a token in `src/css/sfere.css`, so the hexes below
   are the resolved value, not the source of truth — change the brand in
   `tailwind.css` and this table follows.

   | Token          | Hex       | Use                                        |
   | -------------- | --------- | ------------------------------------------ |
   | `brand`        | `#854dff` | accent, active nav, primary buttons, links |
   | `ink`          | `#0a0a0a` | primary text                               |
   | `muted`        | `#737373` | body / secondary text, table cell text     |
   | `subtle`       | `#737373` | placeholders, column headers, hints        |
   | `sidebar`      | `#f7f8fa` | sidebar bg, table row hover                |
   | `fill`         | `#f5f5f5` | chip bg, button hover                      |
   | `line`         | `#e5e5e5` | dividers (table rows, card header/footer)  |
   | `line2`        | `#e5e5e5` | control + card borders                     |
   | `success`      | `#059669` | success text                               |
   | `success-bg`   | `#ecfdf5` | success chip bg                            |
   | `success-line` | `#a7f3d0` | success chip border                        |

   Two pairs now resolve to the same value — `line`/`line2`, and
   `muted`/`subtle`. Both names in each pair are kept so no markup has to
   change, but there is no longer a visual difference between them. Do not
   reach for one over the other expecting contrast; if you need a third level
   of text hierarchy, get it from weight or size.

   `subtle` collapsing into `muted` is forced by contrast, not laziness: on
   this neutral ramp grey-on-white reaches the 4.5:1 AA floor at about
   `#767676`, so no value both separates from `muted` and stays legible.
   `#a1a1a1` — the obvious next step up — is 2.6:1.

   Opacity variants of `brand` are in play too: `border-brand/30`, `bg-brand/5`,
   `bg-brand/10`.

   Stock Tailwind colours are allowed **only** for semantic states, and only
   these ramps: **amber** (warning), **rose** (error/danger/destructive),
   **violet** (anonymous/unknown). Never introduce a fourth.

5. **Tables are hand-rolled.** Never `q-table`. Use `DataTable.vue`. If a screen
   needs a shape `DataTable` cannot express, hand-roll a `<table>` copying the
   class strings out of `DataTable.vue` — do not reach for Quasar.

6. **These primitives are frozen.** Story agents must **not** edit anything in
   `src/components/ui/`. If a primitive is inadequate for your screen, compose
   raw Tailwind inside one of its slots (every primitive has an escape hatch)
   and **report the gap** in your PR/ticket so it can be folded in deliberately
   during an amendment window. Fifty-four agents editing the same sixteen files
   is how a design system dies.

   Amendment windows so far: **Phase 0** (the original thirteen) and
   **post-wave-1**, which added `DefinitionList`, `SelectableCard` and
   `NoticeBanner` and extended `DataTable`, `EmptyState` and `StatCard`. Each of
   those closed a gap that several independent story agents hit and worked
   around; that is the bar for reopening the folder.

7. **Primitives are dumb.** Props in, slots out. No `useRouter`, no `useRoute`,
   no composables, no `fetch`. Pages own all data and navigation; primitives own
   only appearance.

   The one carve-out is a **declarative** `<router-link :to="…">` driven
   entirely by a prop — `DataTable`'s `emptyCtaTo` uses one. That is still dumb:
   the component renders what it is handed and never reads router state.
   Imperative `router.push` stays in the page.

8. **`data-smoke="error"` lives on `ErrorState` and nowhere else.** It is the one
   hook `scripts/smoke.mjs` uses to detect a broken screen on every route. Never
   put that attribute on another element, and never render a bespoke error card
   instead of `ErrorState`. `EmptyState` carries `data-smoke="empty"` for the
   same reason — an intentionally-empty screen must be distinguishable from a
   broken one. That is also why a nested "nothing here" hint should be
   `EmptyState variant="inline"` rather than a hand-rolled `<p>`: the hint keeps
   the smoke hook.

9. **Every screen renders all four states**: loading, error, empty, populated.
   `DataTable` does this for you. A form or detail page must do it by hand with
   `LoadingState` / `ErrorState` / `EmptyState`.

---

## House rules for screens

Rules 1–9 are about the primitives. These are about how a screen uses them, and
every one of them is a bug wave 1 hit or narrowly avoided.

### A missing `:id` is empty, not an error

A detail route whose record does not exist renders `EmptyState`. **Never**
`ErrorState`. The fetch succeeded — the answer was "no such record", which is
information, not failure. `ErrorState` carries `data-smoke="error"`, so getting
this wrong makes the smoke gate report a perfectly working screen as broken.

```vue
<!-- WRONG: the load worked; there is just no record with that id -->
<ErrorState v-else-if="!source" title="Source not found" />

<!-- RIGHT -->
<EmptyState
  v-else-if="!source"
  title="Source not found"
  description="It may have been deleted. Check the trash, or pick another from the list."
>
  <template #cta>
    <button
      class="rounded-lg border border-line2 bg-white px-3 py-1.5 text-sm font-medium text-brand hover:bg-fill"
      @click="router.push({ name: 'sources' })"
      >All sources</button
    >
  </template>
</EmptyState>
```

`ErrorState` is for a request that **failed** — network error, non-2xx, bad
payload. Nothing else.

### Two distinct empty states per list

A list that renders no rows is in one of two situations, and they need different
copy and different CTAs:

| Situation             | Title                    | CTA                |
| --------------------- | ------------------------ | ------------------ |
| Filters matched none  | "No X match your search" | **Clear filters**  |
| Nothing exists at all | "No X yet"               | primary create CTA |

Offering "Create your first source" to someone who has forty sources and a typo
in the search box is the failure mode. Both branches go through `EmptyState`, so
the smoke run still sees `data-smoke="empty"` either way.

If the screen only ever has the second case, skip the slot entirely and use
`DataTable`'s `empty-cta-label` / `empty-cta-to` props.

### Secondary resources degrade in place

A screen usually loads one **primary** resource (the thing the route is named
for) and zero or more **secondary** ones (a template catalog, a related list,
counters). Only the primary resource's failure escalates to a page-level
`ErrorState`. A secondary failure renders its own small `ErrorState` inside the
panel it belongs to, with its own retry, and the rest of the screen keeps
working.

`SourceDetailPage` is the reference: the source itself failing is a page-level
error, but the template catalog failing only breaks the Template tab.

### `@click.stop` on row actions

When `clickable-rows` is set, `DataTable` fires `row-click` from the `<tr>`.
A button inside a `cell-*` slot sits inside that `<tr>`, so its click bubbles and
you navigate away instead of pausing the row.

```html
<!-- inside <template #cell-actions="{ row }"> on a clickable-rows table -->
<button @click.stop="toggle(row)">Pause</button>
```

The modifier is harmless on a non-clickable table, so add it to every row action
button and stop thinking about it.

### Dates: pinned locale, `timeZone: 'UTC'`

`toLocaleDateString()` with no arguments renders differently on the smoke
runner, on a dev box in another region, and in CI. Every formatter pins both the
locale and the zone, so the same ISO string always produces the same characters:

```js
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
})
```

Numbers are the same story: `Number(n).toLocaleString('en-GB')`. Formatting
lives in the composable, never in the component — `StatCard`, `DefinitionList`
and `DataTable` all render whatever string you hand them.

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

"Nothing here yet" panel. Renders `data-smoke="empty"` **in both variants**.

| Prop          | Type                 | Default  | Notes               |
| ------------- | -------------------- | -------- | ------------------- |
| `title`       | String               | —        | required            |
| `description` | String               | `''`     |                     |
| `icon`        | String               | `''`     | an imported SVG url |
| `variant`     | `'card' \| 'inline'` | `'card'` | see below           |

| Slot  | Scope |
| ----- | ----- |
| `cta` | —     |

No events.

`card` is the full bordered surface — the default, and what a whole screen or a
`DataTable` empty state uses. `inline` is a compact centred hint with no border
and no background, for an empty state **nested inside** a `CardPanel` (a column
of `PipelineFlowPanel`, a short list like `ActivityList`), where a bordered card
inside a bordered card reads as a rendering bug. Reach for `inline` instead of
hand-rolling a `<p class="py-2 text-sm text-subtle">`: the hand-rolled version
loses `data-smoke="empty"`.

```html
<EmptyState
  v-if="!column.items.length"
  variant="inline"
  title="Connect a source to start collecting fan signals."
/>
```

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

| Prop               | Type             | Default              | Notes                                                                                                                   |
| ------------------ | ---------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `columns`          | Array            | `[]`                 | `{ key, label, sortable?, align?, width? }`; `align` is `'left' \| 'center' \| 'right'`, `width` is a CSS length string |
| `rows`             | Array            | `[]`                 | the **full** set — the component slices it                                                                              |
| `loading`          | Boolean          | `false`              | renders `LoadingState variant="table"`                                                                                  |
| `error`            | String \| null   | `null`               | renders `ErrorState`                                                                                                    |
| `rowKey`           | String           | `'id'`               | falls back to array index                                                                                               |
| `emptyTitle`       | String           | `'Nothing here yet'` |                                                                                                                         |
| `emptyDescription` | String           | `''`                 |                                                                                                                         |
| `emptyCtaLabel`    | String           | `''`                 | button text on the default empty state                                                                                  |
| `emptyCtaTo`       | Object \| String | `null`               | router location, e.g. `{ name: 'sources-new' }`                                                                         |
| `perPage`          | Number           | `25`                 |                                                                                                                         |
| `clickableRows`    | Boolean          | `false`              | adds `cursor-pointer` and enables `row-click`                                                                           |

| Slot         | Scope            | Notes                                                 |
| ------------ | ---------------- | ----------------------------------------------------- |
| `cell-<key>` | `{ row, value }` | one per column key; default renders `row[key]`        |
| `toolbar`    | —                | search / filter chips, above the card, in every state |
| `empty`      | —                | replaces the default `EmptyState` entirely            |
| `empty-cta`  | —                | replaces just the CTA inside the default `EmptyState` |

| Event       | Payload                           |
| ----------- | --------------------------------- |
| `row-click` | `row` (only when `clickableRows`) |
| `retry`     | — (forwarded from `ErrorState`)   |

State precedence: `loading` → `error` → empty → populated.

**Empty-state CTA.** There are three levels, in order of how much you need:

1. `empty-cta-label` + `empty-cta-to` — the common case. Both must be set;
   renders the primary button as a `<router-link>`. No slot needed.
2. `#empty-cta` — a CTA the props cannot express (a `@click` handler, two
   buttons, a `:disabled`). The title and description still come from
   `empty-title` / `empty-description`.
3. `#empty` — you own the whole empty state. This is the level the two-case
   pattern needs, because the title and description differ per branch too.

```html
<!-- 1. one CTA, no slot -->
<DataTable
  :rows="rows"
  empty-title="No sources yet"
  empty-description="Connect a source to start collecting fan signals."
  empty-cta-label="New source"
  :empty-cta-to="{ name: 'sources-new' }"
/>

<!-- 3. the two-case pattern (see the house rules above) -->
<template #empty>
  <EmptyState
    v-if="sources.length"
    title="No sources match your filters"
    description="Nothing matched that search or tab."
  >
    <template #cta>
      <button class="…tertiary…" @click="clearFilters">Clear filters</button>
    </template>
  </EmptyState>

  <EmptyState v-else title="No sources yet" description="…">
    <template #cta>
      <button class="…primary…" @click="router.push({ name: 'sources-new' })"
        >Connect your first source</button
      >
    </template>
  </EmptyState>
</template>
```

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
| `hint`           | String                     | `''`         | muted caption line under the value          |

| Slot    | Scope | Notes                                        |
| ------- | ----- | -------------------------------------------- |
| default | —     | rich `hint`; wins over the prop when present |

No events.

`delta` is a **trend** — "this moved by X since last period" — and always draws
an arrow in a trend colour. Anything that is not a trend goes in `hint`.
`'1.65× fan-out'` and `'37 errors'` are captions, and pushing them through
`delta` gets them a red down-arrow they did not earn.

```html
<StatCard label="Events delivered (last hour)" value="1.2M" delta="4%" />
<StatCard label="Error rate (last hour)" value="0.31%" hint="37 errors" />
```

### DefinitionList.vue

The label → value read-out for detail screens. Use this instead of hand-rolling
a `<dl>` — before it existed, four screens each carried their own copy.

| Prop      | Type     | Default | Notes                                    |
| --------- | -------- | ------- | ---------------------------------------- |
| `items`   | Array    | `[]`    | `{ label, value, hint? }`                |
| `columns` | `1 \| 2` | `2`     | `2` is responsive: one column below `sm` |

| Slot                 | Scope                   | Notes                              |
| -------------------- | ----------------------- | ---------------------------------- |
| `value-<label-slug>` | `{ item, value, slug }` | replaces one row's value rendering |

No events.

`value` is pre-formatted — the component does no date or number formatting, same
as `StatCard`. `null`, `undefined` and `''` render as an em dash in `text-subtle`
rather than as a blank line, so a "not set" row still reads as a row.

The slot name is the label lowercased with every run of non-alphanumerics
collapsed to a hyphen: `"Pipe ID"` → `#value-pipe-id`, `"Source type"` →
`#value-source-type`. Use it to put a `StatusBadge`, a link or a copy button in
a row.

`columns=1` is the stacked shape — label left, value right, `divide-y` between
rows — and suits a narrow sidebar card. `columns=2` is the wide grid — label
above value, two per row from `sm` up — and suits a full-width panel.

```vue
<DefinitionList :items="facts" :columns="1">
  <template #value-source="{ item }">
    <router-link
      :to="{ name: 'sources-detail', params: { id: item.value.id } }"
      class="font-medium text-brand hover:underline"
      >{{ item.value.name }}</router-link
    >
  </template>

  <template #value-status>
    <StatusBadge
      :enabled="pipe.isEnabled"
      :label="pipe.isEnabled ? 'Enabled' : 'Paused'"
    />
  </template>
</DefinitionList>

<script setup>
const facts = computed(() => [
  { label: 'Pipe ID', value: pipe.value.id },
  { label: 'Status', value: pipe.value.isEnabled },
  {
    label: 'Source',
    value: { id: pipe.value.sourceId, name: pipe.value.sourceName }
  },
  { label: 'Created', value: formatDateTime(pipe.value.createdAt) },
  {
    label: 'Batch size',
    value: pipe.value.batchSize,
    hint: 'Events per delivery'
  }
])
</script>
```

### SelectableCard.vue

A picker card that is a real `<button type="button">` — focusable, keyboard
activatable, and carrying `aria-pressed`. Template pickers recur across the
create screens; this is the one that is accessible without wrapping `CardPanel`
in a button by hand.

| Prop       | Type    | Default | Notes                                          |
| ---------- | ------- | ------- | ---------------------------------------------- |
| `selected` | Boolean | `false` | draws `ring-2 ring-brand`, sets `aria-pressed` |
| `disabled` | Boolean | `false` | suppresses hover and the `select` event        |

| Slot    | Scope                    |
| ------- | ------------------------ |
| default | `{ selected, disabled }` |

| Event    | Payload |
| -------- | ------- |
| `select` | —       |

No payload on `select` — the parent already knows which card it rendered. The
focus ring is an `outline`, not a `ring`, because `ring` is spent on the selected
state; a selected card would otherwise show no focus at all.

```html
<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
  <SelectableCard
    v-for="t in templates"
    :key="t.id"
    :selected="modelValue === t.id"
    @select="emit('update:modelValue', t.id)"
  >
    <div class="flex w-full items-start justify-between gap-2">
      <span class="text-sm font-medium text-ink">{{ t.name }}</span>
      <StatusBadge
        v-if="modelValue === t.id"
        variant="brand"
        label="Selected"
      />
    </div>
    <p class="mt-1.5 text-xs leading-5 text-muted">{{ t.description }}</p>
  </SelectableCard>
</div>
```

### NoticeBanner.vue

An inline notice for "the screen worked, but there is something you should
know" — the cascade warning on a trash screen, a degraded check on a health
screen. It deliberately carries **no** `data-smoke` attribute: a notice is not a
failure, and it must not trip the smoke gate.

| Prop      | Type                           | Default  |
| --------- | ------------------------------ | -------- |
| `variant` | `'info' \| 'warn' \| 'danger'` | `'info'` |
| `title`   | String                         | `''`     |
| `message` | String                         | `''`     |

| Slot    | Scope | Notes                                         |
| ------- | ----- | --------------------------------------------- |
| default | —     | actions or rich body, under `title`/`message` |

No events.

Use this rather than stretching a `StatusBadge` — a badge is a pill sized for one
or two words, and a whole sentence in one looks like a bug. `info` is brand,
`warn` is amber, `danger` is rose; a genuine load failure is still `ErrorState`,
not `NoticeBanner variant="danger"`.

```html
<NoticeBanner
  v-if="cascadeCount"
  variant="warn"
  title="Some of these cannot be restored on their own"
  :message="`${cascadeCount} reference a source or destination that was deleted too.`"
/>
```

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
          @click="router.push({ name: 'destinations-new' })"
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
        row =>
          router.push({ name: 'destinations-detail', params: { id: row.id } })
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
- **empty** → `DataTable` renders `EmptyState` with the `empty*` props. Add
  `empty-cta-label` + `empty-cta-to` for a one-button call to action; reach for
  `#empty` only when the two-case pattern is needed.
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
