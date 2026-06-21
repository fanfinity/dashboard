<template>
  <q-page class="p-6">
    <!-- Header -->
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl! font-semibold! tracking-[-0.5px]! text-ink"
          >Contacts</h1
        >
        <p class="mt-1 text-sm text-muted"
          ><span class="font-medium text-ink">842K</span> verified, deduplicated
          fans across all your sources.</p
        >
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex h-9 w-full max-w-[280px] items-center gap-2 rounded-lg border border-line2 bg-white px-2.5 shadow-sm"
        >
          <img :src="icSearch" alt="" class="size-4 shrink-0" />
          <input
            v-model="query"
            type="text"
            placeholder="Search contacts..."
            class="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
          />
        </div>
        <button
          class="flex h-9 items-center gap-1.5 rounded-lg border border-line2 bg-white px-3 text-sm font-medium text-ink shadow-sm hover:bg-fill"
        >
          <svg viewBox="0 0 16 16" class="size-4 text-subtle" fill="none">
            <path
              d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Export
        </button>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="f in filters"
        :key="f.label"
        class="rounded-lg border px-3 py-1.5 text-sm"
        :class="
          f.active
            ? 'border-brand/40 bg-brand/5 font-medium text-brand'
            : 'border-line2 bg-white text-muted hover:bg-fill'
        "
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Contacts table -->
    <div
      class="overflow-hidden rounded-xl border border-line2 bg-white shadow-sm"
    >
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-line text-left">
            <th
              v-for="h in tableHeads"
              :key="h"
              class="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.4px] text-subtle"
              :class="h === 'Engagement' ? 'text-right' : ''"
              >{{ h }}</th
            >
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in filteredContacts"
            :key="c.email"
            class="border-b border-line last:border-0 hover:bg-sidebar"
          >
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  :class="c.color"
                  >{{ initials(c.name) }}</span
                >
                <div class="min-w-0">
                  <p class="truncate font-medium text-ink">{{ c.name }}</p>
                  <p class="truncate text-xs text-muted">{{ c.city }}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-3.5">
              <p class="text-muted">{{ c.email }}</p>
              <p class="text-xs text-subtle">{{ c.phone }}</p>
            </td>
            <td class="px-5 py-3.5">
              <span
                class="inline-flex items-center rounded-md border border-line2 bg-fill px-2 py-0.5 text-xs text-muted"
                >{{ c.segment }}</span
              >
            </td>
            <td class="px-5 py-3.5 text-muted">{{ c.source }}</td>
            <td class="px-5 py-3.5">
              <span
                :class="badgeClass(c.status)"
                class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                >{{ c.status }}</span
              >
            </td>
            <td class="px-5 py-3.5 text-right text-muted">{{ c.lastSeen }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Footer -->
      <div
        class="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted"
      >
        <span>Showing {{ filteredContacts.length }} of 842,104 contacts</span>
        <div class="flex items-center gap-1">
          <button
            class="rounded-md border border-line2 bg-white px-2.5 py-1 hover:bg-fill"
            >Prev</button
          >
          <button
            class="rounded-md border border-line2 bg-white px-2.5 py-1 hover:bg-fill"
            >Next</button
          >
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import icSearch from '@/assets/dashboard/ic-search.svg'

const query = ref('')

const tableHeads = ['Name', 'Contact', 'Segment', 'Source', 'Status', 'Engagement']

const filters = [
  { label: 'All', active: true },
  { label: 'Verified', active: false },
  { label: 'Super Fans', active: false },
  { label: 'Opted in', active: false },
  { label: 'Lapsed', active: false }
]

const contacts = [
  {
    name: 'Faisal Al-Qahtani',
    city: 'Riyadh',
    email: 'faisal.q@mail.com',
    phone: '+966 50 123 4567',
    segment: 'Super Fans',
    source: 'WhatsApp',
    status: 'Verified',
    lastSeen: '2h ago',
    color: 'bg-brand'
  },
  {
    name: 'Noura Al-Saud',
    city: 'Jeddah',
    email: 'noura.s@mail.com',
    phone: '+966 55 987 6543',
    segment: 'Hot Al-Hilal',
    source: 'Quiz',
    status: 'Verified',
    lastSeen: '5h ago',
    color: 'bg-emerald-500'
  },
  {
    name: 'Omar Al-Harbi',
    city: 'Dammam',
    email: 'omar.h@mail.com',
    phone: '+966 56 222 1188',
    segment: 'Match-day buyers',
    source: 'Tickets',
    status: 'Verified',
    lastSeen: '1d ago',
    color: 'bg-amber-500'
  },
  {
    name: 'Sara Al-Dossari',
    city: 'Riyadh',
    email: 'sara.d@mail.com',
    phone: '+966 53 444 7799',
    segment: 'La Liga readers',
    source: 'Email',
    status: 'Pending',
    lastSeen: '2d ago',
    color: 'bg-pink-500'
  },
  {
    name: 'Khalid Al-Mutairi',
    city: 'Mecca',
    email: 'khalid.m@mail.com',
    phone: '+966 59 333 0021',
    segment: 'Repeat Fan',
    source: 'Poll',
    status: 'Verified',
    lastSeen: '3d ago',
    color: 'bg-indigo-500'
  },
  {
    name: 'Layla Al-Otaibi',
    city: 'Medina',
    email: 'layla.o@mail.com',
    phone: '+966 50 778 9900',
    segment: 'Lapsed fans',
    source: 'CRM',
    status: 'Lapsed',
    lastSeen: '74d ago',
    color: 'bg-rose-500'
  },
  {
    name: 'Yousef Al-Ghamdi',
    city: 'Jeddah',
    email: 'yousef.g@mail.com',
    phone: '+966 54 010 2233',
    segment: 'Travel Fan',
    source: 'WhatsApp',
    status: 'Verified',
    lastSeen: '4d ago',
    color: 'bg-cyan-600'
  }
]

const filteredContacts = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return contacts
  return contacts.filter(
    c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.segment.toLowerCase().includes(q)
  )
})

function initials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
}

const STATUS = {
  Verified: 'border-success-line bg-success-bg text-success',
  Pending: 'border-amber-200 bg-amber-50 text-amber-600',
  Lapsed: 'border-line2 bg-fill text-subtle'
}
function badgeClass(status) {
  return STATUS[status] || STATUS.Lapsed
}
</script>
