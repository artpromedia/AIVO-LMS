# Speech Buddy — Agent Core

> Status: implemented in task #40. Surface stable; on-device fallback path
> documented but not yet shipped (pending UI task #41).

This document captures the production-shape of the Speech Buddy agent
core: the turn pipeline, the safety guarantees, the latency budget,
the on-device fallback plan, and the SME sign-off checklist.

---

## 1. Turn pipeline

```
child audio bytes  ─►  STT  ─►  Safety (child_input)  ─►  Planner  ─►  Safety (buddy_output)  ─►  TTS  ─►  child
                          └─ audio bytes dropped immediately after transcription ─┘
```

Each turn is wrapped in a single correlation id (`uuid4().hex`) emitted on
every log line and event. The orchestrator keeps an in-memory transcript
(text only, never bytes) and encrypts it on `end_session` per-tenant via
HKDF-SHA256-derived AES-256-GCM keys. See `encryption.py`.

Concrete entry points:

| Surface | File |
|---|---|
| FastAPI internal API | `services/ai-svc/src/ai_svc/routes/speech_buddy.py` |
| Python orchestrator | `services/ai-svc/src/ai_svc/speech_buddy/orchestrator_impl.py` |
| 3-layer safety | `services/ai-svc/src/ai_svc/speech_buddy/safety.py` |
| Toolset (scenarios/scaffolds/rubric) | `services/ai-svc/src/ai_svc/speech_buddy/tools_impl.py` |
| Event emitter | `services/ai-svc/src/ai_svc/speech_buddy/events.py` |
| Transcript encryption | `services/ai-svc/src/ai_svc/speech_buddy/encryption.py` |
| STT adapters (mock + Whisper) | `services/ai-svc/src/ai_svc/speech_buddy/stt.py` |
| TTS adapters (mock + OpenAI/litellm) | `services/ai-svc/src/ai_svc/speech_buddy/tts.py` |
| VAD + barge-in | `services/ai-svc/src/ai_svc/speech_buddy/vad.py` |
| Tutor-svc HTTP/WS routes | `services/tutor-svc/src/routes/speechBuddy.ts` |
| Family-svc consent verify | `services/family-svc/src/routes/speech-buddy-consent.ts` |
| Comms-svc safety dispatch | `services/comms-svc/src/routes/notifications.ts` (`/api/comms/internal/speech-buddy-safety`) |

State machine: `greet → pickScenario → roleplayTurn* → reflect → assignQuest → farewell`.

> Implementation note: `pickScenario` is **internal** — it runs once
> inside `start_session()` (see `orchestrator_impl.py`) and is *not*
> a runtime turn-boundary state externally observable on the WS
> stream. The runtime transitions reachable from `run_turn` are
> `greet → roleplayTurn × N → reflect → assignQuest → farewell`,
> with `N = max_roleplay_turns` (default 4, configurable on the
> orchestrator). Clients should not assume `pickScenario` will appear
> in the `nextState` field of any turn response.

---

## 2. Safety policy (operational summary)

The safety filter is three layers, gates **both** child input and buddy
output, and is invoked twice per turn:

1. **Regex blocklist** — deterministic, always-on, sub-millisecond.
2. **Keyword classifier** — heuristic; pluggable via `SafetyFilter.set_classifier`.
3. **LLM judge** — pluggable via `SafetyFilter.set_judge`. Default = a
   deterministic stub so the test suite runs offline; production wires
   this to `services/ai-svc/.../moderation_client`.

Categories:

| Category | Severity | Buddy response |
|---|---|---|
| `self_harm` | hard | crisis script (en/es), session ends, guardian + moderator paged |
| `abuse_disclosure` | hard | crisis script (en/es), session ends, guardian + moderator paged |
| `romantic_sexual` | soft → hard on 2nd hit | redirect line |
| `violence` | soft → hard on 2nd hit | redirect line |
| `medical_advice` | soft | redirect line |
| `pii` | soft | redirect line |
| `jailbreak` | soft → hard on 2nd hit | redirect line |

Hard flags emit `speech_buddy.safety.flag.raised` and (only for
`self_harm` / `abuse_disclosure`) page comms-svc with
**zero transcript text** — only correlation id, category, severity,
age band, and an anonymised learner hash.

### Red-team suite

`services/ai-svc/src/ai_svc/speech_buddy/red_team_prompts.py` ships ≥50
prompts spanning every category. The test
`tests/test_speech_buddy_safety.py::test_red_team_100pct_blocked`
asserts 100% block rate across the suite. **Removing** prompts requires
child-safety SME sign-off (see §6).

---

## 3. Privacy guarantees

The `test_raw_audio_never_persisted` test enforces:

1. No transcript line carries the raw audio bytes payload.
2. `TurnEvent` has no `bytes`/`bytearray`-typed field.
3. `SpeechBuddySession` has no `bytes`/`bytearray`-typed field.
4. The encrypted transcript ciphertext does not contain the canary bytes
   (the orchestrator drops `audio_bytes` immediately after STT and only
   stores the post-transcription text).

Tenant isolation: ciphertext bound to tenant id is associated-data /
keystream-mixed; `test_other_tenants_cannot_decrypt` flips the tenant id
and asserts decryption fails (HMAC tag mismatch on the dev fallback,
GCM auth tag mismatch on production AES-GCM).

Master key env var: `SPEECH_BUDDY_TRANSCRIPT_MASTER_KEY` (base64 or raw).
A loud warning is logged once if the dev fallback master is in use.

---

## 4. Latency budget

Acceptance bar for task #40:

> Median (p50) child end-of-utterance → first TTS audio byte **< 1.2s**
> on staging.

### In-process mock pipeline (CI)

`tests/test_speech_buddy_latency.py` exercises 30 turns through the full
orchestrator with mock STT/TTS and the heuristic planner; observed p50
on the dev container is < 5 ms. Used as a regression canary that none
of the layers introduces a sleep/blocking call.

### Real-provider staging measurement (manual)

Run with `SPEECH_BUDDY_STT_PROVIDER=whisper SPEECH_BUDDY_TTS_PROVIDER=openai`
and a real moderation judge wired in. The expected breakdown per turn:

| Stage | p50 budget | Notes |
|---|---|---|
| Browser → server (audio frames) | 30 ms | over WS, `~16 KB` per frame |
| STT (Whisper) | 350 ms | shared with the existing `transcribe.py` route |
| Safety (child_input) | 5 ms | regex+classifier dominates; judge async-batched |
| Planner | 350 ms | LLM call, streamed first-token |
| Safety (buddy_output) | 10 ms | output is short |
| TTS (OpenAI tts-1) | 250 ms | first audio byte (streamed) |
| Server → browser | 30 ms | back over the same WS |
| **Total** | **~1.05 s** | within the 1.2s budget |

p95 budget: **2.0s**. Exceeding p95 for 5 consecutive minutes triggers
an on-call page (alerting wiring lands in task #42 dashboards).

---

## 5. On-device fallback plan

When the cloud pipeline cannot meet the latency budget (poor connection,
provider outage), a pre-bundled on-device path takes over for non-safety
turns. This task ships the **interface** and the planning doc; the
on-device build itself ships in task #41 alongside the child UI.

### Components

| Layer | Cloud | On-device fallback |
|---|---|---|
| VAD | server energy heuristic | **WebRTC VAD** in the browser (`@webrtc-vad/wasm`) |
| STT | Whisper | **whisper.cpp WASM (tiny.en, 39 MB)** running in a Web Worker |
| Safety | 3-layer (regex+classifier+LLM) | **regex + classifier only** (judge unavailable) |
| Planner | server LLM | **deterministic templated planner** (same scaffolds, no novel content) |
| TTS | OpenAI | **Web Speech API `SpeechSynthesisUtterance`** with the closest matching voice |

Trigger conditions for failover (any one):

- 3 consecutive turns with `total_ms > 2500`, OR
- ai-svc returns `503` / `504`, OR
- WS reconnects > 3 times in 60 s.

Trigger condition for failback:

- 5 consecutive cloud turns under p50 budget AND ≥ 30 s have elapsed
  since the last failover.

### Safety in fallback mode

The hard categories (`self_harm`, `abuse_disclosure`) are still blocked
on-device by the regex layer alone. Because the LLM-judge layer is
unavailable, **on-device sessions are limited to 5 turns** before they
must refresh through the cloud path; this cap is enforced client-side
by the UI task and re-validated server-side once connectivity returns.

If a hard flag is raised on-device, the crisis script plays through the
Web Speech API immediately, **and** a `speech_buddy.safety.flag.raised`
event is queued to flush to the server as soon as connectivity returns.
The guardian is paged on flush — there is no scenario where a hard flag
is silently dropped.

---

## 6. SME sign-off checklist

This checklist must be ticked off (with reviewer name + date in the PR
description) for any change that:

- adds, removes, or weakens a safety regex,
- adds, removes, or relaxes a red-team prompt,
- changes the routed crisis script or redirect copy,
- adds a new locale to the routed responses.

```
[ ] Reviewer (child-safety SME): __________________________  date: __________

[ ] All red-team prompts still block (ran `pytest -k speech_buddy_safety`)
[ ] CRISIS_SCRIPT_EN / CRISIS_SCRIPT_ES still match the policy doc
    (docs/products/speech-buddy/safety.md, §"Crisis script (verbatim)")
[ ] No transcript text appears in any safety log line — only category,
    severity, layer, correlation id, session id
[ ] If the change adds a new safety category: a routed redirect string
    exists for both en + es and a new red-team prompt (≥3) covers it
[ ] If the change adds a new locale: the en/es response was translated
    by a human native speaker, NOT machine-translated
[ ] Comms-svc payload still contains zero transcript text — verified in
    `services/comms-svc/src/routes/notifications.ts` `/api/comms/internal/speech-buddy-safety`
[ ] On-device fallback regex blocklist is in sync with the server one
    (TODO: a build step in task #41 will copy `_REGEX_TABLE` into the
    bundled WASM build; until then this is a manual diff)
```

---

## 7. Internal API reference

```
POST /api/ai/speech-buddy/sessions
  Headers: x-internal-key: $INTERNAL_SERVICE_KEY
  Body: { tenantId, learnerId, ageBand, locale, consentRecordId, targetedSkills? }
  → { sessionId, ageBand, locale, nicknameToken, state, startedAt, targetedSkills }

POST /api/ai/speech-buddy/sessions/{id}/turn
  Body: { text? } | { audioBase64, mimeType? }
  → { buddyText, nextState, ended, endedReason, trace, safetyFlags, skillEvidence }

POST /api/ai/speech-buddy/sessions/{id}/end
  Body: { reason }
  → { sessionId, durationSeconds, turnCount, skillEvidenceTotals,
      badgesAwarded, reflectionPrompts, questAssigned, terminalSafetyFlag,
      transcriptCiphertext }
```

The tutor-svc public-facing routes (`/speech-buddy/sessions...`) wrap
these with child-JWT auth, the per-tenant×age-band feature flag check
(`isSpeechBuddyEnabled`), and the parent-consent gate (`verifyConsent`).
A WebSocket endpoint `/speech-buddy/sessions/:id/stream` is also
registered when `@fastify/websocket` is installed (optional dep).

---

## 8. Pending work for downstream tasks

- **#41 Child UI + consent + dashboards** — replaces the
  `SPEECH_BUDDY_DEV_CONSENTS` env stub with a real consent table on
  family-svc; ships the on-device WASM build per §5.
- **#42 Skill graph + research** — replaces the heuristic planner /
  rubric / scenario picker with the Bayesian/Elo skill graph; wires
  `engagement-svc /api/engagement/internal/speech-buddy/evidence`
  (called best-effort today; see `tools_impl.DefaultToolset.log_skill_evidence`).
