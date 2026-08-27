// Every copy-paste snippet the Install & confirm step offers, keyed by method.
//
// IN A LIB MODULE, NOT THE COMPONENT, for the same reason webSdkSnippet is: a
// Vue SFC's <script> block ends at the first literal closing script tag, string
// literals and comments included, so an HTML install snippet cannot live inside
// the component that renders it. (webSdkSnippet is imported rather than
// re-implemented here — one snippet, one definition, or the tag on a customer's
// site and the tag in the setup guide drift apart.)
//
// Each entry is `{ key, label, blocks: [{ title?, body?, filename, code }],
// note? }`. `blocks` is a list because most methods are "install, then
// initialise, then track" rather than one paste.

import { webSdkSnippet } from '@/lib/webSdkSnippet'

const INGEST_HOST = 'https://ingest.sfere.io'

/**
 * @param {object} source a source row: `{ name, slug, writeKey }`
 * @returns {object[]} methods, in the order the tabs should show them
 */
export function browserMethods(source) {
  const key = source?.writeKey || 'your-write-key'
  const slug = source?.slug || 'your-source'

  return [
    {
      key: 'html',
      label: 'HTML',
      lede: `Paste this once, anywhere before the closing </head> tag. Page views start immediately.`,
      blocks: [
        {
          filename: 'index.html',
          code: webSdkSnippet(key)
        },
        {
          title: 'Identify a signed-in visitor, or send a custom event',
          body: 'Both are optional. Page views need no code beyond the tag above.',
          filename: 'anywhere in your app',
          code: [
            '// tie this browser to a known person',
            'sfere.identify("user_1234", { email: "jane@brand.com" });',
            '',
            '// send something of your own',
            'sfere.track("add_to_cart", { productId: "SKU-221", value: 42 });'
          ].join('\n')
        }
      ],
      attributes: [
        {
          name: 'data-write-key',
          what: "This source's key. Public by design — it belongs in client-side code."
        },
        {
          name: 'data-user-id',
          what: 'Sets the visitor id on load, the same as calling sfere.identify().'
        },
        {
          name: 'data-init-only',
          what: 'Loads the tracker without auto-sending a page view, if you would rather fire it yourself.'
        }
      ]
    },
    {
      key: 'react',
      label: 'React',
      lede: 'One provider near the root, then a hook anywhere below it.',
      blocks: [
        { filename: 'terminal', code: 'npm install @sfere/react' },
        {
          filename: 'App.jsx',
          code: [
            'import { SfereProvider } from "@sfere/react"',
            '',
            'export default function App() {',
            '  return (',
            `    <SfereProvider writeKey="${key}">`,
            '      <YourApp />',
            '    </SfereProvider>',
            '  )',
            '}'
          ].join('\n')
        },
        {
          filename: 'CheckoutButton.jsx',
          code: [
            'import { useSfere } from "@sfere/react"',
            '',
            'const { track, identify } = useSfere()',
            '',
            '<button onClick={() => track("checkout_started", { total: 128 })}>',
            '  Check out',
            '</button>'
          ].join('\n')
        }
      ]
    },
    {
      key: 'npm',
      label: 'NPM package',
      lede: 'The same package works in the browser and in Node.js.',
      blocks: [
        { filename: 'terminal', code: 'npm install @sfere/js' },
        {
          filename: 'analytics.js',
          code: [
            'import { sfere } from "@sfere/js"',
            '',
            `const client = sfere({ writeKey: "${key}" })`,
            '',
            'client.identify("user_1234", { email: "jane@brand.com" })',
            'client.track("checkout", { total: 128 })',
            'client.page()'
          ].join('\n')
        }
      ],
      note: 'In the browser, page title and URL are captured for you. In Node.js, pass them yourself.'
    },
    {
      key: 'http',
      label: 'HTTP API',
      lede: 'No library at all — one POST per event, from anywhere that can make a request.',
      blocks: [
        {
          filename: 'terminal',
          code: [
            `curl -X POST ${INGEST_HOST}/v1/${slug} \\`,
            `  -H "Authorization: Bearer ${key}" \\`,
            '  -H "Content-Type: application/json" \\',
            `  -d '[{"event_type":"page","event_time":"2026-08-27T12:00:00Z","user_id":"user_1234"}]'`
          ].join('\n')
        }
      ],
      note: 'event_type is one of page, track, identify or group. Calling this from a server on someone else’s behalf? Send their IP and User-Agent yourself, or every event looks like it came from your data centre.'
    },
    {
      key: 'native',
      label: 'Native apps',
      lede: 'Building for iOS or Android instead? Same event model, one SDK per platform.',
      blocks: [
        {
          filename: 'AppDelegate.swift',
          code: ['import Sfere', '', `Sfere.start(writeKey: "${key}")`].join(
            '\n'
          )
        },
        {
          filename: 'MainActivity.kt',
          code: [
            'import io.sfere.sdk.Sfere',
            '',
            `Sfere.start(context = this, writeKey = "${key}")`
          ].join('\n')
        }
      ],
      note: 'React Native ships as one package covering both platforms. Migrating from Segment? Point your existing SDK at Sfere with one config change.'
    }
  ]
}

/** Native-first ordering, for a source created from a mobile SDK template. */
export function nativeMethods(source) {
  const all = browserMethods(source)
  const order = ['native', 'npm', 'http', 'html', 'react']
  return order.map(k => all.find(m => m.key === k)).filter(Boolean)
}

/** Server-first ordering, for an HTTP API source. */
export function serverMethods(source) {
  const all = browserMethods(source)
  const order = ['http', 'npm', 'native', 'html', 'react']
  return order.map(k => all.find(m => m.key === k)).filter(Boolean)
}

/**
 * Which set of methods a source should be shown, from the template it was
 * created from. A cloud app gets none — it is polled, not pushed to — and the
 * component renders its connector copy instead of an empty tab bar.
 */
export function methodsForSource(source) {
  const templateId = source?.templateId
  const type = source?.sourceType

  if (type === 'cloud_app') return []
  if (templateId === 'ios-sdk' || templateId === 'android-sdk') {
    return nativeMethods(source)
  }
  if (templateId === 'http-api') return serverMethods(source)
  return browserMethods(source)
}

export default methodsForSource
