---
name: Baseline (Discovery Adventure) recording paths differ web vs mobile
description: Why web records per-answer but mobile posts one session at the end
---

The adaptive baseline runner records results differently on each platform, and
this is intentional — do not "unify" them onto a per-answer backend call.

- **Web (web-v2)** records each answer immediately via its own bridge. That
  per-answer write goes to **web-v2's OWN database**, not to assessment-svc. It
  exists only because the web page is stateless across reloads and needs to
  resume mid-run.
- **Mobile** runs the `@aivo/adaptive-baseline` engine fully in-memory and posts
  the whole per-item session **once at completion** via the discovery
  `/complete` BFF.

**Why:** assessment-svc exposes **no per-answer endpoint**. The discovery
`/complete` submit is the only server surface for baseline results. Mobile
keeps state in memory for the whole run, so a single grouped-by-subject submit
is the correct equivalent of the web's resumability hack.

**How to apply:** if asked to make mobile record per-answer "like web", or to
add a per-answer baseline endpoint, stop — check whether assessment-svc has
actually grown one first. Otherwise the in-memory + `/complete` pattern stays.
