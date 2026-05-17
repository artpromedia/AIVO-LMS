"""Unit tests for the brain clone pipeline.

Run with: pytest services/brain-svc/tests/test_clone_pipeline.py -v
"""
from unittest.mock import MagicMock

import pytest

from brain_svc.models.schemas import (
    BrainCloneRequest,
    DiscoveryChapterResult,
    DiscoveryResults,
    ParentAssessmentData,
)
from brain_svc.services.clone_pipeline import (
    SEED_TEMPLATES,
    _build_disability_signals,
    _build_xai_explanation,
    _compute_mastery_from_discovery,
    _compute_visual_identity,
    clone_brain,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def make_chapter(domain="math", correct=8, total=10, difficulty="medium", chapter_id="c1"):
    return DiscoveryChapterResult(
        chapterId=chapter_id,
        domain=domain,
        correct=correct,
        total=total,
        avgLatencyMs=1500.0,
        difficulty=difficulty,
    )


def make_discovery(*chapters, total_correct=None, total_attempts=None):
    chapters = list(chapters)
    return DiscoveryResults(
        chapterResults=chapters,
        totalCorrect=total_correct if total_correct is not None else sum(c.correct for c in chapters),
        totalAttempts=total_attempts if total_attempts is not None else sum(c.total for c in chapters),
        xpEarned=100,
        responseLatencies=[1000.0, 2000.0, 1500.0],
    )


# ---------------------------------------------------------------------------
# _compute_mastery_from_discovery
# ---------------------------------------------------------------------------
class TestComputeMastery:
    def test_happy_path_clamped_and_difficulty_applied(self):
        template = dict(SEED_TEMPLATES["STANDARD"]["mastery_levels"])
        discovery = make_discovery(
            make_chapter(domain="math", correct=10, total=10, difficulty="hard"),
            make_chapter(domain="ela", correct=5, total=10, difficulty="medium"),
            make_chapter(domain="science", correct=2, total=10, difficulty="easy"),
        )
        result = _compute_mastery_from_discovery(discovery, template)

        # Hard difficulty: 1.0 * 1.2 = 1.2 → clamped to 1.0
        assert result["math"] == 1.0
        # Medium: 0.5 * 1.0 = 0.5
        assert result["ela"] == 0.5
        # Easy: 0.2 * 0.8 = 0.16
        assert result["science"] == pytest.approx(0.16, abs=0.001)

        # All scores in [0.0, 1.0]
        for v in result.values():
            assert 0.0 <= v <= 1.0

    def test_zero_total_skips_chapter(self):
        template = dict(SEED_TEMPLATES["STANDARD"]["mastery_levels"])
        discovery = make_discovery(
            make_chapter(domain="math", correct=0, total=0),
        )
        result = _compute_mastery_from_discovery(discovery, template)
        # math should remain at template default (0.0)
        assert result["math"] == 0.0

    def test_unknown_domain_does_not_crash(self):
        template = dict(SEED_TEMPLATES["STANDARD"]["mastery_levels"])
        discovery = make_discovery(
            make_chapter(domain="basket_weaving", correct=5, total=10),
        )
        # Should not raise; template returned mostly intact
        result = _compute_mastery_from_discovery(discovery, template)
        assert isinstance(result, dict)
        # No mastery key should have been overwritten unexpectedly
        assert all(0.0 <= v <= 1.0 for v in result.values())

    def test_domain_mapping_via_DOMAIN_TO_MASTERY(self):
        template = dict(SEED_TEMPLATES["NON_VERBAL"]["mastery_levels"])
        discovery = make_discovery(
            make_chapter(domain="speech", correct=8, total=10, difficulty="medium"),
        )
        result = _compute_mastery_from_discovery(discovery, template)
        # speech maps → communication
        assert result["communication"] == pytest.approx(0.8, abs=0.001)


# ---------------------------------------------------------------------------
# _build_disability_signals
# ---------------------------------------------------------------------------
class TestBuildDisabilitySignals:
    def test_verbal_parent_returns_empty(self):
        parent = ParentAssessmentData(
            communicationMode="verbal",
            deviceInteraction="independent",
            responseMethod="typing",
            attentionSpan="typical",
            diagnoses=[],
        )
        assert _build_disability_signals(parent) == {}

    def test_non_verbal_parent_populates_all_signals(self):
        parent = ParentAssessmentData(
            communicationMode="aac",
            deviceInteraction="partner_assisted",
            responseMethod="switch",
            attentionSpan="brief",
            diagnoses=["Autism", "Apraxia"],
        )
        signals = _build_disability_signals(parent)
        assert signals["communication_needs"] == "aac"
        assert signals["device_access"] == "partner_assisted"
        assert signals["preferred_response"] == "switch"
        assert signals["attention"] == "brief"
        assert signals["diagnoses"] == ["Autism", "Apraxia"]

    def test_none_parent_returns_empty(self):
        assert _build_disability_signals(None) == {}

    def test_age_appropriate_attention_not_flagged(self):
        parent = ParentAssessmentData(
            communicationMode="verbal",
            attentionSpan="age_appropriate",
        )
        signals = _build_disability_signals(parent)
        assert "attention" not in signals


# ---------------------------------------------------------------------------
# _build_xai_explanation
# ---------------------------------------------------------------------------
class TestBuildXaiExplanation:
    def test_all_decision_arrays_populated(self):
        template = SEED_TEMPLATES["STANDARD"]
        mastery = {"math": 0.8, "ela": 0.5}
        signals = {"communication_needs": "aac"}
        discovery = make_discovery(
            make_chapter(domain="math", correct=8, total=10, difficulty="medium"),
        )
        parent = ParentAssessmentData(communicationMode="aac", diagnoses=["Autism"])

        xai = _build_xai_explanation(
            mastery, signals, template, discovery, parent, "STANDARD"
        )
        assert len(xai["mastery_decisions"]) == 2
        assert len(xai["accommodation_decisions"]) == len(template["active_accommodations"])
        assert len(xai["tutor_decisions"]) == len(template["active_tutors"])
        assert len(xai["signal_decisions"]) == 1

    def test_rai_compliance_always_present(self):
        template = SEED_TEMPLATES["STANDARD"]
        xai = _build_xai_explanation({}, {}, template, None, None, "STANDARD")
        rai = xai["rai_compliance"]
        assert "data_sources" in rai
        assert "bias_mitigations" in rai
        assert "transparency" in rai
        assert "human_oversight" in rai
        assert len(rai["bias_mitigations"]) >= 3

    def test_data_sources_track_inputs(self):
        template = SEED_TEMPLATES["STANDARD"]
        discovery = make_discovery(make_chapter())
        parent = ParentAssessmentData(communicationMode="verbal")
        xai = _build_xai_explanation({}, {}, template, discovery, parent, "STANDARD")
        sources = xai["rai_compliance"]["data_sources"]
        assert any("Discovery" in s for s in sources)
        assert any("Parent" in s for s in sources)
        assert any("template" in s.lower() for s in sources)

    def test_mastery_reasoning_includes_score_breakdown(self):
        template = SEED_TEMPLATES["STANDARD"]
        mastery = {"math": 0.8}
        discovery = make_discovery(
            make_chapter(domain="math", correct=8, total=10, difficulty="medium"),
        )
        xai = _build_xai_explanation(mastery, {}, template, discovery, None, "STANDARD")
        decision = xai["mastery_decisions"][0]
        assert "8/10" in decision["reasoning"]
        assert decision["source"] == "discovery_adventure"


# ---------------------------------------------------------------------------
# _compute_visual_identity
# ---------------------------------------------------------------------------
class TestComputeVisualIdentity:
    def test_all_zero_mastery_returns_valid_identity(self):
        mastery = {"math": 0.0, "ela": 0.0, "science": 0.0}
        identity = _compute_visual_identity(mastery)
        assert identity["primaryHue"].startswith("#")
        assert isinstance(identity["secondaryHues"], list)
        assert identity["growthParticles"] == []  # nothing > 0.5
        assert identity["pulseRate"] == pytest.approx(0.8, abs=0.01)

    def test_high_mastery_populates_growth_particles(self):
        mastery = {"math": 0.9, "ela": 0.7, "science": 0.6}
        identity = _compute_visual_identity(mastery)
        assert len(identity["growthParticles"]) == 3
        for particle in identity["growthParticles"]:
            assert particle["intensity"] >= 0.5
            assert "color" in particle

    def test_mastery_under_threshold_excluded_from_particles(self):
        mastery = {"math": 0.4, "ela": 0.3}
        identity = _compute_visual_identity(mastery)
        assert identity["growthParticles"] == []

    def test_memory_bank_capped_at_5(self):
        mastery = {"math": 0.9}
        chapters = [
            make_chapter(domain=f"d{i}", correct=8, total=10, chapter_id=f"c{i}")
            for i in range(8)
        ]
        discovery = make_discovery(*chapters)
        identity = _compute_visual_identity(mastery, discovery)
        assert len(identity["memoryBank"]) <= 5


# ---------------------------------------------------------------------------
# clone_brain (DB mocked)
# ---------------------------------------------------------------------------
class TestCloneBrain:
    def _make_db(self, learner_row=None, existing=None):
        db = MagicMock()
        # Sequence of execute().first() calls inside clone_brain:
        # 1) check existing brain_states  → existing
        # 2) load learner row             → learner_row
        first_results = [existing, learner_row]
        execute_results = []
        for r in first_results:
            res = MagicMock()
            res.first.return_value = r
            execute_results.append(res)
        # All subsequent INSERT executes return a MagicMock
        execute_results.extend([MagicMock(), MagicMock()])
        db.execute.side_effect = execute_results
        return db

    def test_inserts_brain_state_with_correct_fields(self):
        db = self._make_db(learner_row=({"framework": "CCSS"},))
        request = BrainCloneRequest(
            learner_id="11111111-1111-1111-1111-111111111111",
            tenant_id="22222222-2222-2222-2222-222222222222",
            functioning_level="STANDARD",
        )
        result = clone_brain(db, request)

        assert "brain_state_id" in result
        assert "snapshot_id" in result
        assert result["functioning_level"] == "STANDARD"
        assert result["active_tutors"] == SEED_TEMPLATES["STANDARD"]["active_tutors"]

        # Inspect the brain_states INSERT params
        insert_brain_call = db.execute.call_args_list[2]
        params = insert_brain_call.args[1]
        assert params["lid"] == request.learner_id
        assert params["tid"] == request.tenant_id
        assert "mastery_levels" in str(insert_brain_call.args[0])
        db.commit.assert_called_once()

    def test_creates_snapshot_insert(self):
        db = self._make_db(learner_row=(None,))
        request = BrainCloneRequest(
            learner_id="11111111-1111-1111-1111-111111111111",
            tenant_id="22222222-2222-2222-2222-222222222222",
        )
        clone_brain(db, request)

        # 4th execute call is the snapshot INSERT
        snapshot_call = db.execute.call_args_list[3]
        sql_text = str(snapshot_call.args[0])
        assert "brain_state_snapshots" in sql_text
        # trigger='initial_clone' is a SQL literal in the INSERT
        assert "initial_clone" in sql_text
        params = snapshot_call.args[1]
        assert params["lid"] == request.learner_id
        assert "snap" in params  # snapshot JSON payload included

    def test_approval_status_pending_parent_review(self):
        db = self._make_db(learner_row=(None,))
        request = BrainCloneRequest(
            learner_id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            tenant_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        )
        clone_brain(db, request)
        insert_sql = str(db.execute.call_args_list[2].args[0])
        assert "pending_parent_review" in insert_sql

    def test_duplicate_learner_returns_error(self):
        db = self._make_db(existing=("existing-brain-state-id",))
        request = BrainCloneRequest(
            learner_id="11111111-1111-1111-1111-111111111111",
            tenant_id="22222222-2222-2222-2222-222222222222",
        )
        result = clone_brain(db, request)
        assert "error" in result
        assert result["brain_state_id"] == "existing-brain-state-id"
        # commit must not be called when duplicate
        db.commit.assert_not_called()

    def test_clone_with_discovery_results_computes_mastery(self):
        db = self._make_db(learner_row=(None,))
        discovery = make_discovery(
            make_chapter(domain="math", correct=10, total=10, difficulty="medium"),
        )
        request = BrainCloneRequest(
            learner_id="11111111-1111-1111-1111-111111111111",
            tenant_id="22222222-2222-2222-2222-222222222222",
            discovery_results=discovery,
        )
        result = clone_brain(db, request)
        assert result["functioning_level"] == "STANDARD"
        # visual identity should reflect non-zero mastery
        assert result["visual_identity"]["pulseRate"] > 0.8
