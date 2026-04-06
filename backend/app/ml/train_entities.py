from __future__ import annotations

from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

from app.core.config import settings
from app.ml.common import build_result, load_csv, save_joblib, save_json

DATASET_NAME = "entities.csv"
PIPELINE_NAME = "entities"


def _email_user(email: str) -> str:
    return email.split("@", 1)[0] if "@" in email else email


def _email_domain(email: str) -> str:
    return email.split("@", 1)[1] if "@" in email else ""


def _ip_prefix(ip_address: str) -> str:
    chunks = ip_address.split(".")
    return ".".join(chunks[:3]) if len(chunks) == 4 else ip_address


def _same_person_probability(
    similarity: float,
    phone_match: bool,
    email_user_match: bool,
    email_domain_match: bool,
    ip_match: bool,
) -> float:
    score = 0.0
    score += 0.42 if phone_match else 0.0
    score += 0.24 if email_user_match else 0.0
    score += 0.1 if email_domain_match else 0.0
    score += 0.14 if ip_match else 0.0
    score += 0.1 * max(0.0, min(1.0, similarity))
    return max(0.0, min(1.0, score))


def train_entity_linkage_models() -> dict:
    frame = load_csv(DATASET_NAME, max_rows=settings.MAX_TRAINING_ROWS)
    artifacts: list[str] = []
    notes: list[str] = []

    frame = frame.fillna("").drop_duplicates(subset=["account_id"])  # one profile per account
    if frame.empty:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="cosine-similarity + record-linkage",
            status="failed",
            rows=0,
            notes=["Dataset is empty."],
        )

    frame["phone"] = frame["phone"].astype(str)
    frame["email"] = frame["email"].astype(str).str.lower()
    frame["ip_address"] = frame["ip_address"].astype(str)
    frame["email_user"] = frame["email"].apply(_email_user)
    frame["email_domain"] = frame["email"].apply(_email_domain)
    frame["ip_prefix"] = frame["ip_address"].apply(_ip_prefix)

    frame["profile_text"] = (
        frame["phone"]
        + " "
        + frame["email_user"]
        + " "
        + frame["email_domain"]
        + " "
        + frame["ip_prefix"]
    )

    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1)
    matrix = vectorizer.fit_transform(frame["profile_text"])

    n_neighbors = min(12, len(frame))
    neighbor_model = NearestNeighbors(metric="cosine", algorithm="brute", n_neighbors=n_neighbors)
    neighbor_model.fit(matrix)

    distances, indices = neighbor_model.kneighbors(matrix)

    linked_pairs: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()
    threshold = 0.65

    for row_index in range(len(frame)):
        account_a = str(frame.iloc[row_index]["account_id"])
        for dist, col_index in zip(distances[row_index], indices[row_index]):
            if row_index == int(col_index):
                continue

            account_b = str(frame.iloc[int(col_index)]["account_id"])
            pair_key = tuple(sorted((account_a, account_b)))
            if pair_key in seen_pairs:
                continue

            similarity = 1.0 - float(dist)
            row_a = frame.iloc[row_index]
            row_b = frame.iloc[int(col_index)]

            probability = _same_person_probability(
                similarity=similarity,
                phone_match=row_a["phone"] == row_b["phone"],
                email_user_match=row_a["email_user"] == row_b["email_user"],
                email_domain_match=row_a["email_domain"] == row_b["email_domain"],
                ip_match=row_a["ip_address"] == row_b["ip_address"],
            )

            if probability >= threshold:
                linked_pairs.append(
                    {
                        "account_a": account_a,
                        "account_b": account_b,
                        "same_person_probability": round(probability, 4),
                        "cosine_similarity": round(similarity, 4),
                    }
                )
                seen_pairs.add(pair_key)

    linked_pairs.sort(key=lambda item: item["same_person_probability"], reverse=True)

    parent: dict[str, str] = {str(account): str(account) for account in frame["account_id"]}

    def find(account: str) -> str:
        root = account
        while parent[root] != root:
            root = parent[root]
        while parent[account] != account:
            parent_account = parent[account]
            parent[account] = root
            account = parent_account
        return root

    def union(account_a: str, account_b: str) -> None:
        root_a = find(account_a)
        root_b = find(account_b)
        if root_a != root_b:
            parent[root_b] = root_a

    for pair in linked_pairs:
        union(pair["account_a"], pair["account_b"])

    clusters: dict[str, list[str]] = defaultdict(list)
    for account in frame["account_id"].astype(str):
        clusters[find(account)].append(account)

    cluster_summaries = [
        {
            "cluster_id": cluster_id,
            "size": len(accounts),
            "accounts": accounts[:20],
        }
        for cluster_id, accounts in clusters.items()
        if len(accounts) > 1
    ]
    cluster_summaries.sort(key=lambda item: item["size"], reverse=True)

    avg_probability = float(np.mean([pair["same_person_probability"] for pair in linked_pairs])) if linked_pairs else 0.0
    max_cluster_size = max((item["size"] for item in cluster_summaries), default=1)

    artifacts.append(
        save_joblib(
            "entities",
            "record_linkage_bundle.joblib",
            {
                "vectorizer": vectorizer,
                "neighbor_model": neighbor_model,
                "threshold": threshold,
            },
        )
    )
    artifacts.append(
        save_json(
            "entities",
            "entity_linkage_outputs.json",
            {
                "linked_pairs": linked_pairs[:300],
                "cluster_summaries": cluster_summaries[:200],
                "threshold": threshold,
            },
        )
    )

    if not linked_pairs:
        notes.append("No high-confidence entity links found at the default threshold 0.65.")

    metrics = {
        "linked_pair_count": int(len(linked_pairs)),
        "cluster_count": int(len(cluster_summaries)),
        "max_cluster_size": int(max_cluster_size),
        "average_same_person_probability": float(avg_probability),
    }

    outputs = {
        "top_linked_pairs": linked_pairs[:25],
        "top_clusters": cluster_summaries[:20],
        "threshold": threshold,
    }

    return build_result(
        pipeline=PIPELINE_NAME,
        dataset=DATASET_NAME,
        model_type="cosine-similarity + record-linkage",
        status="success",
        rows=len(frame),
        metrics=metrics,
        outputs=outputs,
        artifacts=artifacts,
        notes=notes,
    )
