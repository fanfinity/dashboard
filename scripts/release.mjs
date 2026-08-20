#!/usr/bin/env node
// Cut a release: bump package.json, commit, tag, and print the push command.
//
//   pnpm release patch|minor|major
//   pnpm release 1.4.0
//
// Pushing the tag is what triggers .github/workflows/deploy-production.yml, which
// then waits on the `production` environment's required reviewer. That workflow
// re-checks that the tag matches package.json, so tags must be cut here rather
// than by hand — a mismatch means the version the app displays is not the version
// that was released.
//
// The script refuses rather than asks. Every guard below is a mistake that is
// either invisible until production (a tag on unpushed code) or not cleanly
// undoable at all (a reused tag).
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' }).trim()

const die = msg => {
  console.error(`release: ${msg}`)
  process.exit(1)
}

const bump = process.argv[2]
if (!bump) die('usage: pnpm release patch|minor|major|X.Y.Z')

// 1. The tag must describe committed code.
if (run('git', ['status', '--porcelain'])) {
  die('working tree is dirty — commit or stash first')
}

// 2. A tag on an unpushed commit produces a production run against a commit
//    nobody has reviewed.
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'main') die(`on branch ${branch} — releases are cut from main`)
try {
  run('git', ['fetch', '--quiet', 'origin', 'main'])
} catch {
  die('could not fetch origin/main')
}
if (run('git', ['rev-parse', 'HEAD']) !== run('git', ['rev-parse', '@{u}'])) {
  die('HEAD differs from origin/main — pull or push first')
}

// 3. Work out the next version.
const pkgPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)
const next = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`
}[bump]
const version = next || bump
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  die(`'${bump}' is neither patch|minor|major nor an X.Y.Z version`)
}
const tag = `v${version}`

// 4. A reused tag is the one mistake that cannot be undone cleanly.
try {
  run('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`])
  die(`${tag} already exists`)
} catch (err) {
  if (err.status !== 1) throw err
}

// 5. Write it back. Two-space JSON is what oxfmt produces for package.json, and
//    `pnpm lint` right after makes sure of it — otherwise the release commit
//    itself would fail lint:check in CI.
pkg.version = version
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
run('pnpm', ['lint'])

run('git', ['commit', '-am', `release: ${tag}`])
run('git', ['tag', '-a', tag, '-m', tag])

// 6. Print rather than push. One deliberate keystroke to start a production
//    pipeline is worth it. --follow-tags matters: a plain `git push` sends the
//    commit and silently drops the tag, and then nothing deploys.
console.log(
  `\nTagged ${tag}. To release:\n\n  git push origin main --follow-tags\n`
)
