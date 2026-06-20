"""
Confidence-aware, per-skill regression assessment (P2).

Replaces the old flat "subject mastery dropped ≥ 15% between two snapshots" rule, which false-fired
on a single noisy session because one bad item can move a subject aggregate. This operates on the
per-skill SERIES from the local model (mastery-svc: p, trend, recent_p, n_obs) and only flags a
regression when there is genuinely a *sustained* decline backed by enough evidence:

  - n_obs ≥ min_obs            → enough observations that the signal isn't a single fluke;
  - trend == "declining"       → the model's rolling trend, not one dip;
  - rel drop from recent peak ≥ threshold.

Confidence scales with the evidence (n_obs) and the size of the drop, so downstream consumers can
prioritise. Pure + dependency-free for exhaustive unit testing.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RegressionAssessment:
    flag: bool
    reason: str
    confidence: float
    drop: float
    rel: float


def assess_skill_regression(
    *,
    p: float,
    trend: str,
    n_obs: int,
    recent_p: list[float] | None,
    min_obs: int = 3,
    rel_drop_threshold: float = 0.15,
) -> RegressionAssessment:
    if n_obs < min_obs:
        return RegressionAssessment(False, "insufficient_observations", 0.0, 0.0, 0.0)
    if trend != "declining":
        return RegressionAssessment(False, "trend_not_declining", 0.0, 0.0, 0.0)

    peak = max(recent_p) if recent_p else p
    if peak <= 0:
        return RegressionAssessment(False, "no_signal", 0.0, 0.0, 0.0)

    drop = peak - p
    rel = drop / peak
    if rel < rel_drop_threshold:
        return RegressionAssessment(False, "below_threshold", 0.0, round(drop, 4), round(rel, 4))

    # 0.3 floor, +0.4 as observations accumulate (saturating at 6), +0.3 with the size of the drop.
    confidence = min(0.95, 0.3 + 0.4 * min(n_obs / 6.0, 1.0) + 0.3 * min(rel / 0.5, 1.0))
    return RegressionAssessment(True, "sustained_decline", round(confidence, 3), round(drop, 4), round(rel, 4))
