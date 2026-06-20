from brain_svc.services.regression import assess_skill_regression


def test_single_noisy_item_does_not_false_fire():
    """The core P2 fix: one bad answer (n_obs below the floor) never flags a regression."""
    r = assess_skill_regression(p=0.30, trend="declining", n_obs=1, recent_p=[0.80, 0.30])
    assert r.flag is False
    assert r.reason == "insufficient_observations"


def test_one_dip_with_non_declining_trend_does_not_fire():
    r = assess_skill_regression(p=0.55, trend="stable", n_obs=8, recent_p=[0.6, 0.58, 0.55])
    assert r.flag is False
    assert r.reason == "trend_not_declining"


def test_sustained_decline_flags_with_scaled_confidence():
    r = assess_skill_regression(p=0.50, trend="declining", n_obs=6, recent_p=[0.80, 0.74, 0.66, 0.58, 0.50])
    assert r.flag is True
    assert r.reason == "sustained_decline"
    assert 0.3 < r.confidence <= 0.95
    assert r.drop == 0.30  # 0.80 peak → 0.50


def test_declining_but_tiny_drop_below_threshold():
    r = assess_skill_regression(p=0.78, trend="declining", n_obs=5, recent_p=[0.80, 0.79, 0.78])
    assert r.flag is False
    assert r.reason == "below_threshold"


def test_more_evidence_and_bigger_drop_raise_confidence():
    small = assess_skill_regression(p=0.55, trend="declining", n_obs=3, recent_p=[0.70, 0.55])
    big = assess_skill_regression(p=0.20, trend="declining", n_obs=10, recent_p=[0.85, 0.20])
    assert big.flag and small.flag
    assert big.confidence > small.confidence
