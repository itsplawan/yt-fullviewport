#!/usr/bin/env bash
# First-time setup: create the git repo, make the first commit, push to GitHub.
#
# Usage:
#   ./setup-github.sh                         # creates a PUBLIC repo "yt-fullviewport" with the GitHub CLI (gh)
#   ./setup-github.sh my-repo private         # custom name / visibility
#   ./setup-github.sh --url <repo-url>        # repo already created on github.com (HTTPS or SSH URL)
set -euo pipefail
cd "$(dirname "$0")"

NAME="yt-fullviewport"
VIS="public"
URL=""
if [[ "${1:-}" == "--url" ]]; then
  URL="${2:?Usage: ./setup-github.sh --url <repo-url>}"
else
  NAME="${1:-$NAME}"
  VIS="${2:-$VIS}"
fi

command -v git >/dev/null || { echo "git is not installed."; exit 1; }

if [[ -z "$(git config user.name || true)" || -z "$(git config user.email || true)" ]]; then
  echo "Set your git identity first, then run this again:"
  echo '  git config --global user.name  "Your Name"'
  echo '  git config --global user.email "you@example.com"'
  exit 1
fi

if [[ ! -d .git ]]; then
  git init -q
  git symbolic-ref HEAD refs/heads/main
fi

VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -n1)"
git add -A
if ! git diff --cached --quiet; then
  git commit -q -m "Initial commit: YT Full Viewport v${VERSION:-?}"
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "Remote 'origin' already set: $(git remote get-url origin)"
elif [[ -n "$URL" ]]; then
  git remote add origin "$URL"
elif command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh repo create "$NAME" "--$VIS" --source=. --remote=origin
else
  cat <<MSG
No remote configured, and the GitHub CLI (gh) is missing or not logged in.
Either:
  1) Create an empty repo on github.com (no README), then run:
       ./setup-github.sh --url https://github.com/<you>/${NAME}.git
  2) Or install gh, run 'gh auth login', then run this script again.
MSG
  exit 1
fi

git push -u origin main
echo
echo "Done. From now on, publish changes with:  ./push.sh \"what changed\""
