from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from statsmodels.tsa.arima.model import ARIMA

from app.core.config import settings
from app.ml.common import build_result, load_csv, relative_workspace_path, resolve_artifacts_dir, save_json

DATASET_NAME = "time_series.csv"
PIPELINE_NAME = "time_series"


def train_time_series_models() -> dict:
    artifacts: list[str] = []
    notes: list[str] = []

    frame = load_csv(DATASET_NAME, max_rows=settings.MAX_TRAINING_ROWS)
    frame["timestamp"] = pd.to_datetime(frame["timestamp"], errors="coerce")
    frame["amount"] = pd.to_numeric(frame["amount"], errors="coerce").fillna(0.0)
    frame = frame.dropna(subset=["timestamp"])

    if frame.empty:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="ARIMA + optional LSTM",
            status="failed",
            rows=0,
            notes=["Dataset is empty after timestamp parsing."],
        )

    daily_series = frame.set_index("timestamp")["amount"].resample("D").sum().sort_index()

    if len(daily_series) < 20:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="ARIMA + optional LSTM",
            status="failed",
            rows=len(frame),
            notes=["Time series requires at least 20 daily points for stable training."],
        )

    warnings.filterwarnings("ignore", category=UserWarning)
    warnings.filterwarnings("ignore", category=FutureWarning)

    arima_order = (2, 1, 2)
    arima_model = ARIMA(daily_series, order=arima_order)
    arima_fit = arima_model.fit()

    in_sample_prediction = arima_fit.predict(start=daily_series.index[0], end=daily_series.index[-1])
    in_sample_prediction = in_sample_prediction.reindex(daily_series.index, fill_value=daily_series.mean())

    residuals = daily_series - in_sample_prediction
    residual_std = float(residuals.std()) if float(residuals.std()) > 0 else 1.0
    z_scores = (residuals - residuals.mean()) / residual_std

    arima_anomalies = []
    for timestamp, value, z_score in zip(daily_series.index, daily_series.values, z_scores.values):
        if abs(float(z_score)) >= 2.5:
            arima_anomalies.append(
                {
                    "date": timestamp.strftime("%Y-%m-%d"),
                    "amount": round(float(value), 2),
                    "z_score": round(float(z_score), 3),
                    "source": "arima",
                }
            )

    forecast = arima_fit.forecast(steps=7)
    forecast_points = [
        {
            "date": idx.strftime("%Y-%m-%d"),
            "predicted_amount": round(float(val), 2),
        }
        for idx, val in forecast.items()
    ]

    artifact_dir = resolve_artifacts_dir() / "time_series"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    arima_path = artifact_dir / "arima_model.pkl"
    arima_fit.save(arima_path)
    artifacts.append(relative_workspace_path(arima_path))

    lstm_anomalies: list[dict] = []
    lstm_summary: dict = {
        "trained": False,
        "reason": "tensorflow is not installed",
    }

    try:
        import tensorflow as tf  # type: ignore[import-not-found]

        tf.random.set_seed(42)

        values = daily_series.values.astype("float32").reshape(-1, 1)
        scaler = MinMaxScaler()
        scaled_values = scaler.fit_transform(values)

        window = 7
        X, y = [], []
        for idx in range(window, len(scaled_values)):
            X.append(scaled_values[idx - window : idx, 0])
            y.append(scaled_values[idx, 0])

        if len(X) > 24:
            X_train = np.array(X).reshape((-1, window, 1))
            y_train = np.array(y)

            lstm_model = tf.keras.Sequential(
                [
                    tf.keras.layers.Input(shape=(window, 1)),
                    tf.keras.layers.LSTM(32, return_sequences=False),
                    tf.keras.layers.Dense(1),
                ]
            )
            lstm_model.compile(optimizer="adam", loss="mse")
            lstm_model.fit(X_train, y_train, epochs=12, batch_size=16, verbose=0)

            predictions_scaled = lstm_model.predict(X_train, verbose=0)
            predictions = scaler.inverse_transform(predictions_scaled).ravel()
            actual = values[window:, 0]
            errors = np.abs(actual - predictions)
            threshold = float(np.percentile(errors, 95))

            anomalous_indices = np.where(errors >= threshold)[0] + window
            for series_index in anomalous_indices[:40]:
                timestamp = daily_series.index[int(series_index)]
                lstm_anomalies.append(
                    {
                        "date": timestamp.strftime("%Y-%m-%d"),
                        "amount": round(float(daily_series.iloc[int(series_index)]), 2),
                        "forecast_error": round(float(errors[int(series_index - window)]), 2),
                        "source": "lstm",
                    }
                )

            lstm_model_path = artifact_dir / "lstm_model.keras"
            lstm_model.save(lstm_model_path)
            artifacts.append(relative_workspace_path(lstm_model_path))

            lstm_summary = {
                "trained": True,
                "sequence_window": window,
                "error_threshold": round(threshold, 4),
            }
        else:
            lstm_summary = {
                "trained": False,
                "reason": "not enough sequence windows to train LSTM",
            }
    except Exception as exc:  # pragma: no cover - optional dependency fallback
        notes.append(f"LSTM training skipped: {exc.__class__.__name__}")

    unusual_activity_map: dict[str, dict] = {}
    for item in arima_anomalies + lstm_anomalies:
        unusual_activity_map[item["date"]] = item

    unusual_activity = sorted(unusual_activity_map.values(), key=lambda item: item["date"])

    summary_artifact = save_json(
        "time_series",
        "time_series_outputs.json",
        {
            "arima_order": arima_order,
            "arima_anomalies": arima_anomalies,
            "lstm_anomalies": lstm_anomalies,
            "forecast": forecast_points,
            "unusual_activity": unusual_activity,
            "lstm_summary": lstm_summary,
        },
    )
    artifacts.append(summary_artifact)

    metrics = {
        "daily_points": int(len(daily_series)),
        "arima_anomaly_count": int(len(arima_anomalies)),
        "lstm_anomaly_count": int(len(lstm_anomalies)),
        "unusual_activity_count": int(len(unusual_activity)),
    }

    outputs = {
        "unusual_activity": unusual_activity[:40],
        "forecast": forecast_points,
        "lstm_summary": lstm_summary,
    }

    return build_result(
        pipeline=PIPELINE_NAME,
        dataset=DATASET_NAME,
        model_type="ARIMA + optional LSTM",
        status="success",
        rows=len(frame),
        metrics=metrics,
        outputs=outputs,
        artifacts=artifacts,
        notes=notes,
    )
