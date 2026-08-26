// Configuration for your app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file

import { defineConfig } from '#q-app'
import { existsSync } from 'node:fs'

// Load .env into process.env at config time. Despite what the comment here used
// to claim, this is NOT only for server-side secrets: the build reads the
// client-exposed VITE_* vars off process.env too, so without this VITE_API_BASE
// comes through empty, every call falls back to http://localhost:8080, and a
// deployed build fails every request while looking like a backend outage. It
// survived the removal of the /japi dev proxy (the server-side EVENTS_API_KEY it
// was originally added for) for that reason.
if (existsSync('.env')) {
  process.loadEnvFile('.env')
}

export default defineConfig((/* ctx */) => {
  return {
    // https://v2.quasar.dev/quasar-cli-vite/prefetch-feature
    // preFetch: true,

    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    // https://v2.quasar.dev/quasar-cli-vite/boot-files
    boot: ['vue-query'],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#css
    css: ['app.scss', 'tailwind.css'],

    // https://github.com/quasarframework/quasar/tree/dev/extras
    extras: [
      // 'ionicons-v4',
      // 'mdi-v7',
      // 'fontawesome-v7',
      // 'eva-icons',
      // 'themify',
      // 'line-awesome',
      // 'roboto-font-latin-ext', // this or either 'roboto-font', NEVER both!

      'roboto-font', // optional, you are not bound to it
      'material-icons' // optional, you are not bound to it
    ],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#build
    build: {
      target: {
        // browser: 'baseline-widely-available',
        // node: 'node22'
      },

      // https://v2.quasar.dev/quasar-cli-vite/page-routing-with-vue-router#filename-based-routing
      // filenameBasedRouting: true,

      vueRouterMode: 'hash', // available values: 'hash', 'history'
      // vueRouterBase, // defaults to publicPath, which is enough for hash mode

      // publicPath: '/', // Firebase Hosting serves app.sfere.io, app-staging.sfere.io
      // and every preview channel from the root, so the default '/' is right everywhere.
      // (It was commented out for GitHub Pages too — a repo-subpath deploy would need it.)
      // define: {},
      // defineEnv: {}
      // ignorePublicFolder: true,
      // minify: false,
      // distDir

      // Emit all assets as files instead of inlining small ones as data: URIs —
      // the app's CSP is default-src 'self' (no data:), which would block inlined images.
      extendViteConf(viteConf) {
        viteConf.build = viteConf.build || {}
        viteConf.build.assetsInlineLimit = 0
      },
      // viteVuePluginOptions: {},

      vitePlugins: [['@tailwindcss/vite', {}]]
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#devserver
    // There is deliberately no `proxy` here. This used to forward /japi/* to a
    // third-party events console with a server-side API key attached, because
    // that host needed auth and was not CORS-enabled. The dashboard now talks
    // to the Sfere backend and to nothing else, so there is nothing left to
    // proxy — and nothing that works in `pnpm dev` but not in a production
    // build, which is what the proxy's absence in `dist/spa` used to cost.
    devServer: {
      // https: true,
      open: true // opens browser window automatically
    },

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#framework
    framework: {
      // Every $q.notify() call in the app used to set position: 'bottom'
      // itself; that's been stripped from all of them so this default
      // (top-right, stacked, Sfere-styled via sfere-toast in sfere.css)
      // takes over everywhere without touching every call site again.
      config: {
        notify: {
          position: 'top-right',
          classes: 'sfere-toast'
        }
      },

      // iconSet: 'material-icons', // Quasar icon set
      // lang: 'en-US', // Quasar language pack

      // For special cases outside of where the auto-import strategy can have an impact
      // (like functional components as one of the examples),
      // you can manually specify Quasar components/directives to be available everywhere:
      //
      // components: [],
      // directives: [],

      // Quasar plugins
      plugins: ['Notify']
    },

    // animations: 'all', // --- includes all animations
    // https://v2.quasar.dev/options/animations
    animations: [],

    // https://v2.quasar.dev/quasar-cli-vite/quasar-config-file#sourcefiles
    // sourceFiles: {
    //   rootComponent: 'src/App.vue',
    //   router: 'src/router/index',
    //   store: 'src/store/index',
    //   pwaRegisterServiceWorker: 'src-pwa/register-sw',
    //   pwaServiceWorker: 'src-pwa/sw/custom-sw',
    //   pwaManifestFile: 'src-pwa/manifest.json',
    //   electronMain: 'src-electron/electron-main',
    //   electronPreload: 'src-electron/electron-preload'
    //   bexManifestFile: 'src-bex/manifest.json
    // },

    // https://v2.quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr
    ssr: {
      prodPort: 3000, // The default port that the production server should use
      // (gets superseded if process.env.PORT is specified at runtime)

      middlewares: [
        'render' // keep this as last one
      ],

      // extendSSRPackageJson (pkgJson) {},
      // extendSSRWebserverConf (rolldownConf) {},

      // manualStoreSerialization: true,
      // manualStoreSsrContextInjection: true,
      // manualStoreHydration: true,
      // manualPostHydrationTrigger: true,

      pwa: false
      // pwaOfflineHtmlFilename: 'offline.html', // do NOT use index.html as name!

      // extendSSRGenerateSWOptions (cfg) {},
      // extendSSRInjectManifestOptions (cfg) {}
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-pwa/configuring-pwa
    pwa: {
      workboxMode: 'GenerateSW' // 'GenerateSW' or 'InjectManifest'
      // swFilename: 'sw.js',
      // manifestFilename: 'manifest.json',
      // extendPWAManifestJson (json) {},
      // useCredentialsForManifestTag: true,
      // injectPWAMetaTags: false,
      // extendPWACustomSWConf (rolldownConf) {},
      // extendPWAGenerateSWOptions (cfg) {},
      // extendPWAInjectManifestOptions (cfg) {},
      // extendPWASwTsConfig (tsConfig) {}
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-cordova-apps/configuring-cordova
    cordova: {},

    // https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps/configuring-capacitor
    capacitor: {
      hideSplashscreen: true
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/configuring-electron
    electron: {
      // extendElectronMainConf (rolldownConf) {},
      // extendElectronPreloadConf (rolldownConf) {},
      // extendElectronPackageJson (pkgJson) {},

      // Electron preload scripts (if any) from /src-electron, WITHOUT file extension
      preloadScripts: ['electron-preload'],

      // specify the debugging port to use for the Electron app when running in development mode
      inspectPort: 5858,

      bundler: 'packager', // 'packager' or 'builder'

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Windows only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration

        appId: 'sfere-dashboard'
      }
    },

    // https://v2.quasar.dev/quasar-cli-vite/developing-browser-extensions/configuring-bex
    bex: {
      // extendBexScriptsConf (rolldownConf) {},
      // extendBexManifestJson (json) {},

      /**
       * The list of extra scripts (js/ts) not in your bex manifest that you want to
       * compile and use in your browser extension. Maybe dynamic use them?
       *
       * Each entry in the list should be a relative filename to /src-bex/
       *
       * @example [ 'my-script.ts', 'sub-folder/my-other-script.js' ]
       */
      extraScripts: []
    }
  }
})
