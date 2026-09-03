<template>
  <q-page class="p-6">
    <!-- The guided source flow, as one page in three steps rather than three
         routes.
         WHY ONE PAGE: the three steps share the form state — the intent picks
         the template, the template names the source, the created source is what
         the install guide needs a key from. Three routes would mean threading
         all of it through query params or a store, and a reload mid-flow would
         land on step 3 with nothing to install.
         WHAT A RELOAD DOES NOW, because this reverses what used to be written
         here. Steps 1-2 survive it, through `useSourceDraft` — by the middle of
         step 2 someone has chosen a platform, named the source, thought about a
         slug and possibly walked off to Zid's site and back, and throwing all of
         that away on a refresh is not "clean", it is an unannounced undo. Step 3
         still does NOT survive, and for the original reason: `created.id` and
         the write key exist exactly once, in the create response, so a restored
         step 3 would be an install guide with no key to show. A restored draft
         says so on screen and offers a way out — see `restoredFromDraft` — for
         the same honesty the old behaviour was reaching for.
         The `<h1>` comes from PageHeader and never changes identity, so
         `pnpm smoke:dist` sees one titled screen regardless of which step is
         showing.
         ONE WIDTH FOR THE WHOLE FLOW: `max-w-[1400px]` on the stepper and on
         each of the three steps, so the header, the rungs and the content share
         a left AND a right edge. They used to cap at 3xl / 5xl / 4xl / 4xl,
         which stepped the right-hand edge in and out as the flow advanced and
         left ~40% of a wide monitor empty on step 1. The cap is a literal on
         each element rather than a shared constant because Tailwind v4 extracts
         class names from source text: a runtime-built string is never
         generated. Line length is kept readable inside that width by the
         layouts, not by the cap — step 2 goes two columns past 64rem. -->
    <PageHeader :title="headerTitle" :subtitle="headerSubtitle">
      <template #actions>
        <!-- The header action follows what the workspace actually needs next.
             A source whose warehouse and pipe the backend already provisioned
             needs neither, so pointing at `destinations-new` there invites a
             duplicate; the source itself is the useful destination. See
             `suggestAddDestination` for why an unfinished or failed lookup gets
             the neutral action rather than the prompt. -->
        <SfereButton
          v-if="step === 'install' && !suggestAddDestination"
          size="sm"
          :to="{ name: 'sources-detail', params: { id: created.id } }"
          >Open this source →</SfereButton
        >
        <SfereButton
          v-else-if="step === 'install'"
          size="sm"
          :to="{ name: 'destinations-new' }"
          >Add a destination →</SfereButton
        >
      </template>
    </PageHeader>

    <!-- The stepper is also the way back. Step 2 used to carry a grey
         "Setting up Web SDK. <description> [Change]" banner above Details,
         which was a third statement of something the `<h1>` ("Add a Web SDK
         source") already said — but it owned the only obvious route back to the
         picker, so the Change control moved here rather than being deleted with
         it. A completed rung is a real <button>; step 3 offers none, because by
         then a row exists in the backend and there is nothing to go back to. -->
    <div class="mb-6 w-full max-w-[1400px]">
      <SetupStepper
        :steps="STEPS"
        :current="stepIndex"
        :navigable-steps="navigableSteps"
        aria-label="Add a source"
        @navigate="goToStep"
      />
    </div>

    <LoadingState v-if="loading" variant="form" :rows="5" />

    <ErrorState
      v-else-if="error"
      title="Couldn't load the source templates."
      :message="error"
      @retry="load"
    />

    <EmptyState
      v-else-if="!templates.length"
      title="No source templates available"
      description="Your workspace has no ingestion templates enabled yet. Ask an admin to enable one."
    >
      <template #cta>
        <SfereButton variant="secondary" :to="{ name: 'sources' }"
          >Back to sources</SfereButton
        >
      </template>
    </EmptyState>

    <!-- STEP 1 — what are you connecting?
         NO CONTINUE BUTTON, deliberately. Picking a card IS continuing: the card
         is already the control, it already commits visibly on click, and asking
         for a second click on a button below the fold charged one decision
         twice. `continueFromIntent` still owns what "continue" means — the
         connector intent navigates elsewhere, a single-template intent settles
         its template — it is just fired by the card now. -->
    <div
      v-else-if="step === 'intent'"
      class="w-full max-w-[1400px]"
      data-tour="source-intent"
    >
      <SourceIntentPicker
        v-model="intent"
        :available-template-ids="templateIds"
        @choose="continueFromIntent"
      />
    </div>

    <!-- STEP 2 — name it and set it up.
         TWO COLUMNS PAST 64rem, behind a container query rather than a viewport
         breakpoint: MainLayout's sidebar collapses without changing the
         viewport, so one 1024px window has two content widths and a `lg:` here
         would be wrong in one of them (ui-conventions rule 12). The columns are
         what make the 1400px cap usable — a single column at that width is a
         run of 1300px-wide text inputs, which is worse than the empty space it
         replaced, not better. -->
    <form
      v-else-if="step === 'configure'"
      class="@container grid w-full max-w-[1400px] gap-4 @min-[64rem]:grid-cols-2 @min-[64rem]:items-start"
      @submit.prevent="submit"
    >
      <!-- A restored draft announces itself. Landing silently inside a
           half-filled form you last touched a week ago reads as a bug, or worse
           as a source you already made; one quiet line and a way out is what
           turns it back into a convenience. -->
      <div
        v-if="restoredFromDraft"
        class="flex flex-wrap items-center justify-between gap-3 rounded-sfere-lg border border-sfere-line bg-sfere-fill px-4 py-3 @min-[64rem]:col-span-2"
      >
        <p class="min-w-0 flex-1 text-sm text-muted">
          Picked up where you left off. Nothing has been created yet.
        </p>
        <SfereButton variant="ghost" size="sm" @click="startOver"
          >Start over</SfereButton
        >
      </div>

      <!-- One template behind the chosen intent: settled by the intent itself,
           with the trip back living on the stepper. Two or more: a real choice,
           and it spans both columns because it decides what the rest of the form
           is about. -->
      <FormSection
        v-if="intentTemplates.length > 1"
        data-tour="source-template"
        title="Which one?"
        :description="`${chosenIntent?.title} covers ${intentTemplates.length} templates. Pick the platform you are wiring up.`"
        class="@min-[64rem]:col-span-2"
      >
        <SourceTemplatePicker
          :model-value="form.templateId"
          :templates="intentTemplates"
          @update:model-value="pickTemplate"
        />
        <p v-if="errors.templateId" class="text-xs text-rose-500">{{
          errors.templateId
        }}</p>
      </FormSection>

      <!-- First thing on the form for a Zid source, above its own name, because
           it is the only thing here that can stop the source working and the
           only one that runs on someone else's schedule — the store owner leaves
           for Zid's site and comes back. It gates the submit rather than merely
           advising: an unauthorised store gives a source that can read nothing.
           It sits below the template picker only because picking Zid is what
           reveals it. -->
      <ZidAuthorizePanel
        v-if="isZid"
        v-model="form.storeId"
        class="@min-[64rem]:col-span-2"
      />

      <!-- No section description here any more. It read "How this source appears
           in lists, and the slug its ingest endpoint uses." — which is the two
           field hints below it, said a third time, above the labels that say it
           a fourth. Each hint is now one clause that the label does not already
           carry. -->
      <FormSection title="Details">
        <FormField
          label="Name"
          required
          for-id="source-name"
          :error="errors.name"
          hint="What teammates will see in lists and pipe diagrams."
        >
          <SfereInput
            id="source-name"
            v-model="form.name"
            placeholder="e.g. Matchday web tracker"
            @update:model-value="touched.name = true"
          />
        </FormField>

        <FormField
          label="Slug"
          required
          for-id="source-slug"
          :error="errors.slug"
          :hint="slugHint"
        >
          <SfereInput
            id="source-slug"
            v-model="form.slug"
            placeholder="matchday-web-tracker"
            @update:model-value="onSlugInput"
          />
        </FormField>

        <FormField
          label="Description"
          optional
          for-id="source-description"
          hint="Why this source exists, for whoever inherits it."
        >
          <SfereTextarea
            id="source-description"
            v-model="form.description"
            :rows="3"
            placeholder="First-party web tracker on sfere.io"
          />
        </FormField>
      </FormSection>

      <!-- Column two: everything decided at create time that is not the source's
           own identity. A wrapper rather than two grid children, because
           auto-placement would otherwise drop the second of them back under
           Details in column one. -->
      <div class="grid content-start gap-4">
        <!-- Keys and strict mode. Both are decided at create time and both are
             easy to get wrong, so each carries its own sentence about what it is
             for rather than a bare label. -->
        <FormSection
          v-if="issuesWriteKey"
          title="Keys"
          description="Generated when you save. You never have to invent one."
        >
          <div
            class="rounded-sfere-lg border border-sfere-line bg-sfere-fill px-4 py-3"
          >
            <p class="text-sm font-medium text-ink">Browser write key</p>
            <p class="mt-1 text-xs text-muted">
              Public by design, so it belongs in client-side code, the same way
              a Google Analytics or Meta Pixel id does. Issued automatically.
            </p>
          </div>

          <div class="flex items-start justify-between gap-4">
            <!-- `min-w-0 flex-1` throughout this file for the same reason:
                 Quasar's unlayered `.flex { flex-wrap: wrap }` outranks
                 Tailwind's `flex-nowrap`, so a text child wider than the row
                 jumps to its own line and strands the control beside it. -->
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-ink"
                >Also issue a server-to-server key</p
              >
              <p class="mt-1 text-xs text-muted">
                Only if you will also send events from your own backend for this
                source. Keep that one private, never in client-side code.
              </p>
            </div>
            <SfereToggle
              v-model="form.serverKey"
              label="Issue a server-to-server key"
            />
          </div>

          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-ink">Strict mode</p>
              <p class="mt-1 text-xs text-muted">
                Off while you are wiring things up: an event arriving without a
                valid key is still matched to this source by domain. Turn it on
                once you are confident, so a mistyped key fails loudly instead
                of landing somewhere quietly wrong.
              </p>
            </div>
            <SfereToggle v-model="form.strictMode" label="Strict mode" />
          </div>
        </FormSection>

        <FormSection
          title="State on creation"
          description="A paused source keeps its configuration but accepts no events."
        >
          <div class="flex items-center gap-2">
            <button
              v-for="opt in STATE_OPTIONS"
              :key="opt.label"
              type="button"
              class="rounded-sfere px-3 py-1.5 text-sm transition duration-150 ease-sfere-ui"
              :class="
                form.isEnabled === opt.value
                  ? 'border border-sfere-300 bg-sfere-50 font-medium text-sfere-brand-text'
                  : 'border border-sfere-line bg-white text-muted hover:bg-sfere-fill'
              "
              @click="form.isEnabled = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </FormSection>
      </div>

      <StickyActionBar
        class="@min-[64rem]:col-span-2"
        data-tour="source-submit"
      >
        <!-- A DISABLED SUBMIT IS ONLY ALLOWED WITH A SENTENCE BESIDE IT. QA
             filed the unexplained version of this as "invalid input is rejected
             completely silently", and the precedent that survived that — the Zid
             authorization gate — is disabled only because it names the missing
             step. Same grammar here: `missingSummary` says which one thing is
             outstanding, in the order someone would fix them. It replaced a
             fully-live Create button on an empty form, which promised a click
             that could only ever produce three red messages. -->
        <SfereButton type="submit" :loading="saving" :disabled="!canSubmit">{{
          saving ? 'Creating…' : 'Create source →'
        }}</SfereButton>
        <!-- `secondary` is already the right variant — it is the kit's bordered
             quiet action — but the variant draws a `sfere-line` hairline on a
             `sfere-surface` body, and StickyActionBar's own background is
             `sfere-surface` too. White on white with a #e5e5e5 edge reads as
             chrome, so the control people reach for to go back looked like it
             only existed on hover. `bg-sfere-fill!` gives it a rest surface the
             bar does not share. The important SUFFIX is not the Quasar
             collision here — this is a plain Tailwind-versus-Tailwind fight:
             the variant string and this fallthrough class both land on the same
             element, on the same property, and which one wins is decided by
             Tailwind's emit order, not by the order they are written. The
             suffix removes the coin flip.
             THIS BELONGS IN sfereButtonVariants.js, not here — a quiet action on
             a surface-coloured bar is not a problem unique to this screen, and
             the day the palette grows a variant that carries its own rest fill,
             delete this class. -->
        <SfereButton
          variant="secondary"
          class="bg-sfere-fill!"
          @click="backToIntent"
          >Back</SfereButton
        >
        <p v-if="missingSummary" class="min-w-0 flex-1 text-xs text-subtle">{{
          missingSummary
        }}</p>
        <p v-else-if="!isReal" class="min-w-0 flex-1 text-xs text-subtle"
          >Demo data mode. This will walk you through setup but save nothing.
          Switch Settings → Data source to real to persist.</p
        >
      </StickyActionBar>
    </form>

    <!-- STEP 3 — install and confirm. -->
    <div v-else class="grid w-full max-w-[1400px] gap-4">
      <NoticeBanner
        v-if="preview"
        tone="warn"
        title="Nothing was saved"
        message="You are in Demo data mode, so this source exists only on this screen. The snippets below are the right shape but the key is not a real key. Switch Settings → Data source to real and create it again to go live."
      />

      <!-- What the backend already did, above the instructions. Creating a web
           or Zid source provisions its ClickHouse destination and the pipe
           joining the two in the same call, so by the time this step renders the
           workspace has finished all three setup steps — and until now the
           screen's primary action still said "Add a destination", sending people
           to build a second one by hand.
           Skipped in preview: nothing was saved, so there is no pipe to find and
           the "Nothing was saved" banner above already owns that story. -->
      <!-- The moment, and then the record. The overlay is the few seconds where
           the chain draws itself over the whole screen; the panel below holds
           the same three nodes permanently, for whoever blinked, tabbed away, or
           comes back to this from the source's Setup instructions tab. Both are
           driven by the one lookup and both open only on `found`, so neither can
           claim a pipe for a source that got none. -->
      <SourceProvisionedOverlay
        v-if="showProvisionedOverlay"
        :state="provisioningState"
        :source="created"
        :pipe="provisionedPipe"
        :destination="provisionedDestination"
        @close="onProvisionedOverlayClose"
      />

      <!-- The one deliberate exception to "lead with what the backend already
           did". A Zid source gets the same provisioned chain as a web one, but
           the chain is DRY until the store owner grants the app access on Zid's
           own domain — nothing the backend can do for them. Showing the pipe
           first and the authorisation below the fold would say "you're live"
           to someone whose store has not let us read a single order, so for
           Zid the outstanding step goes above the record of the finished ones.
           Same component as the source detail page renders, for the same reason
           SourceInstallGuide is shared: whoever closes this tab mid-setup meets
           the identical three steps when they come back. -->
      <ZidSetupWizard v-if="showZidWizard" :source="created" />

      <ProvisionedPipePanel
        v-if="!preview"
        :state="provisioningState"
        :source="created"
        :pipe="provisionedPipe"
        :destination="provisionedDestination"
      />

      <SourceInstallGuide
        :source="created"
        :preview="preview"
        :delivers-to="deliversTo"
        @copy="copyValue"
        @verified="onVerified"
      />

      <!-- Same rule as the header, one step further: when the pipe exists, the
           primary is the source and "Add another destination" demotes to a
           ghost, because a second warehouse is a real thing someone might want
           and a wrong thing to lead with. -->
      <!-- The plain trip back left this row when PageHeader started rendering
           `← Sources` from the manifest: a button whose label only names where
           it goes is navigation, and navigation belongs in one place. "I'll
           finish this later" stays, because it is not that — it says leaving
           the flow unfinished is a fine thing to do, which no back arrow says. -->
      <StickyActionBar>
        <template v-if="!suggestAddDestination">
          <SfereButton
            :to="{ name: 'sources-detail', params: { id: created.id } }"
            >Open this source →</SfereButton
          >
          <SfereButton variant="ghost" :to="{ name: 'destinations-new' }"
            >Add another destination</SfereButton
          >
        </template>
        <template v-else>
          <SfereButton :to="{ name: 'destinations-new' }"
            >Add a destination →</SfereButton
          >
          <SfereButton
            v-if="!preview"
            variant="secondary"
            :to="{ name: 'sources-detail', params: { id: created.id } }"
            >Open this source</SfereButton
          >
          <SfereButton variant="ghost" :to="{ name: 'sources' }"
            >I'll finish this later</SfereButton
          >
        </template>
      </StickyActionBar>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import PageHeader from '@/components/ui/PageHeader.vue'
import FormSection from '@/components/ui/FormSection.vue'
import FormField from '@/components/ui/FormField.vue'
import LoadingState from '@/components/ui/LoadingState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereInput from '@/components/ui/SfereInput.vue'
import SfereTextarea from '@/components/ui/SfereTextarea.vue'
import SfereToggle from '@/components/ui/SfereToggle.vue'
import StickyActionBar from '@/components/ui/StickyActionBar.vue'
import SetupStepper from '@/components/sources/SetupStepper.vue'
import SourceIntentPicker from '@/components/sources/SourceIntentPicker.vue'
import SourceInstallGuide from '@/components/sources/SourceInstallGuide.vue'
import ProvisionedPipePanel from '@/components/sources/ProvisionedPipePanel.vue'
import SourceProvisionedOverlay from '@/components/sources/SourceProvisionedOverlay.vue'
import SourceTemplatePicker from '@/components/sources/SourceTemplatePicker.vue'
import ZidSetupWizard from '@/components/sources/ZidSetupWizard.vue'
import ZidAuthorizePanel from '@/components/sources/ZidAuthorizePanel.vue'
import {
  intentByKey,
  isIntentComingSoon,
  isTemplateComingSoon
} from '@/config/sourceIntents'
import { slugify, useSourceTemplates } from '@/composables/useSources'
import { useSourcesAPI } from '@/composables/useSourcesAPI'
import { useSourceProvisioning } from '@/composables/useSourceProvisioning'
import { useSourceDraft } from '@/composables/useSourceDraft'
import { useDataSource } from '@/composables/useDataSource'
import { useConfetti } from '@/composables/useConfetti'
import { useGuidedTour } from '@/composables/useGuidedTour'

const router = useRouter()
const $q = useQuasar()
const { templates, loading, error, load, findById } = useSourceTemplates()
const { isReal } = useDataSource()
const { create: createSourceReal } = useSourcesAPI()
const { hasDraft, draft, save: saveDraft, clear: clearDraft } = useSourceDraft()
const { fire: fireConfetti } = useConfetti()
const { show: showTourStep } = useGuidedTour()

// What the create call built besides the source. Discovered, never assumed — a
// `cloud_app` source gets no destination and no pipe, so the answer decides both
// the panel and this screen's primary action.
const {
  state: provisioningState,
  pipe: provisionedPipe,
  destination: provisionedDestination,
  provisioned,
  discover: discoverProvisioning
} = useSourceProvisioning()

// Three steps for every template, Zid included. Authorising a Zid store is a
// field of the form, not a step of its own: it was briefly a fourth step, which
// made the stepper grow a rung the moment someone picked Zid on step 2 and moved
// them backwards to reach it. A wizard whose shape changes under you is worse
// than one question asked in place.
const STEPS = [
  { key: 'intent', label: 'What are you connecting?' },
  { key: 'configure', label: 'Add the source' },
  { key: 'install', label: 'Install & confirm' }
]

const STATE_OPTIONS = [
  { label: 'Enabled', value: true },
  { label: 'Paused', value: false }
]

const step = ref('intent')
const intent = ref('')
const saving = ref(false)
const slugTouched = ref(false)
const created = ref(null)
const preview = ref(false)
const restoredFromDraft = ref(false)

// One-way, and set BEFORE `clearDraft()` on a successful create. The draft
// writer is a deep watcher, so a flush queued by the last keystroke can land
// after the clear and write the record straight back — which is exactly the
// "stale draft resurrects a source someone already made" failure. The step check
// alone would not catch it, because the flush carries the state as of its own
// scheduling.
const finished = ref(false)

// Errors appear when a field has been touched or the form has been submitted,
// never merely because a field is currently empty. An untouched form used to
// render "A source name is required.", "A slug is required." and "Pick a source
// template." in red before a single keystroke, which is the screen telling
// someone off for not yet having done the thing they just arrived to do.
const submitted = ref(false)
const touched = reactive({ name: false, slug: false, templateId: false })

const stepIndex = computed(() =>
  Math.max(
    0,
    STEPS.findIndex(s => s.key === step.value)
  )
)

// Only step 1 is ever offered back, and only from step 2. From step 3 a row
// exists in the backend, so "go back and change the platform" is a promise this
// page cannot keep — the source would have to be deleted, which is a different
// decision and lives on its own screen.
const navigableSteps = computed(() => (step.value === 'configure' ? [0] : []))

const form = reactive({
  templateId: '',
  name: '',
  slug: '',
  description: '',
  storeId: '',
  isEnabled: true,
  serverKey: false,
  strictMode: false
})

const templateIds = computed(() => templates.value.map(t => t.id))

const chosenIntent = computed(() => intentByKey(intent.value))

const intentTemplates = computed(() => {
  const ids = chosenIntent.value?.templates ?? []
  return templates.value.filter(t => ids.includes(t.id))
})

const selectedTemplate = computed(() => findById(form.templateId))

const isZid = computed(() => form.templateId === 'zid')

// Whether the form still owes a platform choice — which is exactly when the
// "Which one?" section renders, and the only time Create is not the next thing
// to press on this step.
const needsTemplateChoice = computed(
  () => intentTemplates.value.length > 1 && !form.templateId
)

// What is actually wrong with the form right now, regardless of whether the
// reader has earned the right to be told. `errors` below is this, gated on
// touched-or-submitted; `canSubmit` is this, ungated. Keeping the two derived
// from one source is what stops a disabled button disagreeing with the messages
// under the fields.
const problems = computed(() => {
  const out = { templateId: '', name: '', slug: '', storeId: '' }

  if (!form.templateId) {
    out.templateId = 'Pick a source template.'
  } else if (isTemplateComingSoon(form.templateId)) {
    // Reachable only from a hand-edited store or a draft written before that
    // template was greyed out — useSourceDraft drops those on read, and the
    // picker cards are disabled. Kept because the alternative is a source that
    // can never receive an event.
    out.templateId = 'That platform is not available yet. Pick another.'
  }

  if (!form.name.trim()) out.name = 'A source name is required.'

  if (!form.slug.trim()) {
    out.slug = 'A slug is required.'
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
    out.slug = 'Use lowercase letters, numbers and single dashes only.'
  }

  // A Zid store id only ever comes from an authorization now, so its absence IS
  // "the store has not granted access". The backend answers
  // `400 store_id is required for Zid sources`, which is why this one gates the
  // submit rather than reporting on it.
  if (isZid.value && !form.storeId.trim()) {
    out.storeId = 'A Zid source needs its store ID.'
  }

  return out
})

const errors = computed(() => ({
  templateId:
    submitted.value || touched.templateId ? problems.value.templateId : '',
  name: submitted.value || touched.name ? problems.value.name : '',
  slug: submitted.value || touched.slug ? problems.value.slug : '',
  // Never rendered by this page — ZidAuthorizePanel owns that conversation —
  // but carried so `problems` stays the single list.
  storeId: submitted.value ? problems.value.storeId : ''
}))

const canSubmit = computed(() => !Object.values(problems.value).some(Boolean))

// The sentence beside a disabled Create, naming ONE outstanding thing in the
// order someone would fix them. Not a list: three simultaneous complaints beside
// a dead button is the shouting this screen just stopped doing.
const missingSummary = computed(() => {
  const p = problems.value
  if (p.templateId) return 'Pick a platform to continue.'
  if (p.storeId) return 'Authorize your Zid store above to continue.'
  if (p.name && p.slug) return 'Add a name and slug to continue.'
  if (p.name) return 'Add a name to continue.'
  if (p.slug) {
    return form.slug.trim()
      ? 'Fix the slug to continue.'
      : 'Add a slug to continue.'
  }
  return ''
})

// The remaining go-live steps for a Zid source: register webhooks and run the
// first backfill. Both need a source id, so unlike authorisation they can only
// be offered after the create call. The wizard re-checks `zid-status` on mount,
// so a store authorised on the step before renders step 1 already ticked and the
// merchant lands on the two that are actually left.
//
// `preview` is excluded for the reason the banner above it gives: Demo mode
// saved nothing, so there is no source to register webhooks for.
const showZidWizard = computed(
  () => !preview.value && isReal.value && created.value?.sourceType === 'zid'
)

// The celebratory overlay is suppressed for Zid, and it is the same judgement
// that puts the wizard above ProvisionedPipePanel: the chain the backend built
// is real but DRY until webhooks are registered and the first sync has run, so
// two seconds of it lighting up would be the loudest claim on the screen and the
// least true. The panel still states the chain, under the steps that make it
// carry anything.
const showProvisionedOverlay = computed(
  () => !preview.value && created.value?.sourceType !== 'zid'
)

// The burst, on exactly the same gate as the overlay and no wider. Three of the
// seven templates provision nothing, Zid's chain is dry until webhooks and a
// first sync have run, and Demo mode saved nothing at all — so "a source was
// created" is not the moment, and `state === 'found'` beside a shown overlay is.
// This repo's whole posture is refusing to claim more than the backend did, and
// confetti is the loudest claim a screen can make.
//
// ONE-WAY, for the reason the overlay's own `started` flag exists: `state` can
// settle to 'found' and notify again when a late destinations read fills in the
// name, and a second burst over someone already reading their write key is
// noise. A plain `let`, not a ref — nothing renders it.
//
// The delay lands it on the beat rather than ahead of it: the overlay lights its
// three nodes 340ms apart, so the chain completes at ~800ms and a burst at
// creation time would be over before the thing it celebrates had drawn.
let celebratedProvisioning = false

watch(
  () => provisioningState.value,
  state => {
    if (state !== 'found' || celebratedProvisioning) return
    if (!showProvisionedOverlay.value) return
    celebratedProvisioning = true
    fireConfetti({ count: 120, delay: 700, origin: { x: 0.5, y: 0.5 } })
  }
)

// THE WALKTHROUGH IS DRIVEN FROM HERE, not inferred by the tour. This page is
// the only thing that knows which of its three steps is showing, so it names the
// coachmark for that step and the spotlight renders it; `show()` is a no-op
// unless a walkthrough is actually running, which is what lets this be
// unconditional. `immediate` covers a reload landing back on step 2 from the
// draft, where nothing changes and the guidance still applies.
//
// STEP 3 WAITS ITS TURN. `SourceProvisionedOverlay` covers the whole screen for
// two seconds when a pipe was provisioned, so pointing at a button underneath it
// would scroll the page behind a curtain and reveal a coachmark somebody never
// saw arrive. The overlay only ever opens on `state === 'found'`, so that is the
// one case that waits for its `close`; every other answer — 'none' on a mobile
// or HTTP source, 'unavailable' on a failed read, or no overlay at all in
// preview — has no curtain to wait for. 'idle' and 'looking' wait because the
// lookup may still turn into 'found'.
watch(
  [step, provisioningState, needsTemplateChoice],
  () => {
    if (step.value === 'intent') {
      showTourStep('source-intent')
      return
    }
    if (step.value === 'configure') {
      // Rung 2 has two callouts and this is the page's own answer to which. An
      // intent covering several platforms — "An online store" is Zid and
      // Shopify — opens this form with the choice still outstanding, so Create
      // is disabled and the next click is the picker, not the action row.
      // Ringing Create there would dim the card someone actually has to press.
      showTourStep(
        needsTemplateChoice.value ? 'source-template' : 'source-configure'
      )
      return
    }
    if (showProvisionedOverlay.value) {
      if (
        provisioningState.value === 'none' ||
        provisioningState.value === 'unavailable'
      ) {
        showTourStep('source-install')
      }
      return
    }
    showTourStep('source-install')
  },
  { immediate: true }
)

function onProvisionedOverlayClose() {
  showTourStep('source-install')
}

// A cloud app is polled, so no key is ever issued for it and the Keys section
// would be describing something that does not exist.
const issuesWriteKey = computed(
  () => selectedTemplate.value?.sourceType !== 'cloud_app'
)

const headerTitle = computed(() => {
  if (step.value === 'install')
    return `Install & confirm ${created.value?.name}`
  if (step.value === 'configure' && selectedTemplate.value) {
    return `Add a ${selectedTemplate.value.name} source`
  }
  return 'Connect a source'
})

const headerSubtitle = computed(() => {
  if (step.value === 'install') {
    return 'Pick how you want to send events. You can add another method later.'
  }
  if (step.value === 'configure') {
    return 'This creates the place your events land. Setup instructions come right after.'
  }
  return "Tell us what you're tracking, and we'll show you exactly what to do next."
})

// The primary action on step 3. "Add a destination" is only right when we KNOW
// there is not one — so it is gated on the lookup having actually answered `none`.
// A lookup still in flight, or one that failed, must not invite a duplicate
// warehouse next to a notice saying we probably built one; and gating this way
// means the button can only ever move from the safe answer to the specific one,
// never from "don't add" to "add" under someone's cursor. Preview mode saved
// nothing, so the original prompt stands there.
const suggestAddDestination = computed(
  () => preview.value || provisioningState.value === 'none'
)

// Handed to the install guide so its "events are arriving" result can name where
// they are already landing instead of telling someone to add a destination they
// were given. Empty until the pipe is found — the guide keeps its original copy
// then, which is still right for a cloud app and for a lookup that failed.
const deliversTo = computed(() => {
  // Enabled, not merely provisioned. A paused pipe delivers nothing, so naming
  // where events "are being delivered" would be false — the backend creates it
  // enabled today, which makes this unreachable rather than unnecessary.
  if (!provisioned.value || !provisionedPipe.value?.isEnabled) return ''
  return provisionedDestination.value?.name || 'its warehouse'
})

// One clause the label does not carry. The character rule that used to lead this
// line is the slug field's error message on submit, so printing it here as well
// meant the same sentence appeared twice for anyone who got it wrong.
const slugHint = computed(
  () => `Its ingest endpoint: /v1/${form.slug || 'your-slug'}`
)

function continueFromIntent(key) {
  const chosen = intentByKey(key) ?? chosenIntent.value
  if (!chosen || isIntentComingSoon(chosen)) return

  // The one intent that is not a template: browsing connectors is a different
  // screen, so send them there instead of into a form.
  if (chosen.to) {
    router.push(chosen.to)
    return
  }

  // A single-template intent is settled by the intent itself — nobody should
  // have to pick "Web SDK" after saying "a website".
  //
  // COUNTED OVER THE WHOLE CATALOG, not over the pickable subset. "An online
  // store" covers Zid and Shopify, and Shopify is coming-soon: narrowing to the
  // pickable one would auto-settle Zid and skip the picker, which is exactly
  // where the reader is supposed to SEE that Shopify is on its way. Two cards,
  // one of them greyed, is the answer to "where is Shopify?".
  const ids = chosen.templates
  const inCatalog = templates.value.filter(t => ids.includes(t.id))
  if (inCatalog.length === 1) {
    form.templateId = inCatalog[0].id
  } else if (
    !inCatalog.some(t => t.id === form.templateId) ||
    isTemplateComingSoon(form.templateId)
  ) {
    form.templateId = ''
  }

  step.value = 'configure'
}

function backToIntent() {
  step.value = 'intent'
}

function goToStep(index) {
  // Only ever step 1, and only from step 2 — `navigableSteps` already says so,
  // but the stepper is a dumb renderer and this is the page's own answer.
  if (index === 0 && step.value === 'configure') backToIntent()
}

function pickTemplate(id) {
  touched.templateId = true
  form.templateId = id
}

function onSlugInput() {
  slugTouched.value = true
  touched.slug = true
}

// Picking a template seeds the name from its defaults, but never overwrites
// something the user has already typed.
watch(
  () => form.templateId,
  id => {
    const template = findById(id)
    if (!template) return
    if (!form.name.trim()) form.name = template.defaults?.name ?? template.name
  }
)

watch(
  () => form.name,
  name => {
    if (!slugTouched.value) form.slug = slugify(name)
  }
)

// The draft writer. Steps 1-2 only, never while the flow is finished, and never
// before a template is settled — an intent someone clicked and abandoned inside
// a second is not work worth resuming into.
watch(
  [intent, form, slugTouched],
  () => {
    if (finished.value || step.value === 'install') return
    if (!intent.value || !form.templateId) return
    saveDraft({
      intent: intent.value,
      templateId: form.templateId,
      form: { ...form, slugTouched: slugTouched.value }
    })
  },
  { deep: true }
)

function resetForm() {
  Object.assign(form, {
    templateId: '',
    name: '',
    slug: '',
    description: '',
    storeId: '',
    isEnabled: true,
    serverKey: false,
    strictMode: false
  })
  slugTouched.value = false
  submitted.value = false
  touched.name = false
  touched.slug = false
  touched.templateId = false
}

// The way out of a restored draft. It clears the store as well as the form —
// "start over" that leaves the record behind would hand the same half-built
// source back on the next reload, which is the opposite of what was asked for.
function startOver() {
  clearDraft()
  restoredFromDraft.value = false
  intent.value = ''
  resetForm()
  step.value = 'intent'
}

// Run once, AFTER `load()` resolves: every validity check here reads the
// template registry, and against an empty array they all answer "gone" and throw
// away a perfectly good draft.
function restoreDraft() {
  if (!hasDraft.value) return
  const record = draft.value
  const chosen = intentByKey(record.intent)
  if (!chosen || isIntentComingSoon(chosen)) return
  // The template has to still exist in THIS workspace's catalog. The list is
  // workspace-scoped, so a draft can outlive the template it names.
  if (!findById(record.templateId)) return

  const { slugTouched: wasSlugTouched, ...fields } = record.form ?? {}
  intent.value = record.intent
  Object.assign(form, fields, { templateId: record.templateId })
  // Assigned in the same synchronous block as the fields above, so it is
  // already correct when the `form.name` watcher flushes — otherwise that
  // watcher would slugify the restored name over a slug somebody hand-typed.
  slugTouched.value = wasSlugTouched === true
  restoredFromDraft.value = true
  step.value = 'configure'
}

async function submit() {
  submitted.value = true
  if (!canSubmit.value) return
  saving.value = true

  // Real mode: POST to the backend, then step straight into the install guide
  // for the source that now exists — the write key it returns is what the
  // snippets need, so this is the only moment the flow can hand it over without
  // a second fetch.
  if (isReal.value) {
    try {
      // The zid and web-sdk templates map to the backend's own source types —
      // both provision a Jitsu stream + write key + ClickHouse destination and
      // pipeline in the create call.
      const sourceType = isZid.value
        ? 'zid'
        : form.templateId === 'web-sdk'
          ? 'web'
          : (findById(form.templateId)?.sourceType ?? null)

      const result = await createSourceReal({
        name: form.name.trim(),
        slug: form.slug.trim(),
        sourceType,
        templateId: form.templateId || null,
        storeId: isZid.value ? form.storeId.trim() : null
      })

      // Before anything else that can yield: the source exists now, so the
      // draft describes something already made.
      finished.value = true
      clearDraft()

      $q.notify({
        message: `“${form.name.trim()}” created`,
        color: 'positive',
        position: 'top-right',
        timeout: 2500
      })

      // The backend owns the write key; the template id and the type are ours.
      // Both are carried across explicitly rather than read off the response:
      // `SourceCreate.source_type` defaults to `zid` server-side, so a payload
      // that coerced or defaulted the type would put browser install snippets
      // and a write-key row in front of a pull-only cloud app whose key will
      // never exist. The local value is what the picked template actually says.
      created.value = {
        ...result,
        templateId: form.templateId,
        sourceType: sourceType ?? result.sourceType ?? null,
        slug: result.slug ?? form.slug.trim(),
        name: result.name ?? form.name.trim(),
        // The Zid wizard builds `/redirect-url?store_id=…` from this, and a
        // missing one would open the OAuth page against `undefined` — a dead end
        // with no error, on the one step the merchant cannot skip. `Source`
        // does carry `store_id`, so this is the same belt as `slug` above.
        storeId: result.storeId ?? (isZid.value ? form.storeId.trim() : null)
      }
      preview.value = false
      step.value = 'install'

      // Deliberately not awaited. The install guide and the write key are what
      // this step is for, and they are ready now; the pipe panel is additional
      // and slots in above them when the read answers. Awaiting it would hold
      // the whole step behind two list calls.
      discoverProvisioning(created.value.id)
    } catch (e) {
      $q.notify({
        message: `Couldn't create source: ${e.message || 'request failed'}`,
        color: 'negative',
        position: 'top-right',
        timeout: 4000
      })
    } finally {
      saving.value = false
    }
    return
  }

  // Demo data mode: nothing is persisted, and the list will not show it. The
  // flow still continues to step 3 so the setup instructions can be reviewed —
  // marked `preview`, which is what makes the guide say so on screen rather
  // than implying a live source.
  //
  // The draft is dropped here too, even though no row was written: the flow has
  // been walked to its end, and a form that reappears after you finished it
  // reads as "did that not work?" rather than as a convenience.
  finished.value = true
  clearDraft()

  created.value = {
    id: 'preview',
    name: form.name.trim(),
    slug: form.slug.trim(),
    templateId: form.templateId,
    sourceType: selectedTemplate.value?.sourceType ?? null,
    writeKey: 'sfere_wk_preview_not_a_real_key'
  }
  preview.value = true
  step.value = 'install'
  saving.value = false
}

async function copyValue({ label, value }) {
  try {
    await navigator.clipboard.writeText(value)
    $q.notify({
      message: `${label} copied`,
      color: 'dark',
      position: 'top-right',
      timeout: 1500
    })
  } catch {
    $q.notify({
      message: `Couldn't copy ${label.toLowerCase()}`,
      color: 'negative',
      position: 'top-right',
      timeout: 2500
    })
  }
}

function onVerified() {
  if (preview.value) return
  $q.notify({
    message: 'Source verified. Events are arriving.',
    // The caption used to hand out homework that was already done. Where a pipe
    // was provisioned the events have somewhere to go, and saying so is the
    // whole point of confirming.
    caption: deliversTo.value
      ? `They are being delivered to ${deliversTo.value}. Nothing else to set up.`
      : 'Add a destination next so they have somewhere to go.',
    color: 'positive',
    position: 'top-right',
    timeout: 3000
  })
}

onMounted(async () => {
  await load()
  restoreDraft()
})
</script>
