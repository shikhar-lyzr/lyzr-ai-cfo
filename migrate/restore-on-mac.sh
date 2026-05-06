#!/usr/bin/env bash
# Restore env files + Claude project memory on a Mac after cloning the repo.
#
# Usage:
#   tar -xzf lyzr-cfo-handoff-*.tar.gz -C /tmp/lyzr-handoff
#   bash /tmp/lyzr-handoff/restore-on-mac.sh /path/to/cloned/lyzr-ai-cfo

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-cloned-repo>"
  exit 1
fi

REPO_ROOT="$(cd "$1" && pwd)"
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Repo root:   $REPO_ROOT"
echo "Bundle dir:  $BUNDLE_DIR"
echo ""

# 1. Restore env files into the repo
if [ -d "$BUNDLE_DIR/env" ]; then
  echo "Restoring env files..."
  shopt -s dotglob nullglob
  for f in "$BUNDLE_DIR"/env/*; do
    cp -v "$f" "$REPO_ROOT/"
  done
  shopt -u dotglob nullglob
fi

# 2. Compute the Mac project key for Claude's memory dir.
# Claude derives the key from the absolute repo path: replace `/` with `-`,
# drop the leading slash, and prefix the result.
ABS="$REPO_ROOT"
KEY="${ABS//\//-}"   # /Users/foo/lyzr-ai-cfo -> -Users-foo-lyzr-ai-cfo
PROJECT_DIR="$HOME/.claude/projects/$KEY"
MEMORY_DST="$PROJECT_DIR/memory"

echo ""
echo "Claude project key: $KEY"
echo "Target memory dir:  $MEMORY_DST"

mkdir -p "$MEMORY_DST"

if [ -d "$BUNDLE_DIR/memory" ]; then
  echo "Restoring memory files..."
  cp -v "$BUNDLE_DIR"/memory/* "$MEMORY_DST/"
fi

echo ""
echo "Done."
echo ""
echo "Next:"
echo "  cd $REPO_ROOT"
echo "  npm install"
echo "  claude     # start a Claude Code session — memory will be loaded"
echo ""
echo "Note: some memory entries are Windows-specific (taskkill, Node orphans,"
echo "Turbopack root). They're harmless on Mac but you can delete them if you"
echo "want a cleaner index. See feedback_windows_gotchas.md and"
echo "feedback_node_orphans_after_dev_kills.md."
