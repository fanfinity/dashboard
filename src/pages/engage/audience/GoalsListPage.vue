<template>
  <q-page class="p-6">
    <PageHeader title="Goals" subtitle="/goals" />
    <EmptyState title="Not built yet" :description="description" />
  </q-page>
</template>

<script setup>
// STUB — implemented by issue #41.
// The route and this file already exist so the story agent rewrites in place and
// never has to touch src/router/. Replace this whole file; keep the path.
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const description =
  'This screen is tracked by issue #41 and has not been implemented yet.'
</script>
