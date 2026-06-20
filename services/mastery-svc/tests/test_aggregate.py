from mastery_svc.services.aggregate import mastery_band, mean_p_by_subject


def test_mean_p_by_subject_matches_mean_of_skills():
    rows = [("math", 0.8), ("math", 0.4), ("reading", 0.6)]
    agg = mean_p_by_subject(rows)
    assert agg["math"] == 0.6  # (0.8 + 0.4) / 2 — the subject aggregate is the mean of its skills
    assert agg["reading"] == 0.6


def test_mean_p_by_subject_empty():
    assert mean_p_by_subject([]) == {}


def test_mastery_band_buckets_match_scoring_policy():
    assert mastery_band(0.10) == "not_started"
    assert mastery_band(0.30) == "emerging"
    assert mastery_band(0.50) == "approaching"
    assert mastery_band(0.80) == "on_grade_level"
    assert mastery_band(0.95) == "stretching"
    # boundaries are exclusive-upper, matching masteryLevelFromScore
    assert mastery_band(0.15) == "emerging"
    assert mastery_band(0.40) == "approaching"
    assert mastery_band(0.90) == "stretching"
