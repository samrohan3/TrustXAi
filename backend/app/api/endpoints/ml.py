from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

from app.core.deps import require_roles
from app.core.types import RoleEnum
from app.db.mongo import get_db
from app.ml.orchestrator import available_pipelines, run_training
from app.schemas.api import ModelPipelineCatalog, ModelTrainingRunRead

router = APIRouter(
    prefix="/ml",
    tags=["ml"],
    dependencies=[Depends(require_roles(RoleEnum.admin, RoleEnum.analyst))],
)


@router.get("/pipelines", response_model=ModelPipelineCatalog)
def list_ml_pipelines() -> ModelPipelineCatalog:
    return ModelPipelineCatalog(pipelines=available_pipelines())


@router.post("/train/all", response_model=ModelTrainingRunRead)
def train_all_models(db: Database = Depends(get_db)) -> ModelTrainingRunRead:
    run_payload = run_training()
    db["ml_training_runs"].insert_one({**run_payload, "created_at": datetime.utcnow()})
    return ModelTrainingRunRead.model_validate(run_payload)


@router.post("/train/{pipeline_name}", response_model=ModelTrainingRunRead)
def train_single_pipeline(
    pipeline_name: str,
    db: Database = Depends(get_db),
) -> ModelTrainingRunRead:
    if pipeline_name not in available_pipelines():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown pipeline: {pipeline_name}",
        )

    run_payload = run_training([pipeline_name])
    db["ml_training_runs"].insert_one({**run_payload, "created_at": datetime.utcnow()})
    return ModelTrainingRunRead.model_validate(run_payload)


@router.get("/train/runs", response_model=list[ModelTrainingRunRead])
def list_training_runs(
    limit: int = Query(default=10, ge=1, le=50),
    db: Database = Depends(get_db),
) -> list[ModelTrainingRunRead]:
    rows = list(
        db["ml_training_runs"]
        .find({}, {"_id": 0, "created_at": 0})
        .sort("started_at", -1)
        .limit(limit)
    )
    return [ModelTrainingRunRead.model_validate(row) for row in rows]
