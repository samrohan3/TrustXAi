from __future__ import annotations

import networkx as nx
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.core.config import settings
from app.ml.common import build_result, load_csv, normalize_probability, save_joblib, save_json

DATASET_NAME = "layered_transactions.csv"
PIPELINE_NAME = "layered_transactions"


def _build_global_graph(frame: pd.DataFrame) -> nx.DiGraph:
    grouped = (
        frame.groupby(["from_account", "to_account"], as_index=False)
        .agg(total_amount=("amount", "sum"), max_layer=("layer", "max"), transaction_count=("case_id", "count"))
    )

    graph = nx.DiGraph()
    for row in grouped.itertuples(index=False):
        graph.add_edge(
            row.from_account,
            row.to_account,
            amount=float(row.total_amount),
            max_layer=int(row.max_layer),
            transaction_count=int(row.transaction_count),
        )
    return graph


def _extract_money_trails(case_frame: pd.DataFrame, max_paths: int = 6) -> list[dict]:
    graph = nx.DiGraph()
    for row in case_frame.itertuples(index=False):
        amount = float(row.amount)
        if graph.has_edge(row.from_account, row.to_account):
            graph[row.from_account][row.to_account]["amount"] += amount
        else:
            graph.add_edge(row.from_account, row.to_account, amount=amount)

    sources = [node for node, degree in graph.in_degree() if degree == 0]
    sinks = [node for node, degree in graph.out_degree() if degree == 0]
    if not sources:
        sources = list(graph.nodes())[:3]
    if not sinks:
        sinks = list(graph.nodes())[:3]

    trails: list[dict] = []
    for source in sources[:3]:
        for sink in sinks[:8]:
            if source == sink:
                continue
            for path in nx.all_simple_paths(graph, source=source, target=sink, cutoff=8):
                amount_sum = 0.0
                for left, right in zip(path, path[1:]):
                    amount_sum += float(graph[left][right].get("amount", 0.0))

                trails.append(
                    {
                        "source": source,
                        "sink": sink,
                        "hops": len(path) - 1,
                        "path": path,
                        "amount": round(amount_sum, 2),
                    }
                )

                if len(trails) >= max_paths:
                    return trails
    return trails


def train_layered_graph_models() -> dict:
    notes: list[str] = []
    artifacts: list[str] = []

    frame = load_csv(DATASET_NAME, max_rows=settings.MAX_TRAINING_ROWS)
    frame["layer"] = pd.to_numeric(frame["layer"], errors="coerce").fillna(0).astype(int)
    frame["amount"] = pd.to_numeric(frame["amount"], errors="coerce").fillna(0.0)

    if frame.empty:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="networkx + graph anomaly",
            status="failed",
            rows=0,
            notes=["Dataset is empty."],
        )

    graph = _build_global_graph(frame)

    case_summaries = []
    money_trails: list[dict] = []

    for case_id, group in frame.groupby("case_id"):
        layer_count = int(group["layer"].max())
        total_amount = float(group["amount"].sum())
        unique_accounts = int(pd.concat([group["from_account"], group["to_account"]]).nunique())

        case_summaries.append(
            {
                "case_id": str(case_id),
                "layer_count": layer_count,
                "unique_accounts": unique_accounts,
                "total_amount": round(total_amount, 2),
            }
        )

        trails = _extract_money_trails(group, max_paths=4)
        for trail in trails:
            trail["case_id"] = str(case_id)
        money_trails.extend(trails)

    case_summaries.sort(key=lambda item: item["layer_count"], reverse=True)
    money_trails.sort(key=lambda item: item["amount"], reverse=True)

    if graph.number_of_nodes() == 0:
        return build_result(
            pipeline=PIPELINE_NAME,
            dataset=DATASET_NAME,
            model_type="networkx + graph anomaly",
            status="failed",
            rows=len(frame),
            notes=["Graph has no nodes after preprocessing."],
        )

    in_degree = dict(graph.in_degree(weight="amount"))
    out_degree = dict(graph.out_degree(weight="amount"))
    pagerank = nx.pagerank(graph, weight="amount") if graph.number_of_nodes() > 1 else {node: 0.0 for node in graph.nodes()}

    if graph.number_of_nodes() > 500:
        betweenness = nx.betweenness_centrality(graph, k=min(200, graph.number_of_nodes()), seed=42)
    else:
        betweenness = nx.betweenness_centrality(graph)

    node_rows = []
    for node in graph.nodes():
        node_rows.append(
            {
                "node": node,
                "in_degree": float(in_degree.get(node, 0.0)),
                "out_degree": float(out_degree.get(node, 0.0)),
                "pagerank": float(pagerank.get(node, 0.0)),
                "betweenness": float(betweenness.get(node, 0.0)),
            }
        )

    node_features = pd.DataFrame(node_rows)
    feature_columns = ["in_degree", "out_degree", "pagerank", "betweenness"]

    scaler = StandardScaler()
    scaled = scaler.fit_transform(node_features[feature_columns])
    anomaly_model = IsolationForest(n_estimators=220, contamination=0.05, random_state=42)
    anomaly_model.fit(scaled)

    raw_scores = -anomaly_model.decision_function(scaled)
    anomaly_scores = normalize_probability(raw_scores)

    node_features["anomaly_score"] = anomaly_scores
    suspicious_nodes = (
        node_features.sort_values("anomaly_score", ascending=False)
        .head(25)
        .to_dict(orient="records")
    )

    node2vec_status = "not_available"
    try:
        from node2vec import Node2Vec  # type: ignore[import-not-found]

        node2vec = Node2Vec(
            graph.to_undirected(),
            dimensions=16,
            walk_length=10,
            num_walks=20,
            workers=1,
            quiet=True,
        )
        embedding_model = node2vec.fit(window=5, min_count=1, batch_words=16)

        embedding_preview = []
        for node in list(graph.nodes())[:20]:
            vector = embedding_model.wv[str(node)].tolist()
            embedding_preview.append({"node": str(node), "embedding_head": [round(float(v), 5) for v in vector[:6]]})

        node2vec_status = "trained"
        artifacts.append(save_json("layered_transactions", "node2vec_preview.json", {"preview": embedding_preview}))
    except Exception as exc:  # pragma: no cover - optional dependency fallback
        notes.append(f"Node2Vec training skipped: {exc.__class__.__name__}")

    artifacts.append(
        save_joblib(
            "layered_transactions",
            "graph_anomaly_model.joblib",
            {
                "scaler": scaler,
                "model": anomaly_model,
                "feature_columns": feature_columns,
            },
        )
    )

    artifacts.append(
        save_json(
            "layered_transactions",
            "graph_outputs.json",
            {
                "case_summaries": case_summaries[:50],
                "money_trails": money_trails[:80],
                "suspicious_nodes": suspicious_nodes,
                "node2vec_status": node2vec_status,
            },
        )
    )

    metrics = {
        "node_count": int(graph.number_of_nodes()),
        "edge_count": int(graph.number_of_edges()),
        "case_count": int(frame["case_id"].nunique()),
        "avg_layer_count": float(np.mean([summary["layer_count"] for summary in case_summaries])),
        "max_layer_count": int(max(summary["layer_count"] for summary in case_summaries)),
        "suspicious_node_count": int(len(suspicious_nodes)),
    }

    outputs = {
        "node2vec_status": node2vec_status,
        "top_suspicious_nodes": suspicious_nodes[:10],
        "top_money_trails": money_trails[:20],
        "top_layer_cases": case_summaries[:10],
    }

    return build_result(
        pipeline=PIPELINE_NAME,
        dataset=DATASET_NAME,
        model_type="networkx + graph anomaly",
        status="success",
        rows=len(frame),
        metrics=metrics,
        outputs=outputs,
        artifacts=artifacts,
        notes=notes,
    )
