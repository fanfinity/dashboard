// The Jitsu browser snippet a client site pastes to stream events into a Web
// SDK source. Everything is fixed configuration except the write key, which the
// backend generates (a Jitsu browser key, keyId:secret) when the source is
// created.
//
// Lives in its own module because both SourceIngestPanel and WebSdkSetupPanel
// render it, and an SFC script block cannot contain a literal closing script
// tag — the parser ends the block at the first one, string or comment included.

export const JITSU_SNIPPET_HOST = 'https://console.fanfinity.io'

const CLOSE_SCRIPT = `</${'script'}>`

/**
 * The copy-paste `<script>` tag for a Web SDK source.
 *
 * @param {string} writeKey the source's Jitsu browser write key (keyId:secret)
 * @returns {string}
 */
export function webSdkSnippet(writeKey) {
  return [
    '<script',
    '  async',
    `  src="${JITSU_SNIPPET_HOST}/p.js"`,
    `  data-write-key="${writeKey}"`,
    `  data-host="${JITSU_SNIPPET_HOST}"`,
    '  data-init-only="true"',
    `  data-debug="true">${CLOSE_SCRIPT}`
  ].join('\n')
}
