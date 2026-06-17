---
name: web-v2 hardcoded-hex eslint rule scope
description: Why some web-v2 components can use raw hex colors and others cannot (flat-config override quirk)
---

The root `eslint.config.mjs` bans hardcoded hex colors (`no-restricted-syntax`)
across the web-v2/marketing apps so all surface colors flow through `iw-*`
tokens.

**The durable gotcha:** ESLint flat config *replaces* (does not merge)
array-valued rule options when a later block re-declares the same rule for an
overlapping glob. A later block re-declares `no-restricted-syntax` (for an
unrelated bare-fetch selector) scoped to a subset of component dirs, which
silently drops the hex ban for *those* dirs only. So two visually-identical
files can lint differently purely based on which config block their path
matches — "the other file does it" is not evidence a pattern is allowed.

**Why it matters:** decorative SVG artwork legitimately needs a fixed palette.
If you add such art *outside* the exempted dirs (e.g. `components/auth/`), add a
file-level `/* eslint-disable no-restricted-syntax -- fixed decorative SVG
artwork ... */` (see `components/auth/cloud-mascot.tsx`). Real surface *chrome*
must still use `iw-*` tokens — never disable the rule for chrome.

**How to apply:** before assuming a web-v2 file is hex-exempt, check which
config block its path matches; do not rely on "the other mascot does it."
`apps/web-admin` has no hex rule at all (separate app, own config).
