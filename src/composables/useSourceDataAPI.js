import { ref } from 'vue'
import { listSourceEvents as fetchSourceEvents } from '@/api/fanfinity'
import { customFetch } from '@/api/mutator'
import { useMe } from '@/composables/useMe'

/**
 * Convert snake_case keys to camelCase (shallow).
 */
function camelize(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[key] = v
  }
  return out
}

/**
 * Map an EventSummary (event_name / event_type / event_timestamp) onto the
 * shape SourceEventsPanel's table renders. The summary carries no payload, so
 * `event` is left undefined and the payload cell shows its em dash.
 */
function mapEventSummary(ev) {
  return {
    timestamp: ev.event_timestamp,
    eventName: ev.event_name,
    eventType: ev.event_type
  }
}

/**
 * API-backed composable for per-source ClickHouse data.
 *
 * Wraps three endpoints:
 *   GET /v1/accounts/{account}/sources/{source}/customers
 *   GET /v1/accounts/{account}/sources/{source}/orders
 *   GET /v1/accounts/{account}/sources/{source}/events
 */
export function useSourceDataAPI() {
  const { currentAccount } = useMe()

  const customers = ref([])
  const customersTotal = ref(0)
  const customersLoading = ref(false)
  const customersError = ref(null)

  const orders = ref([])
  const ordersTotal = ref(0)
  const ordersLoading = ref(false)
  const ordersError = ref(null)

  const events = ref([])
  const eventsTotal = ref(0)
  const eventsLoading = ref(false)
  const eventsError = ref(null)

  function _base(sourceId) {
    const accountId = currentAccount.value?.id
    if (!accountId) throw new Error('No account selected')
    return `/v1/accounts/${accountId}/sources/${sourceId}`
  }

  async function listSourceCustomers(sourceId, { page = 1, size = 50 } = {}) {
    customersLoading.value = true
    customersError.value = null
    try {
      const res = await customFetch(
        `${_base(sourceId)}/customers?page=${page}&size=${size}`
      )
      const data = res.data
      customers.value = (data.items ?? []).map(camelize)
      customersTotal.value = data.total ?? 0
    } catch (e) {
      customersError.value = e.message || 'Failed to load customers'
      customers.value = []
      customersTotal.value = 0
    } finally {
      customersLoading.value = false
    }
  }

  async function listSourceOrders(sourceId, { page = 1, size = 50 } = {}) {
    ordersLoading.value = true
    ordersError.value = null
    try {
      const res = await customFetch(
        `${_base(sourceId)}/orders?page=${page}&size=${size}`
      )
      const data = res.data
      orders.value = (data.items ?? []).map(camelize)
      ordersTotal.value = data.total ?? 0
    } catch (e) {
      ordersError.value = e.message || 'Failed to load orders'
      orders.value = []
      ordersTotal.value = 0
    } finally {
      ordersLoading.value = false
    }
  }

  async function listSourceEvents(sourceId, { page = 1, size = 50 } = {}) {
    eventsLoading.value = true
    eventsError.value = null
    try {
      const accountId = currentAccount.value?.id
      if (!accountId) throw new Error('No account selected')
      const res = await fetchSourceEvents(accountId, sourceId, { page, size })
      const data = res.data
      events.value = (data.items ?? []).map(mapEventSummary)
      eventsTotal.value = data.total ?? 0
    } catch (e) {
      eventsError.value = e.message || 'Failed to load events'
      events.value = []
      eventsTotal.value = 0
    } finally {
      eventsLoading.value = false
    }
  }

  return {
    customers,
    customersTotal,
    customersLoading,
    customersError,
    listSourceCustomers,

    orders,
    ordersTotal,
    ordersLoading,
    ordersError,
    listSourceOrders,

    events,
    eventsTotal,
    eventsLoading,
    eventsError,
    listSourceEvents
  }
}
