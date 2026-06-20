# Aivo Brain — Build Prompts (post-audit)

Drafted from the four-audit consolidated verdict. Each prompt below is **self-contained**:
paste one into a fresh Claude Code session and it has the context, the real file paths,
the task, the acceptance criteria, and the guardrails it needs. They are ordered so each
builds on the last, but P4/P5/P6 are independent and can run in parallel.

The through-line of the whole backlog — and the thing you explicitly asked for — is:

> **Local Python models that link to the LLMs.**

So before the prompts, here is the architecture that makes that phrase concrete, mapped to
the code that exists today.

---

## 0. Architecture: what "local Python models that link to the LLMs" means here

Today the "brain" has **no learned models**. All seven Python services are FastAPI +
SQLAlchemy + `litellm` (hosted Claude/Gemini/GPT). "Mastery" is a per-subject float dict
(`brain_states.mastery_levels`) written by a one-line heuristic
(`clone_pipeline.py:214` → `correct/total × difficulty_multiplier`), and "ability" is a
θ→band lookup in TypeScript (`packages/scoring/src/delivery-level.ts:98`
`deliveryLevelFromTheta`). The LLM does all genuine reasoning.

The target architecture splits responsibility cleanly:

| Layer | Owns | Built with | Inspectable / approvable? |
|---|---|---|---|
| **Local model** (new) | *What* the learner knows, *what level*, *what's next* — per-skill mastery `p`, ability `θ`, trend, recommended difficulty/next-skill | Python: **BKT** first (pure NumPy, online), **DKT** later (small PyTorch LSTM, offline-trained) | **Yes** — durable state, versioned, parent approve/amend/deny |
| **LLM** (exists) | *How* to say it — generate/adapt/rewrite the actual lesson, practice, tutoring utterance | `litellm` → hosted models (`llm_gateway.py`) | No — stateless generation |

### The link is bidirectional

**Model → LLM (downstream).** The model's structured outputs become inputs to the LLM
prompt. The seam already exists:
`ai-svc/.../prompt_builder.py:484` `build_content_generation_prompt(..., delivery_level,
current_mastery, mastery_trend, ...)` and the adaptive-instructions block at
`prompt_builder.py:427-481` already consume `current_mastery`, `mastery_trend`,
`attempts`. Today those values are static/heuristic; we make them come **live from the
model**. The model decides the level and the next skill; the LLM decides the words.

**LLM → Model (upstream / closed loop).** Items the LLM generates are answered by the
learner and graded; each graded response is an **observation** POSTed back to the model,
which updates mastery online. `learning-svc/src/services/mastery-signal-emitter.ts`
already fire-and-forgets mastery movements to recommendation-svc — we add one more sink:
the model's `observe` endpoint. This is what makes "the brain improves as the learner
improves" real and **per-session** (fixing the audit's "mastery lags" gap), and it is
what makes parent approve/amend/deny meaningful: parents approve **model state changes**,
not LLM whims.

### Data already available to train/seed a model
- `assessment_attempts` (discovery adventure: correct/total, difficulty, latency per chapter)
- `brain_states.mastery_levels` + `brain_state_snapshots` (versioned history)
- `causal_analyses` (regression signals)
- `subject-brain-svc` skill graphs + misconception stores (`src/services/skill-graph-store.ts`) — the **knowledge components (KCs)** to trace mastery *per skill* instead of per subject
- `@aivo/scoring` `deliveryLevelFromTheta` — the existing θ→band mapping the model's θ output plugs into

### Recommended target service
A new **`services/mastery-svc`** (Python/FastAPI), same shape as `brain-svc`. It owns the
models and exposes a thin contract (below). brain-svc, learning-svc, and ai-svc call it.
Alternative: embed the model as a `brain_svc/models/kt/` module inside brain-svc — less
infra, but couples training/serving to the governance service. **Recommendation:** separate
`mastery-svc` so the model can be retrained/redeployed independently and so DKT's heavier
deps (torch) don't bloat brain-svc.

**Model contract (stable across BKT → DKT):**
```
POST /mastery/observe        {learner_id, skill_id, correct, difficulty, latency_ms, source}
GET  /mastery/{learner_id}                    -> {skill_id: {p, theta, trend, n_obs}}
GET  /mastery/{learner_id}/{skill_id}         -> {p, theta, trend, confidence, n_obs}
GET  /next-skill/{learner_id}/{subject}       -> {skill_id, rationale}
GET  /difficulty-target/{learner_id}/{skill_id} -> {delivery_level, theta, target_difficulty}
```

> **Repo note.** Do the model work in **AIVO-LMS** — it is the superset (it has `apps/web-v2`
> already wired to brain-svc; ENTERPRISE-READY does not). Both repos are on branch
> `claude/inspiring-turing-735fsr`. P4 is the one prompt that targets ENTERPRISE-READY's
> `apps/web`.

---

## P0 — Local mastery model (BKT) + the LLM link  ⭐ headline

> Build a real, local, Python knowledge-tracing model and wire it so it **drives the LLM's
> delivery level and adaptive instructions**, and so **graded answers flow back into it**.
> Start with Bayesian Knowledge Tracing (BKT): no GPU, no training job, updates online,
> fully inspectable — ideal for a first, parent-approvable model.
>
> **Context (verified paths, AIVO-LMS):**
> - Mastery is currently a per-subject float dict on `brain_states.mastery_levels`, written
>   by the heuristic `_compute_mastery_from_discovery` in
>   `services/brain-svc/src/brain_svc/services/clone_pipeline.py:214` (`correct/total ×
>   DIFFICULTY_MULTIPLIER`). There is no model.
> - The LLM prompt already accepts the signals we want to feed it:
>   `services/ai-svc/src/ai_svc/services/prompt_builder.py:484`
>   `build_content_generation_prompt(..., delivery_level, current_mastery, mastery_trend)`
>   and the adaptive block at `prompt_builder.py:427-481`. Called from
>   `services/ai-svc/src/ai_svc/routes/generate.py:80`.
> - Mastery movements are already emitted fire-and-forget in
>   `services/learning-svc/src/services/mastery-signal-emitter.ts`.
> - Skill graphs / KCs live in `services/subject-brain-svc/src/services/skill-graph-store.ts`.
> - θ→band mapping to reuse: `packages/scoring/src/delivery-level.ts:98` `deliveryLevelFromTheta`.
> - DB migrations: `packages/db/drizzle/*.sql` (Drizzle) and `packages/db/migrations/*.sql`.
>
> **Build:**
> 1. New service `services/mastery-svc` (FastAPI, mirror `brain-svc` layout: `src/mastery_svc/{main,auth,models,routes,services}`, `requirements.txt` with `numpy`). Add the standard internal-service-token auth (`x-internal-service` / `x-service-token`) used by `clone_pipeline.py:573`.
> 2. Implement **BKT** in `src/mastery_svc/services/bkt.py`: per-(learner, skill) state with the four BKT params (`p_init`, `p_transit`, `p_slip`, `p_guess`); `observe(correct)` does the Bayesian posterior update; expose `p_mastery` and a derived `theta` (logit of `p`). Seed per-skill priors from `subject-brain-svc` skill-graph difficulty. Keep params per-subject in a config dict so they are tunable.
> 3. Persistence: new table `learner_skill_mastery (learner_id, tenant_id, skill_id, subject, p_mastery, theta, n_obs, last_trend, updated_at)` via a new `packages/db/drizzle/` migration. Store a rolling trend (last-N delta → `rising|stable|declining`).
> 4. Implement the contract endpoints in §0 (`/observe`, `/mastery/...`, `/next-skill`, `/difficulty-target`). `/difficulty-target` returns `delivery_level` by feeding `theta` through the **same** banding logic as `deliveryLevelFromTheta` (port it or call a tiny shared helper — do not re-invent the bands).
>
> **The LLM link (this is the point):**
> 5. **Downstream:** make `learning-svc` (the lesson route that computes `grade-target.ts`/`delivery_level` and calls ai-svc `/generate`) fetch `delivery_level` + `current_mastery` + `mastery_trend` from `mastery-svc` instead of reading the static `curriculum_alignment` heuristic. The values still arrive at `prompt_builder.build_content_generation_prompt` unchanged — only their **source** changes. Keep a feature flag (`AIVO_MASTERY_MODEL_ENABLED`, default off) and fall back to the existing path when off.
> 6. **Upstream (closed loop):** when a lesson/practice item generated by the LLM is graded, POST the outcome to `mastery-svc /observe`. Add this sink alongside the existing emit in `mastery-signal-emitter.ts` (same fire-and-forget, flag-gated, never fails the lesson).
> 7. Replace the clone-time heuristic: in `clone_pipeline.py`, when the flag is on, seed `learner_skill_mastery` from the discovery results via BKT cold-start instead of `correct/total × multiplier`, and have `brain_states.mastery_levels` be a **read-through aggregate** (mean p per subject) of the per-skill rows so nothing downstream breaks.
>
> **Acceptance criteria:**
> - `mastery-svc` unit tests: BKT posterior monotonic in correct streak; θ→band agrees with `deliveryLevelFromTheta` fixtures; `/observe` is idempotent on replay of the same event id.
> - Integration test: generate a lesson with the flag ON → the `delivery_level` in the ai-svc request provably came from `mastery-svc` (assert the call), and a graded answer produces an `/observe` write that moves `p_mastery`.
> - Flag OFF reproduces today's behavior exactly (snapshot test).
> - No new hosted-LLM calls added; `llm_gateway.py` untouched.
>
> **Guardrails:** do not change the approve/amend/deny or teach-gate semantics. Model output is *advisory until approved* exactly like mastery is today — a delivery-band **raise** still routes through the existing recommendation/approval path; the model never silently promotes a learner.

---

## P1 — DKT upgrade (PyTorch) behind the same contract

> Add Deep Knowledge Tracing as a second, offline-trained model served behind the **same
> `mastery-svc` contract** as BKT, selectable per-subject by feature flag. This is the
> "Pedagogical Model (PyTorch BKT/DKT)" the PRD promised and that the k8s `training-svc
> (DKT LSTM)` config referenced but never shipped.
>
> **Context:** P0's `mastery-svc` and its contract exist. Interaction history for training
> lives in `assessment_attempts`, `brain_state_snapshots`, and the new `learner_skill_mastery`
> observation log. No torch anywhere in the repo today (verified — no ML libs in any
> `requirements.txt`).
>
> **Build:**
> 1. `services/mastery-svc/src/mastery_svc/services/dkt.py`: a small LSTM over (skill_id,
>    correct) sequences emitting next-step P(correct) per skill; derive `p_mastery`/`theta`
>    from the hidden state. Keep the input/output adapter identical to BKT so routes are
>    model-agnostic.
> 2. Offline training entrypoint `scripts/train_dkt.py` (+ a `training-svc` job or a cron):
>    reads anonymized interaction sequences, writes a versioned weight file to object storage
>    (path in config), logs AUC/accuracy. **No PII in features** — skill ids + correctness +
>    coarse latency buckets only.
> 3. Serving: load the latest approved weights at startup; `MODEL_BACKEND=bkt|dkt` per subject;
>    BKT remains the cold-start/low-data fallback (DKT only once a learner has ≥ N observations).
>
> **Acceptance criteria:** held-out next-step AUC reported and beats the BKT baseline on the
> same split; serving parity test (same contract shape as BKT); cold-start falls back to BKT;
> a model-version field is recorded on every `/observe`/read so predictions are reproducible.
>
> **Guardrails:** DKT changes *predictions*, never the governance flow. Ship behind the flag,
> dark-launch (compute but don't serve) first, compare against BKT before flipping.

---

## P2 — Per-skill mastery representation + per-session updates

> Move the brain from per-**subject** mastery to per-**skill** mastery, updated every
> session, so the brain snapshot stops lagging (audit gap: "`brain_states.mastery_levels`
> isn't rewritten per-session"). Largely delivered by P0's `learner_skill_mastery` table;
> this prompt finishes the migration and the read-model.
>
> **Context:** `brain_states.mastery_levels` is `{subject: float}`. The KCs to key on are in
> `subject-brain-svc/src/services/skill-graph-store.ts`. P0 introduced `learner_skill_mastery`
> as the system of record with a per-subject aggregate read-through.
>
> **Build:** make per-skill the canonical store; keep `brain_states.mastery_levels` as a
> derived per-subject aggregate for back-compat (anything reading it keeps working); update
> `recommendation_generator.py` and `causal_analyses` regression detection to operate on
> per-skill series (replace the flat `0.15` drop threshold with a per-skill, confidence-aware
> check); write a `mastery_threshold` snapshot trigger (the enum value already exists in
> `packages/db/src/schema/enums.ts`) when a skill crosses a mastery band.
>
> **Acceptance criteria:** a completed session moves exactly the practiced skills' rows;
> the subject aggregate matches the mean of its skills; regression detection no longer
> false-fires on a single noisy item. Back-compat snapshot test on `mastery_levels` readers.

---

## P3 — Central "master brain" + clone-link + upgrade propagation

> Build the learner-independent **master brain** the original vision describes, make each
> learner brain *derive from and stay linked to* it, and add `main_brain_upgrade`
> propagation. Today every learner brain is an independent template instantiation
> (`clone_pipeline.SEED_TEMPLATES`); there is no global brain. The schema for this is
> **already defined but dead.**
>
> **Context (verified dead schema to revive):**
> - `packages/db/src/schema/brain.ts:12` `brainSeedTemplates` (table exists, unused)
> - `packages/db/src/schema/enums.ts:92` `main_brain_upgrade` (snapshot trigger value, never emitted)
> - `packages/db/src/schema/learner-brain-profiles.ts` (`0048`), `brain-profile-approvals.ts` (`0108`), `brain-profile-changes.ts` (`0115`) — present, not wired to live brain-svc
> - Live clone path: `services/brain-svc/src/brain_svc/services/clone_pipeline.py`
>
> **Build:**
> 1. Define the **master brain** as a versioned store: the shared skill-graph + KT priors
>    (from P0/§0) + policy/accommodation templates. Back it with `brain_seed_templates`
>    (revive it) keyed by functioning level, replacing the hardcoded `SEED_TEMPLATES` dict.
> 2. On clone, record the master-brain **version** the learner brain derived from
>    (`learner_brain_profiles` revision link) so lineage is queryable.
> 3. Add a **propagation job**: when the master brain is upgraded (new skill, better KT
>    prior, revised template), emit a `main_brain_upgrade` snapshot + a *recommendation*
>    to each affected learner's parent — propagation is **opt-in via approve/amend/deny**,
>    never a silent rewrite of an approved brain.
>
> **Acceptance criteria:** a master-brain edit produces one pending recommendation per
> affected approved learner; declining leaves the learner brain untouched; approving applies
> the delta and writes a `main_brain_upgrade` snapshot with lineage. Clone reads templates
> from the store, not the Python dict (delete the dict once parity tests pass).
>
> **Guardrails:** never auto-apply a master-brain change to an approved learner brain.
> Pending learners (`pending_parent_review`) may take new defaults directly.

---

## P4 — Wire ENTERPRISE-READY `apps/web` to the real backend

> Close the audit's "biggest won't-work-for-a-real-parent-today" gap **in the
> ENTERPRISE-READY repo**, where `apps/web` renders clone-review / recommendations /
> approve-amend-deny as fixtures and `respondToRecommendation` persists nothing.
>
> **Important:** in **AIVO-LMS this is already done** — `apps/web-v2` has real BFF routes
> (`apps/web-v2/lib/services/brain-svc.ts`,
> `apps/web-v2/app/parent/learners/[learnerId]/brain-review/actions.ts`,
> `apps/web-v2/app/api/bff/learners/[learnerId]/recommendations/[recId]/respond/route.ts`).
> So this is a **port**, not a from-scratch build.
>
> **Build (in ENTERPRISE-READY, branch `claude/inspiring-turing-735fsr`):** replicate the
> web-v2 BFF pattern in `apps/web`: a `brain-svc` client, brain-review server actions, and
> the three role-scoped `recommendations/[recId]/respond` routes (parent/caregiver/teacher),
> calling the live `brain-svc`/`recommendation-svc`. Replace the no-op
> `respondToRecommendation` (`index.ts:148`) and the fixture clone-review surface. Keep the
> fail-closed teach gate (`canTeach`, `sessions.ts:277`) authoritative.
>
> **Acceptance criteria:** an E2E test where a parent approves a recommendation in `apps/web`
> → the persisted `brain_states`/recommendation status actually changes → `canTeach`
> reflects it. No surface still reads a fixture.

---

## P5 — Extend the agentic "brain proposes" path beyond math/ELA

> Make "the brain reasons → proposes an improvement" true across all subjects. Today only the
> math/ELA agentic tutor calls `propose_recommendation` (narrow: 2 subjects, 1/session,
> 3 types); everything else is rule/score-signal heuristics in
> `recommendation_generator.py`.
>
> **Context:** agentic propose lives in `services/recommendation-svc/src/routes/propose.ts`
> + `recommendation-policy.ts` + `recommendation-effect-handlers.ts`; the ai-svc agent loop
> is `services/ai-svc/src/ai_svc/agent/{loop,actions}.py`. Subject brains:
> `services/subject-brain-svc/src/services/{science,world-language,...}-subject-brain.ts`.
>
> **Build:** generalize `propose_recommendation` so every subject brain (science, world
> language, SEL, speech, executive function, …) can emit evidence-cited proposals through the
> same policy + approve/amend/deny pipeline; widen the allow-list (`agent/actions.py` allowed
> actions/tools) per subject; keep the per-session rate limit and parent-approval gate.
>
> **Acceptance criteria:** a science session can produce an evidence-cited recommendation that
> flows through the existing approval path; rate limits and dedup (`recommendation_generator`
> `_dedup_key`) still hold; no subject can self-apply without approval.

---

## P6 — Fix the small but real correctness bugs

> Three concrete defects called out by the audit:
> 1. **brain-svc `/amend` is audit-only.** In `services/brain-svc/src/brain_svc/routes/brain.py`
>    the standalone `/amend` records the audit event but does **not** mutate mastery. Make it
>    apply the amended value to `brain_states` (within the same approval contract /
>    `contracts/approval_contract.py`) and snapshot it — matching what recommendation-svc's
>    apply path already does.
> 2. **Clone timing.** Clone fires at baseline-completion, not onboarding, and leaves
>    `iep_profile`/`sensory_profile` empty (`clone_pipeline.py:512`). Decide + implement the
>    intended trigger point and backfill those profiles from intake when present.
> 3. **Aggregate lag** is resolved by P2; verify here with a regression test.
>
> **Acceptance criteria:** amending a mastery value through brain-svc `/amend` changes the
> stored value *and* writes an audit event + snapshot; a test proves `iep_profile` is
> populated at clone when intake data exists.

---

## Suggested sequencing

1. **P0** (headline — local model + LLM link; also fixes the mastery-lag root cause)
2. **P2** (finish per-skill migration — small once P0 lands)
3. **P1** (DKT — the "real ML" upgrade, once BKT is proving the loop)
4. **P3** (central master brain — the architectural heart of the original vision)
5. **P4 / P5 / P6** in parallel (independent; P4 is the ENTERPRISE-READY frontend port)

P0 is the highest-leverage start: it is the thing you asked for, it slots into seams that
already exist (`prompt_builder` inputs, `mastery-signal-emitter`, `deliveryLevelFromTheta`),
and it makes "the brain improves as the learner improves" literally true per session instead
of a heuristic.
