#!/usr/bin/env bash
# Fails if forbidden stub/placeholder markers appear in production code.
#
# Refined from the naive substring scan: marker words use word boundaries so
# format masks ("XXXX-XXXX") and legit constant names ("PLACEHOLDER_SKILL_SEED")
# are not false-positives, and "not implemented" must be a real throw/raise.
# Docs (*.md) and lint-rule message strings (eslint.config.*) are excluded.
set -euo pipefail

# Real stub signals: TODO/FIXME/XXX/PLACEHOLDER as standalone markers, or an
# explicit not-implemented throw/raise.
PATTERN='\b(TODO|FIXME|XXX|PLACEHOLDER)\b|NotImplementedError|raise NotImplementedError|throw new Error\([^)]*not implemented'

EXCLUDES=(
  --glob='!**/*test*/**' --glob='!**/*.test.*' --glob='!**/fixtures/**'
  --glob='!**/*.lock' --glob='!**/pnpm-lock.yaml' --glob='!.agents/**'
  --glob='!**/skill_graphs.json' --glob='!**/*.md' --glob='!**/eslint.config.*'
)

echo "→ Scanning for stub/placeholder markers in production code…"
if rg -n --hidden "${EXCLUDES[@]}" -e "$PATTERN" services packages apps; then
  echo "✗ Stub/placeholder markers found above. Implement them fully — no shortcuts."
  exit 1
fi

echo "→ Scanning for empty Python function bodies ('pass'-only)…"
if rg -nU --glob='!**/*test*/**' -e $'def [a-zA-Z0-9_]+\\([^)]*\\):\\n\\s*pass\\s*$' services; then
  echo "✗ Empty Python function body found."
  exit 1
fi

# Fabricated BFF fallbacks (persistence-migration Global Invariant #2):
# a BFF route must surface a typed error when its upstream/DB is
# unreachable — never synthesize data with `stub: true` or a fabricated
# local id (`inc-local-…`, `maint-local-…`, `run-stub-${Date.now()}`).
BFF_PATTERN='stub:\s*true|\b(inc|maint|run)-local-|-stub-\$\{Date\.now'

# Grandfathered offenders that predate this gate. Each is owned by a later
# persistence sprint (incidents/maintenance → Sprint 4; ai evals → Sprint 7)
# and MUST be de-stubbed there. The gate still catches every NEW occurrence.
BFF_EXCLUDES=(
  --glob='!**/*test*/**' --glob='!**/*.test.*'
  --glob='!apps/web-v2/app/api/bff/admin/status/incidents/**'
  --glob='!apps/web-v2/app/api/bff/admin/status/maintenance/route.ts'
  --glob='!apps/web-v2/app/api/bff/admin/ai/evals/route.ts'
)

echo "→ Scanning for fabricated BFF fallbacks (stub:true / *-local-* ids)…"
if rg -n --hidden "${BFF_EXCLUDES[@]}" -e "$BFF_PATTERN" apps/web-v2/app; then
  echo "✗ Fabricated BFF fallback found above. Return a typed error instead — "
  echo "  no stub:true, no synthesized ids. (See README Global Invariant #2.)"
  exit 1
fi

echo "✓ No stubs or placeholders detected."
