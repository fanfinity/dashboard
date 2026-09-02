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

    <!-- The onboarding fork. An overlay over a fully-rendered Home, opened only
         on `/`: a deep link from Slack must not be met by a modal demanding a
         role, and the smoke gate needs the nav and every <h1> to stay in the
         DOM. Binding it to the route rather than to a one-shot flag is what
         makes it close itself the moment you navigate away. -->
    <PersonaQuestion
      :open="personaQuestionOpen"
      @choose="onChoosePersona"
      @skip="onSkipPersona"
    />
  </q-layout>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuth } from '@/composables/useAuth'
import { useMe } from '@/composables/useMe'
import { useEntitlements } from '@/composables/useEntitlements'
import { useFeatures } from '@/composables/useFeatures'
import { useOnboarding } from '@/composables/useOnboarding'
import { useDataSource } from '@/composables/useDataSource'
import { orderNavGroups, toFlat, toSections } from '@/lib/navOrder'
import ComingSoonPanel from '@/components/ComingSoonPanel.vue'
import PersonaQuestion from '@/components/onboarding/PersonaQuestion.vue'
import DemoModeBanner from '@/components/DemoModeBanner.vue'
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
  {
    key: 'warehouse',
    label: 'Warehouse',
    icon: icSetup,
    children: [
      { label: 'Warehouse connections', to: '/dwh-connections' },
      { label: 'DWH syncs', to: '/dwh-syncs', key: 'dwh-syncs' },
      {
        label: 'Warehouse models',
        to: '/warehouse-models',
        key: 'warehouse-models'
      }
    ]
  },
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

// Which persona this person picked, and whether they have been asked at all.
// Read here because the answer now sets the ORDER of the sidebar — never its
// contents. A marketer signing in finds Profiles next to Dashboard instead of
// three sections down; an analyst finds Warehouse and Monitoring at the top of
// COLLECT. Every row a persona does not care about is still in the rail, in its
// authored position, so support can say "click Pipes" to anyone. Removal stays
// entitlements' job, below.
const {
  personaMeta,
  needsPersona,
  setPersona,
  skip: skipPersonaQuestion
} = useOnboarding()

// Three passes, and the order between them matters.
//
// FIRST, entitlement-gated groups disappear. An entitlement you do not hold is
// not yours to see; Engage is subject to both gates and this one runs first.
//
// THEN switched-off modules disappear too — see isInactive() above for why that
// is now a removal rather than a Soon pill. Two details this pass has to get
// right, and both were bugs the first time round:
//
//   * A CAPTION IS A FIELD ON THE FIRST GROUP OF ITS SECTION, so filtering the
//     flat array can strand one. Drop `audiences` and 'ACTIVATE' goes with it,
//     leaving Campaigns absorbed into the ACCOUNT section above. Sectioning
//     first, filtering within sections, then flattening is what re-attaches
//     each caption to whichever group now leads.
//   * A GROUP WHOSE CHILDREN ARE ALL SWITCHED OFF must go too, or the rail
//     grows a chevron that expands into nothing.
//
// THEN the persona reorders what is left. That way a persona ordering can never
// resurrect a row either gate removed, and orderNavGroups only ever sees rows
// this account is allowed to see. See src/lib/navOrder.js for why it cannot drop
// one; a persona with no `nav` — engineer, a skipped question, an unanswered one,
// which is the path scripts/smoke.mjs walks — gets the authored array back
// untouched.
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

const visibleGroups = computed(() =>
  orderNavGroups(activeGroups.value, personaMeta.value?.nav)
)

// Settings is `locked: true` in features.js and Logout carries no key, so today
// nothing here can be switched off. The filter is here anyway because the rule is
// the rail's, not this list's: no row the user cannot use.
const visibleBottomMenu = computed(() =>
  bottomMenu.filter(item => !isInactive(item))
)

const personaQuestionOpen = computed(
  () => needsPersona.value && route.path === '/'
)

function onChoosePersona(key) {
  setPersona(key)
  $q.notify({
    message: `Set to “${personaMeta.value?.label ?? key}”`,
    caption: 'Change it any time in Settings → General.',
    color: 'dark',
    timeout: 2500
  })
}

// Skipping is acknowledged, for the same reason choosing is. The overlay used to
// simply vanish on Skip, which is indistinguishable from having dismissed it by
// accident — and it is the one branch where nothing else on the screen changes to
// confirm the click landed. The toast also carries the only pointer back: someone
// who skips has not read the sentence about Settings that the answer's toast
// repeats.
function onSkipPersona() {
  skipPersonaQuestion()
  $q.notify({
    message: 'No role set',
    caption: 'Pick one any time in Settings → General.',
    color: 'dark',
    timeout: 2500
  })
}

// Groups the user has explicitly toggled. A group whose screen is active is
// always shown open regardless, so navigation never hides where you are.
const openGroups = ref(new Set())

// Pre-expanded for this persona, so a marketer lands with the profile screens
// listed rather than behind a chevron.
//
// ADDITIVE, AND DELIBERATELY NOT A COMPUTED. A computed set derived from the
// persona would fight the person using it: collapse Profiles and it would spring
// back open on the next render, with no way to say otherwise. Writing into the
// same ref the chevron writes into means the persona chooses the starting state
// and the user has the last word from then on. It also runs on change rather than
// only at init, so picking a role in the overlay expands the rail in the same
// tick instead of on the next reload.
watch(
  () => personaMeta.value?.nav?.expand,
  keys => {
    if (!keys?.length) return
    const next = new Set(openGroups.value)
    for (const key of keys) next.add(key)
    openGroups.value = next
  },
  { immediate: true }
)

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
