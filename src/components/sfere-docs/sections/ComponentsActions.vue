<template>
  <DocSection
    id="actions"
    eyebrow="Components"
    title="Actions & markers"
    description="Buttons are pills. That shape is the most load-bearing decision in the kit, which is why nothing here offers a way to square one off — and why badges are deliberately not pills, so a status marker never reads as something you can press."
  >
    <DocSpecimen
      title="Button — light surfaces"
      usage="One primary per view. Secondary is the everyday choice; ghost is for actions inside an already-busy toolbar; danger is for destructive confirmation only."
      code='<SfereButton>Book a demo</SfereButton>
<SfereButton variant="secondary">Read the docs</SfereButton>
<SfereButton variant="ghost">Cancel</SfereButton>
<SfereButton variant="danger">Delete forever</SfereButton>'
    >
      <div class="flex flex-wrap items-center gap-3">
        <SfereButton>Book a demo</SfereButton>
        <SfereButton variant="secondary">Read the docs</SfereButton>
        <SfereButton variant="ghost">Cancel</SfereButton>
        <SfereButton variant="danger">Delete forever</SfereButton>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Button — ink surfaces"
      on-dark
      usage="The on-dark pair. white is the primary action on a dark band; outlineLight is its quiet counterpart. Using a light-surface variant on ink is the one way to get this component wrong."
      code='<SfereButton variant="white">Book a demo</SfereButton>
<SfereButton variant="outlineLight">Talk to sales</SfereButton>'
    >
      <div class="flex flex-wrap items-center gap-3">
        <SfereButton variant="white">Book a demo</SfereButton>
        <SfereButton variant="outlineLight">Talk to sales</SfereButton>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="Sizes and states"
      usage="lg is for a hero's single call to action. sm belongs in tables and toolbars. Loading disables the button and swaps in a spinner — never leave a submitted button clickable."
    >
      <div class="flex flex-col gap-5">
        <div class="flex flex-wrap items-center gap-3">
          <SfereButton size="sm">Small</SfereButton>
          <SfereButton size="md">Medium</SfereButton>
          <SfereButton size="lg">Large</SfereButton>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <SfereButton loading>Saving</SfereButton>
          <SfereButton disabled>Disabled</SfereButton>
          <SfereButton variant="secondary" disabled>Disabled</SfereButton>
        </div>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereIconButton"
      usage="A toolbar action whose noun is already on the page — Trash and New sit under an h1 that names what they act on. label is required and is both the aria-label and the tooltip, so the word survives for a screen reader even though the surface shows a glyph. Never use one where the action is not guessable from its icon: a labelled button is the default, this is the exception."
      code='<SfereIconButton icon="trash" label="Trash" to="/pipes/trash" />
<SfereIconButton icon="plus" label="New pipe" variant="primary" to="/pipes/new" />'
    >
      <div class="flex flex-col gap-5">
        <div class="flex flex-wrap items-center gap-3">
          <SfereIconButton icon="trash" label="Trash" />
          <SfereIconButton icon="plus" label="New pipe" variant="primary" />
          <SfereIconButton icon="arrow-left" label="Back" variant="ghost" />
          <SfereIconButton
            icon="trash"
            label="Delete forever"
            variant="danger"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <SfereIconButton icon="plus" label="Small" size="sm" />
          <SfereIconButton icon="plus" label="Medium" size="md" />
          <SfereIconButton icon="plus" label="Large" size="lg" />
          <SfereIconButton icon="plus" label="Saving" loading />
          <SfereIconButton icon="plus" label="Disabled" disabled />
        </div>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="RowActionsMenu"
      usage="A table row's actions, collapsed into one kebab. Reach for it when a row carries two or more actions whose noun is the row itself — Pause and Delete on every list screen — and the alternative is printing both words on all ten visible rows. It reports which action was chosen and nothing else: the ConfirmDialog, the target ref and the mutation all stay on the page, because two dialogs reading one shared row is how a confirm acts on the wrong record."
      code="<RowActionsMenu
  :label=&quot;`Actions for ${row.name}`&quot;
  :actions=&quot;[
    { key: 'toggle', label: row.isEnabled ? 'Pause' : 'Enable',
      icon: row.isEnabled ? 'pause' : 'play' },
    { key: 'delete', label: 'Delete', icon: 'trash',
      tone: 'destructive' }
  ]&quot;
  @select=&quot;onRowAction(row, $event)&quot;
/>"
    >
      <div class="flex flex-wrap items-center gap-8">
        <RowActionsMenu
          label="Actions for Website events"
          :actions="pairActions"
          @select="lastAction = $event"
        />
        <RowActionsMenu
          label="Actions for Snowflake Production"
          :actions="tripleActions"
          @select="lastAction = $event"
        />
        <p class="font-sfere-mono text-sfere-xs text-sfere-fg-muted">
          select → {{ lastAction || 'nothing yet' }}
        </p>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereIcon"
      usage="The glyph registry in sfereIcons.js — every icon on one 256 grid, drawn with currentColor so the same entry works on a brand fill and on white. Always aria-hidden: it is decorative beside a label, or the whole content of a control that carries its own."
      code='<SfereIcon name="trash" />'
    >
      <div class="flex flex-wrap items-center gap-6 text-sfere-fg-muted">
        <div
          v-for="name in iconNames"
          :key="name"
          class="flex flex-col items-center gap-2"
        >
          <SfereIcon :name="name" size="lg" />
          <span class="font-sfere-mono text-sfere-xs">{{ name }}</span>
        </div>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereLinkArrow"
      usage="The tertiary action. Use it to leave a card for more detail; never as the only way to complete a task."
      code='<SfereLinkArrow label="See how it works" href="#" />'
    >
      <div class="flex flex-wrap items-center gap-8">
        <SfereLinkArrow label="See how it works" to="/design-system" />
        <SfereLinkArrow label="Read the spec" to="/design-system" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="StatusBadge"
      usage="A state, not a label. Six tones and no more — a seventh means the states are not actually distinct."
      code='<StatusBadge tone="success" label="Delivered" dot />'
    >
      <div class="flex flex-wrap items-center gap-2.5">
        <StatusBadge tone="brand" label="Beta" />
        <StatusBadge tone="neutral" label="Draft" />
        <StatusBadge tone="success" label="Delivered" dot />
        <StatusBadge tone="warn" label="Throttled" dot />
        <StatusBadge tone="danger" label="Failed" dot />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SferePill"
      usage="The bordered capsule above a hero — region tags, compliance marks. It is a label; if it needs a click handler you wanted a small secondary button."
      code='<SferePill label="Hosted in-region" />'
    >
      <div class="flex flex-wrap items-center gap-2.5">
        <SferePill label="Hosted in-region" />
        <SferePill label="PDPL aligned" />
        <SferePill label="SOC 2 Type II" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereIconChip · SfereAvatar · SfereKbd · SfereTooltip"
      usage="The small markers. Icon chips are decorative and aria-hidden; avatars fall back to initials rather than a generic silhouette, which at least distinguishes rows."
    >
      <div class="flex flex-wrap items-center gap-8">
        <div class="flex items-center gap-3">
          <SfereIconChip>
            <svg class="size-5" viewBox="0 0 256 256" fill="currentColor">
              <path
                d="M240 132c0 19.88-35.82 36-80 36c-19.6 0-37.56-3.17-51.47-8.44C146.76 156.85 176 142 176 124V96.72c36.52 3.34 64 17.86 64 35.28m-64-48c0-19.88-35.82-36-80-36S16 64.12 16 84s35.82 36 80 36s80-16.12 80-36"
                opacity="0.2"
              />
              <path
                d="M184 89.57V84c0-25.08-37.83-44-88-44S8 58.92 8 84v40c0 20.89 26.25 37.49 64 43.3V172c0 25.08 37.83 44 88 44s88-18.92 88-44v-40c0-20.7-25.42-38.28-64-42.43M232 132c0 13.66-30.47 28-72 28c-3.72 0-7.4-.12-11-.35c22.51-8 35-19.9 35-33.65v-22.21c29.83 4.6 48 16.94 48 28.21M96 152v-16.13a183 183 0 0 0 24 0V152q-11.87.87-24 0m72-25.24c-6.13 6.85-16.13 12.66-29.26 16.85a108 108 0 0 0 21.26-8.09v-8.76a123 123 0 0 0 8-.61ZM96 56c41.53 0 72 14.34 72 28s-30.47 28-72 28s-72-14.34-72-28s30.47-28 72-28M24 124v-11.41c11.7 8 30.19 13.75 52 15.91v16.32c-30.31-5.13-52-17.66-52-20.82m64 84c-41.53 0-72-14.34-72-28v-11.41c11.7 8 30.19 13.75 52 15.91V184c0 4.85 1.42 9.44 4.16 13.71A94 94 0 0 1 88 208m0-40c-3.72 0-7.4-.12-11-.35A80 80 0 0 0 88 168m72 32c-41.53 0-72-14.34-72-28v-.11q3.94.11 8 .11c3.72 0 7.4-.09 11-.24V184c0 4.85 1.42 9.44 4.16 13.71A94 94 0 0 1 160 200"
              />
            </svg>
          </SfereIconChip>
          <SfereIconChip size="sm">
            <svg class="size-4" viewBox="0 0 256 256" fill="currentColor">
              <path d="M240 104l-48 40H64l-48-40l48-40h128Z" opacity="0.2" />
              <path
                d="M69.12 94.15L28.5 128l40.62 33.85a8 8 0 1 1-10.24 12.29l-48-40a8 8 0 0 1 0-12.29l48-40a8 8 0 0 1 10.24 12.3m176 27.7l-48-40a8 8 0 1 0-10.24 12.3L227.5 128l-40.62 33.85a8 8 0 1 0 10.24 12.29l48-40a8 8 0 0 0 0-12.29"
              />
            </svg>
          </SfereIconChip>
        </div>

        <div class="flex items-center gap-2">
          <SfereAvatar name="Salem Al Marri" size="lg" />
          <SfereAvatar name="Layla Haddad" />
          <SfereAvatar name="Omar" size="sm" />
        </div>

        <div class="flex items-center gap-1.5">
          <SfereKbd label="⌘" />
          <SfereKbd label="K" />
        </div>

        <SfereTooltip text="Events accepted in the last hour">
          <SfereButton variant="secondary" size="sm">Hover me</SfereButton>
        </SfereTooltip>
      </div>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import { ref } from 'vue'
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import RowActionsMenu from '@/components/ui/RowActionsMenu.vue'
import SfereAvatar from '@/components/ui/SfereAvatar.vue'
import StatusBadge from '@/components/ui/StatusBadge.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'
import SfereIconChip from '@/components/ui/SfereIconChip.vue'
import SfereKbd from '@/components/ui/SfereKbd.vue'
import SfereLinkArrow from '@/components/ui/SfereLinkArrow.vue'
import SferePill from '@/components/ui/SferePill.vue'
import SfereTooltip from '@/components/ui/SfereTooltip.vue'
import { SFERE_ICON_NAMES } from '@/components/ui/sfereIcons.js'

const iconNames = SFERE_ICON_NAMES

// Two and three items, because the flip-above and the arrow-key wrap are the
// two behaviours a reader will want to try, and both need more than one row of
// menu to be visible at all.
const pairActions = [
  { key: 'toggle', label: 'Pause', icon: 'pause' },
  { key: 'delete', label: 'Delete', icon: 'trash', tone: 'destructive' }
]

const tripleActions = [
  { key: 'toggle', label: 'Enable', icon: 'play' },
  { key: 'keys', label: 'Reveal write key', icon: 'eye' },
  { key: 'delete', label: 'Delete forever', icon: 'trash', tone: 'destructive' }
]

// The specimen echoes what came back rather than firing a toast: this page is
// the one surface where the point is that the component reports a key and
// leaves the consequence to the caller.
const lastAction = ref('')
</script>
