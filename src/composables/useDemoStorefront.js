import { computed } from 'vue'
import { useMockResource } from '@/composables/useMockResource'
import { DEMO_PROFILE_ID, DEMO_SOURCE_ID } from '@/composables/useDemoEvents'

/**
 * The Demo Store's catalog and its event vocabulary.
 *
 * The products are constants rather than mock JSON on purpose: they are part of
 * the demo's script, not workspace data, and `public/data/` belongs to other
 * packets. Prices are SAR, and the goods are the ones a club shop actually
 * sells, so a payload in the inspector reads like a real fan-commerce event
 * rather than `foo/bar`.
 *
 * No product imagery: the CSP is `default-src 'self'`, so tiles are drawn with
 * inline SVG in `DemoProductCard.vue` instead of loading pictures.
 */

export const CURRENCY = 'SAR'

export const DEMO_PRODUCTS = [
  {
    id: 'prd_home_jersey',
    slug: 'home-jersey-2627',
    sku: 'FF-JRSY-2627-H',
    name: 'Home Jersey 2026/27',
    category: 'apparel',
    price: 349,
    art: 'jersey',
    description: 'Match-day shirt, adult sizes. The shop bestseller.'
  },
  {
    id: 'prd_derby_ticket',
    slug: 'derby-ticket-east',
    sku: 'FF-TCKT-DRBY-E',
    name: 'Derby Ticket — East Stand',
    category: 'ticketing',
    price: 180,
    art: 'ticket',
    description: 'Single seat for the Riyadh derby, scanned at gate B.'
  },
  {
    id: 'prd_supporters_scarf',
    slug: 'supporters-scarf',
    sku: 'FF-SCRF-CLSC',
    name: 'Supporters Scarf',
    category: 'apparel',
    price: 75,
    art: 'scarf',
    description: 'Knitted club scarf — the cheap add-on that lifts basket size.'
  },
  {
    id: 'prd_season_pass',
    slug: 'season-pass-digital',
    sku: 'FF-PASS-2627',
    name: 'Season Pass — Digital',
    category: 'subscription',
    price: 1290,
    art: 'pass',
    description: 'Full-season streaming and priority ticket ballot access.'
  }
]

/**
 * What a visitor can be made to do. `eventName` is what lands in the log, and
 * each entry produces a different payload shape — which is the point of having
 * five of them rather than one "fire event" button.
 */
export const DEMO_ACTIONS = [
  {
    key: 'page_view',
    eventName: 'page_view',
    label: 'View the product page',
    description: 'A page call: path, title and referrer, no identity attached.'
  },
  {
    key: 'add_to_cart',
    eventName: 'add_to_cart',
    label: 'Add to cart',
    description: 'A track call carrying the product, its price and the basket.'
  },
  {
    key: 'identify',
    eventName: 'identify',
    label: 'Sign in',
    description:
      'An identify call: the anonymous visitor resolves to a known fan.'
  },
  {
    key: 'begin_checkout',
    eventName: 'begin_checkout',
    label: 'Begin checkout',
    description: 'Basket value and item count, once the visitor commits.'
  },
  {
    key: 'purchase',
    eventName: 'purchase',
    label: 'Complete the purchase',
    description:
      'The conversion: order id, line items and total. Empties the basket.'
  }
]

/** The order the "Run the full journey" button fires them in. */
export const DEMO_JOURNEY = [
  'page_view',
  'add_to_cart',
  'identify',
  'begin_checkout',
  'purchase'
]

/**
 * `349` -> `SAR 349`.
 *
 * @param {number|null|undefined} amount
 * @returns {string}
 */
export function formatPrice(amount) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '—'
  return `${CURRENCY} ${value.toLocaleString('en-GB')}`
}

/**
 * Sum of a basket's prices.
 *
 * @param {Array} cart
 * @returns {number}
 */
export function cartValue(cart) {
  return cart.reduce((total, item) => total + Number(item.price ?? 0), 0)
}

/**
 * Turns "this button, for this product, with this basket" into the spec
 * `useDemoEvents().capture()` wants.
 *
 * Kept out of the page so the payload vocabulary is defined once and can be
 * read on its own — the payloads are what the inspector exists to show.
 *
 * @param {string} actionKey  one of `DEMO_ACTIONS[].key`
 * @param {object} product    one of `DEMO_PRODUCTS`
 * @param {object} [context]
 * @param {Array}  [context.cart]     products currently in the basket
 * @param {string} [context.orderId]  order reference for a purchase
 * @returns {object} a `capture()` spec
 */
export function demoEventSpec(actionKey, product, context = {}) {
  const { cart = [], orderId = null } = context

  const line = {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    price: product.price,
    currency: CURRENCY
  }

  if (actionKey === 'page_view') {
    return {
      eventName: 'page_view',
      properties: {
        path: `/store/${product.slug}`,
        title: `${product.name} — Fanfinity Demo Store`,
        referrer: 'https://demo.fanfinity.io/store',
        productId: product.id
      }
    }
  }

  if (actionKey === 'add_to_cart') {
    return {
      eventName: 'add_to_cart',
      properties: {
        ...line,
        quantity: 1,
        cartSize: cart.length + 1,
        cartValue: cartValue(cart) + product.price
      }
    }
  }

  if (actionKey === 'identify') {
    return {
      eventName: 'identify',
      profileId: DEMO_PROFILE_ID,
      properties: {
        email: 'saud.dossari@example.com',
        firstName: 'Saud',
        lastName: 'Al-Dossari',
        city: 'Riyadh',
        favouriteTeam: 'Al-Hilal',
        marketingConsent: false
      }
    }
  }

  if (actionKey === 'begin_checkout') {
    return {
      eventName: 'begin_checkout',
      properties: {
        items: cart.length,
        value: cartValue(cart),
        currency: CURRENCY,
        shippingMethod: cart.every(i => i.category === 'subscription')
          ? 'none'
          : 'standard'
      }
    }
  }

  return {
    eventName: 'purchase',
    properties: {
      orderId,
      items: cart.map(i => ({
        productId: i.id,
        sku: i.sku,
        name: i.name,
        price: i.price,
        quantity: 1
      })),
      itemCount: cart.length,
      value: cartValue(cart),
      currency: CURRENCY,
      paymentMethod: 'mada'
    }
  }
}

/**
 * The configured source the demo store reports as.
 *
 * The store has no source of its own — it borrows the workspace's Web SDK
 * source so the endpoint, write key and snippet on screen are the ones a real
 * storefront would be given.
 *
 * @returns {{
 *   source: import('vue').ComputedRef<object|null>,
 *   sources: import('vue').Ref<Array>,
 *   loading: import('vue').Ref<boolean>,
 *   error: import('vue').Ref<string|null>,
 *   load: () => Promise<void>
 * }}
 */
export function useDemoStoreSource() {
  const { data: sources, loading, error, load } = useMockResource('sources')

  const source = computed(
    () => sources.value.find(s => s.id === DEMO_SOURCE_ID) ?? null
  )

  return { source, sources, loading, error, load }
}
