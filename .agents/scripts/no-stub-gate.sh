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

echo "✓ No stubs or placeholders detected."
