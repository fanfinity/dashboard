<template>
  <q-item
    clickable
    class="min-h-0! rounded-xl! p-4! flex items-start gap-3 border border-line2 bg-white shadow-sm hover:shadow-md transition-shadow"
    @click="emit('select', connector)"
  >
    <!-- Logo -->
    <div
      class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-fill"
    >
      <img
        v-if="!logoFailed"
        :src="logo"
        :alt="connector.meta?.name"
        class="size-6 object-contain"
        @error="logoFailed = true"
      />
      <img v-else :src="icSources" alt="" class="size-5 opacity-60" />
    </div>

    <!-- Text -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <h3
          class="truncate text-sm! font-semibold! tracking-[-0.35px]! text-ink"
        >
          {{ connector.meta?.name || connector.packageId }}
        </h3>
        <span
          v-if="connector.meta?.license"
          class="shrink-0 rounded bg-fill px-1.5 py-0.5 text-[10px] font-medium text-subtle"
        >
          {{ connector.meta.license }}
        </span>
      </div>
      <p class="mt-0.5 truncate text-xs text-muted">{{
        connector.packageId
      }}</p>
    </div>
  </q-item>
</template>

<script setup>
import { ref } from 'vue'
import { logoUrl } from '@/composables/useConnectorCatalog'
import icSources from '@/assets/dashboard/ic-sources.svg'

const props = defineProps({
  connector: { type: Object, required: true }
})

const emit = defineEmits(['select'])

const logoFailed = ref(false)
const logo = logoUrl(props.connector)
</script>
