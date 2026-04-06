from __future__ import annotations

from datetime import datetime
import uuid

from app.ml.common import build_result, save_json
from app.ml.train_advanced_financial import train_advanced_fraud_model
from app.ml.train_aml_rules import train_aml_rules_engine
from app.ml.train_complaints import train_complaint_nlp_models
from app.ml.train_entities import train_entity_linkage_models
from app.ml.train_federated import train_federated_models
from app.ml.train_layered_graph import train_layered_graph_models
from app.ml.train_time_series import train_time_series_models
from app.ml.train_transactions import train_transactions_models

PIPELINE_REGISTRY = {
    "transactions": train_transactions_models,
    "layered_transactions": train_layered_graph_models,
    "entities": train_entity_linkage_models,
    "time_series": train_time_series_models,
    "complaints": train_complaint_nlp_models,
    "federated": train_federated_models,
    "aml_patterns": train_aml_rules_engine,
    "fraud_detection_financial": train_advanced_fraud_model,
}


def available_pipelines() -> list[str]:
    return list(PIPELINE_REGISTRY.keys())


def run_training(pipelines: list[str] | None = None) -> dict:
    requested_pipelines = pipelines or available_pipelines()
    unknown = [name for name in requested_pipelines if name not in PIPELINE_REGISTRY]
    if unknown:
        raise ValueError(f"Unknown pipelines: {', '.join(unknown)}")

    started_at = datetime.utcnow()
    run_id = str(uuid.uuid4())

    results: list[dict] = []
    for pipeline_name in requested_pipelines:
        trainer = PIPELINE_REGISTRY[pipeline_name]
        try:
            results.append(trainer())
        except Exception as exc:  # pragma: no cover - defensive guard
            results.append(
                build_result(
                    pipeline=pipeline_name,
                    dataset="unknown",
                    model_type="unknown",
                    status="failed",
                    rows=0,
                    notes=[f"Pipeline execution failed: {exc.__class__.__name__}: {exc}"],
                )
            )

    completed_at = datetime.utcnow()
    duration_seconds = (completed_at - started_at).total_seconds()
    succeeded = sum(1 for result in results if result.get("status") == "success")

    run_payload = {
        "run_id": run_id,
        "started_at": started_at,
        "completed_at": completed_at,
        "duration_seconds": round(duration_seconds, 3),
        "requested_pipelines": requested_pipelines,
        "succeeded": succeeded,
        "failed": len(results) - succeeded,
        "results": results,
    }

    manifest_path = save_json("training_runs", f"{run_id}.json", run_payload)
    run_payload["manifest"] = manifest_path
    return run_payload
