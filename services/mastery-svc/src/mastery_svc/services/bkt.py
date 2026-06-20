"""
Bayesian Knowledge Tracing (BKT) — the first local mastery model.

Pure, dependency-light functions (only ``math``) so the model is fully inspectable
and exhaustively unit-testable. State per (learner, skill) is a single number:
``p`` = P(skill is mastered). Each graded answer updates ``p`` online via the
classic two-step BKT posterior:

    1. condition on the observation (was the answer correct?), accounting for
       slip (knew it, got it wrong) and guess (didn't know it, got it right);
    2. apply the learning transition (a chance the opportunity itself taught it).

``theta`` is the logit of ``p`` so it plugs straight into the existing
``deliveryLevelFromTheta`` banding policy (see services/banding.py) — the model
decides the *level*; the LLM decides the *words*.

DKT (PyTorch) will later sit behind the same contract; keep this interface stable.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

_EPS = 1e-4


def clamp01(p: float, lo: float = _EPS, hi: float = 1.0 - _EPS) -> float:
    return max(lo, min(hi, p))


@dataclass(frozen=True)
class BktParams:
    p_init: float
    p_transit: float
    p_slip: float
    p_guess: float

    @classmethod
    def from_dict(cls, d: dict) -> "BktParams":
        return cls(
            p_init=float(d["p_init"]),
            p_transit=float(d["p_transit"]),
            p_slip=float(d["p_slip"]),
            p_guess=float(d["p_guess"]),
        )


def logit(p: float) -> float:
    p = clamp01(p)
    return math.log(p / (1.0 - p))


def theta_from_p(p: float) -> float:
    """Ability estimate as the logit of mastery probability."""
    return logit(p)


def posterior_given_observation(p_l: float, correct: bool, p_slip: float, p_guess: float) -> float:
    """P(mastered | observation) — Bayes update before the learning transition."""
    if correct:
        num = p_l * (1.0 - p_slip)
        den = p_l * (1.0 - p_slip) + (1.0 - p_l) * p_guess
    else:
        num = p_l * p_slip
        den = p_l * p_slip + (1.0 - p_l) * (1.0 - p_guess)
    if den <= 0.0:
        return p_l
    return num / den


def bkt_update(p_l: float, correct: bool, params: BktParams) -> float:
    """One online BKT step → new P(mastered). Monotonic non-decreasing on a
    correct answer and non-increasing on an incorrect one (for sane params)."""
    conditioned = posterior_given_observation(p_l, correct, params.p_slip, params.p_guess)
    transitioned = conditioned + (1.0 - conditioned) * params.p_transit
    return clamp01(transitioned)


def predicted_p_correct(p_l: float, params: BktParams) -> float:
    """P(next answer correct) given current mastery — slip/guess weighted."""
    return p_l * (1.0 - params.p_slip) + (1.0 - p_l) * params.p_guess


def cold_start_prior(params: BktParams, difficulty_delta: float = 0.0) -> float:
    """Initial P(mastered) before any observation, tilted by item difficulty."""
    return clamp01(params.p_init + difficulty_delta)
