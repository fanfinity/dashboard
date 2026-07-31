<template>
  <q-page class="p-6">
    <PageHeader title="Destinations" subtitle="/destinations" />
    <EmptyState title="Not built yet" :description="description" />
  </q-page>
</template>

<script setup>
// STUB — implemented by issue #28.
// The route and this file already exist so the story agent rewrites in place and
// never has to touch src/router/. Replace this whole file; keep the path.
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const description =
  'This screen is tracked by issue #28 and has not been implemented yet.'
</script>
