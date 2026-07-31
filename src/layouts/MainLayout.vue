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
          <img
            v-if="!mini"
            :src="logo"
            alt="Fanfinity"
            class="h-[17px] w-auto"
          />
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

            <!-- Leaf entry: navigates directly -->
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
                  v-if="!mini && group.badge"
                  :class="[BADGE_BASE, BADGES[group.badge].class]"
                  >{{ BADGES[group.badge].label }}</span
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
                <q-item
                  v-for="child in group.children"
                  :key="child.to"
                  clickable
                  :class="itemClass(child)"
                  class="min-h-8! rounded-lg! px-3! py-1.5! mb-0.5 flex items-center"
                  @click="select(child)"
                >
                  <span class="flex-1 text-[13px] tracking-[-0.3px]">{{
                    child.label
                  }}</span>
                  <span
                    v-if="child.badge"
                    :class="[BADGE_BASE, BADGES[child.badge].class]"
                    class="ml-1.5"
                    >{{ BADGES[child.badge].label }}</span
                  >
                </q-item>
              </div>
            </template>
          </template>
        </q-list>

        <!-- Bottom menu -->
        <div class="shrink-0 border-t border-line p-3">
          <q-list>
            <q-item
              v-for="item in bottomMenu"
              :key="item.label"
              clickable
              :class="[
                itemClass(item),
                mini ? 'justify-center px-0!' : 'px-3!'
              ]"
              class="min-h-9! rounded-lg! py-2! mb-0.5 flex items-center gap-2"
              @click="select(item)"
            >
              <img :src="item.icon" :alt="item.label" class="size-4 shrink-0" />
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
                      user?.email
                    }}</q-item-label>
                    <q-item-label
                      v-if="currentRole"
                      caption
                      class="capitalize"
                      >{{ currentRole }}</q-item-label
                    >
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
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuth } from '@/composables/useAuth'
import { useMe } from '@/composables/useMe'
import { useEntitlements } from '@/composables/useEntitlements'

import logo from '@/assets/dashboard/logo.svg'
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
const { user, logOut } = useAuth()
const { currentAccount, currentRole } = useMe()

// Badge vocabulary, borrowed from the marketing site's Live/Preview pills so the
// dashboard tells the same story with the same honesty: `live` = backed by real
// network data today, `demo` = illustrative fixture, `preview` = module designed
// but not built. Unbadged rows are ordinary product surface — badging all ~30
// mock screens would be noise, so only the exceptions that matter in a demo, and
// the unbuilt module, carry a pill. Palettes are StatusBadge's success/neutral/
// brand strings, so a nav pill and a table pill read as the same object.
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

// A rail is icons and tooltips only, so the pill has nowhere to render — the
// tooltip carries the same word instead rather than dropping the honesty cue.
function railLabel(item) {
  return item.badge ? `${item.label} — ${BADGES[item.badge].label}` : item.label
}

// FROZEN. Screens are registered in src/router/screens.js; this list decides what
// is *reachable from the sidebar* and how it is grouped. Only list views belong
// here — create/detail/trash screens are reached from within their list.
//
// A group with no `children` is a direct link. Groups auto-expand when one of
// their screens is active.
//
// The order is the product story, so the sidebar reads top-to-bottom the way the
// data flows: collect → resolve → activate → engage → measure, with operational
// rooms last. `caption` marks the first group of a section and renders as a small
// uppercase label (a plain rule in rail mode, where there is no room for text);
// keeping it on the group rather than in a wrapper array means an
// entitlement-gated section takes its own caption with it when it disappears.
// `badge` is a key into BADGES above.
const navGroups = [
  { key: 'dashboard', label: 'Dashboard', icon: icOverview, to: '/' },
  {
    key: 'sources',
    caption: 'COLLECT',
    label: 'Sources',
    icon: icSources,
    children: [
      { label: 'Event streams', to: '/sources' },
      { label: 'Live events', to: '/live-events', badge: 'live' },
      { label: 'Connectors', to: '/connectors', badge: 'live' }
    ]
  },
  { key: 'pipes', label: 'Pipes', icon: icIntegrations, to: '/pipes' },
  {
    key: 'destinations',
    label: 'Destinations',
    icon: icActivation,
    to: '/destinations'
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    icon: icSetup,
    children: [
      { label: 'Warehouse connections', to: '/dwh-connections' },
      { label: 'DWH syncs', to: '/dwh-syncs' },
      { label: 'Warehouse models', to: '/warehouse-models' }
    ]
  },
  {
    key: 'profiles',
    caption: 'RESOLVE',
    label: 'Profiles',
    icon: icContacts,
    children: [
      { label: 'Profile search', to: '/profiles/search' },
      { label: 'Identity resolution', to: '/profiles/identity-resolution' },
      { label: 'Attributes', to: '/attributes' },
      { label: 'Profile API', to: '/profile-api' },
      { label: 'Live profile syncs', to: '/live-profile-syncs' },
      { label: 'Profile DWH syncs', to: '/profile-dwh-syncs' }
    ]
  },
  {
    key: 'fans',
    label: 'Fans',
    icon: icSegments,
    children: [
      { label: 'Contacts', to: '/contacts', badge: 'live' },
      {
        label: 'Live identity graph',
        to: '/identity-resolution',
        badge: 'live'
      }
    ]
  },
  {
    key: 'audiences',
    caption: 'ACTIVATE',
    label: 'Audiences',
    icon: icSegments,
    children: [
      { label: 'Audiences', to: '/audiences' },
      { label: 'Segments', to: '/segments', badge: 'live' },
      { label: 'Goals', to: '/goals' },
      { label: 'Activation', to: '/activation', badge: 'demo' }
    ]
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    icon: icComm,
    children: [
      { label: 'Journeys', to: '/journeys' },
      { label: 'Email campaigns', to: '/channels/email' },
      { label: 'Communications', to: '/communications', badge: 'demo' },
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
    key: 'measure',
    caption: 'MEASURE',
    label: 'Measure',
    icon: icOverview,
    children: [
      { label: 'Reporting', to: '/reporting' },
      { label: 'Fan overview', to: '/fan-overview', badge: 'demo' }
    ]
  },
  {
    key: 'monitoring',
    caption: 'SYSTEM',
    label: 'Monitoring',
    icon: icBell,
    children: [
      { label: 'Errors', to: '/errors' },
      { label: 'Health', to: '/health' }
    ]
  },
  {
    key: 'demo',
    label: 'Demo lab',
    icon: icSetup,
    children: [
      { label: 'Demo store', to: '/demo-store' },
      { label: 'Event inspector', to: '/demo-event-inspector' },
      { label: 'Events demo', to: '/events-demo', badge: 'live' },
      { label: 'Integrations', to: '/integrations', badge: 'demo' }
    ]
  }
]

const bottomMenu = [
  { label: 'Authorizations', icon: icSetup, to: '/authorizations' },
  { label: 'Secrets', icon: icSettings, to: '/secrets' },
  { label: 'Settings', icon: icSettings, to: '/settings' },
  { label: 'Logout', icon: icLogout, action: 'logout' }
]

const { isEnabled, load: loadEntitlements } = useEntitlements()

// Without this the gate never reads public/data/entitlements.json and every
// entitlement silently falls back to its optimistic default.
loadEntitlements()

// Entitlement-gated groups disappear entirely rather than rendering dead links.
const visibleGroups = computed(() =>
  navGroups.filter(g => !g.entitlement || isEnabled(g.entitlement))
)

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
