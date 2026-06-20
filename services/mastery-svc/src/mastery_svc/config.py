"""
mastery-svc configuration.

The Bayesian Knowledge Tracing (BKT) parameters live here as a plain dict so they
are tunable per subject without code changes, and the whole local-model rollout is
gated behind a single feature flag so callers fall back to today's behaviour when off.
"""
import os

# ── Feature flag ─────────────────────────────────────────────────────────────
# When OFF (default), the model is dormant: learning-svc keeps reading delivery
# level from the static curriculum_alignment heuristic, mastery-signal-emitter does
# not POST observations, and clone_pipeline keeps its existing seeding. Nothing
# downstream changes until this is explicitly turned on.
def mastery_model_enabled() -> bool:
    return os.environ.get("AIVO_MASTERY_MODEL_ENABLED", "").strip().lower() in (
        "1", "true", "yes", "on", "enabled",
    )


MODEL_VERSION = "bkt-v1"

# ── BKT parameters, per canonical subject ────────────────────────────────────
#   p_init    = P(L0)  prior probability the skill is already mastered
#   p_transit = P(T)   probability of learning the skill on a given opportunity
#   p_slip    = P(S)   probability of an incorrect answer despite mastery
#   p_guess   = P(G)   probability of a correct answer without mastery
# Subjects use the canonical keys from @aivo/scoring canonicalSubjectKey
# ("reading" not "ela", "social" not "sel", …). DEFAULT covers anything unseen.
BKT_PARAMS: dict[str, dict[str, float]] = {
    "math":     {"p_init": 0.20, "p_transit": 0.12, "p_slip": 0.10, "p_guess": 0.20},
    "reading":  {"p_init": 0.25, "p_transit": 0.12, "p_slip": 0.10, "p_guess": 0.25},
    "writing":  {"p_init": 0.20, "p_transit": 0.11, "p_slip": 0.12, "p_guess": 0.20},
    "science":  {"p_init": 0.18, "p_transit": 0.11, "p_slip": 0.11, "p_guess": 0.22},
    "social":   {"p_init": 0.22, "p_transit": 0.11, "p_slip": 0.12, "p_guess": 0.22},
    "speech":   {"p_init": 0.15, "p_transit": 0.10, "p_slip": 0.14, "p_guess": 0.18},
    "DEFAULT":  {"p_init": 0.20, "p_transit": 0.10, "p_slip": 0.12, "p_guess": 0.22},
}

# Difficulty tilts only the COLD-START prior (a harder skill starts less likely
# already-mastered). The online update itself stays pure BKT so a correct streak
# is provably monotonic regardless of difficulty.
DIFFICULTY_PRIOR_DELTA: dict[str, float] = {"easy": 0.05, "medium": 0.0, "hard": -0.05}

# Rolling trend over the last N posterior values.
TREND_WINDOW = 5
TREND_EPS = 0.03


def params_for_subject(subject: str | None) -> dict[str, float]:
    if subject and subject in BKT_PARAMS:
        return BKT_PARAMS[subject]
    return BKT_PARAMS["DEFAULT"]
