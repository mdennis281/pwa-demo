#!/usr/bin/env bash
# Poll origin/<branch>; if the last successfully-deployed SHA doesn't match
# the remote tip, fetch + rebuild + restart service. Idempotent — safe to
# run on a timer. Logs go to journald via systemd.
#
# We compare against state/last-sha (last SUCCESSFUL deploy), not HEAD,
# so a half-finished/failed deploy gets retried on the next tick.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/pwa-demo/repo}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-pwa-demo}"
STATE_DIR="/opt/pwa-demo/state"
LAST_FILE="$STATE_DIR/last-sha"

cd "$REPO_DIR"
mkdir -p "$STATE_DIR"

git fetch --quiet origin "$BRANCH"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
LAST_OK_SHA="$(cat "$LAST_FILE" 2>/dev/null || true)"

if [[ "$REMOTE_SHA" == "$LAST_OK_SHA" ]]; then
  echo "up to date at $REMOTE_SHA"
  exit 0
fi

echo "deploy: ${LAST_OK_SHA:-<none>} -> $REMOTE_SHA"

git reset --hard "origin/$BRANCH"
npm ci --no-audit --no-fund
npm run build
systemctl restart "$SERVICE"

# Only mark success after the restart returns.
echo "$REMOTE_SHA" > "$LAST_FILE"
echo "deploy ok at $REMOTE_SHA"
