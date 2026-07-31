#!/usr/bin/env node
// Minimal static server for dist/spa, used by scripts/smoke.mjs.
//
// The router runs in hash mode, so every deep link is really just a request for
// index.html with a #fragment the server never sees — which means no SPA
// fallback rewriting is needed. That is the whole reason this file is 40 lines.
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const ROOT = resolve(process.argv[2] || 'dist/spa')
const PORT = Number(process.env.SMOKE_PORT || 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
}

if (!existsSync(ROOT)) {
  console.error(`serve-dist: ${ROOT} does not exist — run a build first`)
  process.exit(1)
}

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  // normalize() collapses ../ so a request cannot escape ROOT.
  let file = join(ROOT, normalize(url))
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden')
    return
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(ROOT, 'index.html')
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  })
  createReadStream(file).pipe(res)
})

server.listen(PORT, () => {
  console.log(`serve-dist: ${ROOT} on http://localhost:${PORT}`)
})
