import json
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.config import settings
from app.security import verify_internal_key, generate_webhook_signature

router = APIRouter(prefix="/internal", tags=["internal"])


class WebhookTestPayload(BaseModel):
    jobId: str
    projectId: str
    stage: str
    progress: int


@router.get("/health", dependencies=[Depends(verify_internal_key)])
async def internal_health():
    """
    Internal health check endpoint, authenticated via X-Internal-Key.
    """
    return {
        "ok": True,
        "data": {
            "status": "healthy",
            "service": "ai-service",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "models": {
                "chat": settings.OPENAI_MODEL,
                "embedding": settings.OPENAI_EMBEDDING_MODEL,
                "provider": settings.EMBEDDING_PROVIDER
            }
        }
    }


@router.post("/test/trigger-webhook", dependencies=[Depends(verify_internal_key)])
async def trigger_test_webhook(payload: WebhookTestPayload):
    """
    Test helper: Sends an HMAC-signed webhook callback from FastAPI to Express.
    """
    body = payload.model_dump()
    raw_bytes = json.dumps(body).encode("utf-8")
    signature = generate_webhook_signature(raw_bytes)

    webhook_url = f"{settings.BACKEND_INTERNAL_URL}/internal/webhooks/pipeline"
    headers = {
        "Content-Type": "application/json",
        "X-Signature": signature
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook_url, content=raw_bytes, headers=headers)
            return {
                "ok": True,
                "data": {
                    "backendStatus": response.status_code,
                    "backendResponse": response.json() if response.headers.get("content-type", "").startswith("application/json") else response.text
                }
            }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"ok": False, "error": {"code": "WEBHOOK_DISPATCH_FAILED", "message": str(e)}}
        )
