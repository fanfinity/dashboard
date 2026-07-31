#!/usr/bin/env bash
# Create an isolated worktree for one story agent.
#
#   pnpm worktree sources
#
# This is the ONLY sanctioned way to make an agent worktree. `git worktree add`
# copies tracked files only, and .env is gitignored — so a hand-made worktree has
# no Firebase config, sign-in fails, and the router's auth guard bounces every
# route to /login. That looks like "the app is broken" and tempts an agent into
# editing frozen router files. Step 2 below is what prevents it.
set -euo pipefail

SLUG="${1:-}"
if [ -z "$SLUG" ]; then
  echo "usage: pnpm worktree <slug>   (e.g. pnpm worktree sources)" >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
WT="$ROOT/.claude/worktrees/$SLUG"
BASE_REF="${BASE_REF:-phase0-baseline}"

if [ -e "$WT" ]; then
  echo "worktree already exists: $WT" >&2
  exit 1
fi

if ! git -C "$ROOT" rev-parse -q --verify "$BASE_REF" >/dev/null; then
  echo "base ref '$BASE_REF' does not exist — has Phase 0 been tagged?" >&2
  exit 1
fi

# Fork from the TAG, not from the moving integration HEAD, so every branch in a
# wave shares one base and merges stay trivial.
git -C "$ROOT" worktree add "$WT" -b "story/$SLUG" "$BASE_REF"

cp "$ROOT/.env" "$WT/.env" 2>/dev/null \
  && echo "copied .env" \
  || echo "WARNING: no .env in $ROOT — smoke tests will not be able to sign in" >&2

( cd "$WT" && pnpm install --frozen-lockfile --prefer-offline )

cat <<EOF

worktree ready
  path:   $WT
  branch: story/$SLUG   (forked from $BASE_REF)

The agent commits here and stops. It must NOT merge, push, or open a PR.
EOF
