import logging
from typing import Optional, List, Dict, Any
from app.pipeline.ingest import send_pipeline_webhook
from app.pipeline.chunk_store import get_chunks_by_project
from app.pipeline.extractors.extractor import extract_facts_from_chunks
from app.pipeline.reconciler.reconciler import reconcile_extracted_facts

logger = logging.getLogger("ai-service.pipeline_runner")


async def run_project_analysis_pipeline(
    job_id: str,
    project_id: str,
    source_ids: Optional[List[str]] = None
) -> None:
    """
    Executes stages 5-6 of the pipeline for a project:
    1. Fetch project chunks (filtered by allowed source IDs)
    2. Stage 5: EXTRACT facts with verbatim quote verification
    3. Stage 6: RECONCILE (deduplicate facts, merge evidence, detect contradictions)
    4. Dispatch reconciled facts and evidence to Express via HMAC-signed webhook for persistence (Stage 7)
    """
    logger.info(f"Starting analysis job {job_id} for project {project_id}")

    try:
        # 1. Fetch chunks
        chunks = get_chunks_by_project(project_id, source_ids)
        if not chunks:
            raise ValueError(f"No indexed chunks found for project {project_id} (sources: {source_ids})")

        # 2. Stage 5: EXTRACT
        await send_pipeline_webhook(job_id, project_id, stage="extracting", progress=25)
        raw_facts = await extract_facts_from_chunks(chunks)

        # 3. Stage 6: RECONCILE
        await send_pipeline_webhook(job_id, project_id, stage="reconciling", progress=60)
        reconciled = reconcile_extracted_facts(raw_facts)

        # 4. Stage 7: PERSIST via Express webhook
        await send_pipeline_webhook(
            job_id,
            project_id,
            stage="persisting",
            progress=85,
            data=reconciled
        )

        logger.info(f"Analysis job {job_id} successfully completed extraction and reconciliation")
        await send_pipeline_webhook(
            job_id,
            project_id,
            stage="completed",
            progress=100,
            data=reconciled
        )

    except Exception as e:
        logger.error(f"Analysis job {job_id} failed: {e}", exc_info=True)
        await send_pipeline_webhook(
            job_id,
            project_id,
            stage="failed",
            progress=0,
            error=str(e)
        )

