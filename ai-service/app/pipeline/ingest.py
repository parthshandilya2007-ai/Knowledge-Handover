import json
import logging
from typing import Optional, List, Any
import httpx
from app.config import settings
from app.security import generate_webhook_signature
from app.pipeline.parsers.pdf_parser import parse_pdf_bytes
from app.pipeline.parsers.docx_parser import parse_docx_bytes
from app.pipeline.parsers.txt_parser import parse_txt_bytes
from app.pipeline.parsers.github_parser import parse_github_items
from app.pipeline.chunker.text_chunker import chunk_document
from app.pipeline.embedder.embedder import get_embedder
from app.pipeline.chunk_store import save_chunks, delete_chunks_by_source

logger = logging.getLogger("ai-service.ingest")


async def send_pipeline_webhook(
    job_id: str,
    project_id: str,
    stage: str,
    progress: int,
    source_id: Optional[str] = None,
    error: Optional[str] = None
) -> None:
    """
    Sends an HMAC-SHA256 signed webhook notification to the Express backend.
    """
    payload = {
        "jobId": job_id,
        "projectId": project_id,
        "stage": stage,
        "progress": progress,
        "sourceId": source_id,
        "error": error
    }

    raw_bytes = json.dumps(payload).encode("utf-8")
    signature = generate_webhook_signature(raw_bytes)
    webhook_url = f"{settings.BACKEND_INTERNAL_URL}/internal/webhooks/pipeline"

    headers = {
        "Content-Type": "application/json",
        "X-Signature": signature
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(webhook_url, content=raw_bytes, headers=headers)
            if res.status_code != 200:
                logger.warning(f"Webhook failed with status {res.status_code}: {res.text}")
    except Exception as e:
        logger.error(f"Failed to deliver pipeline webhook to {webhook_url}: {e}")


async def ingest_source_pipeline(
    source_id: str,
    project_id: str,
    source_type: str,
    title: str,
    file_ref: Optional[str] = None,
    text_content: Optional[str] = None,
    items: Optional[List[Any]] = None
) -> None:
    """
    Executes stages 2-4 of the pipeline for a single source:
    1. Parse
    2. Chunk
    3. Embed & Index
    """
    job_id = f"ingest-{source_id}"
    logger.info(f"Starting ingestion pipeline for source {source_id} (Project: {project_id}, Type: {source_type})")

    try:
        # Delete any existing chunks if re-processing
        delete_chunks_by_source(source_id)

        # Stage 2: PARSE
        await send_pipeline_webhook(job_id, project_id, "parsing", 25, source_id)

        parsed_doc = None

        if source_type == "github":
            parsed_doc = parse_github_items(items or [], repo_name=title)
        else:
            file_bytes = b""
            if file_ref:
                # Fetch file bytes from Express internal endpoint
                file_url = f"{settings.BACKEND_INTERNAL_URL}/internal/files/{source_id}"
                headers = {"X-Internal-Key": settings.INTERNAL_SERVICE_KEY}
                async with httpx.AsyncClient(timeout=30.0) as client:
                    res = await client.get(file_url, headers=headers)
                    if res.status_code != 200:
                        raise ValueError(f"Failed to fetch file from Express: HTTP {res.status_code}")
                    file_bytes = res.content

            # Parse according to format
            lower_ref = (file_ref or "").lower()
            lower_title = title.lower()

            if lower_ref.endswith(".pdf") or lower_title.endswith(".pdf") or file_bytes[:4] == b"%PDF":
                parsed_doc = parse_pdf_bytes(file_bytes, original_name=title)
            elif lower_ref.endswith(".docx") or lower_title.endswith(".docx") or file_bytes[:4] == b"PK\x03\x04":
                parsed_doc = parse_docx_bytes(file_bytes, original_name=title)
            else:
                # TXT or meeting notes
                parsed_doc = parse_txt_bytes(file_bytes, original_name=title, text_content=text_content or "")

        if not parsed_doc.raw_text.strip():
            raise ValueError("Document parsed but produced empty text content")

        # Stage 3: CHUNK
        await send_pipeline_webhook(job_id, project_id, "chunking", 50, source_id)
        chunks = chunk_document(parsed_doc, source_id=source_id, project_id=project_id)
        if not chunks:
            raise ValueError("Chunking failed: 0 chunks created")

        # Stage 4: EMBED & INDEX
        await send_pipeline_webhook(job_id, project_id, "embedding", 75, source_id)
        embedder = get_embedder()
        chunk_texts = [c["text"] for c in chunks]
        embeddings = await embedder.embed_texts(chunk_texts)

        for i, emb in enumerate(embeddings):
            chunks[i]["embedding"] = emb

        # Save to MongoDB chunks collection
        num_saved = save_chunks(chunks)
        logger.info(f"Successfully saved and indexed {num_saved} chunks for source {source_id}")

        # Complete
        await send_pipeline_webhook(job_id, project_id, "ready", 100, source_id)

    except Exception as e:
        logger.error(f"Ingestion failed for source {source_id}: {e}", exc_info=True)
        await send_pipeline_webhook(job_id, project_id, "failed", 0, source_id, error=str(e))
