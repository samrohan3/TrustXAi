from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from app.core.config import settings
from app.ml.common import account_id_to_number, build_result, load_csv, save_joblib, save_json

PIPELINE_NAME = "federated"
DATASET_BANK_A = "bank_A.csv"
DATASET_BANK_B = "bank_B.csv"


def _prepare_bank_frame(frame: pd.DataFrame, bank_name: str) -> pd.DataFrame:
    prepared = frame.copy()
    prepared["bank"] = bank_name
    prepared["amount"] = pd.to_numeric(prepared["amount"], errors="coerce").fillna(0.0)
    prepared["is_fraud"] = pd.to_numeric(prepared["is_fraud"], errors="coerce").fillna(0).astype(int)
    prepared["account_numeric"] = account_id_to_number(prepared["account_id"])
    return prepared[["bank", "account_id", "amount", "account_numeric", "is_fraud"]]


def _safe_auc(y_true: np.ndarray, y_score: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return float("nan")
    return float(roc_auc_score(y_true, y_score))


def _sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-values))


def train_federated_models() -> dict:
    artifacts: list[str] = []
    notes: list[str] = []

    bank_a = _prepare_bank_frame(load_csv(DATASET_BANK_A, max_rows=settings.MAX_TRAINING_ROWS), "bank_A")
    bank_b = _prepare_bank_frame(load_csv(DATASET_BANK_B, max_rows=settings.MAX_TRAINING_ROWS), "bank_B")

    combined = pd.concat([bank_a, bank_b], ignore_index=True)

    if combined.empty:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=f"{DATASET_BANK_A} + {DATASET_BANK_B}",
            model_type="federated-averaging",
            status="failed",
            rows=0,
            notes=["Bank datasets are empty."],
        )

    if combined["is_fraud"].nunique() < 2:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=f"{DATASET_BANK_A} + {DATASET_BANK_B}",
            model_type="federated-averaging",
            status="failed",
            rows=len(combined),
            notes=["Both classes are required for federated fraud training."],
        )

    feature_columns = ["amount", "account_numeric"]
    X = combined[feature_columns].to_numpy(dtype=float)
    y = combined["is_fraud"].to_numpy(dtype=int)
    banks = combined["bank"].to_numpy(dtype=str)

    X_train, X_test, y_train, y_test, banks_train, banks_test = train_test_split(
        X,
        y,
        banks,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    local_models = []
    local_metrics: dict[str, dict] = {}

    for bank_name in sorted(set(banks_train)):
        mask = banks_train == bank_name
        X_local = X_train_scaled[mask]
        y_local = y_train[mask]

        model = SGDClassifier(loss="log_loss", random_state=42)

        class_counts = np.bincount(y_local, minlength=2)
        safe_counts = np.where(class_counts == 0, 1, class_counts)
        class_weights = {
            0: float(len(y_local) / (2 * safe_counts[0])),
            1: float(len(y_local) / (2 * safe_counts[1])),
        }
        sample_weights = np.array([class_weights[int(label)] for label in y_local], dtype=float)

        model.partial_fit(X_local, y_local, classes=np.array([0, 1]), sample_weight=sample_weights)

        # Run a few local epochs to stabilize each participant update before averaging.
        for _ in range(4):
            permutation = np.random.permutation(len(X_local))
            model.partial_fit(
                X_local[permutation],
                y_local[permutation],
                sample_weight=sample_weights[permutation],
            )

        local_models.append((bank_name, model, int(len(X_local))))

        bank_eval_mask = banks_test == bank_name
        X_eval = X_test_scaled[bank_eval_mask]
        y_eval = y_test[bank_eval_mask]
        if len(X_eval) > 0:
            decision = model.decision_function(X_eval)
            probabilities = _sigmoid(decision)
            predictions = (probabilities >= 0.5).astype(int)
            precision, recall, f1, _ = precision_recall_fscore_support(y_eval, predictions, average="binary", zero_division=0)

            local_metrics[bank_name] = {
                "samples": int(len(X_local)),
                "accuracy": float(accuracy_score(y_eval, predictions)),
                "precision": float(precision),
                "recall": float(recall),
                "f1": float(f1),
                "roc_auc": _safe_auc(y_eval, probabilities),
            }

    total_samples = sum(item[2] for item in local_models)
    avg_coef = np.zeros_like(local_models[0][1].coef_)
    avg_intercept = np.zeros_like(local_models[0][1].intercept_)

    for _, model, sample_count in local_models:
        weight = sample_count / total_samples
        avg_coef += model.coef_ * weight
        avg_intercept += model.intercept_ * weight

    global_decision = np.dot(X_test_scaled, avg_coef.ravel()) + avg_intercept.ravel()[0]
    global_probabilities = _sigmoid(global_decision)
    global_predictions = (global_probabilities >= 0.5).astype(int)

    precision, recall, f1, _ = precision_recall_fscore_support(y_test, global_predictions, average="binary", zero_division=0)
    accuracy = accuracy_score(y_test, global_predictions)
    auc = _safe_auc(y_test, global_probabilities)

    artifacts.append(
        save_joblib(
            "federated",
            "federated_global_model.joblib",
            {
                "scaler": scaler,
                "coefficients": avg_coef,
                "intercept": avg_intercept,
                "feature_columns": feature_columns,
                "participants": [item[0] for item in local_models],
            },
        )
    )

    artifacts.append(
        save_json(
            "federated",
            "federated_outputs.json",
            {
                "global_metrics": {
                    "accuracy": accuracy,
                    "precision": precision,
                    "recall": recall,
                    "f1": f1,
                    "roc_auc": auc,
                },
                "local_metrics": local_metrics,
                "participants": [item[0] for item in local_models],
            },
        )
    )

    notes.append("Implements Flower/TFF-style federated averaging in-process without external orchestration.")

    metrics = {
        "global_accuracy": float(accuracy),
        "global_precision": float(precision),
        "global_recall": float(recall),
        "global_f1": float(f1),
        "global_roc_auc": float(auc),
        "participant_count": int(len(local_models)),
    }

    outputs = {
        "participants": [item[0] for item in local_models],
        "local_metrics": local_metrics,
        "global_threshold": 0.5,
    }

    return build_result(
        pipeline=PIPELINE_NAME,
        dataset=f"{DATASET_BANK_A} + {DATASET_BANK_B}",
        model_type="federated-averaging",
        status="success",
        rows=len(combined),
        metrics=metrics,
        outputs=outputs,
        artifacts=artifacts,
        notes=notes,
    )
