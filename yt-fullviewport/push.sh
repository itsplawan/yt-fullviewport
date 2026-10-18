#!/usr/bin/env bash
# Stage everything, commit, and push to the current branch's remote.
# Usage: ./push.sh "commit message"      (message is optional)
set -euo pipefail
cd "$(dirname "$0")"

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit."
  exit 0
fi

VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n1)"
MSG="${*:-Update (v${VERSION:-?})}"

git commit -m "$MSG"
git push -u origin HEAD
