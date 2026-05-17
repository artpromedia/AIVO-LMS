#!/usr/bin/env bash
# One-shot push of current main (incl. uncommitted Batch 6 marketing files)
# to https://github.com/artpromedia/AIVO-LMS.git using $GITHUB_PAT.
# Never prints the PAT. Does NOT force-push.
set -euo pipefail

if [[ -z "${GITHUB_PAT:-}" ]]; then
  echo "ERROR: GITHUB_PAT secret is not set in this shell." >&2
  echo "Run from the Replit Shell (where Replit secrets are exported)." >&2
  exit 1
fi

cd "$(dirname "$0")/.."

EMAIL="50024149+artpromedia@users.noreply.github.com"
NAME="artpromedia"

# 1. Stage and commit if there are pending changes
if [[ -n "$(git status --porcelain)" ]]; then
  echo "==> Staging and committing pending changes..."
  git add -A
  git -c user.email="$EMAIL" -c user.name="$NAME" commit -m "feat(marketing): MKT-12/13/14 — blog, guides, resources, analytics, experiments, launch docs

- Add 6 long-form articles in lib/content.ts (4 blog posts + 2 guides)
- Add shared ArticleView with Article + BreadcrumbList JSON-LD
- Add /blog/[slug], /guides, /guides/[slug], /resources pages
- Extend sitemap with /guides + /resources + slug pages (de-dupe /blog)
- Layout: add WebSite + SoftwareApplication JSON-LD
- Analytics: typed events, providers, index facade (lib/analytics/)
- Experiments: lib/experiments.ts A/B framework
- App-level not-found.tsx and error.tsx
- Docs: brand-asset-manifest, funnel-map, launch-readiness-checklist"
else
  echo "==> Working tree clean; skipping commit."
fi

# 2. Configure or update the aivo-lms remote (no PAT stored on disk).
REMOTE_URL="https://github.com/artpromedia/AIVO-LMS.git"
if git remote get-url aivo-lms >/dev/null 2>&1; then
  git remote set-url aivo-lms "$REMOTE_URL"
else
  git remote add aivo-lms "$REMOTE_URL"
fi

# 3. Push main using PAT injected only for this push.
echo "==> Pushing main to aivo-lms (no force)..."
PUSH_URL="https://x-access-token:${GITHUB_PAT}@github.com/artpromedia/AIVO-LMS.git"
git push "$PUSH_URL" main:main

# 4. Verify remote HEAD == local HEAD.
LOCAL_SHA="$(git rev-parse main)"
REMOTE_SHA="$(git ls-remote "$PUSH_URL" refs/heads/main | awk '{print $1}')"
echo "==> local  main: $LOCAL_SHA"
echo "==> remote main: $REMOTE_SHA"
if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  echo "==> SUCCESS: AIVO-LMS main is in sync with local main."
else
  echo "ERROR: SHA mismatch after push." >&2
  exit 1
fi
