#!/usr/bin/env python3
"""
Offline DKT training entrypoint (P1) — the `training-svc (DKT LSTM)` job the k8s config referenced
but that never shipped. Reads anonymized interaction sequences (skill id + correctness only — NO PII),
trains the LSTM, reports held-out next-step AUC vs a per-skill-mean baseline, and writes a versioned
weight file for mastery-svc to load (DKT_WEIGHTS_PATH).

Usage:
    python scripts/train_dkt.py --out /data/ml/models/dkt-v1.pt            # synthetic (default)
    DATABASE_URL=... python scripts/train_dkt.py --from-db --out dkt.pt    # real observation log

Exits non-zero if DKT does not beat the baseline on the held-out split, so a bad model never ships.
"""
import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from mastery_svc.services import dkt  # noqa: E402


def load_sequences_from_db(database_url: str):
    """Read (learner -> ordered [(skill_id, correct)]) from mastery_observations. No PII in features."""
    from sqlalchemy import create_engine, text

    if database_url.startswith("postgres://"):
        database_url = "postgresql://" + database_url[len("postgres://"):]
    engine = create_engine(database_url)
    rows = engine.connect().execute(
        text("SELECT learner_id, skill_id, correct FROM mastery_observations ORDER BY learner_id, created_at")
    ).fetchall()
    by_learner: dict[str, list] = {}
    for learner_id, skill_id, correct in rows:
        by_learner.setdefault(str(learner_id), []).append((skill_id, bool(correct)))
    return [seq for seq in by_learner.values() if len(seq) >= 2]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.environ.get("DKT_WEIGHTS_PATH", "dkt-v1.pt"))
    ap.add_argument("--from-db", action="store_true")
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--learners", type=int, default=300)
    ap.add_argument("--hidden", type=int, default=64)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--version", default="dkt-v1")
    args = ap.parse_args()

    if not dkt.torch_available():
        print("ERROR: torch is not installed; install requirements.txt to train DKT", file=sys.stderr)
        return 2

    if args.from_db:
        database_url = os.environ.get("DATABASE_URL", "")
        if not database_url:
            print("ERROR: --from-db requires DATABASE_URL", file=sys.stderr)
            return 2
        sequences = load_sequences_from_db(database_url)
        if len(sequences) < 20:
            print(f"ERROR: too few sequences ({len(sequences)}) to train", file=sys.stderr)
            return 2
        vocab = dkt.build_vocab(sequences)
    else:
        sequences, _ = dkt.synthetic_sequences(num_learners=args.learners, seed=args.seed)
        vocab = dkt.build_vocab(sequences)

    model, metrics = dkt.train(sequences, vocab, hidden=args.hidden, epochs=args.epochs, seed=args.seed)
    print(f"training complete: {metrics}")

    if metrics["dkt_auc"] <= metrics["baseline_auc"]:
        print(
            f"ERROR: DKT AUC {metrics['dkt_auc']} did not beat baseline {metrics['baseline_auc']}; not saving.",
            file=sys.stderr,
        )
        return 1

    dkt.save_checkpoint(model, vocab, args.out, version=args.version)
    print(f"saved {args.version} -> {args.out} (skills={metrics['num_skills']})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
