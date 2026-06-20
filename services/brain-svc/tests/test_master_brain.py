from brain_svc.services.master_brain import (
    apply_delta_to_brain,
    classify_learners_for_upgrade,
    default_master_templates,
    delta_is_empty,
    diff_template,
)


def test_default_master_templates_cover_all_levels_with_priors():
    tpls = default_master_templates()
    for level in ("STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"):
        assert level in tpls
        assert "mastery_levels" in tpls[level]["template"]
        assert {"p_init", "p_transit", "p_slip", "p_guess"} <= set(tpls[level]["kt_priors"])


def test_diff_template_is_additive_only():
    old = {"mastery_levels": {"math": 0.0}, "active_accommodations": ["a1"], "active_tutors": ["nova"], "functional_curriculum": {}}
    new = {
        "mastery_levels": {"math": 0.0, "science": 0.0},
        "active_accommodations": ["a1", "a2"],
        "active_tutors": ["nova", "atlas"],
        "functional_curriculum": {"focus": "stem"},
    }
    delta = diff_template(old, new)
    assert delta["added_skills"] == ["science"]
    assert delta["added_accommodations"] == ["a2"]
    assert delta["added_tutors"] == ["atlas"]
    assert delta["curriculum_changes"] == {"focus": "stem"}
    assert not delta_is_empty(delta)


def test_diff_template_no_change_is_empty():
    t = {"mastery_levels": {"math": 0.0}, "active_accommodations": [], "active_tutors": [], "functional_curriculum": {}}
    assert delta_is_empty(diff_template(t, t))


def test_apply_delta_preserves_earned_mastery_and_unions_lists():
    brain = {
        "mastery_levels": {"math": 0.82},  # earned — must be preserved
        "active_accommodations": ["a1"],
        "active_tutors": ["nova"],
        "functional_curriculum": {},
    }
    delta = {
        "added_skills": ["science", "math"],  # math already present → not reset
        "added_accommodations": ["a2", "a1"],
        "added_tutors": ["atlas"],
        "curriculum_changes": {"focus": "stem"},
    }
    out = apply_delta_to_brain(brain, delta)
    assert out["mastery_levels"]["math"] == 0.82  # earned mastery untouched
    assert out["mastery_levels"]["science"] == 0.0  # new capability starts un-mastered
    assert out["active_accommodations"] == ["a1", "a2"]  # union, no duplicate
    assert out["active_tutors"] == ["nova", "atlas"]
    assert out["functional_curriculum"] == {"focus": "stem"}


def test_classify_learners_by_approval_status():
    rows = [
        {"learner_id": "L1", "approval_status": "approved"},
        {"learner_id": "L2", "approval_status": "pending_parent_review"},
        {"learner_id": "L3", "approval_status": "amended"},
    ]
    plan = classify_learners_for_upgrade(rows)
    assert plan["recommend"] == ["L1", "L3"]  # approved/amended → propose
    assert plan["apply_direct"] == ["L2"]  # pending → direct
