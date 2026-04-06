from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.core.config import settings

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent


def resolve_data_dir() -> Path:
    raw = Path(settings.DATA_DIR).expanduser()
    if raw.is_absolute():
        return raw

    repo_candidate = (REPO_ROOT / raw).resolve()
    if repo_candidate.exists():
        return repo_candidate

    return (BACKEND_ROOT / raw).resolve()


def resolve_artifacts_dir() -> Path:
    raw = Path(settings.MODEL_ARTIFACTS_DIR).expanduser()
    artifact_root = raw if raw.is_absolute() else (REPO_ROOT / raw).resolve()
    artifact_root.mkdir(parents=True, exist_ok=True)
    return artifact_root


def relative_workspace_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


def get_dataset_path(file_name: str) -> Path:
    return resolve_data_dir() / file_name


def load_csv(file_name: str, max_rows: int | None = None) -> pd.DataFrame:
    dataset_path = get_dataset_path(file_name)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    nrows = max_rows if max_rows and max_rows > 0 else None
    return pd.read_csv(dataset_path, nrows=nrows)


def to_builtin(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): to_builtin(val) for key, val in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_builtin(item) for item in value]
    if isinstance(value, (np.integer, np.floating)):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    return value


def save_json(relative_dir: str, file_name: str, payload: dict[str, Any]) -> str:
    target_dir = resolve_artifacts_dir() / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / file_name

    with file_path.open("w", encoding="utf-8") as handle:
        json.dump(to_builtin(payload), handle, indent=2, default=str)

    return relative_workspace_path(file_path)


def save_joblib(relative_dir: str, file_name: str, obj: Any) -> str:
    target_dir = resolve_artifacts_dir() / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / file_name
    joblib.dump(obj, file_path)
    return relative_workspace_path(file_path)


def account_id_to_number(series: pd.Series) -> pd.Series:
    numeric = series.astype(str).str.extract(r"(\d+)", expand=False).fillna("0")
    return pd.to_numeric(numeric, errors="coerce").fillna(0.0)


def normalize_probability(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values

    min_value = float(np.min(values))
    max_value = float(np.max(values))
    spread = max_value - min_value
    if spread <= 0:
        return np.zeros_like(values)
    return (values - min_value) / spread


def build_result(
    pipeline: str,
    dataset: str,
    model_type: str,
    status: str,
    rows: int,
    metrics: dict[str, Any] | None = None,
    outputs: dict[str, Any] | None = None,
    artifacts: list[str] | None = None,
    notes: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "pipeline": pipeline,
        "dataset": dataset,
        "model_type": model_type,
        "status": status,
        "rows": int(rows),
        "metrics": to_builtin(metrics or {}),
        "outputs": to_builtin(outputs or {}),
        "artifacts": artifacts or [],
        "notes": notes or [],
    }
