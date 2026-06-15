---
name: AIVO Stage companion vs. tutor identities
description: Product decision on how the AIVO robot mascot relates to the 14 subject tutors in the learner Stage.
---

# AIVO robot is an ADDITIVE companion; the 14 tutors keep their own identities

The AIVO "Virtual Brain" robot (the friendly purple bot from the public landing
page) is a **shared brand companion** that appears in the learner Stage on both
web and mobile. It is **additive** — it does NOT replace the 14 subject tutors.

**Why:** User decision (2026-06). The 14 subject tutors are meant to get their
own distinct robot redesigns as a *separate future effort*; until then they keep
their existing faces. The AIVO robot is the constant brand presence alongside
whatever tutor is assigned, for cross-platform consistency.

**How to apply:**
- Reuse the existing transparent asset, do not regenerate: web serves it at the
  public path `/images/mascot/virtual-brain-robot.png` (same one the landing
  hero uses); mobile bundles a copy under `apps/mobile/assets/images/`.
- Treat the companion as decorative (aria-hidden / RN importantForAccessibility
  hidden) — real text + SR-labelled UI carry meaning.
- Any idle motion must be gated under Calm / high-contrast / prefers-reduced-
  motion AND the Stage's computed `motionOff` (sensory profile can force it).
- Do NOT swap the subject tutors' portraits/emoji for the generic robot. Generic
  tier placeholders (e.g. mobile's old fox/moon) are fair game to replace.
