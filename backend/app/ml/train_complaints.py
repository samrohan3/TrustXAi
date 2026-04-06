from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from app.core.config import settings
from app.ml.common import build_result, load_csv, save_joblib, save_json

DATASET_NAME = "complaints.csv"
PIPELINE_NAME = "complaints"


def train_complaint_nlp_models() -> dict:
    frame = load_csv(DATASET_NAME, max_rows=settings.MAX_TRAINING_ROWS)
    artifacts: list[str] = []
    notes: list[str] = []

    frame["text"] = frame["text"].astype(str).str.strip()
    frame["label_binary"] = frame["label"].astype(str).str.lower().map({"fraud": 1, "normal": 0}).fillna(0).astype(int)
    frame = frame[frame["text"] != ""]

    if frame.empty:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="tfidf + logistic-regression",
            status="failed",
            rows=0,
            notes=["Dataset is empty after preprocessing."],
        )

    if frame["label_binary"].nunique() < 2:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="tfidf + logistic-regression",
            status="failed",
            rows=len(frame),
            notes=["Both fraud and normal complaint labels are required."],
        )

    X_train, X_test, y_train, y_test = train_test_split(
        frame["text"],
        frame["label_binary"],
        test_size=0.2,
        random_state=42,
        stratify=frame["label_binary"],
    )

    pipeline = Pipeline(
        steps=[
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
            ("classifier", LogisticRegression(max_iter=1200, class_weight="balanced")),
        ]
    )
    pipeline.fit(X_train, y_train)

    probabilities = pipeline.predict_proba(X_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)

    precision, recall, f1, _ = precision_recall_fscore_support(y_test, predictions, average="binary", zero_division=0)
    accuracy = accuracy_score(y_test, predictions)
    auc = roc_auc_score(y_test, probabilities) if len(np.unique(y_test)) > 1 else float("nan")

    vectorizer: TfidfVectorizer = pipeline.named_steps["tfidf"]
    classifier: LogisticRegression = pipeline.named_steps["classifier"]

    feature_names = np.array(vectorizer.get_feature_names_out())
    coef = classifier.coef_[0]
    top_indices = np.argsort(coef)[-20:][::-1]
    top_fraud_terms = [
        {
            "term": str(feature_names[index]),
            "weight": round(float(coef[index]), 4),
        }
        for index in top_indices
    ]

    sample_predictions = []
    sample_slice = X_test.iloc[:25]
    for complaint_text, probability in zip(sample_slice, probabilities[:25]):
        sample_predictions.append(
            {
                "text": complaint_text,
                "fraud_probability": round(float(probability), 4),
                "prediction": "fraud" if probability >= 0.5 else "normal",
            }
        )

    artifacts.append(save_joblib("complaints", "complaint_classifier.joblib", pipeline))
    artifacts.append(
        save_json(
            "complaints",
            "complaint_outputs.json",
            {
                "top_fraud_terms": top_fraud_terms,
                "sample_predictions": sample_predictions,
                "metrics": {
                    "accuracy": accuracy,
                    "precision": precision,
                    "recall": recall,
                    "f1": f1,
                    "roc_auc": auc,
                },
            },
        )
    )

    notes.append("BERT fine-tuning is not enabled in this backend build; logistic regression is used for production-safe NLP training.")

    metrics = {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "roc_auc": float(auc),
        "fraud_rate": float(frame["label_binary"].mean()),
    }

    outputs = {
        "top_fraud_terms": top_fraud_terms,
        "sample_predictions": sample_predictions,
    }

    return build_result(
        pipeline=PIPELINE_NAME,
        dataset=DATASET_NAME,
        model_type="tfidf + logistic-regression",
        status="success",
        rows=len(frame),
        metrics=metrics,
        outputs=outputs,
        artifacts=artifacts,
        notes=notes,
    )
