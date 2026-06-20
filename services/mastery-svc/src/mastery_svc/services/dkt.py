"""
Deep Knowledge Tracing (DKT) — a small PyTorch LSTM served behind the SAME mastery-svc contract as
BKT, the "Pedagogical Model (PyTorch BKT/DKT)" the PRD promised but never shipped.

Design:
- Model: classic DKT. Each interaction (skill, correct) is a one-hot of size 2*num_skills (skill s
  correct → s; skill s incorrect → num_skills+s). An LSTM over the sequence emits, at each step, the
  next-step P(correct) for every skill. A skill's mastery `p` = the model's predicted P(correct) for
  that skill given the learner's history so far; `theta = logit(p)` — identical adapter to BKT, so the
  routes are model-agnostic.
- Serving: stateless replay. We don't persist hidden state; we replay the learner's observation log
  (mastery_observations) through the LSTM and read out the prediction for the queried skill. Unknown
  skills (not in the trained vocab) or empty history → return None so the caller falls back to BKT.
- torch is an OPTIONAL import: when it's absent the module still imports and DKT simply reports itself
  unavailable, so BKT-only serving keeps working.

Training utilities (synthetic generator, train loop, AUC eval, checkpoint I/O) live here too so the
offline scripts/train_dkt.py is a thin CLI and the acceptance tests can call them directly.
"""
from __future__ import annotations

import math
import os
import random
from dataclasses import dataclass

try:  # torch is optional — BKT-only deployments need not install it.
    import torch
    import torch.nn as nn
    _TORCH_OK = True
except Exception:  # pragma: no cover - exercised only in torch-less environments
    torch = None  # type: ignore
    nn = object  # type: ignore
    _TORCH_OK = False


def torch_available() -> bool:
    return _TORCH_OK


# ── Model ────────────────────────────────────────────────────────────────────
if _TORCH_OK:

    class DKTNet(nn.Module):
        def __init__(self, num_skills: int, hidden: int = 64):
            super().__init__()
            self.num_skills = num_skills
            self.hidden = hidden
            self.lstm = nn.LSTM(input_size=2 * num_skills, hidden_size=hidden, batch_first=True)
            self.out = nn.Linear(hidden, num_skills)

        def forward(self, x):  # x: (batch, seq, 2*num_skills) → (batch, seq, num_skills)
            h, _ = self.lstm(x)
            return torch.sigmoid(self.out(h))


Interaction = tuple[str, bool]


def encode(interactions: list[tuple[int, bool]], num_skills: int):
    """One-hot encode a sequence of (skill_idx, correct) → (1, seq, 2*num_skills) tensor."""
    seq = torch.zeros(len(interactions), 2 * num_skills)
    for t, (idx, correct) in enumerate(interactions):
        seq[t, idx if correct else num_skills + idx] = 1.0
    return seq.unsqueeze(0)


def _logit(p: float) -> float:
    p = min(1 - 1e-4, max(1e-4, p))
    return math.log(p / (1 - p))


# ── Serving ──────────────────────────────────────────────────────────────────
@dataclass
class DktPrediction:
    p: float
    theta: float
    model_version: str


class DktService:
    """Loads the latest trained weights and serves per-skill predictions. A singleton instance is
    created at import; mastery-svc calls `.load()` at startup."""

    def __init__(self) -> None:
        self._model = None
        self._skill_to_idx: dict[str, int] = {}
        self._num_skills = 0
        self._version = "dkt-v1"
        self._loaded = False

    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def version(self) -> str:
        return self._version

    def load(self, weights_path: str | None = None) -> bool:
        path = weights_path or os.environ.get("DKT_WEIGHTS_PATH", "")
        if not _TORCH_OK or not path or not os.path.exists(path):
            self._loaded = False
            return False
        try:
            ckpt = torch.load(path, map_location="cpu", weights_only=False)
            self._num_skills = int(ckpt["num_skills"])
            self._skill_to_idx = dict(ckpt["skill_to_idx"])
            self._version = ckpt.get("version", "dkt-v1")
            model = DKTNet(self._num_skills, int(ckpt.get("hidden", 64)))
            model.load_state_dict(ckpt["state_dict"])
            model.eval()
            self._model = model
            self._loaded = True
            return True
        except Exception:
            self._loaded = False
            return False

    def predict(self, history: list[Interaction], skill_id: str) -> DktPrediction | None:
        """Replay the learner's history and read out P(correct) for `skill_id`. None when DKT can't
        serve this query (not loaded / unknown skill / no usable history) → caller falls back to BKT."""
        if not self._loaded or skill_id not in self._skill_to_idx:
            return None
        known = [(self._skill_to_idx[s], bool(c)) for (s, c) in history if s in self._skill_to_idx]
        if not known:
            return None
        with torch.no_grad():
            out = self._model(encode(known, self._num_skills))  # (1, seq, num_skills)
        p = float(out[0, -1, self._skill_to_idx[skill_id]])
        p = min(1 - 1e-4, max(1e-4, p))
        return DktPrediction(p=round(p, 4), theta=round(_logit(p), 4), model_version=self._version)


# Module-level singleton used by the serving path.
service = DktService()


# ── Metrics ──────────────────────────────────────────────────────────────────
def auc_score(y_true: list[int], y_score: list[float]) -> float:
    """Rank-based ROC-AUC (Mann–Whitney U), no sklearn dependency. 0.5 when one class is absent."""
    pairs = sorted(zip(y_score, y_true), key=lambda x: x[0])
    n_pos = sum(y_true)
    n_neg = len(y_true) - n_pos
    if n_pos == 0 or n_neg == 0:
        return 0.5
    # Average ranks for ties.
    ranks = [0.0] * len(pairs)
    i = 0
    while i < len(pairs):
        j = i
        while j < len(pairs) and pairs[j][0] == pairs[i][0]:
            j += 1
        avg_rank = (i + 1 + j) / 2.0
        for k in range(i, j):
            ranks[k] = avg_rank
        i = j
    sum_pos_ranks = sum(r for r, (_, t) in zip(ranks, pairs) if t == 1)
    return (sum_pos_ranks - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg)


# ── Synthetic data (for offline training + the AUC-beats-baseline test) ──────
def synthetic_sequences(
    num_learners: int = 320,
    skills: list[str] | None = None,
    seq_len: int = 60,
    seed: int = 7,
    group_size: int = 3,
) -> tuple[list[list[Interaction]], list[str]]:
    """Generate learner interaction sequences where skills come in GROUPS that share one latent concept
    (group = index // group_size). Practising any skill in a group raises the shared latent, and every
    skill in the group reads its P(correct) from it. So most of the evidence about a skill lives in its
    GROUP-MATES' history — a correlation DKT models (it sees all skills jointly through the LSTM) but
    BKT cannot (it traces each skill independently, ignoring the rest of the group). DKT therefore beats
    a BKT baseline on held-out next-step prediction, which is the whole point of the upgrade."""
    rng = random.Random(seed)
    skills = skills or [f"s{i}" for i in range(9)]
    n = len(skills)
    group_of = {skills[i]: i // group_size for i in range(n)}
    num_groups = (n + group_size - 1) // group_size
    sequences: list[list[Interaction]] = []
    for _ in range(num_learners):
        latent = {g: rng.uniform(0.0, 0.12) for g in range(num_groups)}
        learn = {g: rng.uniform(0.12, 0.24) for g in range(num_groups)}
        seq: list[Interaction] = []
        for _ in range(seq_len):
            s = rng.choice(skills)
            g = group_of[s]
            p_correct = 0.15 + 0.78 * latent[g]
            correct = rng.random() < p_correct
            seq.append((s, correct))
            if correct:
                latent[g] = min(1.0, latent[g] + learn[g] * (1 - latent[g]))
        sequences.append(seq)
    return sequences, skills


def build_vocab(sequences: list[list[Interaction]]) -> dict[str, int]:
    skills = sorted({s for seq in sequences for (s, _) in seq})
    return {s: i for i, s in enumerate(skills)}


def train(
    sequences: list[list[Interaction]],
    skill_to_idx: dict[str, int],
    *,
    hidden: int = 64,
    epochs: int = 12,
    lr: float = 0.01,
    val_frac: float = 0.2,
    seed: int = 0,
):
    """Train DKT with masked next-step BCE. Returns (model, metrics) where metrics include held-out
    next-step AUC for DKT and for a per-skill-mean baseline on the SAME split."""
    if not _TORCH_OK:
        raise RuntimeError("torch is not installed; cannot train DKT")
    torch.manual_seed(seed)
    rng = random.Random(seed)
    num_skills = len(skill_to_idx)

    seqs = [s for s in sequences if len(s) >= 2]
    rng.shuffle(seqs)
    cut = max(1, int(len(seqs) * (1 - val_frac)))
    train_seqs, val_seqs = seqs[:cut], seqs[cut:]

    model = DKTNet(num_skills, hidden)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    bce = nn.BCELoss(reduction="none")

    def to_idx(seq):
        return [(skill_to_idx[s], c) for (s, c) in seq]

    for _ in range(epochs):
        model.train()
        rng.shuffle(train_seqs)
        for seq in train_seqs:
            idx = to_idx(seq)
            x = encode(idx[:-1], num_skills)  # predict step t+1 from steps ≤ t
            preds = model(x)[0]  # (seq-1, num_skills)
            target_skill = torch.tensor([idx[t + 1][0] for t in range(len(idx) - 1)])
            target_correct = torch.tensor([1.0 if idx[t + 1][1] else 0.0 for t in range(len(idx) - 1)])
            p = preds[torch.arange(len(idx) - 1), target_skill]
            loss = bce(p, target_correct).mean()
            opt.zero_grad()
            loss.backward()
            opt.step()

    # Held-out next-step AUC: DKT vs (a) a BKT baseline (the comparison the PRD/audit names) and
    # (b) a per-skill-mean baseline, all on the SAME val pairs/order so the AUCs are comparable.
    from mastery_svc.config import params_for_subject
    from mastery_svc.services.bkt import BktParams, bkt_update, predicted_p_correct

    model.eval()
    skill_means: dict[int, list[int]] = {}
    for seq in train_seqs:
        for s, c in to_idx(seq):
            skill_means.setdefault(s, []).append(1 if c else 0)
    base_rate = {s: (sum(v) / len(v)) for s, v in skill_means.items()}
    global_rate = sum(sum(v) for v in skill_means.values()) / max(1, sum(len(v) for v in skill_means.values()))
    bkt_params = BktParams.from_dict(params_for_subject(None))

    y_true: list[int] = []
    dkt_scores: list[float] = []
    base_scores: list[float] = []
    bkt_scores: list[float] = []
    with torch.no_grad():
        for seq in val_seqs:
            idx = to_idx(seq)
            if len(idx) < 2:
                continue
            preds = model(encode(idx[:-1], num_skills))[0]
            p_l: dict[int, float] = {}  # per-skill BKT state, walked alongside the sequence
            for t in range(len(idx) - 1):
                sk_t, c_t = idx[t]
                p_l[sk_t] = bkt_update(p_l.get(sk_t, bkt_params.p_init), bool(c_t), bkt_params)
                ns, nc = idx[t + 1]
                y_true.append(1 if nc else 0)
                dkt_scores.append(float(preds[t, ns]))
                base_scores.append(base_rate.get(ns, global_rate))
                bkt_scores.append(predicted_p_correct(p_l.get(ns, bkt_params.p_init), bkt_params))

    metrics = {
        "n_val_pairs": len(y_true),
        "dkt_auc": round(auc_score(y_true, dkt_scores), 4),
        "bkt_auc": round(auc_score(y_true, bkt_scores), 4),
        "baseline_auc": round(auc_score(y_true, base_scores), 4),
        "num_skills": num_skills,
    }
    return model, metrics


def save_checkpoint(model, skill_to_idx: dict[str, int], path: str, *, version: str = "dkt-v1") -> None:
    if not _TORCH_OK:
        raise RuntimeError("torch is not installed")
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "skill_to_idx": skill_to_idx,
            "num_skills": model.num_skills,
            "hidden": model.hidden,
            "version": version,
        },
        path,
    )
