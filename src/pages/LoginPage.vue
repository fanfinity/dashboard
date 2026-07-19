<template>
  <div class="flex min-h-screen items-center justify-center bg-sidebar p-6">
    <div class="w-full max-w-sm rounded-2xl border border-line2 bg-white p-8">
      <h1 class="text-[22px]! font-semibold! tracking-[-0.4px]! text-ink">
        {{ mode === 'signup' ? 'Create your account' : 'Sign in' }}
      </h1>
      <p class="mt-1 text-[14px] text-muted">
        {{
          mode === 'signup'
            ? 'Sign up with your email to get started.'
            : 'Welcome back — sign in with your email.'
        }}
      </p>

      <q-form class="mt-6 flex flex-col gap-4" @submit.prevent="submit">
        <q-input
          v-model="email"
          type="email"
          label="Email"
          outlined
          dense
          autocomplete="email"
          :rules="[v => !!v || 'Email is required']"
        />
        <q-input
          v-model="password"
          type="password"
          label="Password"
          outlined
          dense
          :autocomplete="
            mode === 'signup' ? 'new-password' : 'current-password'
          "
          :rules="[v => !!v || 'Password is required']"
        />

        <q-btn
          type="submit"
          :loading="loading"
          color="primary"
          unelevated
          no-caps
          class="mt-1 h-10 rounded-lg font-medium"
          :label="mode === 'signup' ? 'Create account' : 'Sign in'"
        />
      </q-form>

      <p class="mt-5 text-center text-[13px] text-muted">
        <template v-if="mode === 'signup'">
          Already have an account?
          <button
            type="button"
            class="font-medium text-brand hover:underline"
            @click="mode = 'signin'"
          >
            Sign in
          </button>
        </template>
        <template v-else>
          Don't have an account?
          <button
            type="button"
            class="font-medium text-brand hover:underline"
            @click="mode = 'signup'"
          >
            Create one
          </button>
        </template>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { loading, signIn, signUp } = useAuth()

const mode = ref('signin')
const email = ref('')
const password = ref('')

async function submit() {
  const ok =
    mode.value === 'signup'
      ? await signUp(email.value, password.value)
      : await signIn(email.value, password.value)

  if (ok) {
    router.replace(route.query.redirect || '/')
  }
}
</script>
