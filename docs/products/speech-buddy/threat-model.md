# Speech Buddy — threat model

This is the STRIDE threat model for Speech Buddy plus a **child-specific**
risks section that STRIDE alone does not cover. It is the security spec for
the agent-core, UI, and skill-graph tasks. Every entry has an owner: the task
that must implement the mitigation.

> Conventions: **L** = likelihood (1–5), **I** = impact (1–5), **R** = L × I.
> Mitigations marked _[planned]_ are explicitly owned by a downstream task.

---

## Trust boundaries

```
[Child device] ─audio/WS─► [tutor-svc /speech-buddy/sessions/:id/stream]
                                │
                                ├─► [ai-svc orchestrator + safety filter]
                                │       │
                                │       └─► [LLM provider] (external)
                                │
                                ├─► [engagement-svc skill profile]
                                │
                                └─► [comms-svc guardian channel] ──► [parent device]

[Parent / educator browser] ──► [web/mobile app] ──► [tutor-svc, family-svc]
```

The hard boundaries are: child-device ↔ tutor-svc, ai-svc ↔ external LLM,
each service ↔ the database, and any service ↔ comms-svc.

---

## STRIDE

### Spoofing

| # | Threat | L | I | R | Mitigation | Owner |
|---|--------|---|---|---|------------|-------|
| S1 | An unconsented user opens a child session by guessing/replaying a session id | 3 | 5 | 15 | Sessions are tenant-scoped, parent-consent-gated server-side; WS upgrade re-validates consent and learner ownership | UI + consent task _[planned]_ |
| S2 | A malicious party impersonates a guardian to receive escalation notifications | 2 | 5 | 10 | Guardian channel addresses come from the verified `family-svc` consent record only; never from request input | UI + consent task _[planned]_ |

### Tampering

| # | Threat | L | I | R | Mitigation | Owner |
|---|--------|---|---|---|------------|-------|
| T1 | Client tampers with WS frames to bypass the safety filter | 3 | 5 | 15 | Safety filter runs server-side on **both** input and output; no client trust | Agent-core task _[planned]_ |
| T2 | Tampered transcript blob in storage hides a flagged turn | 2 | 4 | 8  | Append-only audit log of safety decisions keyed by correlation id; transcript writes are hash-chained per session | Agent-core task _[planned]_ |

### Repudiation

| # | Threat | L | I | R | Mitigation | Owner |
|---|--------|---|---|---|------------|-------|
| R1 | A flagged turn is later disputed; no evidence the filter ran | 2 | 4 | 8  | Every safety decision is logged with correlation id, age band, and rule that fired (no transcript text in the log) | Agent-core task _[planned]_ |
| R2 | Parent disputes that they consented | 1 | 5 | 5  | Consent record is immutable + timestamped + tied to the verified parent identity | UI + consent task _[planned]_ |

### Information disclosure

| # | Threat | L | I | R | Mitigation | Owner |
|---|--------|---|---|---|------------|-------|
| I1 | Raw audio leaks via logs, traces, or storage | 4 | 5 | 20 | Hard rule: no persistent store may write raw audio; enforced by test in agent-core task | Agent-core task _[planned]_ |
| I2 | Transcript leaks across tenants | 2 | 5 | 10 | Per-tenant encryption keys; every read scoped by tenant id from JWT; integration tests cover cross-tenant attempts | Agent-core task _[planned]_ |
| I3 | LLM provider logs leak child utterances | 4 | 4 | 16 | Use a provider with contractual zero-retention; nickname tokens replace real names before any prompt leaves the cluster | Foundations + agent-core |
| I4 | A safety-flag notification reveals what the child said to the parent | 3 | 3 | 9  | Notifications carry **category + correlation id only**; transcript text is opt-in and fetched separately by the parent in-app | Agent-core + UI tasks _[planned]_ |

### Denial of service

| # | Threat | L | I | R | Mitigation | Owner |
|---|--------|---|---|---|------------|-------|
| D1 | One child's session monopolises STT/TTS budget | 3 | 3 | 9  | Per-tenant and per-learner rate limits; daily session caps server-side | Skill-graph task _[planned]_ |
| D2 | LLM provider outage breaks every session simultaneously | 3 | 4 | 12 | Document the on-device fallback plan; degrade gracefully to text-only "lite" mode | Agent-core task _[planned]_ |

### Elevation of privilege

| # | Threat | L | I | R | Mitigation | Owner |
|---|--------|---|---|---|------------|-------|
| E1 | A child account performs parent-only actions (delete transcripts, change topic toggles) | 2 | 4 | 8  | All such actions require a parent-role JWT validated server-side | UI + consent task _[planned]_ |
| E2 | A teacher in a school tenant accesses raw transcripts without per-student parent opt-in | 3 | 4 | 12 | Educator endpoints return aggregates only unless an explicit per-student parent opt-in row exists | UI + consent task _[planned]_ |

---

## Child-specific risks (beyond STRIDE)

| # | Risk | L | I | R | Mitigation | Owner |
|---|------|---|---|---|------------|-------|
| C1 | The buddy emits content inappropriate for the age band | 3 | 5 | 15 | Output safety filter + per-band prompt templates + ≥50-prompt red-team test suite | Agent-core task _[planned]_ |
| C2 | Child develops parasocial dependence on the buddy ("dark patterns") | 3 | 4 | 12 | Daily session caps server-side; no leaderboards; no infinite-scroll; explicit "go talk to a real person" mini-quest | Skill-graph task _[planned]_ |
| C3 | Child discloses abuse and the alert reaches the abusing guardian | 2 | 5 | 10 | Disclosure category routes to a moderator queue (not the guardian channel) when the disclosure names the guardian | Agent-core task _[planned]_ |
| C4 | Child shares PII (address, school) that is then stored in the transcript | 4 | 4 | 16 | PII detector scrubs transcripts at write-time; raw matched substrings are replaced with `[redacted]` | Agent-core task _[planned]_ |
| C5 | Stranger gains access to a child's session via a shared device | 2 | 4 | 8  | Parent dashboard surfaces every session start; per-session re-auth required after device idle | UI + consent task _[planned]_ |
| C6 | Child of a non-shipped locale receives an English fallback that they cannot understand | 4 | 2 | 8  | Until a locale is reviewed by a child-language reviewer, the feature flag stays OFF for that locale | Foundations (this task) + UI task |

---

## Out of scope for this threat model

- LLM provider–internal threats. Covered by the provider contract (zero
  retention, SOC 2). We log the provider name + region with each session.
- Family-svc consent storage hardening. Covered by the existing platform
  security review.
- Network transport. We rely on TLS termination at the gateway; that is
  covered by the platform threat model.

---

## Review

Initial author: agent (foundations task).
Required reviewers before the agent-core task ships: child-safety lead,
security lead. Re-review on any change to the safety filter, the consent
flow, the parent notification payload, or the educator endpoints.
