<template>
  <CardPanel>
    <div class="mb-3 flex items-baseline justify-between gap-2">
      <h2 class="text-sm! font-semibold! tracking-[-0.35px]! text-ink">{{
        title
      }}</h2>
      <router-link
        v-if="linkTo"
        :to="linkTo"
        class="text-xs font-medium text-brand hover:underline"
        >{{ linkLabel }}</router-link
      >
    </div>
    <ActivityList :items="items" :empty-text="emptyText" />
  </CardPanel>
</template>

<script setup>
import CardPanel from '@/components/ui/CardPanel.vue'
import ActivityList from '@/components/shell/ActivityList.vue'

// The card around an ActivityList: a heading, one "view all" link, the list.
// Home had this markup twice — Recent errors and Latest events — differing only
// in four strings, and needs each of them as an independently orderable block
// now, so the two copies became one component with props.
//
// `linkTo` is optional and the link is `v-if`'d rather than defaulted: a
// router-link to a route that does not exist logs the console warning
// scripts/smoke.mjs fails on, so "no link" has to be expressible.
defineProps({
  title: { type: String, required: true },
  items: { type: Array, default: () => [] },
  emptyText: { type: String, default: '' },
  linkLabel: { type: String, default: '' },
  linkTo: { type: [String, Object], default: null }
})
</script>
