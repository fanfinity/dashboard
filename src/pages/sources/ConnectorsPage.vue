<template>
  <!-- Same 1400px cap and the same reasoning as SourcesListPage: the header and
       the catalog below it are one column, so they share a left AND a right
       edge. Literal, not a token — Tailwind v4 extracts class names from source
       text. -->
  <q-page class="p-6">
    <div class="mx-auto w-full max-w-[1400px]">
      <!-- No `back` prop: the manifest's `parent` is the back link, so
           "← Sources" comes from one place along with the other 15 sub-screens. -->
      <PageHeader
        title="Connectors"
        subtitle="Pre-built integrations you can pull into Sfere."
      />

      <ConnectorCatalog />
    </div>
  </q-page>
</template>

<script setup>
import PageHeader from '@/components/ui/PageHeader.vue'
import ConnectorCatalog from '@/components/sources/ConnectorCatalog.vue'

// THE CATALOG IS A SCREEN AGAIN, AND THAT REVERSES A CONSOLIDATION.
//
// It was a route, then became `/sources?tab=connectors` on the argument that
// browsing connector *types* is a step in adding a source, so it belonged in
// that page rather than beside it in the sidebar. The Sources list has been
// rebuilt against the prototype since, and the prototype has no tab bar — so
// the tab that was holding the catalog is gone and three live callers pointed
// at it: `/connectors` (bookmarks, handover docs), the "Something else" intent
// in `sourceIntents.js`, and the first-run overlay's own "Something else"
// branch in `MainLayout`.
//
// The half of the old argument that still holds is the sidebar: this is a
// SUB-SCREEN (`parent: sources` in the manifest), so it has a back link and no
// rail row of its own. What changed is only where the catalog lives, not
// whether it is a place in the nav.
//
// The page is a shell on purpose. `ConnectorCatalog.vue` owns the search, the
// grid, the connect panel and all four states, unchanged, because it is the
// same component the tab rendered and the tab's behaviour is not what was
// wrong with it.
</script>
