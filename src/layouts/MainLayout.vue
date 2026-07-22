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
        <q-list class="flex-1 overflow-y-auto p-3">
          <q-item
            v-for="item in mainMenu"
            :key="item.label"
            clickable
            :class="[itemClass(item), mini ? 'justify-center px-0!' : 'px-3!']"
            class="min-h-9! rounded-lg! py-2! mb-0.5 flex items-center gap-2"
            @click="select(item)"
          >
            <img :src="item.icon" :alt="item.label" class="size-4 shrink-0" />
            <span v-if="!mini" class="flex-1 text-sm tracking-[-0.35px]">{{
              item.label
            }}</span>
            <img
              v-if="!mini && item.chevron"
              :src="icChevron"
              alt=""
              class="size-[18px] opacity-70"
            />
            <q-tooltip
              v-if="mini"
              anchor="center right"
              self="center left"
              class="bg-ink! text-xs"
              >{{ item.label }}</q-tooltip
            >
          </q-item>
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

const mainMenu = [
  { label: 'Overview', icon: icOverview, to: '/' },
  { label: 'Contacts', icon: icContacts, to: '/contacts' },
  {
    label: 'Identity Resolution',
    icon: icContacts,
    to: '/identity-resolution'
  },
  { label: 'Segments', icon: icSegments, to: '/segments' },
  { label: 'Activation', icon: icActivation, to: '/activation', chevron: true },
  {
    label: 'Communication',
    icon: icComm,
    to: '/communications',
    chevron: true
  },
  { label: 'Integrations', icon: icIntegrations, to: '/integrations' },
  { label: 'Live Events', icon: icOverview, to: '/live-events' },
  { label: 'Events Demo', icon: icOverview, to: '/events-demo' }
]

const bottomMenu = [
  { label: 'Setup', icon: icSetup },
  { label: 'Sources', icon: icSources, to: '/sources' },
  { label: 'Settings', icon: icSettings },
  { label: 'Logout', icon: icLogout, action: 'logout' }
]

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

function isActive(item) {
  return item.to ? route.path === item.to : false
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
