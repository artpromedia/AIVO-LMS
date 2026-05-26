"""Sprint 6 — IEP drafter tests.

Pin down the contract for the baseline → IEP draft pipeline:
  - prompt builder surfaces every relevant input slot
  - pydantic schema enforces SMART goal shape, accommodation whitelist,
    service-type whitelist, and 0-300 minutes per week ceiling
  - validate_iep_draft returns structured errors for hallucinated
    domains / accommodation types / service types so the route can
    retry the LLM
"""

from __future__ import annotations

import pytest

from ai_svc.services.iep_drafter import (
    IepDraftPayload,
    build_iep_draft_prompt,
    validate_iep_draft,
)


PARENT = {
    "communicationMode": "verbal",
    "functioningLevel": "SUPPORTED",
    "diagnoses": ["ADHD", "Specific Learning Disability"],
    "responses": {
        "str-1": ["math facts", "drawing"],
        "ch-1": ["reading fluency", "writing stamina"],
        "pref-1": ["Minecraft", "soccer"],
    },
}

LEARNING_PROFILE = {
    "thetaPlacement": 0.42,
    "modalityFit": [
        {"modality": "visual", "accuracy": 0.85, "n": 6},
        {"modality": "auditory", "accuracy": 0.58, "n": 5},
    ],
    "processingSpeedMs": 4500,
    "frustrationRate": 0.30,
    "frustrationTolerance": "moderate",
    "attentionRunLength": 8,
}

DOMAIN_SCORES = {
    "math": {"correct": 5, "total": 6, "difficulty": 2, "avgLatencyMs": 4200},
    "ela": {"correct": 2, "total": 6, "difficulty": 1, "avgLatencyMs": 8200},
    "science": {"correct": 4, "total": 6, "difficulty": 2, "avgLatencyMs": 5300},
}


VALID_DRAFT = {
    "summary": "Strong math performance with significant reading fluency challenges. Visual modality is the strongest learning pathway.",
    "goals": [
        {
            "domain": "ela",
            "goalText": "Will read 3rd-grade-level passages aloud at 80 wpm with 95% accuracy by end of academic year.",
            "baseline": "Currently reading 3rd-grade passages at 40 wpm with frequent decoding errors.",
            "targetCriteria": "80 wpm at 95% accuracy across 3 consecutive trials.",
            "measurableCriteria": "Weekly oral reading fluency probe (DIBELS).",
            "evidence": ["baseline ela 2/6 correct", "parent reported reading fluency challenge"],
        },
        {
            "domain": "math",
            "goalText": "Will solve two-step word problems with 90% accuracy across 4 of 5 sessions by spring.",
            "baseline": "Solves single-step problems at 85% accuracy; struggles to chain operations.",
            "targetCriteria": "90% accuracy on two-step problems.",
            "measurableCriteria": "Weekly word-problem quiz, 10 items.",
            "evidence": ["baseline math 5/6 correct — extend to two-step"],
        },
        {
            "domain": "executive_function",
            "goalText": "Will complete a 3-step writing checklist independently in 4 of 5 sessions.",
            "baseline": "Currently completes 1 step before redirection.",
            "targetCriteria": "3 steps completed without prompting in 4 of 5 sessions.",
            "measurableCriteria": "Teacher checklist tally per writing session.",
            "evidence": ["ADHD diagnosis", "writing stamina challenge"],
        },
    ],
    "accommodations": [
        {
            "type": "presentation",
            "description": "Provide visual supports + graphic organizers for all reading and writing tasks.",
            "frequency": "always",
            "rationale": "Visual modality accuracy (85%) far exceeds auditory (58%).",
            "priority": 1,
        },
        {
            "type": "timing",
            "description": "Extended time (1.5x) on reading and writing assessments.",
            "frequency": "always",
            "rationale": "Processing speed of 4500 ms is below grade-level expectation.",
            "priority": 1,
        },
    ],
    "services": [
        {
            "serviceType": "SPED",
            "minutesPerWeek": 150,
            "frequency": "weekly",
            "location": "school",
            "rationale": "Reading fluency goal requires structured literacy intervention.",
        },
    ],
    "risks": [
        "Auditory modality fit is preliminary (n=5); confirm with classroom observation.",
    ],
}


class TestPromptBuilder:
    def test_includes_strengths_challenges_diagnoses(self):
        sys, _ = build_iep_draft_prompt(
            parent_assessment=PARENT,
            learning_profile=LEARNING_PROFILE,
            domain_scores=DOMAIN_SCORES,
        )
        assert "ADHD" in sys
        assert "Specific Learning Disability" in sys
        assert "math facts" in sys
        assert "reading fluency" in sys

    def test_surfaces_learning_profile_metrics(self):
        sys, _ = build_iep_draft_prompt(
            parent_assessment=PARENT,
            learning_profile=LEARNING_PROFILE,
            domain_scores=DOMAIN_SCORES,
        )
        assert "Theta placement" in sys
        assert "visual" in sys
        assert "85%" in sys or "0.85" in sys
        assert "moderate" in sys

    def test_handles_missing_profile_gracefully(self):
        sys, _ = build_iep_draft_prompt(
            parent_assessment=PARENT,
            learning_profile=None,
            domain_scores=None,
        )
        assert "No baseline profile on file" in sys
        assert "no per-subject scores recorded" in sys

    def test_includes_existing_iep_context(self):
        iep_ctx = {
            "disabilityCategories": ["SLD"],
            "accommodations": [{"type": "presentation", "description": "extended time"}],
            "gradeLevel": "3",
        }
        sys, _ = build_iep_draft_prompt(
            parent_assessment=PARENT,
            learning_profile=LEARNING_PROFILE,
            domain_scores=DOMAIN_SCORES,
            iep_context=iep_ctx,
        )
        assert "Existing IEP Context" in sys
        assert "SLD" in sys

    def test_user_prompt_carries_strict_schema(self):
        _, user = build_iep_draft_prompt(
            parent_assessment=PARENT,
            learning_profile=LEARNING_PROFILE,
            domain_scores=DOMAIN_SCORES,
        )
        assert '"goals":' in user
        assert "SPED|SLP|OT|PT|COUNSELING|ABA|BEHAVIOUR_SUPPORT" in user
        assert "measurableCriteria" in user


class TestSchema:
    def test_happy_path(self):
        payload, errs = validate_iep_draft(VALID_DRAFT)
        assert payload is not None
        assert errs == []
        assert len(payload.goals) == 3
        assert payload.goals[0].domain == "ela"
        assert payload.accommodations[0].priority == 1

    def test_rejects_hallucinated_domain(self):
        bad = {
            **VALID_DRAFT,
            "goals": [
                {**VALID_DRAFT["goals"][0], "domain": "telekinesis"},
                VALID_DRAFT["goals"][1],
                VALID_DRAFT["goals"][2],
            ],
        }
        payload, errs = validate_iep_draft(bad)
        assert payload is None
        assert any("telekinesis" in e for e in errs)

    def test_rejects_unknown_service_type(self):
        bad = {
            **VALID_DRAFT,
            "services": [{**VALID_DRAFT["services"][0], "serviceType": "EXORCISM"}],
        }
        payload, errs = validate_iep_draft(bad)
        assert payload is None
        assert any("EXORCISM" in e for e in errs)

    def test_rejects_unknown_accommodation_type(self):
        bad = {
            **VALID_DRAFT,
            "accommodations": [
                {**VALID_DRAFT["accommodations"][0], "type": "interpretive_dance"}
            ],
        }
        payload, errs = validate_iep_draft(bad)
        assert payload is None
        assert any("interpretive_dance" in e for e in errs)

    def test_caps_service_minutes_at_600(self):
        # Schema field ge=0, le=600 — 9999 should fail at the pydantic
        # layer.
        bad = {
            **VALID_DRAFT,
            "services": [{**VALID_DRAFT["services"][0], "minutesPerWeek": 9999}],
        }
        payload, errs = validate_iep_draft(bad)
        assert payload is None

    def test_requires_minimum_3_goals(self):
        bad = {**VALID_DRAFT, "goals": VALID_DRAFT["goals"][:2]}
        payload, errs = validate_iep_draft(bad)
        assert payload is None

    def test_payload_round_trips(self):
        payload, _ = validate_iep_draft(VALID_DRAFT)
        assert payload is not None
        dumped = payload.model_dump(exclude_none=True)
        re_payload, _ = validate_iep_draft(dumped)
        assert re_payload is not None
        assert len(re_payload.goals) == 3
