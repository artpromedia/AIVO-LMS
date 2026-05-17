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
#   /                    Hero headline + Footer trust lock badge
#                        - apps/marketing/src/components/marketing/Hero.tsx
#                          (i18n marketing.hero.title_line1 -> "Learning
#                          adventures")
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
#                        Statement") and the SOC 2 Type II audit claim that
#                        district buyers look for.
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
        "Learning adventures" \
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
        "SOC 2 Type II"
      ;;
    *)
      printf 'marketing_markers_for: unknown path %q\n' "${1:-}" >&2
      return 1
      ;;
  esac
}

# Back-compat: callers that only know about the homepage can keep using
# MARKETING_MARKERS without breaking. New callers should iterate
# MARKETING_ROUTES and call marketing_markers_for for full coverage.
# shellcheck disable=SC2034  # consumers read this array after sourcing
mapfile -t MARKETING_MARKERS < <(marketing_markers_for "/")
