from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from app.core.config import settings
from app.ml.common import build_result, load_csv, save_joblib, save_json

try:
    from xgboost import XGBClassifier
except Exception:  # pragma: no cover - optional dependency fallback
    XGBClassifier = None


DATASET_NAME = "fraud_detection_financial.csv"
PIPELINE_NAME = "fraud_detection_financial"


def _safe_auc(y_true: pd.Series, y_score: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return float("nan")
    return float(roc_auc_score(y_true, y_score))


def train_advanced_fraud_model() -> dict:
    artifacts: list[str] = []
    notes: list[str] = []

    frame = load_csv(DATASET_NAME, max_rows=settings.MAX_TRAINING_ROWS)

    if frame.empty:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="advanced-classifier",
            status="failed",
            rows=0,
            notes=["Dataset is empty."],
        )

    if "isFraud" in frame.columns:
        target_column = "isFraud"
    elif "is_fraud" in frame.columns:
        target_column = "is_fraud"
    else:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="advanced-classifier",
            status="failed",
            rows=len(frame),
            notes=["Could not find target column isFraud/is_fraud."],
        )

    frame[target_column] = pd.to_numeric(frame[target_column], errors="coerce").fillna(0).astype(int)

    if frame[target_column].nunique() < 2:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="advanced-classifier",
            status="failed",
            rows=len(frame),
            notes=["Both classes are required in target labels."],
        )

    X = frame.drop(columns=[target_column])
    y = frame[target_column]

    categorical_features = [column for column in X.columns if X[column].dtype == "object"]
    numeric_features = [column for column in X.columns if column not in categorical_features]

    for column in numeric_features:
        X[column] = pd.to_numeric(X[column], errors="coerce").fillna(0.0)

    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
            ("numeric", "passthrough", numeric_features),
        ]
    )

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    rf_pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=220,
                    max_depth=12,
                    class_weight="balanced",
                    random_state=42,
                    n_jobs=1,
                ),
            ),
        ]
    )
    rf_pipeline.fit(X_train, y_train)
    rf_probs = rf_pipeline.predict_proba(X_test)[:, 1]
    rf_auc = _safe_auc(y_test, rf_probs)

    best_name = "random_forest"
    best_pipeline = rf_pipeline
    best_probs = rf_probs
    best_auc = rf_auc

    benchmark = {
        "random_forest_auc": rf_auc,
    }

    if XGBClassifier is not None:
        xgb_pipeline = Pipeline(
            steps=[
                (
                    "preprocessor",
                    ColumnTransformer(
                        transformers=[
                            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
                            ("numeric", "passthrough", numeric_features),
                        ]
                    ),
                ),
                (
                    "classifier",
                    XGBClassifier(
                        n_estimators=260,
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
        benchmark["xgboost_auc"] = xgb_auc

        rf_compare = -1.0 if np.isnan(rf_auc) else float(rf_auc)
        xgb_compare = -1.0 if np.isnan(xgb_auc) else float(xgb_auc)
        if xgb_compare > rf_compare:
            best_name = "xgboost"
            best_pipeline = xgb_pipeline
            best_probs = xgb_probs
            best_auc = xgb_auc
    else:
        notes.append("xgboost is not installed. Used RandomForest as fallback.")

    predictions = (best_probs >= 0.5).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, predictions, average="binary", zero_division=0)
    accuracy = accuracy_score(y_test, predictions)

    artifacts.append(
        save_joblib(
            "fraud_detection_financial",
            "advanced_fraud_model.joblib",
            {
                "model_name": best_name,
                "pipeline": best_pipeline,
                "threshold": 0.5,
                "target_column": target_column,
            },
        )
    )

    sample_predictions = []
    for probability, label in zip(best_probs[:30], predictions[:30]):
        sample_predictions.append(
            {
                "fraud_probability": round(float(probability), 4),
                "prediction": "fraud" if int(label) == 1 else "normal",
            }
        )

    artifacts.append(
        save_json(
            "fraud_detection_financial",
            "advanced_outputs.json",
            {
                "best_model": best_name,
                "benchmark": benchmark,
                "sample_predictions": sample_predictions,
            },
        )
    )

    metrics = {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "best_auc": float(best_auc),
        **benchmark,
    }

    outputs = {
        "best_model": best_name,
        "sample_predictions": sample_predictions,
    }

    return build_result(
        pipeline=PIPELINE_NAME,
        dataset=DATASET_NAME,
        model_type="xgboost/random-forest",
        status="success",
        rows=len(frame),
        metrics=metrics,
        outputs=outputs,
        artifacts=artifacts,
        notes=notes,
    )
