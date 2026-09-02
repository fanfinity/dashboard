<template>
  <q-dialog v-model="open">
    <div :class="cardClasses">
      <div
        class="flex shrink-0 items-start justify-between gap-4 border-b border-sfere-line px-5 py-4"
      >
        <div class="min-w-0">
          <h2 class="font-sfere-display! text-sfere-h4! text-sfere-fg">{{
            builder ? `Edit “${builder.name}”` : 'Add a profile builder'
          }}</h2>
          <p class="mt-1 text-sfere-sm text-sfere-fg-muted"
            >Which identifiers a profile is stitched on, and in what order of
            trust.</p
          >
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div class="flex flex-col gap-4">
          <NoticeBanner
            v-if="apiMissing"
            tone="info"
            title="Nothing will be saved"
            message="Demo data mode is on, so this form validates and stops. Switch Settings → Data source to Real API to save."
          />

          <!-- A rename IS saveable here, unlike a function's: `ProfileBuilder`
               persists its name. Enabled rather than disabled for that reason. -->
          <FormField
            label="Name"
            required
            for-id="builder-name"
            :error="errors.name"
          >
            <SfereInput
              id="builder-name"
              v-model="form.name"
              placeholder="e.g. Fan profile"
              autocomplete="off"
            />
          </FormField>

          <FormField
            v-if="!builder"
            label="Slug"
            required
            for-id="builder-slug"
            hint="The machine name. Derived from the name; change it if you need a specific one."
            :error="errors.slug"
          >
            <SfereInput
              id="builder-slug"
              v-model="slugField"
              autocomplete="off"
            />
          </FormField>

          <!-- Ordered, and the order is the configuration: it decides which
               identifier wins when two disagree about who a profile is. Hence
               up/down controls rather than a checkbox set, and hence never
               sorting this list for tidiness. -->
          <FormField
            label="Stitch on"
            required
            for-id="builder-identifiers"
            hint="Most trusted first. When two identifiers disagree about who someone is, the one higher up wins."
            :error="errors.identifierTypes"
          >
            <div id="builder-identifiers" class="flex flex-col gap-2">
              <div
                v-for="(key, index) in form.identifierTypes"
                :key="key"
                class="flex items-center gap-2 rounded-sfere border border-sfere-line bg-white px-3 py-2"
              >
                <span class="w-5 shrink-0 text-xs text-sfere-fg-subtle"
                  >{{ index + 1 }}.</span
                >
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium text-sfere-fg">{{
                    labelFor(key)
                  }}</span>
                  <span
                    class="block font-sfere-mono text-[11px] text-sfere-fg-subtle"
                    >{{ key }}</span
                  >
                </span>
                <span class="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    class="rounded-sfere border border-sfere-line px-2 py-1 text-xs text-sfere-fg-muted hover:bg-sfere-fill disabled:opacity-40"
                    :disabled="index === 0"
                    aria-label="More trusted"
                    @click="moveIdentifier(index, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="rounded-sfere border border-sfere-line px-2 py-1 text-xs text-sfere-fg-muted hover:bg-sfere-fill disabled:opacity-40"
                    :disabled="index === form.identifierTypes.length - 1"
                    aria-label="Less trusted"
                    @click="moveIdentifier(index, 1)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="rounded-sfere border border-sfere-line px-2 py-1 text-xs text-rose-600 hover:bg-sfere-fill"
                    aria-label="Remove"
                    @click="removeIdentifier(index)"
                  >
                    ×
                  </button>
                </span>
              </div>

              <p
                v-if="!form.identifierTypes.length"
                class="text-sm text-sfere-fg-muted"
                >Nothing picked yet. A builder with no identifiers has nothing
                to stitch on.</p
              >

              <div v-if="available.length" class="flex items-center gap-2">
                <SfereSelect
                  v-model="pick"
                  :options="availableOptions"
                  class="w-56"
                  aria-label="Identifier to add"
                />
                <SfereButton
                  variant="secondary"
                  size="sm"
                  :disabled="!pick"
                  @click="addIdentifier"
                  >Add</SfereButton
                >
              </div>
            </div>
          </FormField>

          <FormField
            label="Destination"
            optional
            for-id="builder-destination"
            hint="Where the assembled profiles are written. Leave blank to build them without delivering anywhere yet."
          >
            <SfereSelect
              id="builder-destination"
              v-model="form.destinationId"
              :options="destinationOptions"
            />
          </FormField>

          <FormField
            label="Schedule"
            optional
            for-id="builder-cron"
            hint="Standard five-field cron. Leave blank to let the backend choose when to run."
            :error="errors.cron"
          >
            <SfereInput
              id="builder-cron"
              v-model="form.cron"
              placeholder="0 * * * *"
              autocomplete="off"
            />
          </FormField>

          <FormField
            label="Custom code"
            optional
            for-id="builder-code"
            hint="Optional JavaScript run while assembling each profile. Leave blank for the default behaviour."
          >
            <SfereTextarea
              id="builder-code"
              v-model="form.code"
              :rows="6"
              class="font-sfere-mono!"
            />
          </FormField>
        </div>
      </div>

      <div
        class="flex shrink-0 items-center justify-end gap-2 border-t border-sfere-line px-5 py-3.5"
      >
        <SfereButton v-close-popup variant="secondary" size="sm"
          >Cancel</SfereButton
        >
        <SfereButton size="sm" :loading="submitting" @click="submit">{{
          builder ? 'Save builder' : 'Create builder'
        }}</SfereButton>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import FormField from '@/components/ui/FormField.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereSelect from '@/components/ui/SfereSelect.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import { slugifyBuilder } from '@/composables/useProfileBuilders'

// One dialog for create and edit. The two forms differ by exactly one field —
// `slug` is required on create and not accepted on update — so two components
// would be two places to keep the identifier ordering logic, which is the part
// worth having once.
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** null for create. */
  builder: { type: Object, default: null },
  identifierTypes: { type: Array, default: () => [] },
  destinations: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
  apiMissing: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'submit'])

// Both halves, and a `min()`: Quasar's unlayered
// `.q-dialog__inner--minimized > div { max-width: 560px }` is a max-width, so a
// width alone loses to it, and a flat pixel max-width would stop the dialog
// shrinking on a narrow window.
const cardClasses = [
  'flex max-h-[85vh] w-[min(640px,94vw)]! max-w-[min(640px,94vw)]! flex-col flex-nowrap! overflow-hidden',
  'rounded-sfere-xl! border border-sfere-line bg-sfere-surface shadow-sfere-pop'
]

const open = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const form = reactive({
  name: '',
  identifierTypes: [],
  destinationId: '',
  cron: '',
  code: '',
  isEnabled: true
})
const errors = reactive({ name: '', slug: '', identifierTypes: '', cron: '' })
const pick = ref('')

const slugEdited = ref(false)
const slugManual = ref('')
const slugField = computed({
  get: () => (slugEdited.value ? slugManual.value : slugifyBuilder(form.name)),
  set: value => {
    slugEdited.value = true
    slugManual.value = value
  }
})

watch(open, isOpen => {
  if (!isOpen) return
  const b = props.builder
  form.name = b?.name ?? ''
  // Copied, not referenced: editing the order in this dialog must not mutate the
  // row behind it before anyone has saved.
  form.identifierTypes = [...(b?.identifierTypes ?? [])]
  form.destinationId = b?.destinationId ?? ''
  form.cron = b?.cron ?? ''
  form.code = b?.code ?? ''
  form.isEnabled = b ? b.isEnabled : true
  slugEdited.value = false
  slugManual.value = ''
  pick.value = ''
  errors.name = ''
  errors.slug = ''
  errors.identifierTypes = ''
  errors.cron = ''
})

function labelFor(key) {
  return props.identifierTypes.find(t => t.key === key)?.displayName ?? key
}

const available = computed(() =>
  props.identifierTypes.filter(t => !form.identifierTypes.includes(t.key))
)

const availableOptions = computed(() =>
  available.value.map(t => ({ value: t.key, label: t.displayName || t.key }))
)

const destinationOptions = computed(() => [
  { value: '', label: 'No destination' },
  ...props.destinations.map(d => ({ value: d.id, label: d.name }))
])

function addIdentifier() {
  if (!pick.value) return
  // Appended, so a newly added identifier is the LEAST trusted. Anything else
  // would silently promote it above choices already made.
  form.identifierTypes.push(pick.value)
  pick.value = ''
  errors.identifierTypes = ''
}

function moveIdentifier(index, delta) {
  const to = index + delta
  if (to < 0 || to >= form.identifierTypes.length) return
  const list = form.identifierTypes
  list.splice(to, 0, list.splice(index, 1)[0])
}

function removeIdentifier(index) {
  form.identifierTypes.splice(index, 1)
}

function validate() {
  errors.name = form.name.trim() ? '' : 'Give the builder a name.'
  errors.slug =
    props.builder || slugField.value.trim()
      ? props.builder || /^[a-z0-9-]+$/.test(slugField.value.trim())
        ? ''
        : 'A slug uses lower-case letters, numbers and hyphens only.'
      : 'A slug is required.'
  errors.identifierTypes = form.identifierTypes.length
    ? ''
    : 'Pick at least one identifier to stitch on.'
  const cron = form.cron.trim()
  errors.cron =
    cron && cron.split(/\s+/).length !== 5
      ? 'A cron expression has five space-separated fields.'
      : ''
  return !(errors.name || errors.slug || errors.identifierTypes || errors.cron)
}

function submit() {
  if (!validate()) return
  emit('submit', {
    name: form.name.trim(),
    ...(props.builder ? {} : { slug: slugField.value.trim() }),
    identifierTypes: [...form.identifierTypes],
    destinationId: form.destinationId || null,
    cron: form.cron.trim() || null,
    code: form.code.trim() || null,
    isEnabled: form.isEnabled
  })
}
</script>
