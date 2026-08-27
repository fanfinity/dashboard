<template>
  <div class="flex flex-col gap-4">
    <NoticeBanner
      tone="info"
      message="Not sure which one? Pick the closest match — you can add more sources later, and every option leads to the exact setup steps for that platform."
    />

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <SelectableCard
        v-for="intent in available"
        :key="intent.key"
        :selected="modelValue === intent.key"
        @select="emit('update:modelValue', intent.key)"
      >
        <span
          class="grid size-10 place-items-center rounded-sfere-lg border transition duration-200 ease-sfere-ui"
          :class="
            modelValue === intent.key
              ? 'border-sfere-300 bg-sfere-100 text-sfere-brand-text'
              : 'border-sfere-line bg-sfere-fill text-sfere-fg-muted'
          "
        >
          <svg
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="intent.icon" />
          </svg>
        </span>

        <p class="mt-3 text-sm font-medium text-ink">{{ intent.title }}</p>
        <p class="mt-1.5 text-xs leading-5 text-muted">{{ intent.body }}</p>

        <p
          class="mt-3 flex items-center gap-1 text-xs font-medium text-sfere-brand-text"
        >
          <span aria-hidden="true">→</span>
          {{ intent.outcome }}
        </p>
      </SelectableCard>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SelectableCard from '@/components/ui/SelectableCard.vue'
import { SOURCE_INTENTS } from '@/config/sourceIntents'

// Step 1 of the guided flow: what are you connecting, in the reader's words.
//
// An intent whose templates are all absent is dropped rather than shown and
// then dead-ending on an empty step 2 — the template list is workspace-scoped,
// so a workspace with Stripe disabled should not be offered Payments. The
// `connector` intent has no templates and always survives: it navigates
// somewhere else entirely.
const props = defineProps({
  modelValue: { type: String, default: '' },
  // Template ids this workspace actually has, from useSourceTemplates().
  availableTemplateIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const available = computed(() =>
  SOURCE_INTENTS.filter(
    intent =>
      intent.to ||
      intent.templates.some(id => props.availableTemplateIds.includes(id))
  )
)
</script>
