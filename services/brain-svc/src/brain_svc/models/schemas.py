from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DiscoveryChapterResult(BaseModel):
    chapterId: str
    domain: str
    correct: int
    total: int
    avgLatencyMs: float = 0
    difficulty: str = "easy"

class DiscoveryResults(BaseModel):
    chapterResults: list[DiscoveryChapterResult] = []
    totalCorrect: int = 0
    totalAttempts: int = 0
    xpEarned: int = 0
    responseLatencies: list[float] = []

class ParentAssessmentData(BaseModel):
    communicationMode: Optional[str] = None
    deviceInteraction: Optional[str] = None
    responseMethod: Optional[str] = None
    attentionSpan: Optional[str] = None
    diagnoses: list = []
    responses: dict = {}

class BrainCloneRequest(BaseModel):
    learner_id: str
    tenant_id: Optional[str] = None
    assessment_id: Optional[str] = None
    functioning_level: str = "STANDARD"
    parent_assessment_id: Optional[str] = None
    iep_profile_id: Optional[str] = None
    discovery_results: Optional[DiscoveryResults] = None
    parent_assessment_data: Optional[ParentAssessmentData] = None

class BrainStateResponse(BaseModel):
    id: str
    learner_id: str
    tenant_id: str
    mastery_levels: dict
    disability_signals: dict
    functioning_level_profile: dict
    iep_profile: dict
    sensory_profile: dict
    active_accommodations: list
    active_tutors: list
    version: int
    created_at: datetime
    updated_at: datetime

class SnapshotResponse(BaseModel):
    id: str
    brain_state_id: str
    learner_id: str
    version: int
    trigger: str
    created_at: datetime

class RecommendationCreate(BaseModel):
    learner_id: str
    tenant_id: str
    type: str
    title: str
    description: Optional[str] = None
    payload: dict = {}

class RecommendationResolve(BaseModel):
    status: str
    parent_notes: Optional[str] = None

class ParentModification(BaseModel):
    field: str
    original_value: float | str | bool | None = None
    parent_value: float | str | bool | None = None
    parent_note: Optional[str] = None
    modified_at: Optional[str] = None

class BrainApproveRequest(BaseModel):
    parent_notes: Optional[str] = None
    consent_given: bool = False
    consent_version: str = "1.0"
    parent_modifications: list[ParentModification] = []
    # Sprint A4 (Brain Clone Process Animation): the parent must
    # explicitly acknowledge the Responsible-AI disclosures shown on
    # the brain-clone review page before approval is accepted. The
    # `rai_version` pins the disclosures to the clone version they
    # reviewed so a later re-clone forces a fresh acknowledgement.
    rai_acknowledged: bool = False
    rai_version: Optional[str] = None

class BrainAmendRequest(BaseModel):
    parent_notes: str
    context_additions: Optional[dict] = None
    # P6: amendments may now carry value changes (mastery_levels.<d>/accommodation.<a>/tutor.<t>),
    # not just a note — so an amendment actually mutates what gets taught, like the approve path.
    parent_modifications: list[ParentModification] = []

class BrainDeclineRequest(BaseModel):
    reason: Optional[str] = None

class BrainRollbackRequest(BaseModel):
    snapshot_id: str
