<template>
  <q-layout view="lHh Lpr lFf">
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

            <!-- Switched-off module: visible, inert. No `clickable` and no
                 @click, so there is no ripple and no cursor promising a
                 destination — the Soon pill is the whole affordance. Children
                 are not rendered: there is nothing to expand into yet. -->
            <q-item
              v-if="isSoon(group)"
              :class="mini ? 'justify-center px-0!' : 'px-3!'"
              class="min-h-9! rounded-lg! py-2! mb-0.5 flex cursor-not-allowed items-center gap-2 text-subtle"
            >
              <img
                :src="group.icon"
                :alt="group.label"
                class="size-4 shrink-0 opacity-50"
              />
              <span v-if="!mini" class="flex-1 text-sm tracking-[-0.35px]">{{
                group.label
              }}</span>
              <span v-if="!mini" :class="[BADGE_BASE, BADGES.soon.class]">{{
                BADGES.soon.label
              }}</span>
              <q-tooltip
                v-if="mini"
                anchor="center right"
                self="center left"
                class="bg-ink! text-xs"
                >{{ railLabel(group) }}</q-tooltip
              >
            </q-item>

            <!-- Leaf entry: navigates directly -->
            <q-item
              v-else-if="!group.children"
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
                  <!-- Disabled child: inert with Soon pill -->
                  <q-item
                    v-if="isSoon(child)"
                    class="min-h-8! rounded-lg! px-3! py-1.5! mb-0.5 flex cursor-not-allowed items-center gap-1 text-subtle"
                  >
                    <span class="flex-1 text-[13px] tracking-[-0.3px]">{{
                      child.label
                    }}</span>
                    <span :class="[BADGE_BASE, BADGES.soon.class]">{{
                      BADGES.soon.label
                    }}</span>
                  </q-item>
                  <!-- Active child: clickable -->
                  <q-item
                    v-else
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
            <template v-for="item in bottomMenu" :key="item.label">
              <!-- Same inert treatment as a switched-off group above. -->
              <q-item
                v-if="isSoon(item)"
                :class="mini ? 'justify-center px-0!' : 'px-3!'"
                class="min-h-9! rounded-lg! py-2! mb-0.5 flex cursor-not-allowed items-center gap-2 text-subtle"
              >
                <img
                  :src="item.icon"
                  :alt="item.label"
                  class="size-4 shrink-0 opacity-50"
                />
                <span v-if="!mini" class="flex-1 text-sm tracking-[-0.35px]">{{
                  item.label
                }}</span>
                <span v-if="!mini" :class="[BADGE_BASE, BADGES.soon.class]">{{
                  BADGES.soon.label
                }}</span>
                <q-tooltip
                  v-if="mini"
                  anchor="center right"
                  self="center left"
                  class="bg-ink! text-xs"
                  >{{ railLabel(item) }}</q-tooltip
                >
              </q-item>

              <q-item
                v-else
                clickable
                :class="[
                  itemClass(item),
                  mini ? 'justify-center px-0!' : 'px-3!'
                ]"
                class="min-h-9! rounded-lg! py-2! mb-0.5 flex items-center gap-2"
                @click="select(item)"
              >
                <img
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
    <q-header class="bg-white! text-ink border-b border-line">
      <q-toolbar class="min-h-14! gap-2 px-3 sm:gap-3">
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          class="lg:hidden"
          @click="leftDrawerOpen = !leftDrawerOpen"
        />

        <!-- Search -->
        <div
          class="flex h-9 w-full min-w-0 max-w-[608px] items-center gap-2 rounded-lg border border-line2 bg-white px-2.5 shadow-sm"
        >
          <img :src="icSearch" alt="" class="size-4 shrink-0" />
          <q-input
            v-model="search"
            borderless
            dense
            hide-bottom-space
            placeholder="Search fans, segments, campaigns..."
            class="min-w-0 flex-1 py-0!"
            input-class="text-sm! text-ink! placeholder:text-subtle!"
          />
          <div
            class="hidden items-center gap-1 rounded-md bg-fill px-1.5 py-1 sm:flex"
          >
            <img :src="icCmd" alt="" class="size-3" />
            <span class="text-xs text-ink">F</span>
          </div>
        </div>

        <q-space />

        <!-- Right cluster -->
        <div class="flex shrink-0 items-center gap-2 sm:gap-3">
          <span
            class="hidden h-6 items-center rounded-md border border-success-line bg-success-bg px-2 text-[11px] font-medium tracking-[-0.44px] text-success sm:flex"
          >
            Collecting
          </span>

          <div class="relative">
            <q-btn flat dense round size="sm">
              <img :src="icBell" alt="Notifications" class="size-5" />
            </q-btn>
            <span
              class="pointer-events-none absolute right-1.5 top-1.5 size-1.5 rounded-full bg-red-500"
            />
          </div>

          <q-btn flat dense round size="sm" class="hidden sm:inline-flex">
            <img :src="icHelp" alt="Help" class="size-5" />
          </q-btn>

          <q-avatar size="32px" class="cursor-pointer">
            <img :src="avatar" alt="Account" />
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

    <!-- Standing indicator that every screen is reading mock JSON, not a real
         backend. Its own file explains why a q-footer rather than a
         hand-rolled fixed bar. -->
    <DemoModeBanner v-if="isMockData" />

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
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuth } from '@/composables/useAuth'
import { useMe } from '@/composables/useMe'
import { useEntitlements } from '@/composables/useEntitlements'
import { useFeatures } from '@/composables/useFeatures'
import { useOnboarding } from '@/composables/useOnboarding'
import { useDataSource } from '@/composables/useDataSource'
import ComingSoonPanel from '@/components/ComingSoonPanel.vue'
import PersonaQuestion from '@/components/onboarding/PersonaQuestion.vue'
import DemoModeBanner from '@/components/DemoModeBanner.vue'

import avatar from '@/assets/dashboard/avatar.jpg'
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
import icSearch from '@/assets/dashboard/ic-search.svg'
import icCmd from '@/assets/dashboard/ic-cmd.svg'
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
  preview: { label: 'Preview', class: 'border-brand/30 bg-brand/5 text-brand' },
  // `soon` is not authored on a nav entry like the three above — it is derived
  // from src/config/features.js, so one switch changes the pill, the row's
  // interactivity and what the route renders together and they cannot disagree.
  soon: { label: 'Soon', class: 'border-line2 bg-fill text-subtle' }
}

const BADGE_BASE =
  'inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[10px]! font-medium uppercase tracking-wide'

// Which pill a row wears. `soon` outranks an authored badge because it answers
// the more urgent question — can I click this? — and Engage would otherwise show
// `preview` while being inert.
function navBadge(item) {
  if (isSoon(item)) return 'soon'
  return item.badge || null
}

// A rail is icons and tooltips only, so the pill has nowhere to render — the
// tooltip carries the same word instead rather than dropping the honesty cue.
function railLabel(item) {
  const badge = navBadge(item)
  return badge ? `${item.label} — ${BADGES[badge].label}` : item.label
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
// feature is off renders as an inert row with a Soon pill instead of navigating,
// and its routes render ComingSoonPanel — see isSoon()/lockedFeature below. Every
// group here keeps its children while it is switched off, so activating a module
// is one flag rather than a nav rewrite.
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
const bottomMenu = [
  {
    key: 'authorizations',
    label: 'Authorizations',
    icon: icSetup,
    to: '/authorizations'
  },
  { key: 'secrets', label: 'Secrets', icon: icSettings, to: '/secrets' },
  { key: 'settings', label: 'Settings', icon: icSettings, to: '/settings' },
  { label: 'Logout', icon: icLogout, action: 'logout' }
]

const { isEnabled, load: loadEntitlements } = useEntitlements()
// Named for what it checks: this file's own isActive() is the route-matching
// helper further down, and the two are asked entirely different questions.
const { isActive: isFeatureActive } = useFeatures()
const { isMock: isMockData } = useDataSource()

// A module that is not switched on yet. Rendered rather than hidden — the sidebar
// is the product roadmap, and a row you can see but not click says "not yet",
// where a missing row says "does not exist".
function isSoon(item) {
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

// Entitlement-gated groups disappear entirely rather than rendering dead links.
// Note this is the opposite of feature activation, which renders a Soon row: an
// entitlement you do not hold is not yours to see, whereas a module that is not
// built yet is worth advertising. Engage is subject to both, and the entitlement
// wins because it removes the row before isSoon() is ever asked.
const visibleGroups = computed(() =>
  navGroups.filter(g => !g.entitlement || isEnabled(g.entitlement))
)

// Which persona this person picked, and whether they have been asked at all. The
// answer steers onboarding and, later, what Home leads with — it never changes
// what the sidebar contains, which is why nothing above reads it.
const {
  personaMeta,
  needsPersona,
  setPersona,
  skip: skipPersonaQuestion
} = useOnboarding()

const personaQuestionOpen = computed(
  () => needsPersona.value && route.path === '/'
)

function onChoosePersona(key) {
  setPersona(key)
  $q.notify({
    message: `Set to “${personaMeta.value?.label ?? key}”`,
    caption: 'Change it any time in Settings → Your role.',
    color: 'dark',
    position: 'bottom',
    timeout: 2500
  })
}

function onSkipPersona() {
  skipPersonaQuestion()
}

// Groups the user has explicitly toggled. A group whose screen is active is
// always shown open regardless, so navigation never hides where you are.
const openGroups = ref(new Set())

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

const search = ref('')
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
