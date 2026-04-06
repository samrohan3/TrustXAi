from __future__ import annotations

import pandas as pd

from app.core.config import settings
from app.ml.common import build_result, load_csv, save_json

PIPELINE_NAME = "aml_patterns"
DATASET_PATTERNS = "aml_patterns.csv"
DATASET_TRANSACTIONS = "transactions.csv"
DATASET_LAYERED = "layered_transactions.csv"


def train_aml_rules_engine() -> dict:
    artifacts: list[str] = []
    notes: list[str] = []

    patterns = load_csv(DATASET_PATTERNS, max_rows=settings.MAX_TRAINING_ROWS)
    transactions = load_csv(DATASET_TRANSACTIONS, max_rows=settings.MAX_TRAINING_ROWS)
    layered = load_csv(DATASET_LAYERED, max_rows=settings.MAX_TRAINING_ROWS)

    if patterns.empty:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_PATTERNS,
            model_type="rule-engine",
            status="failed",
            rows=0,
            notes=["AML patterns dataset is empty."],
        )

    threshold_by_type = (
        patterns.assign(threshold=pd.to_numeric(patterns["threshold"], errors="coerce").fillna(1))
        .groupby("pattern_type")["threshold"]
        .median()
        .to_dict()
    )

    velocity_threshold = max(int(threshold_by_type.get("velocity", 6)), 1)
    smurfing_threshold = max(int(threshold_by_type.get("smurfing", 4)), 1)
    circular_threshold = max(int(threshold_by_type.get("circular", 3)), 1)
    layering_threshold = max(int(threshold_by_type.get("layering", 4)), 1)

    transactions["amount"] = pd.to_numeric(transactions["amount"], errors="coerce").fillna(0.0)
    transactions["timestamp"] = pd.to_datetime(transactions["timestamp"], errors="coerce")
    transactions = transactions.dropna(subset=["timestamp"])

    layered["layer"] = pd.to_numeric(layered["layer"], errors="coerce").fillna(0).astype(int)
    layered["amount"] = pd.to_numeric(layered["amount"], errors="coerce").fillna(0.0)

    alerts: list[dict] = []

    velocity_counts = (
        transactions.assign(hour_bucket=transactions["timestamp"].dt.floor("H"))
        .groupby(["from_account", "hour_bucket"], as_index=False)
        .size()
        .rename(columns={"size": "txn_count"})
    )
    velocity_hits = velocity_counts[velocity_counts["txn_count"] >= velocity_threshold]
    for row in velocity_hits.head(150).itertuples(index=False):
        alerts.append(
            {
                "pattern": "velocity",
                "severity": "high",
                "account": row.from_account,
                "value": int(row.txn_count),
                "threshold": velocity_threshold,
                "context": str(row.hour_bucket),
            }
        )

    smurf_amount_limit = float(max(1000.0, transactions["amount"].quantile(0.2)))
    smurfing_counts = (
        transactions[transactions["amount"] <= smurf_amount_limit]
        .assign(day=transactions["timestamp"].dt.date)
        .groupby(["from_account", "day"], as_index=False)
        .size()
        .rename(columns={"size": "small_txn_count"})
    )
    smurfing_hits = smurfing_counts[smurfing_counts["small_txn_count"] >= smurfing_threshold]
    for row in smurfing_hits.head(150).itertuples(index=False):
        alerts.append(
            {
                "pattern": "smurfing",
                "severity": "medium",
                "account": row.from_account,
                "value": int(row.small_txn_count),
                "threshold": smurfing_threshold,
                "context": str(row.day),
            }
        )

    case_layers = layered.groupby("case_id", as_index=False)["layer"].max().rename(columns={"layer": "layer_count"})
    layering_hits = case_layers[case_layers["layer_count"] >= layering_threshold]
    for row in layering_hits.head(200).itertuples(index=False):
        alerts.append(
            {
                "pattern": "layering",
                "severity": "critical" if int(row.layer_count) >= layering_threshold + 2 else "high",
                "case_id": row.case_id,
                "value": int(row.layer_count),
                "threshold": layering_threshold,
                "context": "sequential transfer depth",
            }
        )

    reverse_pairs = layered.merge(
        layered,
        left_on=["case_id", "from_account", "to_account"],
        right_on=["case_id", "to_account", "from_account"],
        suffixes=("_forward", "_reverse"),
    )
    reverse_pairs = reverse_pairs[
        reverse_pairs["from_account_forward"] < reverse_pairs["to_account_forward"]
    ]

    circular_hits = reverse_pairs.groupby("case_id", as_index=False).size().rename(columns={"size": "cycle_edges"})
    circular_hits = circular_hits[circular_hits["cycle_edges"] >= circular_threshold]
    for row in circular_hits.head(120).itertuples(index=False):
        alerts.append(
            {
                "pattern": "circular",
                "severity": "high",
                "case_id": row.case_id,
                "value": int(row.cycle_edges),
                "threshold": circular_threshold,
                "context": "bi-directional transfer loops",
            }
        )

    alert_counts = (
        pd.DataFrame(alerts).groupby("pattern").size().to_dict() if alerts else {"velocity": 0, "smurfing": 0, "layering": 0, "circular": 0}
    )

    artifacts.append(
        save_json(
            "aml_rules",
            "aml_pattern_alerts.json",
            {
                "thresholds": {
                    "velocity": velocity_threshold,
                    "smurfing": smurfing_threshold,
                    "layering": layering_threshold,
                    "circular": circular_threshold,
                },
                "alert_counts": alert_counts,
                "alerts": alerts[:500],
            },
        )
    )

    if not alerts:
        notes.append("No AML alerts triggered with current rule thresholds.")

    metrics = {
        "total_alerts": int(len(alerts)),
        "velocity_alerts": int(alert_counts.get("velocity", 0)),
        "smurfing_alerts": int(alert_counts.get("smurfing", 0)),
        "layering_alerts": int(alert_counts.get("layering", 0)),
        "circular_alerts": int(alert_counts.get("circular", 0)),
    }

    outputs = {
        "alert_counts": alert_counts,
        "sample_alerts": alerts[:60],
        "thresholds": {
            "velocity": velocity_threshold,
            "smurfing": smurfing_threshold,
            "layering": layering_threshold,
            "circular": circular_threshold,
        },
    }

    return build_result(
        pipeline=PIPELINE_NAME,
        dataset=f"{DATASET_PATTERNS} + {DATASET_TRANSACTIONS} + {DATASET_LAYERED}",
        model_type="rule-engine",
        status="success",
        rows=len(patterns),
        metrics=metrics,
        outputs=outputs,
        artifacts=artifacts,
        notes=notes,
    )
