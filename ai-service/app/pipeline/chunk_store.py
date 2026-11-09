from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pymongo
from pymongo import MongoClient
from app.config import settings

_mongo_client: Optional[MongoClient] = None


def get_mongo_client() -> MongoClient:
  global _mongo_client
  if _mongo_client is None:
    _mongo_client = MongoClient(
        settings.MONGODB_URI, serverSelectionTimeoutMS=3000
    )
  return _mongo_client


def get_chunks_collection():
  client = get_mongo_client()
  db = client.get_database()
  return db["chunks"]


def save_chunks(chunks: List[Dict[str, Any]]) -> int:
  """Saves chunks with embeddings and locators into the chunks collection."""
  if not chunks:
    return 0

  collection = get_chunks_collection()
  now = datetime.now(timezone.utc).isoformat()

  docs = []
  for ch in chunks:
    doc = {**ch, "createdAt": now}
    docs.append(doc)

  res = collection.insert_many(docs)
  return len(res.inserted_ids)


def delete_chunks_by_source(source_id: str) -> int:
  """Removes all indexed chunks associated with a deleted or reprocessed source."""
  try:
    collection = get_chunks_collection()
    res = collection.delete_many({"sourceId": source_id})
    return res.deleted_count
  except Exception as e:
    print(f"[ChunkStore] Error deleting chunks for source {source_id}: {e}")
    return 0


def get_chunks_by_source(source_id: str) -> List[Dict[str, Any]]:
  """Retrieves all chunks for a source."""
  try:
    collection = get_chunks_collection()
    cursor = collection.find({"sourceId": source_id}).sort("order", 1)
    return list(cursor)
  except Exception:
    return []


def get_chunks_by_sources(source_ids: List[str]) -> List[Dict[str, Any]]:
  """Retrieves all chunks belonging to an allowed list of source IDs."""
  if not source_ids:
    return []
  try:
    collection = get_chunks_collection()
    cursor = collection.find({"sourceId": {"$in": source_ids}}).sort("order", 1)
    return list(cursor)
  except Exception:
    return []
