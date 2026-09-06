<template>
  <!-- `--app-footer-h` is what lets a `sticky bottom-0` submit bar clear the
       DemoModeBanner. That banner is a q-footer fixed to the viewport bottom,
       and sticky offsets resolve against the viewport, not against the padding
       q-page-container reserves for it — so without this every StickyActionBar
       would dock underneath it in Demo mode. Zero the rest of the time. -->
  <q-layout
    view="lHh Lpr lFf"
    :style="{ '--app-footer-h': isRealData ? '0px' : '36px' }"
  >
    <!-- Sidebar -->
    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      :mini="mini"
      :mini-width="72"
      :width="240"
      :breakpoint="1023"
      side="left"
      class="bg-sidebar! border-r border-line"
    >
      <div class="flex h-full flex-col">
        <!-- Logo row -->
        <div
          class="flex h-14 shrink-0 items-center border-b border-line px-3"
          :class="mini ? 'justify-center' : 'justify-between'"
        >
          <img v-if="!mini" :src="logo" alt="Sfere" class="h-[22px] w-auto" />
          <q-btn
            flat
            dense
            round
            size="sm"
            aria-label="Toggle sidebar"
            @click="toggleCollapse"
          >
            <img
              :src="icCollapse"
              alt=""
              class="size-4 transition-transform"
              :class="mini ? 'rotate-180' : ''"
            />
          </q-btn>
        </div>

        <!-- Main menu -->
        <q-list data-smoke="nav" class="flex-1 overflow-y-auto p-3">
          <template v-for="group in visibleGroups" :key="group.key">
            <!-- Section caption: marks where a stage of the product story
                 begins. The rail has no room for the text, so it degrades to a
                 plain rule that still separates the sections. -->
            <div
              v-if="group.caption && !mini"
              class="px-3 pb-1 pt-4 text-[11px]! font-semibold uppercase tracking-wider text-subtle"
            >
              {{ group.caption }}
            </div>
            <q-separator v-else-if="group.caption" class="my-2 bg-line!" />

            <!-- Leaf entry: navigates directly. A switched-off module never
                 reaches here — visibleGroups drops it, so every row in the rail
                 goes somewhere. -->
            <q-item
              v-if="!group.children"
              clickable
              :class="[
                itemClass(group),
                mini ? 'justify-center px-0!' : 'px-3!'
              ]"
              class="min-h-9! rounded-lg! py-2! mb-0.5 flex items-center gap-2"
              @click="select(group)"
            >
              <img
                :src="group.icon"
                :alt="group.label"
                class="size-4 shrink-0"
              />
              <span v-if="!mini" class="flex-1 text-sm tracking-[-0.35px]">{{
                group.label
              }}</span>
              <q-tooltip
                v-if="mini"
                anchor="center right"
                self="center left"
                class="bg-ink! text-xs"
                >{{ railLabel(group) }}</q-tooltip
              >
            </q-item>

            <!-- Group: expands to its screens. In mini mode there is no room to
                 expand, so clicking jumps to the group's first screen instead. -->
            <template v-else>
              <q-item
                clickable
                :class="[
                  groupClass(group),
                  mini ? 'justify-center px-0!' : 'px-3!'
                ]"
                class="min-h-9! rounded-lg! py-2! mb-0.5 flex items-center gap-2"
                @click="toggleGroup(group)"
              >
                <img
                  :src="group.icon"
                  :alt="group.label"
                  class="size-4 shrink-0"
                />
                <span v-if="!mini" class="flex-1 text-sm tracking-[-0.35px]">{{
                  group.label
                }}</span>
                <span
                  v-if="!mini && navBadge(group)"
                  :class="[BADGE_BASE, BADGES[navBadge(group)].class]"
                  >{{ BADGES[navBadge(group)].label }}</span
                >
                <img
                  v-if="!mini"
                  :src="icChevron"
                  alt=""
                  class="size-[18px] opacity-70 transition-transform"
                  :class="isExpanded(group) ? 'rotate-90' : ''"
                />
                <q-tooltip
                  v-if="mini"
                  anchor="center right"
                  self="center left"
                  class="bg-ink! text-xs"
                  >{{ railLabel(group) }}</q-tooltip
                >
              </q-item>

              <div
                v-if="!mini && isExpanded(group)"
                class="mb-1 ml-4 border-l border-line pl-2"
              >
                <template v-for="child in group.children" :key="child.to">
                  <q-item
                    clickable
                    :class="itemClass(child)"
                    class="min-h-8! rounded-lg! px-3! py-1.5! mb-0.5 flex items-center"
                    @click="select(child)"
                  >
                    <span class="flex-1 text-[13px] tracking-[-0.3px]">{{
                      child.label
                    }}</span>
                    <span
                      v-if="navBadge(child)"
                      :class="[BADGE_BASE, BADGES[navBadge(child)].class]"
                      class="ml-1.5"
                      >{{ BADGES[navBadge(child)].label }}</span
                    >
                  </q-item>
                </template>
              </div>
            </template>
          </template>
        </q-list>

        <!-- Bottom menu -->
        <div class="shrink-0 border-t border-line p-3">
          <q-list>
            <template v-for="item in visibleBottomMenu" :key="item.label">
              <q-item
                clickable
                :class="[
                  itemClass(item),
                  mini ? 'justify-center px-0!' : 'px-3!'
                ]"
                class="min-h-9! rounded-lg! py-2! mb-0.5 flex items-center gap-2"
                :aria-label="mini ? item.label : undefined"
                @click="select(item)"
              >
                <!-- Two ways to draw a bottom-menu row's mark. `glyph` is a
                     name in the kit's registry and inherits the row's colour;
                     `icon` is a bundled SVG file with its own. Both render at
                     size-4, so the rail lines up either way.

                     SfereIcon is aria-hidden by design, and in rail mode the
                     label beside it is not rendered — hence the `aria-label`
                     above, which is what an <img alt> row already had. -->
                <SfereIcon v-if="item.glyph" :name="item.glyph" />
                <img
                  v-else
                  :src="item.icon"
                  :alt="item.label"
                  class="size-4 shrink-0"
                />
                <span v-if="!mini" class="flex-1 text-sm tracking-[-0.35px]">{{
                  item.label
                }}</span>
                <q-tooltip
                  v-if="mini"
                  anchor="center right"
                  self="center left"
                  class="bg-ink! text-xs"
                  >{{ item.label }}</q-tooltip
                >
              </q-item>
            </template>
          </q-list>
        </div>
      </div>
    </q-drawer>

    <!-- Header -->
    <!-- `text-ink!` with the important SUFFIX, not a bare `text-ink`: Quasar's
         `.q-header` is unlayered `color: #fff` and beats any layered utility, so
         every child that inherits its colour — a `.q-btn` sets `color: inherit`
         — renders white on this white bar. That is how the nav toggle below
         became invisible rather than missing. -->
    <q-header class="bg-white! text-ink! border-b border-line">
      <q-toolbar class="min-h-14! gap-2 px-3 sm:gap-3">
        <!-- The only way into the sidebar under 1024px, where q-drawer's
             `:breakpoint="1023"` turns it into an overlay. It is an
             SfereIconButton rather than a `q-btn icon="menu"` so its glyph
             carries its own colour instead of inheriting the header's; the
             tooltip aligns `start` because this is the one icon button in the
             app pinned to the LEFT edge, where an end-aligned bubble would hang
             off the viewport. `lg:hidden!` needs the suffix for the same reason
             the header's colour does: `.q-btn`-style unlayered display rules
             outrank a layered `hidden`. -->
        <SfereIconButton
          label="Open navigation"
          icon="menu"
          variant="ghost"
          class="lg:hidden!"
          tooltip-align="start"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />

        <q-space />

        <!-- Right cluster -->
        <div class="flex shrink-0 items-center gap-2 sm:gap-3">
          <span
            class="hidden h-6 items-center rounded-md border border-success-line bg-success-bg px-2 text-[11px] font-medium tracking-[-0.44px] text-success sm:flex"
          >
            Collecting
          </span>

          <q-btn flat dense round size="sm" class="hidden sm:inline-flex">
            <img :src="icHelp" alt="Help" class="size-5" />
          </q-btn>

          <!-- A silhouette here, initials on /team: the roster is a wall of rows
               where identical grey heads would carry no information (see
               SfereAvatar.vue), but this chip is always the one person who is
               signed in, so a mark that reads as "you" beats a letter pair. It
               replaced a bundled photo that showed the same stranger's face to
               every account. -->
          <q-avatar
            size="32px"
            class="cursor-pointer bg-sfere-100 text-sfere-700"
            role="button"
            aria-label="Account"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="size-[18px]"
            >
              <circle cx="12" cy="8.5" r="3.75" />
              <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" />
            </svg>
            <q-menu anchor="bottom right" self="top right">
              <q-list style="min-width: 200px">
                <q-item class="pointer-events-none">
                  <q-item-section>
                    <q-item-label v-if="currentAccount" class="truncate">{{
                      currentAccount.name
                    }}</q-item-label>
                    <q-item-label caption class="truncate">{{
                      me?.email
                    }}</q-item-label>
                    <q-item-label
                      v-if="currentRole"
                      caption
                      class="capitalize"
                      >{{ currentRole }}</q-item-label
                    >
                    <q-item-label caption class="font-mono opacity-70">{{
                      appVersion
                    }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup @click="handleLogout">
                  <q-item-section>Sign out</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-avatar>
        </div>
      </q-toolbar>
    </q-header>

    <!-- Page content -->
    <q-page-container>
      <!-- The gate is here rather than in a router beforeEach for two reasons: a
           guard cannot swap a component, only redirect, and a redirect would
           throw away the URL you asked for. Standing ComingSoonPanel in front of
           <router-view> keeps the address bar honest — switch the module on and
           the same URL renders the real screen — while the v-else means the page
           component never mounts, so nothing it fetches on mount ever runs. -->
      <ComingSoonPanel
        v-if="lockedFeature"
        :feature="lockedFeature"
        :title="route.meta.title || 'Coming soon'"
      />
      <router-view v-else />
    </q-page-container>

    <!-- Standing indicator that every screen is reading fake data (demo JSON
         or the local mock API), not a real backend. Its own file explains why
         a q-footer rather than a hand-rolled fixed bar. -->
    <DemoModeBanner v-if="!isRealData" />

    <!-- The arrival. A full-page surface over a fully-rendered Home, opened
         only on `/`: a deep link from Slack must not be met by it, and the smoke
         gate needs the nav and every <h1> to stay in the DOM. Binding it to the
         route rather than to a one-shot flag is what makes it close itself the
         moment you navigate away.

         SEVEN BEATS, ONE SURFACE: what Sfere does, where this account's activity
         happens, which platform, the store grant where one is needed, the
         install, the confirmation that an event arrived, the provisioning read
         and the summary. The layout drives every swap because everything between
         the beats is a decision — recording the answers, creating the source,
         starting the lookup and settling the record. -->
    <FirstRunOverlay
      :open="arrivalOpen"
      :step="arrivalStep"
      :intent="arrivalIntent"
      :template-id="arrivalTemplate"
      :store-id="arrivalStoreId"
      @advance="onAdvance"
      @back="onArrivalBack"
      @choose="onChooseIntent"
      @choose-platform="onChoosePlatform"
      @update:store-id="value => (arrivalStoreId = value)"
      @retry-create="enterConnect"
      @connected="onStoreConnected"
      @finish="onFinishArrival"
      @skip="onPauseFirstRun"
    />

    <!-- The guided walkthrough's spotlight, mounted once for the same reason the
         canvas below it is: it dims the whole window and points at one control,
         and a per-page copy would mean every page owning a layer that has to
         agree with the others. It draws nothing unless a page has named a step
         AND that step's `data-tour` anchor is on screen. -->
    <SpotlightTour />

    <!-- The app-wide celebration canvas, mounted once. Every screen below this
         layout fires it with `useConfetti().fire()` and owns no canvas of its
         own; it draws nothing until something does. `/login`, `/signup` and
         `/design-system` sit outside this layout, so anything there that wants a
         burst mounts its own — the docs page does. -->
    <SfereConfetti />
  </q-layout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuth } from '@/composables/useAuth'
import { useMe } from '@/composables/useMe'
import { useEntitlements } from '@/composables/useEntitlements'
import { useFeatures } from '@/composables/useFeatures'
import { useOnboarding } from '@/composables/useOnboarding'
import { needsPlatformStep } from '@/config/firstRun'
import { templateFor, useFirstRunSetup } from '@/composables/useFirstRunSetup'
import { useDataSource } from '@/composables/useDataSource'
import { toFlat, toSections } from '@/lib/navSections'
import ComingSoonPanel from '@/components/ComingSoonPanel.vue'
import FirstRunOverlay from '@/components/onboarding/FirstRunOverlay.vue'
import DemoModeBanner from '@/components/DemoModeBanner.vue'
import SfereConfetti from '@/components/ui/SfereConfetti.vue'
import SpotlightTour from '@/components/ui/SpotlightTour.vue'
import SfereIcon from '@/components/ui/SfereIcon.vue'
import SfereIconButton from '@/components/ui/SfereIconButton.vue'

import icCollapse from '@/assets/dashboard/ic-collapse.svg'
import icChevron from '@/assets/dashboard/ic-chevron.svg'
import icOverview from '@/assets/dashboard/ic-overview.svg'
import icContacts from '@/assets/dashboard/ic-contacts.svg'
import icSegments from '@/assets/dashboard/ic-segments.svg'
import icActivation from '@/assets/dashboard/ic-activation.svg'
import icComm from '@/assets/dashboard/ic-comm.svg'
import icIntegrations from '@/assets/dashboard/ic-integrations.svg'
import icSetup from '@/assets/dashboard/ic-setup.svg'
import icSources from '@/assets/dashboard/ic-sources.svg'
import icSettings from '@/assets/dashboard/ic-settings.svg'
import icLogout from '@/assets/dashboard/ic-logout.svg'
import icBell from '@/assets/dashboard/ic-bell.svg'
import icHelp from '@/assets/dashboard/ic-help.svg'

const $q = useQuasar()
const router = useRouter()
const route = useRoute()
const { logOut } = useAuth()
const { me, currentAccount, currentRole } = useMe()

// Stamped by the deploy workflows — staging `sha-<short>`, production `vX.Y.Z`,
// PR previews `pr-<N>` — and "dev" locally, matching the backend's app_version
// default. This is the only place a user can answer "which build am I looking
// at?". It sits in the account menu rather than on a page so it adds no <h1> and
// no route, which keeps scripts/smoke.mjs unaffected.
const appVersion = import.meta.env.VITE_APP_VERSION || 'dev'

// Badge vocabulary, borrowed from the marketing site's Live/Preview pills so the
// dashboard tells the same story with the same honesty: `live` = backed by real
// network data today, `demo` = illustrative fixture, `preview` = module designed
// but not built. Unbadged rows are ordinary product surface — badging all ~30
// mock screens would be noise, so only the exceptions carry a pill. Palettes are
// StatusBadge's success/neutral/brand strings, so a nav pill and a table pill
// read as the same object.
//
// Today the only pill in the tree is `preview` on Engage. Nothing renders real
// data — the events read path 401s and those pages fall back to mock JSON — so a
// `live` pill would overclaim, and the demo-only legacy pages that carried `demo`
// are gone. Both keys stay: re-badge `live` the day the events key works again
// rather than reinventing the mechanism.
const BADGES = {
  live: {
    label: 'Live',
    class: 'border-success-line bg-success-bg text-success'
  },
  demo: { label: 'Demo', class: 'border-line2 bg-fill text-subtle' },
  preview: { label: 'Preview', class: 'border-brand/30 bg-brand/5 text-brand' }
}

const BADGE_BASE =
  'inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[10px]! font-medium uppercase tracking-wide'

// Which pill a row wears. There is no `soon` pill any more: a module that is not
// switched on is not in the rail at all, so every row here is one you can click
// and the only badges left are the authored ones.
function navBadge(item) {
  return item.badge || null
}

// A rail is icons and tooltips only, so the pill has nowhere to render — the
// tooltip carries the same word instead rather than dropping the honesty cue.
function railLabel(item) {
  const badge = navBadge(item)
  return badge ? `${item.label} (${BADGES[badge].label})` : item.label
}

// Screens are registered in src/router/screens.js; this list decides what is
// *reachable from the sidebar* and how it is grouped. Only list views belong
// here — create/detail/trash screens are reached from within their list.
//
// A group with no `children` is a direct link. Groups auto-expand when one of
// their screens is active.
//
// The order is the product story, so the sidebar reads top-to-bottom the way the
// data flows: collect → fans → activate → engage → measure, with the demo lab
// last. Monitoring sits inside COLLECT because errors and health are read by the
// same engineer who is watching the pipeline, not by a separate ops persona.
// `caption` marks the first group of a section and renders as a small uppercase
// label (a plain rule in rail mode, where there is no room for text); keeping it
// on the group rather than in a wrapper array means an entitlement-gated section
// takes its own caption with it when it disappears. `badge` is a key into BADGES
// above.
//
// One surface per concept: the legacy duplicate pages (Contacts, the live
// identity graph, Segments, Activation, Communications, Integrations, Fan
// overview) were deleted, so FANS is Profiles alone and every row below points at
// a product screen.
//
// `key` is the feature-activation key from src/config/features.js. A group whose
// feature is off is not rendered at all, though its routes still render
// ComingSoonPanel — see isInactive()/lockedFeature below. Every group here keeps
// its children while it is switched off, so activating a module is one flag
// rather than a nav rewrite.
const navGroups = [
  { key: 'dashboard', label: 'Dashboard', icon: icOverview, to: '/' },
  // Live events sits above COLLECT, uncaptioned, next to Dashboard: it is
  // watching the stream, not configuring it, so it belongs with the things you
  // look at rather than the things you set up. Carrying no `caption` is what
  // keeps it outside the section below.
  {
    key: 'live-events',
    label: 'Live events',
    icon: icBell,
    to: '/live-events'
  },
  // Sources leads COLLECT, so the caption lives here. It is one click, not a
  // drawer: its three former children were not siblings — Event streams IS
  // Sources, and Connectors is the catalog you browse to add one (now a tab on
  // that page).
  {
    key: 'sources',
    caption: 'COLLECT',
    label: 'Sources',
    icon: icSources,
    to: '/sources'
  },
  {
    key: 'destinations',
    label: 'Destinations',
    icon: icActivation,
    to: '/destinations'
  },
  { key: 'pipes', label: 'Pipes', icon: icIntegrations, to: '/pipes' },
  // Its own row rather than a child of Pipes: a function belongs to the account
  // and can run on several pipes, so nesting it under one of them would say the
  // wrong thing about what it is. Placed straight after Pipes because that is
  // where it is used.
  {
    key: 'functions',
    label: 'Functions',
    icon: icIntegrations,
    to: '/functions'
  },
  // There is deliberately no Warehouse row. The warehouse IS a destination —
  // every `web`/`zid` source create provisions its own ClickHouse destination,
  // and browsing its tables or running SQL against it are tabs on
  // `/destinations/:id`. A second rail row pointing at `/dwh-connections` said
  // the warehouse was somewhere else. The `warehouse` feature key stays
  // `enabled: true` in features.js, so those three routes still render their
  // real pages; only the row is gone.
  {
    key: 'monitoring',
    label: 'Monitoring',
    icon: icBell,
    children: [
      { label: 'Errors', to: '/errors' },
      { label: 'Health', to: '/health' }
    ]
  },
  {
    key: 'profiles',
    caption: 'FANS',
    label: 'Profiles',
    icon: icContacts,
    children: [
      { label: 'Profiles', to: '/profiles' },
      { label: 'Profile search', to: '/profiles/search' },
      {
        label: 'Identity resolution',
        to: '/profiles/identity-resolution',
        key: 'identity-resolution'
      },
      { label: 'Attributes', to: '/attributes', key: 'attributes' },
      {
        label: 'Profile builders',
        to: '/profile-builders',
        key: 'profile-builders'
      },
      { label: 'Profile API', to: '/profile-api', key: 'profile-api' },
      {
        label: 'Live profile syncs',
        to: '/live-profile-syncs',
        key: 'live-profile-syncs'
      },
      {
        label: 'Profile DWH syncs',
        to: '/profile-dwh-syncs',
        key: 'profile-dwh-syncs'
      }
    ]
  },
  // ACCOUNT is who and how much. It sits directly after FANS, above the four
  // not-yet-built sections rather than below them. Those four are hidden while
  // they are switched off, so this no longer keeps Team and Billing off the
  // bottom of the rail — but the moment one of them ships it would again, and the
  // authored order is what decides where it lands.
  {
    key: 'team',
    caption: 'ACCOUNT',
    label: 'Team & roles',
    icon: icContacts,
    to: '/team'
  },
  {
    key: 'billing',
    label: 'Billing',
    icon: icActivation,
    to: '/billing'
  },
  {
    key: 'audiences',
    caption: 'ACTIVATE',
    label: 'Audiences',
    icon: icSegments,
    to: '/audiences'
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    icon: icComm,
    children: [
      { label: 'Journeys', to: '/journeys' },
      // Goals belong to journeys — a goal is what a journey is measured
      // against — so they sit together rather than under Audiences.
      { label: 'Goals', to: '/goals' },
      { label: 'Email campaigns', to: '/channels/email' },
      { label: 'Assets', to: '/assets' },
      { label: 'Catalogs', to: '/catalogs' },
      { label: 'Channel settings', to: '/channels/settings' }
    ]
  },
  {
    key: 'engage',
    caption: 'ENGAGE',
    label: 'Engage',
    icon: icComm,
    entitlement: 'engage',
    badge: 'preview',
    children: [
      { label: 'Surveys', to: '/surveys' },
      { label: 'Engage settings', to: '/engage-settings' },
      { label: 'Operator work log', to: '/engage-operator/work-log' }
    ]
  },
  {
    key: 'reporting',
    caption: 'MEASURE',
    label: 'Reporting',
    icon: icOverview,
    to: '/reporting'
  },
  {
    key: 'demo',
    caption: 'SYSTEM',
    label: 'Demo lab',
    icon: icSetup,
    children: [
      { label: 'Demo store', to: '/demo-store' },
      { label: 'Event inspector', to: '/demo-event-inspector' },
      { label: 'Events demo', to: '/events-demo' }
    ]
  }
]

// Same `key` contract as navGroups. Settings carries `locked: true` in
// features.js because it hosts the activation panel — switching it off would take
// every other switch with it.  Logout has no key, so it is never gated.
//
// Authorizations and Secrets used to sit here as two permanent rows above
// Settings. They are tabs on /settings now, for the reason the connector catalog
// became a tab on /sources: each is workspace configuration you set up once and
// then leave alone, so a row that is always in the rail costs more attention than
// it returns. /secrets and /authorizations redirect into the tabs — see
// src/router/routes.js.
//
// TRASH SITS DIRECTLY ABOVE SETTINGS for the same reason those two left the main
// rail: it is somewhere you go occasionally to recover something, not somewhere
// you work. It replaced a Trash icon-button in the toolbar of ten list screens,
// each pointing at its own '/x/trash' route; those ten URLs are named redirects
// in src/router/routes.js now.
//
// It carries `glyph` rather than `icon`, and it is the only row here that does.
// The other two are `<img>` files under src/assets/dashboard/ with their
// colour baked in; a `glyph` is a name in the kit's own registry, drawn by
// SfereIcon with `fill="currentColor"` — so it takes the row's own colour and
// tints to `text-brand!` when the row is active, which the flat SVGs cannot do.
// The template branches on which of the two a row declares.
const bottomMenu = [
  { key: 'trash', label: 'Trash', glyph: 'trash', to: '/trash' },
  { key: 'settings', label: 'Settings', icon: icSettings, to: '/settings' },
  { label: 'Logout', icon: icLogout, action: 'logout' }
]

const { isEnabled, load: loadEntitlements } = useEntitlements()
// Named for what it checks: this file's own isActive() is the route-matching
// helper further down, and the two are asked entirely different questions.
const { isActive: isFeatureActive } = useFeatures()
const { isReal: isRealData } = useDataSource()

// A module that is not switched on yet. HIDDEN, not rendered inert.
//
// This reverses the earlier call ("the sidebar is the product roadmap, and a row
// you can see but not click says 'not yet'"). Twenty-odd rows out of the rail are
// switched off today, so the roadmap reading cost every user a sidebar that was
// mostly unclickable and pushed the live rows below the fold. Feature activation
// in Settings is where the roadmap lives now, and it is the one surface that can
// still switch a module on.
//
// The route gate is deliberately UNCHANGED: /audiences still renders
// ComingSoonPanel with the screen's own <h1>, which is what lets
// scripts/smoke.mjs keep walking every route instead of the active few. Hide the
// rows, keep the gate.
function isInactive(item) {
  return Boolean(item.key) && !isFeatureActive(item.key)
}

// The feature standing between this route and its page, or null when the screen
// is switched on. MainLayout swaps ComingSoonPanel in for <router-view> on this,
// which is why the real page component never mounts and never fetches.
const lockedFeature = computed(() => {
  const group = route.meta.group
  if (!group) return null
  return isFeatureActive(group) ? null : group
})

// Without this the gate never reads public/data/entitlements.json and every
// entitlement silently falls back to its optimistic default.
loadEntitlements()

// Whether this person has been through the arrival yet, and how to record the
// answer. THE SIDEBAR NO LONGER READS ANY OF THIS: ordering the rail by role was
// removed along with the role question — a role picked in the first ten seconds
// moved rows around on a rail where every row stayed anyway, so nobody could see
// what the answer had bought, and support could not say "it's the fourth row
// down" to anyone. The rail is now the authored order for everybody, and the
// only two things that change it are the entitlement gate and feature
// activation, both below.
const {
  needsFirstRun,
  intent: onboardingIntent,
  platform: onboardingPlatform,
  sourceId: onboardingSourceId,
  step: onboardingStep,
  setIntent,
  setPlatform,
  setStep,
  setSource,
  complete: completeFirstRun,
  pause: pauseFirstRun,
  resumeStep,
  clearResume
} = useOnboarding()

// The backend half of the arrival: it creates the source the answers describe,
// runs the real event check and reads back what was provisioned. Held here
// because every branch below is a decision and decisions are the layout's; the
// overlay reads the same singleton for what its beats DISPLAY.
const firstRunSetup = useFirstRunSetup()

// Two passes, and the order between them matters.
//
// FIRST, entitlement-gated groups disappear. An entitlement you do not hold is
// not yours to see; Engage is subject to both gates and this one runs first.
//
// THEN switched-off modules disappear too — see isInactive() above for why that
// is a removal rather than a Soon pill. Two details this pass has to get right,
// and both were bugs the first time round:
//
//   * A CAPTION IS A FIELD ON THE FIRST GROUP OF ITS SECTION, so filtering the
//     flat array can strand one. Drop `audiences` and 'ACTIVATE' goes with it,
//     leaving Campaigns absorbed into the ACCOUNT section above. Sectioning
//     first, filtering within sections, then flattening is what re-attaches
//     each caption to whichever group now leads.
//   * A GROUP WHOSE CHILDREN ARE ALL SWITCHED OFF must go too, or the rail
//     grows a chevron that expands into nothing.
//
// THERE USED TO BE A THIRD PASS, and its removal is the point of this change:
// `orderNavGroups(activeGroups, persona.nav)` front-loaded the rows a role cared
// about. It is gone with the role question. The sectioning helpers survive it
// because the caption problem above is theirs, not the ordering's — they moved
// from src/lib/navOrder.js to src/lib/navSections.js so the file name stops
// promising an ordering nothing does any more.
const activeGroups = computed(() => {
  const entitled = navGroups.filter(
    g => !g.entitlement || isEnabled(g.entitlement)
  )
  const sections = toSections(entitled)
    .map(section => ({
      ...section,
      groups: section.groups
        .filter(group => !isInactive(group))
        .map(group =>
          group.children
            ? { ...group, children: group.children.filter(c => !isInactive(c)) }
            : group
        )
        .filter(group => !group.children || group.children.length)
    }))
    .filter(section => section.groups.length)
  return toFlat(sections)
})

// The authored order, for everybody. Kept as its own computed rather than
// collapsing the two: `activeGroups` answers "which rows may this account see?"
// and this answers "in what order?", and the template reading one name means the
// day an ordering comes back it has one place to go.
const visibleGroups = computed(() => activeGroups.value)

// Settings is `locked: true` in features.js and Logout carries no key, so today
// nothing here can be switched off. The filter is here anyway because the rule is
// the rail's, not this list's: no row the user cannot use.
const visibleBottomMenu = computed(() =>
  bottomMenu.filter(item => !isInactive(item))
)

// The arrival is seven beats on one surface: what Sfere does, where this
// account's activity happens, which platform, the store grant where one is
// needed, the install, the confirmation, the provisioning read and the summary.
// `arrivalStep` is which one is showing.
//
// SEPARATE FROM THE RECORD, and it has to be: the beats render in the same tick a
// card is clicked, while every writer in `useOnboarding` goes through a commit
// that validates and persists. The record is the durable copy — read on a cold
// load and on a resume — and these refs are the live one.
const arrivalStep = ref('welcome')

// The category the later beats are about.
const arrivalIntent = ref('')

// The platform beat's answer. `arrivalTemplate` is the source-template id that
// decides what gets created and which install methods the guide offers;
// `arrivalPlatformKey` is the card's own key, which only naming needs — "Both"
// resolves to the iOS template and must not be called "iOS app".
const arrivalTemplate = ref('')
const arrivalPlatformKey = ref('')

// The granted store's id, read off the backend by the authorize beat and
// required by the create for a Zid or Salla source.
const arrivalStoreId = ref('')

const arrivalFinished = ref(false)

// NOTHING HERE ARMS THE SPOTLIGHT WALKTHROUGH ANY MORE, and that is a
// consequence of the arrival owning its own install and verify beats rather than
// an oversight. `startTour('source-setup')` used to fire on the hand-off to
// `/sources/new`, so the coachmarks explained the create form the reader had just
// been dropped onto — a form they no longer see, because the arrival now walks
// them through the same three things with a full screen each. Pointing a
// spotlight at a screen nobody was sent to would be a tour with nothing to show,
// which is the exact failure the old comment on the connector branch warned
// about. `SpotlightTour`, `useGuidedTour` and `src/config/tours.js` are all still
// wired and `SourceCreatePage` still calls `show()` on its own steps, so the day
// something hands off to that page again, arming it is one line.

// OPEN FOR TWO REASONS, and they are not the same reason. `needsFirstRun` is
// "this account has never answered"; `resumeStep` is "somebody just pressed
// Resume setup on the Dashboard". The second is in-memory only and is set by
// exactly one control, which is what keeps a parked arrival from reopening
// itself on every load — the failure mode the old skip-is-final rule existed to
// prevent.
const arrivalOpen = computed(() => {
  if (route.path !== '/') return false
  if (arrivalFinished.value) return false
  return needsFirstRun.value || Boolean(resumeStep.value)
})

// THE ARRIVAL RE-ARMED FROM SETTINGS. `arrivalFinished` is session state, not a
// record: it is flipped by the route watcher below the moment you leave `/`, and
// nothing flips it back. So `Restart onboarding` on Settings → General worked or
// silently did nothing depending on how the reader got to Settings — a cold load
// straight to `/settings` never fired that watcher, a click through from Home
// did. Same code, two behaviours, which is exactly the sort of bug that goes
// unreported because the control simply appears to do nothing.
//
// Watched on `needsFirstRun` rather than routed through `resumeStep`, which is
// the parked-arrival path and cannot carry this: `RESUMABLE_STEPS` deliberately
// excludes 'welcome', and a restart replays from the welcome. Only the flip TO
// true is acted on, so settling the arrival cannot re-open it.
watch(needsFirstRun, (now, before) => {
  if (!now || before) return
  arrivalFinished.value = false
  arrivalStep.value = 'welcome'
  arrivalIntent.value = ''
  arrivalTemplate.value = ''
  arrivalPlatformKey.value = ''
  arrivalStoreId.value = ''
  // A RESTART MUST NOT INHERIT THE LAST RUN'S SOURCE. `ensureSource` is
  // idempotent on purpose — a reader walking Back and forward again must not
  // create a second source — so without this a restarted arrival would walk to
  // its install beat and show the source it created ten minutes ago.
  firstRunSetup.reset()
})

// A COLD LOAD INTO AN UNFINISHED ARRIVAL, which v4 could not have and v5 has to
// answer. The arrival now creates a real source at its fifth beat, so a reload
// that restarted from the welcome would walk the reader back through the
// questions and create a SECOND source — orphaning the first, and on a `web`
// template orphaning a ClickHouse destination with it (the backend's DELETE does
// not clean those up).
//
// Gated on there being progress to resume: with no category and no source
// recorded, the reader never got past the welcome and the welcome is where they
// belong.
onMounted(async () => {
  if (!needsFirstRun.value) return
  if (!onboardingIntent.value && !onboardingSourceId.value) return
  arrivalIntent.value = onboardingIntent.value ?? ''
  arrivalTemplate.value = onboardingPlatform.value ?? ''
  arrivalStep.value = await resolveResumeStep(onboardingStep.value)
})

// A resume asked for on the Dashboard. It re-arms the surface and puts it
// straight on the beat that was parked, skipping the welcome — somebody
// returning has already read it, and replaying it would make Resume feel like
// Start over.
watch(resumeStep, async step => {
  if (!step) return
  arrivalFinished.value = false
  arrivalIntent.value = onboardingIntent.value ?? ''
  arrivalTemplate.value = onboardingPlatform.value ?? ''
  arrivalStep.value = await resolveResumeStep(step)
})

/**
 * Which beat a reader can actually be put back on, which is not always the one
 * they left. Four of the seven need a live source and one of those needs a write
 * key that no longer exists.
 *
 * THE INSTALL BEAT CANNOT BE RESTORED ACROSS A RELOAD, and that is the backend's
 * doing rather than a shortcut: the write key is issued once, in the create
 * response, and every later read of it is masked — which is why
 * `SecretRevealDialog` exists at all. A restored install beat would therefore
 * render the guide's `provisioning…` placeholder over a key that HAD been issued,
 * which is worse than not offering the beat. Persisting the key to avoid that
 * would put a live credential in localStorage to save a click. So a reader who
 * parked on the install beat and came back after a reload lands on VERIFY, which
 * needs only the id, and reaches the snippet from the source's own Setup
 * instructions tab — the same component, which is the point of it being the same
 * component.
 *
 * Within one session none of that applies: the source is still in memory with
 * its key, so the beat they left is the beat they get.
 */
async function resolveResumeStep(step) {
  const needsSource = ['connect', 'verify', 'setup', 'ready'].includes(step)

  if (needsSource) {
    if (firstRunSetup.source.value?.id) return step
    const saved = onboardingSourceId.value
    if (saved && (await firstRunSetup.restore(saved))) return 'verify'
    // The source cannot be read back, so every beat that describes it would be
    // describing nothing. The questions are still answerable.
    return 'category'
  }

  // The platform and authorize beats cannot render without knowing what they are
  // narrowing, and after a reload the record is the only copy of that answer.
  if (step === 'authorize') {
    if (arrivalTemplate.value) return 'authorize'
    return arrivalIntent.value ? 'platform' : 'category'
  }
  if (step === 'platform') return arrivalIntent.value ? 'platform' : 'category'
  return 'category'
}

function finishArrival() {
  arrivalFinished.value = true
  arrivalStep.value = 'welcome'
  arrivalIntent.value = ''
  arrivalTemplate.value = ''
  arrivalPlatformKey.value = ''
  arrivalStoreId.value = ''
  clearResume()
}

// Back walks the beats in reverse rather than always returning to the welcome:
// from the platform beat the thing behind you is the category question you just
// answered, not the paragraph before it.
function onArrivalBack() {
  const from = arrivalStep.value

  // From the confirmation beat the thing behind you is the install, and the
  // source is untouched by the trip.
  if (from === 'verify') {
    goToStep('connect')
    return
  }

  // From the install beat, back is the question that chose the platform — or the
  // grant, where there was one. THE SOURCE ALREADY EXISTS BY THIS POINT, and
  // `ensureSource` is idempotent, so coming forward again on the SAME answers
  // reuses it. Coming forward on a DIFFERENT answer creates a second source and
  // leaves the first in the account, which is exactly what `/sources/new` does
  // if you create twice: true, visible on the Sources screen, and better than
  // silently reusing a source built for a platform the reader has just changed
  // their mind about.
  if (from === 'connect') {
    if (needsAuthorizeStep(arrivalTemplate.value)) {
      goToStep('authorize')
      return
    }
    goToStep(needsPlatformStep(arrivalIntent.value) ? 'platform' : 'category')
    return
  }

  if (from === 'authorize') {
    goToStep(needsPlatformStep(arrivalIntent.value) ? 'platform' : 'category')
    return
  }

  // GOING BACK TO OR PAST THE CATEGORY QUESTION CLEARS THE CATEGORY, and that is
  // what keeps the record honest rather than merely tidy: both destinations sit
  // BEFORE the beat that captured it. Without this, parking after walking back
  // left a record saying `intent: 'app'` beside `step: 'category'` — so the
  // Dashboard band promised "Finish connecting your mobile app" and the resume
  // opened on "Where does your customer activity happen?".
  arrivalIntent.value = ''
  arrivalTemplate.value = ''
  arrivalPlatformKey.value = ''
  arrivalStep.value = from === 'platform' ? 'category' : 'welcome'
}

// Leaving `/` ends the beat rather than parking it. Without this, walking off to
// Sources and coming back would reopen the card over a Home the reader has
// already seen — an arrival is a thing that happens once.
watch(
  () => route.path,
  path => {
    if (path !== '/') finishArrival()
  }
)

// The answer, and the only place in the app that decides what a category means.
//
// IT NAVIGATES, and that is the one departure from the surface this replaced.
// The old overlay recorded a role and then offered a separate button onto the
// first setup step, because being thrown onto a form by a click you thought only
// recorded a preference reads as a misfire. Here the click IS the choice of what
// to connect — "Website" is not a preference, it is the first field of the create
// form — so a second consent step would be asking the same question twice.
//
// THE CATEGORY TRAVELS IN THE URL, not in a shared ref. `/sources/new` reads
// `?intent=` and pre-selects step 1, which means the hand-off survives a reload
// and a link somebody pastes to a colleague, and the create page keeps being
// readable on its own without knowing this overlay exists.
//
// TAKING IT STARTS THE WALKTHROUGH. That is the one journey with a script behind
// it (src/config/tours.js), and arming it here rather than on the record being
// written is what keeps a skipped arrival — the path scripts/smoke.mjs walks —
// from arming a spotlight with no step to show.
function onChooseIntent(key) {
  // "SOMETHING ELSE" LEAVES THE ARRIVAL, because there is nothing here for it to
  // do. It resolves to the connector catalog rather than to a template, so there
  // is no source to create, no snippet to install and no event to wait for — the
  // four beats after the question would each have nothing to say. The category is
  // recorded and the arrival is SETTLED rather than parked: the reader answered
  // and was taken where they asked to go, so it must not reopen over the catalog
  // they are now reading.
  if (key === 'connector') {
    setIntent(key)
    completeFirstRun()
    finishArrival()
    firstRunSetup.reset()
    router.push({ name: 'sources', query: { tab: 'connectors' } })
    return
  }

  setIntent(key)
  arrivalIntent.value = key

  // A CATEGORY COVERING SEVERAL PLATFORMS ASKS ONE MORE QUESTION. "A website" has
  // only `web-sdk` behind it, so a platform beat for it would be a screen with
  // one answer — a click that teaches the reader their answers do not matter.
  if (needsPlatformStep(key)) {
    goToStep('platform')
    return
  }

  arrivalTemplate.value = templateFor(key, '')
  arrivalPlatformKey.value = ''
  enterConnect()
}

// The platform beat's answer. `templateId` may be empty — that is the "Both"
// card, which carries no template of its own; `templateFor` resolves it, and
// `arrivalPlatformKey` is what stops the resulting source being called "iOS app".
function onChoosePlatform(option) {
  setPlatform(option.templateId)
  arrivalTemplate.value = templateFor(arrivalIntent.value, option.templateId)
  arrivalPlatformKey.value = option.key ?? ''

  // A STORE STARTS WITH A GRANT, and it is a beat rather than a field for a
  // reason the create form's own comment gives in reverse: there the template is
  // settled halfway down a form, so growing a step would be a wizard changing
  // shape under the reader. Here the platform was settled by the click that just
  // happened. It also cannot be skipped — the backend refuses a Zid or Salla
  // source without a `store_id`, so there is nothing to create until it is done.
  if (needsAuthorizeStep(arrivalTemplate.value)) {
    goToStep('authorize')
    return
  }

  enterConnect()
}

/** Which templates cannot be created until a store has granted access. */
function needsAuthorizeStep(templateId) {
  return templateId === 'zid' || templateId === 'salla'
}

/** Move to a beat and record it, so a reload can find its way back. */
function goToStep(step) {
  arrivalStep.value = step
  setStep(step)
}

/**
 * Enter the install beat, creating the source on the way in.
 *
 * THE CREATE IS AWAITED BUT THE BEAT IS NOT WAITED FOR: the step changes first,
 * so the reader sees "Preparing your source…" on the beat that is about to hold
 * the snippet rather than a frozen platform picker. `FirstRunConnect` renders the
 * spinner, the failure and the retry from the same three refs.
 */
async function enterConnect() {
  goToStep('connect')
  const created = await firstRunSetup.ensureSource({
    intentKey: arrivalIntent.value,
    templateId: arrivalTemplate.value,
    platformKey: arrivalPlatformKey.value,
    storeId: arrivalStoreId.value
  })
  // Recorded as soon as it exists, so a reload one second later can put the
  // reader back on a beat that describes a source rather than starting a flow
  // that would create another one.
  if (created?.id && created.id !== 'preview') setSource(created.id)
}

/**
 * The forward control, for every beat.
 *
 * ONE HANDLER RATHER THAN SEVEN, and the beat order lives here and nowhere else.
 * The overlay emits `advance` and knows nothing about what follows what, so
 * inserting a beat is one edit rather than an edit and a matching one in a
 * component that would otherwise disagree with it.
 */
function onAdvance() {
  const from = arrivalStep.value

  if (from === 'welcome') {
    // NOT RECORDED. The welcome is deliberately not a resumable beat — see
    // ARRIVAL_STEPS in useOnboarding — so moving off it records nothing until
    // there is an answer to record.
    arrivalStep.value = 'category'
    return
  }

  if (from === 'authorize') {
    enterConnect()
    return
  }

  if (from === 'connect') {
    goToStep('verify')
    return
  }

  if (from === 'verify') {
    goToStep('setup')
    // THE LOOKUP STARTS ON ARRIVAL AT THE BEAT THAT SHOWS IT, un-awaited, so the
    // checklist can render its rows as running rather than the beat appearing
    // already finished. `discover` retries twice on its own.
    firstRunSetup.discoverProvisioning()
    return
  }

  if (from === 'setup') {
    goToStep('ready')
  }
}

/**
 * The store wizard finished its first sync.
 *
 * IT DOES NOT ADVANCE THE BEAT. The wizard's own last step reports what the sync
 * pulled, and moving the reader off that report the instant it appears would
 * throw away the only confirmation the store path gets before the event check.
 * The forward control is theirs to press; this only says the click landed, which
 * is the same courtesy the pause branch gets and for the same reason — nothing
 * else on screen changes at that moment.
 */
function onStoreConnected() {
  $q.notify({
    message: 'First sync started',
    caption: 'Check for events on the next step once it has run.',
    color: 'dark',
    timeout: 2500
  })
}

/**
 * The last beat's control: the arrival is done.
 *
 * `completeFirstRun()` is what settles the record — `hasOnboarded` reads
 * `completedAt` — so nothing before this point can close the surface under a
 * reader who is still working through it. There is no navigation: the arrival
 * opens over a fully-rendered Home and closing it IS arriving at the dashboard.
 */
function onFinishArrival() {
  completeFirstRun()
  finishArrival()
  firstRunSetup.reset()
}

// Parking is acknowledged, for the same reason choosing is. It used to simply
// vanish, which is indistinguishable from having dismissed it by accident — and
// it is the one branch where nothing else on the screen changes to confirm the
// click landed.
//
// THE TOAST PROMISES SOMETHING THAT IS TRUE. It used to say "Connect a source any
// time from the Sources screen", which pointed at a create form rather than at
// the beats the reader was half way through. The Dashboard carries a resume band,
// so that is what it names.
//
// IT DOES NOT RESET `firstRunSetup`, deliberately. A reader who parks on the
// install beat and presses Resume five minutes later is still in the same
// session, so the source — and the write key that exists nowhere else — is still
// in memory and they land back on the beat they left. Only a finished or
// restarted arrival clears it.
function onPauseFirstRun() {
  pauseFirstRun(arrivalStep.value, arrivalIntent.value)
  finishArrival()
  $q.notify({
    message: 'Setup paused',
    caption: 'Pick it up again from the band on your dashboard.',
    color: 'dark',
    timeout: 2500
  })
}

// Groups the user has explicitly toggled. A group whose screen is active is
// always shown open regardless, so navigation never hides where you are.
const openGroups = ref(new Set())

// NOTHING PRE-EXPANDS A GROUP ANY MORE. A watcher here used to open whichever
// groups the chosen role named, so a marketer landed with the profile screens
// listed rather than behind a chevron. It went with the role question: with no
// role there is nobody to pre-expand for, and guessing would be the rail moving
// under a reader for a reason they cannot see. `groupHasActiveChild` below still
// opens the group you are actually in, which is the case that mattered.

function groupHasActiveChild(group) {
  return (group.children || []).some(c => isActive(c))
}

function isExpanded(group) {
  return openGroups.value.has(group.key) || groupHasActiveChild(group)
}

function toggleGroup(group) {
  if (mini.value) {
    // No room to expand in rail mode — jump to the group's first screen.
    select(group.children[0])
    return
  }
  const next = new Set(openGroups.value)
  if (next.has(group.key)) next.delete(group.key)
  else next.add(group.key)
  openGroups.value = next
}

function groupClass(group) {
  return groupHasActiveChild(group) ? 'text-ink font-medium' : 'text-muted'
}

const leftDrawerOpen = ref(false)
const miniState = ref(false)

// Collapse to a rail (icons only) on desktop; on mobile the drawer is an
// overlay, so "mini" never applies and the toggle just closes it.
const mini = computed(() => !$q.screen.lt.md && miniState.value)

// Served from public/brand/ rather than imported from src/assets/ so there is
// one copy of the brand asset, shared with SfereLogo and the design-system
// page. The rail has no room for a lockup *and* the collapse toggle in 72px, so
// it stays wordmark-free exactly as before.
const logo = `${import.meta.env.BASE_URL}brand/sfere-logo.svg`

function toggleCollapse() {
  if ($q.screen.lt.md) {
    leftDrawerOpen.value = false
  } else {
    miniState.value = !miniState.value
  }
}

// Prefix match, not equality: with nested routes (/sources/new, /sources/:id)
// an exact match would leave the sidebar showing nothing as active the moment
// you opened a detail or create screen.
function isActive(item) {
  if (!item.to) return false
  if (item.to === '/') return route.path === '/'
  return route.path === item.to || route.path.startsWith(item.to + '/')
}

function itemClass(item) {
  return isActive(item)
    ? 'bg-white! text-brand! border border-line2 shadow-sm'
    : 'text-muted'
}

async function handleLogout() {
  await logOut()
  router.push('/login')
}

function select(item) {
  if (item.action === 'logout') {
    handleLogout()
    return
  }
  if (item.to) {
    router.push(item.to)
    if ($q.screen.lt.md) leftDrawerOpen.value = false
  }
}
</script>
