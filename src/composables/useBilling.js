import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'

/**
 * Plan, usage, add-ons, payment method and invoice history.
 *
 * NO `api` OPTION, same reasoning as `useTeam()`: there is no billing endpoint,
 * and the tiers themselves are not decided yet. Real mode reports `apiMissing`
 * rather than inventing an invoice — a fabricated amount on a screen Finance
 * reads is the worst kind of placeholder.
 *
 * The numbers in `public/data/billing.json` are illustrative shape, not
 * approved pricing. The page says so on screen.
 *
 * @returns {{
 *   plan: import('vue').ComputedRef<object|null>,
 *   usage: import('vue').ComputedRef<Array>,
 *   addOns: import('vue').ComputedRef<Array>,
 *   invoices: import('vue').ComputedRef<Array>,
 *   paymentMethod: import('vue').ComputedRef<object|null>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   apiMissing: import('vue').Ref<boolean>,
 *   load: () => Promise<void>
 * }}
 */
export function useBilling() {
  const { data, loading, error, apiMissing, load } = useMockResource(
    'billing',
    {
      initial: {}
    }
  )

  const plan = computed(() => data.value?.plan ?? null)
  const usage = computed(() => data.value?.usage ?? [])
  const addOns = computed(() => data.value?.addOns ?? [])
  const invoices = computed(() => data.value?.invoices ?? [])
  const paymentMethod = computed(() => data.value?.paymentMethod ?? null)

  return {
    plan,
    usage,
    addOns,
    invoices,
    paymentMethod,
    loading,
    error,
    apiMissing,
    load
  }
}

/** 4180000 -> "4.18M". Compact because these sit in a meter label. */
export function formatUsage(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

export default useBilling
