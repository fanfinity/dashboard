<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <StatusBadge
      v-if="label"
      tone="brand"
      :label="label"
      :title="`Created from the ${record.templateId} template`"
    />
    <StatusBadge
      v-else
      tone="neutral"
      label="Custom"
      title="Hand-configured, not created from a template"
    />
    <StatusBadge
      v-if="upgrade"
      tone="warn"
      :label="upgradeText"
      :title="upgradeTitle"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useTemplates } from '@/composables/useTemplates'

// "Which template is this on, and is it behind?" — asked by both the list cell
// and the detail header, so the answer is composed once here rather than twice.
// The rule itself is not re-implemented: it comes straight from useTemplates().
//
// `compact` shortens the upgrade pill to one word for a table cell; the full
// "Upgrade available · <version>" sentence is for the detail screen, where there
// is room for it.
const props = defineProps({
  record: { type: Object, default: null },
  compact: { type: Boolean, default: false }
})

const { hasUpgrade, templateLabel, upgradeLabel } = useTemplates()

const label = computed(() => templateLabel(props.record))
const upgrade = computed(() => hasUpgrade(props.record))
const upgradeTitle = computed(() => upgradeLabel(props.record))
const upgradeText = computed(() =>
  props.compact ? 'Upgrade' : upgradeTitle.value
)
</script>
