from datetime import datetime, timezone
import json
from typing import Optional, List, Dict, Any
from app.config import settings
from app.pipeline.chunk_store import delete_chunks_by_source
from app.pipeline.ingest import ingest_source_pipeline
from app.pipeline.pipeline_runner import run_project_analysis_pipeline
from app.pipeline.parsers.github_parser import GithubItemInput
from app.security import generate_webhook_signature, verify_internal_key
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
import httpx
from pydantic import BaseModel

router = APIRouter(prefix="/internal", tags=["internal"])


class WebhookTestPayload(BaseModel):
  jobId: str
  projectId: str
  stage: str
  progress: int


class SourceIngestRequest(BaseModel):
    sourceId: str
    projectId: str
    type: str
    title: str
    fileRef: Optional[str] = None
    text: Optional[str] = None
    items: Optional[List[GithubItemInput]] = None


@router.get("/health", dependencies=[Depends(verify_internal_key)])
async def internal_health():
  """Internal health check endpoint, authenticated via X-Internal-Key."""
  return {
      "ok": True,
      "data": {
          "status": "healthy",
          "service": "ai-service",
          "timestamp": datetime.now(timezone.utc).isoformat(),
          "models": {
              "chat": settings.OPENAI_MODEL,
              "embedding": settings.OPENAI_EMBEDDING_MODEL,
              "provider": settings.EMBEDDING_PROVIDER,
          },
      },
  }


@router.post("/sources/ingest", dependencies=[Depends(verify_internal_key)])
async def ingest_source(
    payload: SourceIngestRequest, background_tasks: BackgroundTasks
):
    """Trigger parsing, chunking, and embedding in the background for an uploaded source."""
    background_tasks.add_task(
        ingest_source_pipeline,
        source_id=payload.sourceId,
        project_id=payload.projectId,
        source_type=payload.type,
        title=payload.title,
        file_ref=payload.fileRef,
        text_content=payload.text,
        items=payload.items,
    )

    return {
        "ok": True,
        "data": {
            "accepted": True,
            "sourceId": payload.sourceId,
            "message": "Ingestion job queued",
        },
    }


class PipelineRunRequest(BaseModel):
    jobId: str
    projectId: str
    sourceIds: Optional[List[str]] = None


@router.post("/pipeline/run", dependencies=[Depends(verify_internal_key)])
async def run_pipeline(
    payload: PipelineRunRequest, background_tasks: BackgroundTasks
):
    """Trigger extraction, reconciliation, and persistence pipeline in the background."""
    background_tasks.add_task(
        run_project_analysis_pipeline,
        job_id=payload.jobId,
        project_id=payload.projectId,
        source_ids=payload.sourceIds,
    )

    return {
        "ok": True,
        "data": {
            "accepted": True,
            "jobId": payload.jobId,
            "projectId": payload.projectId,
            "message": "Project analysis job queued",
        },
    }


@router.delete(
    "/sources/{source_id}", dependencies=[Depends(verify_internal_key)]
)
async def delete_source_chunks(source_id: str):
  """Deletes all chunks in MongoDB for a specified source."""
  deleted_count = delete_chunks_by_source(source_id)
  return {"ok": True, "data": {"sourceId": source_id, "deleted": deleted_count}}


@router.post(
    "/test/trigger-webhook", dependencies=[Depends(verify_internal_key)]
)
async def trigger_test_webhook(payload: WebhookTestPayload):
  """Test helper: Sends an HMAC-signed webhook callback from FastAPI to Express."""
  body = payload.model_dump()
  raw_bytes = json.dumps(body).encode("utf-8")
  signature = generate_webhook_signature(raw_bytes)

  webhook_url = f"{settings.BACKEND_INTERNAL_URL}/internal/webhooks/pipeline"
  headers = {"Content-Type": "application/json", "X-Signature": signature}

  try:
    async with httpx.AsyncClient(timeout=10.0) as client:
      response = await client.post(
          webhook_url, content=raw_bytes, headers=headers
      )
      return {
          "ok": True,
          "data": {
              "backendStatus": response.status_code,
              "backendResponse": (
                  response.json()
                  if response.headers.get("content-type", "").startswith(
                      "application/json"
                  )
                  else response.text
              ),
          },
      }
  except Exception as e:
    raise HTTPException(
        status_code=500,
        detail={
            "ok": False,
            "error": {"code": "WEBHOOK_DISPATCH_FAILED", "message": str(e)},
        },
    )
