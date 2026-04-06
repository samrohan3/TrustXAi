from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from app.core.config import settings
from app.ml.common import (
    account_id_to_number,
    build_result,
    load_csv,
    normalize_probability,
    save_joblib,
    save_json,
)

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover - optional dependency fallback
    XGBClassifier = None


DATASET_NAME = "transactions.csv"
PIPELINE_NAME = "transactions"


def _safe_auc(y_true: pd.Series, y_score: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return float("nan")
    return float(roc_auc_score(y_true, y_score))


def _prepare_transactions_frame(frame: pd.DataFrame) -> pd.DataFrame:
    prepared = frame.copy()
    prepared["amount"] = pd.to_numeric(prepared["amount"], errors="coerce").fillna(0.0)
    prepared["timestamp"] = pd.to_datetime(prepared["timestamp"], errors="coerce")
    prepared["hour"] = prepared["timestamp"].dt.hour.fillna(0).astype(int)
    prepared["day_of_week"] = prepared["timestamp"].dt.dayofweek.fillna(0).astype(int)
    prepared["is_weekend"] = prepared["day_of_week"].isin([5, 6]).astype(int)
    prepared["from_account_num"] = account_id_to_number(prepared["from_account"])
    prepared["to_account_num"] = account_id_to_number(prepared["to_account"])
    prepared["is_fraud"] = pd.to_numeric(prepared["is_fraud"], errors="coerce").fillna(0).astype(int)
    prepared["transaction_type"] = prepared["transaction_type"].fillna("unknown")
    return prepared


def _build_preprocessor(categorical_features: list[str], numeric_features: list[str]) -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
            ("numeric", "passthrough", numeric_features),
        ]
    )


def train_transactions_models() -> dict:
    notes: list[str] = []
    artifacts: list[str] = []

    frame = load_csv(DATASET_NAME, max_rows=settings.MAX_TRAINING_ROWS)
    prepared = _prepare_transactions_frame(frame)

    if prepared.empty:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="hybrid-supervised-unsupervised",
            status="failed",
            rows=0,
            notes=["Dataset is empty."],
        )

    if prepared["is_fraud"].nunique() < 2:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="hybrid-supervised-unsupervised",
            status="failed",
            rows=len(prepared),
            notes=["Training requires both fraud and non-fraud labels in is_fraud."],
        )

    categorical_features = ["transaction_type"]
    numeric_features = ["amount", "hour", "day_of_week", "is_weekend", "from_account_num", "to_account_num"]
    feature_columns = categorical_features + numeric_features

    X = prepared[feature_columns]
    y = prepared["is_fraud"]
    tx_ids = prepared["transaction_id"].astype(str)

    X_train, X_test, y_train, y_test, _ids_train, ids_test = train_test_split(
        X,
        y,
        tx_ids,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    preprocessor = _build_preprocessor(categorical_features, numeric_features)

    rf_pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=180,
                    max_depth=10,
                    random_state=42,
                    class_weight="balanced",
                    n_jobs=1,
                ),
            ),
        ]
    )
    rf_pipeline.fit(X_train, y_train)
    rf_probs = rf_pipeline.predict_proba(X_test)[:, 1]
    rf_auc = _safe_auc(y_test, rf_probs)

    best_model_name = "random_forest"
    best_pipeline = rf_pipeline
    best_probs = rf_probs
    best_auc = rf_auc

    model_metrics: dict[str, float] = {"random_forest_auc": rf_auc}

    if XGBClassifier is not None:
        xgb_pipeline = Pipeline(
            steps=[
                ("preprocessor", _build_preprocessor(categorical_features, numeric_features)),
                (
                    "classifier",
                    XGBClassifier(
                        n_estimators=220,
                        max_depth=6,
                        learning_rate=0.08,
                        subsample=0.9,
                        colsample_bytree=0.9,
                        objective="binary:logistic",
                        eval_metric="logloss",
                        random_state=42,
                        n_jobs=1,
                    ),
                ),
            ]
        )
        xgb_pipeline.fit(X_train, y_train)
        xgb_probs = xgb_pipeline.predict_proba(X_test)[:, 1]
        xgb_auc = _safe_auc(y_test, xgb_probs)
        model_metrics["xgboost_auc"] = xgb_auc

        rf_compare = -1.0 if np.isnan(rf_auc) else float(rf_auc)
        xgb_compare = -1.0 if np.isnan(xgb_auc) else float(xgb_auc)
        if xgb_compare > rf_compare:
            best_model_name = "xgboost"
            best_pipeline = xgb_pipeline
            best_probs = xgb_probs
            best_auc = xgb_auc
    else:
        notes.append("xgboost is not installed. Used RandomForest as the supervised model.")

    contamination = float(np.clip(y_train.mean(), 0.01, 0.25))
    scaler = StandardScaler()
    train_scaled = scaler.fit_transform(X_train[numeric_features])

    iso_model = IsolationForest(
        n_estimators=220,
        contamination=contamination,
        random_state=42,
    )
    iso_model.fit(train_scaled)

    test_scaled = scaler.transform(X_test[numeric_features])
    iso_raw_scores = -iso_model.decision_function(test_scaled)
    iso_probs = normalize_probability(iso_raw_scores)

    risk_scores = (0.7 * best_probs) + (0.3 * iso_probs)
    risk_labels = (risk_scores >= 0.5).astype(int)

    precision, recall, f1, _ = precision_recall_fscore_support(y_test, risk_labels, average="binary", zero_division=0)
    accuracy = accuracy_score(y_test, risk_labels)

    sample_risk_scores = []
    for txn_id, risk, label in zip(ids_test.iloc[:25], risk_scores[:25], risk_labels[:25]):
        sample_risk_scores.append(
            {
                "transaction_id": str(txn_id),
                "risk_score": round(float(risk), 4),
                "prediction": "fraud" if int(label) == 1 else "normal",
            }
        )

    bundle_artifact = save_joblib(
        "transactions",
        "hybrid_transaction_models.joblib",
        {
            "best_supervised_model": best_model_name,
            "supervised_pipeline": best_pipeline,
            "isolation_model": iso_model,
            "isolation_scaler": scaler,
            "numeric_features": numeric_features,
            "categorical_features": categorical_features,
            "risk_threshold": 0.5,
        },
    )
    artifacts.append(bundle_artifact)

    summary_artifact = save_json(
        "transactions",
        "training_summary.json",
        {
            "best_supervised_model": best_model_name,
            "best_supervised_auc": best_auc,
            "metrics": {
                "accuracy": accuracy,
                "precision": precision,
                "recall": recall,
                "f1": f1,
                **model_metrics,
            },
            "sample_risk_scores": sample_risk_scores,
        },
    )
    artifacts.append(summary_artifact)

    metrics = {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "hybrid_positive_rate": float(np.mean(risk_labels)),
        "best_supervised_auc": float(best_auc),
        **model_metrics,
    }

    outputs = {
        "best_supervised_model": best_model_name,
        "risk_threshold": 0.5,
        "sample_risk_scores": sample_risk_scores,
    }

    return build_result(
        pipeline=PIPELINE_NAME,
        dataset=DATASET_NAME,
        model_type="isolation-forest + random-forest/xgboost",
        status="success",
        rows=len(prepared),
        metrics=metrics,
        outputs=outputs,
        artifacts=artifacts,
        notes=notes,
    )
