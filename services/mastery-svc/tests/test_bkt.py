from mastery_svc.config import params_for_subject
from mastery_svc.services import bkt


def _params(subject="math"):
    return bkt.BktParams.from_dict(params_for_subject(subject))


def test_correct_streak_is_monotonic():
    """Acceptance: BKT posterior is monotonic (non-decreasing) in a correct streak,
    strictly increasing until it saturates at the clamp ceiling."""
    params = _params()
    p = params.p_init
    prev = -1.0
    for _ in range(12):
        nxt = bkt.bkt_update(p, True, params)
        assert nxt >= p, "a correct answer must never lower mastery"
        if p < 0.99:
            assert nxt > p, "below saturation, each correct answer strictly raises mastery"
        prev, p = p, nxt
    assert p > 0.9, "a long correct streak converges toward mastered"


def test_incorrect_never_increases_mastery():
    params = _params()
    for start in (0.2, 0.5, 0.8, 0.95):
        assert bkt.bkt_update(start, False, params) <= start


def test_correct_outranks_incorrect_from_same_state():
    params = _params()
    base = 0.45
    assert bkt.bkt_update(base, True, params) > bkt.bkt_update(base, False, params)


def test_theta_is_logit_of_p():
    assert abs(bkt.theta_from_p(0.5)) < 1e-9
    assert bkt.theta_from_p(0.9) > 0
    assert bkt.theta_from_p(0.1) < 0


def test_clamp_keeps_p_in_open_interval():
    params = _params()
    p = 0.999999
    for _ in range(50):
        p = bkt.bkt_update(p, True, params)
    assert 0.0 < p < 1.0  # never saturates to exactly 0 or 1 (theta stays finite)


def test_cold_start_prior_tilts_with_difficulty():
    params = _params()
    easy = bkt.cold_start_prior(params, 0.05)
    hard = bkt.cold_start_prior(params, -0.05)
    assert easy > params.p_init > hard
