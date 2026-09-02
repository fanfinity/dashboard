<template>
  <DocSection
    id="feedback"
    eyebrow="Components"
    title="Navigation & feedback"
    description="How the system says 'wait', 'nothing here' and 'something you should know'. The distinction that matters most: nothing here is an error surface. An empty result is information; a failed request is not, and it gets a different component."
  >
    <DocSpecimen
      title="TabNav"
      usage="underline switches a page's primary content; pill filters a list inside a tray. Using both on one screen makes neither read as the control it is."
      code='<TabNav v-model="tab" :tabs="tabs" />
<TabNav v-model="tab" :tabs="tabs" variant="pill" />'
    >
      <div class="flex flex-col gap-8">
        <TabNav v-model="tab" :tabs="tabs" />
        <TabNav v-model="tab" :tabs="tabs" variant="pill" />
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereBreadcrumbs"
      usage="An ol inside a labelled nav, with aria-current on the last crumb — that combination is the only reason to use this over a row of links. The final crumb is never a link."
      code="<SfereBreadcrumbs :items=&quot;[{ label: 'Sources', href: '#' }, { label: 'Stadium turnstiles' }]&quot; />"
    >
      <SfereBreadcrumbs
        :items="[
          { label: 'Platform', to: '/design-system' },
          { label: 'Sources', to: '/design-system' },
          { label: 'Stadium turnstiles' }
        ]"
      />
    </DocSpecimen>

    <DocSpecimen
      title="NoticeBanner"
      usage="'The screen worked, but there is something you should know.' A genuine load failure is an error state, not a danger alert — and nothing here carries a data-smoke attribute, so a notice can never trip the repo's smoke gate."
      code='<NoticeBanner tone="warn" title="…" message="…" />'
    >
      <div class="flex flex-col gap-3">
        <NoticeBanner
          tone="info"
          title="Ingest is running in sandbox"
          message="Events are accepted and resolved, but nothing is forwarded to destinations."
        />
        <NoticeBanner
          tone="success"
          title="Backfill complete"
          message="812,405 profiles resolved in 6m 12s."
        />
        <NoticeBanner
          tone="warn"
          title="Two sources cannot be restored on their own"
          message="They reference a destination that was deleted in the same operation."
        />
        <NoticeBanner
          tone="danger"
          title="Delivery to Meta CAPI is failing"
          message="The access token expired 4 hours ago."
          dismissible
        />
        <!-- `collapsible` turns the title into the disclosure control and hides
             the slot behind it. Shown with slot content because that is the only
             case it does anything in — a banner whose whole payload is `title`
             has nothing to disclose. -->
        <NoticeBanner
          tone="warn"
          title="3 issues need your attention"
          collapsible
        >
          <ul class="grid gap-2">
            <li class="grid gap-0.5">
              <span class="text-sm font-medium text-ink">Android SDK</span>
              <span class="text-sm text-muted"
                >Enabled, but no events received in the last hour.</span
              >
            </li>
            <li class="grid gap-0.5">
              <span class="text-sm font-medium text-ink">S3 Cold Storage</span>
              <span class="text-sm text-muted"
                >Enabled, but no pipe delivers to it.</span
              >
            </li>
          </ul>
        </NoticeBanner>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="EmptyState"
      usage="Two situations need two states. Filters matched nothing → 'No X match your search' + Clear filters. Nothing exists yet → 'No X yet' + the create action. Offering 'create your first' to someone with forty records and a typo is the failure mode."
    >
      <div class="grid gap-4 lg:grid-cols-2">
        <EmptyState
          title="No sources match your search"
          description="Nothing matched “turnstile” on the Paused tab."
        >
          <template #icon>
            <svg class="size-5" viewBox="0 0 256 256" fill="currentColor">
              <path
                d="M192 116a76 76 0 1 1-76-76a76 76 0 0 1 76 76"
                opacity="0.2"
              />
              <path
                d="m229.66 218.34l-50.07-50.06a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.32M40 116a76 76 0 1 1 76 76a76.08 76.08 0 0 1-76-76"
              />
            </svg>
          </template>
          <template #cta>
            <SfereButton variant="secondary" size="sm"
              >Clear filters</SfereButton
            >
          </template>
        </EmptyState>

        <EmptyState
          title="No sources yet"
          description="Connect a source to start collecting fan signals."
        >
          <template #icon>
            <svg class="size-5" viewBox="0 0 256 256" fill="currentColor">
              <path
                d="M208 128v72a8 8 0 0 1-8 8H56a8 8 0 0 1-8-8v-72Z"
                opacity="0.2"
              />
              <path
                d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8"
              />
            </svg>
          </template>
          <template #cta>
            <SfereButton size="sm">Connect your first source</SfereButton>
          </template>
        </EmptyState>
      </div>
    </DocSpecimen>

    <DocSpecimen
      title="SfereSkeleton · SfereProgress · SfereSpinner"
      usage="Skeleton wherever the final shape is known — the placeholder impersonating the content stops the layout jumping when data lands. Spinner only when the shape is unknown. Progress only when there is a real quantity to report."
    >
      <div class="grid gap-8 lg:grid-cols-2">
        <div class="flex flex-col gap-3">
          <p
            class="font-sfere-mono text-sfere-label uppercase text-sfere-fg-muted"
          >
            Skeleton
          </p>
          <SfereSkeleton :rows="4" />
        </div>

        <div class="flex flex-col gap-5">
          <p
            class="font-sfere-mono text-sfere-label uppercase text-sfere-fg-muted"
          >
            Progress &amp; spinner
          </p>
          <SfereProgress :value="68" label="Backfilling profiles" show-value />
          <SfereProgress
            :value="92"
            tone="warn"
            label="Monthly event quota"
            show-value
          />
          <div
            class="flex items-center gap-2 text-sfere-sm text-sfere-fg-muted"
          >
            <SfereSpinner :size="16" />
            Resolving identities…
          </div>
        </div>
      </div>
    </DocSpecimen>
  </DocSection>
</template>

<script setup>
import { ref } from 'vue'
import DocSection from '../DocSection.vue'
import DocSpecimen from '../DocSpecimen.vue'
import NoticeBanner from '@/components/ui/NoticeBanner.vue'
import SfereBreadcrumbs from '@/components/ui/SfereBreadcrumbs.vue'
import SfereButton from '@/components/ui/SfereButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SfereProgress from '@/components/ui/SfereProgress.vue'
import SfereSkeleton from '@/components/ui/SfereSkeleton.vue'
import SfereSpinner from '@/components/ui/SfereSpinner.vue'
import TabNav from '@/components/ui/TabNav.vue'

const tab = ref('all')

const tabs = [
  { key: 'all', label: 'All', count: 24 },
  { key: 'delivering', label: 'Delivering', count: 19 },
  { key: 'paused', label: 'Paused', count: 3 },
  { key: 'failed', label: 'Failed', count: 2 }
]
</script>
