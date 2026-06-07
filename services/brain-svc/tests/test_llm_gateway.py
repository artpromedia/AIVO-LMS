"""Sprint 8: model-chain construction must not double-try the preferred model.

The old `[preferred_model] + MODEL_PRIORITY` tried the preferred model twice
when it was already in the priority list, wasting a fallback retry.
"""
from __future__ import annotations

from brain_svc.services.llm_gateway import MODEL_PRIORITY, build_model_chain


def test_no_preferred_returns_priority_copy():
    chain = build_model_chain(None)
    assert chain == MODEL_PRIORITY
    assert chain is not MODEL_PRIORITY  # a copy, not the shared list


def test_preferred_already_in_priority_is_not_duplicated():
    preferred = MODEL_PRIORITY[2]  # e.g. haiku
    chain = build_model_chain(preferred)
    assert chain[0] == preferred
    assert chain.count(preferred) == 1
    # Every priority model is still present exactly once.
    assert sorted(chain) == sorted(MODEL_PRIORITY)
    assert len(chain) == len(MODEL_PRIORITY)


def test_preferred_not_in_priority_is_prepended():
    preferred = "anthropic/claude-custom-9"
    chain = build_model_chain(preferred)
    assert chain[0] == preferred
    assert chain[1:] == MODEL_PRIORITY
    assert chain.count(preferred) == 1
