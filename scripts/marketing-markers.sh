#!/usr/bin/env bash
# Shared source-of-truth for the marker strings that must appear in the
# rendered HTML of every URL the marketing-site guardrails cover.
#
# Both production smoke checks (verify-marketing-deploy.sh) and pre-merge PR
# checks (verify-marketing-build.sh) source this file so the two assertions
# can never drift apart. If a redesign legitimately drops or renames a
# marker, update it here and both checks stay in sync.
#
# Coverage (path -> required substrings, asserted case-insensitively):
#   /                    Hero headline + features section + Footer trust lock
#                        - apps/marketing/src/app/page.tsx
#                          ("A calmer, more personal way to learn" hero: the
#                          word "learn" is wrapped in a gradient span, so we
#                          assert the stable lead-in "calmer, more personal
#                          way to"; the features section heading is asserted
#                          via "Everything needed to support")
#                        - apps/marketing/src/components/marketing/Footer.tsx
#                          ("COPPA · FERPA · SOC 2")
#   /privacy-policy      apps/marketing/src/app/privacy-policy/page.tsx
#                        Must keep COPPA + FERPA references and include
#                        "Online Privacy Protection Act" (without the
#                        apostrophe, which React SSR encodes as &#x27;)
#                        so a section rename or i18n key drop can't
#                        silently blank it.
#   /coppa-compliance    apps/marketing/src/app/coppa-compliance/page.tsx
#                        Must surface the COPPA compliance contact section
#                        via "school and district inquiries" (the plain-text
#                        context around the compliance email, which Cloudflare
#                        email-obfuscation removes from the raw HTML) and the
#                        verifiable-parental-consent language required by the
#                        FTC's COPPA Rule.
#   /ferpa-compliance    apps/marketing/src/app/ferpa-compliance/page.tsx
#                        Must keep the page title ("FERPA Compliance
#                        Statement") and the "SOC 2 Trust Services Criteria"
#                        safeguards language that district buyers look for.
#
# Usage (bash):
#   source "$(dirname "$0")/marketing-markers.sh"
#   for route in "${MARKETING_ROUTES[@]}"; do
#     mapfile -t markers < <(marketing_markers_for "$route")
#     for m in "${markers[@]}"; do ... ; done
#   done

# Ordered list of paths the marketing-site guardrails must cover. Consumers
# iterate this array and call marketing_markers_for "$path" to get the
# substrings that must appear (case-insensitively) in that path's HTML.
# shellcheck disable=SC2034  # consumers read this array after sourcing
MARKETING_ROUTES=(
  "/"
  "/privacy-policy"
  "/coppa-compliance"
  "/ferpa-compliance"
)

# Print the marker strings (one per line) that must appear in the rendered
# HTML of the given path. Returns non-zero if the path is not covered, so a
# typo in a consumer script surfaces loudly instead of silently asserting
# nothing.
marketing_markers_for() {
  case "${1:-}" in
    "/")
      printf '%s\n' \
        "calmer, more personal way to" \
        "Everything needed to support" \
        "COPPA" \
        "FERPA" \
        "SOC 2"
      ;;
    "/privacy-policy")
      printf '%s\n' \
        "COPPA" \
        "FERPA" \
        "Online Privacy Protection Act"
      ;;
    "/coppa-compliance")
      printf '%s\n' \
        "school and district inquiries" \
        "verifiable parental consent"
      ;;
    "/ferpa-compliance")
      printf '%s\n' \
        "FERPA Compliance Statement" \
        "SOC 2 Trust Services Criteria"
      ;;
    *)
      printf 'marketing_markers_for: unknown path %q\n' "${1:-}" >&2
      return 1
      ;;
  esac
}

# Scan a fetched HTML body for numeric-claim citation violations.
#
# Rules enforced on the "/" (home) route:
#
#   Rule 1 — any element with data-stat-value MUST also carry data-citation on
#   the same HTML opening tag.  Content-module stats (content/claims.ts) only
#   render with data-stat-value when their source field is non-empty, so a
#   missing data-citation attribute indicates a stat was rendered without a
#   documented source.
#
#   Rule 2 — the specific efficacy claim "+47.2%" is known to be unsourced and
#   MUST NOT appear anywhere in the rendered HTML, regardless of how it got
#   there.  This guards against the claim being re-introduced outside the
#   content module.
#
# Usage:
#   mapfile -t violations < <(marketing_citation_guard "/" "/tmp/body.html")
#   (( ${#violations[@]} == 0 )) || echo "citation check failed"
#
# The function prints one violation string per line and always exits 0 so
# callers can collect the output with mapfile without set -e aborting.
# $1 = route path  $2 = path to the downloaded HTML body file
marketing_citation_guard() {
  local route="${1:-}"
  local body_file="${2:-}"

  # Citation guard is only applied to the marketing home page.
  [[ "$route" == "/" ]] || return 0

  if [[ ! -f "$body_file" ]]; then
    printf 'CITATION-GUARD %s: body file not found: %s\n' "$route" "$body_file"
    return 0
  fi

  # Rule 1 — extract every HTML opening tag that carries data-stat-value and
  # verify each one also carries data-citation.
  local tag
  while IFS= read -r tag; do
    [[ -n "$tag" ]] || continue
    if [[ "$tag" != *"data-citation="* ]]; then
      printf 'CITATION-GUARD %s: data-stat-value element missing data-citation (unsourced numeric claim rendered): %s\n' \
        "$route" "${tag:0:140}"
    fi
  done < <(grep -oE '<[^>]*data-stat-value[^>]*>' "$body_file" 2>/dev/null || true)

  # Rule 2 — the known-unsourced "+47.2%" figure must not appear in the body.
  if grep -qF '+47.2%' "$body_file" 2>/dev/null; then
    printf 'CITATION-GUARD %s: unsourced numeric claim "+47.2%%" found in rendered HTML\n' "$route"
  fi
}

# Back-compat: callers that only know about the homepage can keep using
# MARKETING_MARKERS without breaking. New callers should iterate
# MARKETING_ROUTES and call marketing_markers_for for full coverage.
# shellcheck disable=SC2034  # consumers read this array after sourcing
mapfile -t MARKETING_MARKERS < <(marketing_markers_for "/")
