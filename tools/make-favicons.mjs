#!/usr/bin/env node
/**
 * make-favicons.mjs — rasterise the Sfere mark into the legacy favicon formats.
 *
 * `public/favicon.svg` is what every current browser actually uses. These
 * outputs exist for the ones that don't:
 *
 *   public/icons/favicon-{16,32,96,128}x{16,32,96,128}.png
 *   public/favicon.ico   — 16 + 32 + 48, PNG-encoded inside the ICO container
 *
 * Single source: every size is rendered from `public/favicon.svg`, not from
 * `public/brand/sfere-mark.svg`. The favicon file is already square and is the
 * geometry that was cut for small sizes (the three faintest nodes dropped);
 * the mark is 42x38 and would need aspect-ratio padding to fill a square canvas
 * for no gain. One source means the icon is the same drawing at every size.
 *
 * Rendering goes through the Playwright Chromium already in devDependencies —
 * the machine has no rsvg-convert/ImageMagick, and this needs no network. The
 * screenshot is taken with `omitBackground` so the PNGs stay RGBA with a fully
 * transparent field; without it Chromium bakes in an opaque white square, which
 * looks wrong on dark tab chrome and inside the ICO.
 *
 * Usage:
 *   node tools/make-favicons.mjs           # write the PNGs and the ICO
 *   node tools/make-favicons.mjs --check   # render and report, write nothing
 *
 * Lives in tools/ rather than scripts/ because scripts/ is a frozen path
 * (see CLAUDE.md).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const SOURCE_SVG = join(ROOT, 'public/favicon.svg')

/* The four sizes Quasar scaffolded into public/icons/. Nothing in index.html
   references them today, but they ship with the build, so they are regenerated
   rather than left as the old mark. */
const PNG_SIZES = [16, 32, 96, 128]

/* What goes inside favicon.ico. 48 is the Windows shortcut size; it is rendered
   for the container only and is not written to public/icons/. */
const ICO_SIZES = [16, 32, 48]

const check = process.argv.slice(2).includes('--check')

/* -------------------------------------------------------------------------- */

/**
 * Render the source SVG into a size x size RGBA PNG buffer.
 *
 * The SVG's own width/height attributes are overridden in CSS so one file can
 * fill every canvas; its viewBox is what actually controls the geometry.
 */
async function renderPng(page, svg, size) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<!doctype html>
     <style>
       html, body { margin: 0; padding: 0; background: transparent }
       svg { display: block; width: ${size}px; height: ${size}px }
     </style>
     ${svg}`
  )
  return page.screenshot({ omitBackground: true })
}

/**
 * Assemble PNG buffers into an ICO container.
 *
 * Layout: a 6-byte ICONDIR, then one 16-byte ICONDIRENTRY per image, then the
 * image payloads back to back. Storing PNGs rather than BMPs is legal and has
 * been supported since Windows Vista; it is why this file lands at a few KB
 * where a BMP-encoded one is tens of KB.
 */
function buildIco(images) {
  const HEADER = 6
  const ENTRY = 16

  const directory = Buffer.alloc(HEADER + ENTRY * images.length)
  directory.writeUInt16LE(0, 0) // reserved
  directory.writeUInt16LE(1, 2) // type 1 = icon
  directory.writeUInt16LE(images.length, 4)

  let offset = HEADER + ENTRY * images.length

  images.forEach(({ size, buffer }, index) => {
    const at = HEADER + ENTRY * index
    directory.writeUInt8(size === 256 ? 0 : size, at) // 0 means 256
    directory.writeUInt8(size === 256 ? 0 : size, at + 1)
    directory.writeUInt8(0, at + 2) // palette size — 0 for truecolour
    directory.writeUInt8(0, at + 3) // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(buffer.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += buffer.length
  })

  return Buffer.concat([directory, ...images.map(image => image.buffer)])
}

/* -------------------------------------------------------------------------- */

const svg = readFileSync(SOURCE_SVG, 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage()

const sizes = [...new Set([...PNG_SIZES, ...ICO_SIZES])].sort((a, b) => a - b)
const rendered = new Map()

for (const size of sizes) {
  rendered.set(size, await renderPng(page, svg, size))
}

await browser.close()

const ico = buildIco(
  ICO_SIZES.map(size => ({ size, buffer: rendered.get(size) }))
)

const outputs = [
  ...PNG_SIZES.map(size => ({
    path: join(ROOT, `public/icons/favicon-${size}x${size}.png`),
    buffer: rendered.get(size)
  })),
  { path: join(ROOT, 'public/favicon.ico'), buffer: ico }
]

for (const output of outputs) {
  const label = output.path.slice(ROOT.length)
  if (check) {
    console.log(`  would write ${label} (${output.buffer.length} bytes)`)
    continue
  }
  mkdirSync(dirname(output.path), { recursive: true })
  writeFileSync(output.path, output.buffer)
  console.log(`  wrote ${label} (${output.buffer.length} bytes)`)
}

console.log(
  check
    ? `\nCheck only — nothing written. ICO carries ${ICO_SIZES.join(', ')}px.`
    : `\nDone. ICO carries ${ICO_SIZES.join(', ')}px.`
)
