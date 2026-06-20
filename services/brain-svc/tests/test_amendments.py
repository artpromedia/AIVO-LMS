from brain_svc.services.amendments import apply_parent_modifications


def test_mastery_value_is_amended():
    mastery, acc, tut, recs = apply_parent_modifications(
        {"math": 0.5}, [], [], [{"field": "mastery_levels.math", "parent_value": 0.9}]
    )
    assert mastery["math"] == 0.9  # the stored value actually changes (P6 — was a no-op before)
    assert len(recs) == 1 and recs[0]["field"] == "mastery_levels.math"


def test_accommodation_add_and_remove():
    _m, acc, _t, _r = apply_parent_modifications(
        {}, ["a1"], [],
        [{"field": "accommodation.a2", "parent_value": True}, {"field": "accommodation.a1", "parent_value": False}],
    )
    assert acc == ["a2"]


def test_tutor_add():
    _m, _a, tut, _r = apply_parent_modifications({}, [], ["nova"], [{"field": "tutor.atlas", "parent_value": True}])
    assert tut == ["nova", "atlas"]


def test_unknown_mastery_domain_is_ignored():
    mastery, *_ = apply_parent_modifications({"math": 0.5}, [], [], [{"field": "mastery_levels.science", "parent_value": 0.9}])
    assert "science" not in mastery


def test_inputs_are_not_mutated():
    original = {"math": 0.5}
    mastery, *_ = apply_parent_modifications(original, [], [], [{"field": "mastery_levels.math", "parent_value": 0.9}])
    assert original["math"] == 0.5 and mastery["math"] == 0.9


def test_accepts_pydantic_parent_modification():
    from brain_svc.models.schemas import ParentModification

    mod = ParentModification(field="mastery_levels.math", parent_value=0.8)
    mastery, *_ = apply_parent_modifications({"math": 0.5}, [], [], [mod])
    assert mastery["math"] == 0.8
