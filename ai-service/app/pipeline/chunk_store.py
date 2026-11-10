from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import pymongo
from pymongo import MongoClient
from app.config import settings

_mongo_client: Optional[MongoClient] = None
_indexes_created: bool = False


def get_mongo_client() -> MongoClient:
  global _mongo_client
  if _mongo_client is None:
    _mongo_client = MongoClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=2000,
        connectTimeoutMS=5000,
        socketTimeoutMS=45000,
        maxPoolSize=10
    )
  return _mongo_client


def get_chunks_collection():
  global _indexes_created
  client = get_mongo_client()
  db = client.get_database()
  collection = db["chunks"]
  if not _indexes_created:
    try:
      collection.create_index([("sourceId", pymongo.ASCENDING)])
      collection.create_index([("projectId", pymongo.ASCENDING), ("order", pymongo.ASCENDING)])
      collection.create_index([("projectId", pymongo.ASCENDING), ("sourceId", pymongo.ASCENDING)])
      collection.create_index([("chunkId", pymongo.ASCENDING)], unique=True, sparse=True)
      _indexes_created = True
    except Exception as e:
      print(f"[ChunkStore] Notice ensuring indexes: {e}")
  return collection


def save_chunks(chunks: List[Dict[str, Any]]) -> int:
  """Saves chunks with embeddings and locators into the chunks collection.
  Prevents duplicate chunks by removing existing matching chunk IDs before insert.
  """
  if not chunks:
    return 0

  collection = get_chunks_collection()
  now = datetime.now(timezone.utc).isoformat()

  # Deduplicate: remove any pre-existing records with same chunkId
  chunk_ids = [ch.get("chunkId") for ch in chunks if ch.get("chunkId")]
  if chunk_ids:
    try:
      collection.delete_many({"chunkId": {"$in": chunk_ids}})
    except Exception:
      pass

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
  """
  Retrieves all chunks belonging to an allowed list of source IDs.
  """
  if not source_ids:
    return []
  try:
    collection = get_chunks_collection()
    cursor = collection.find({"sourceId": {"$in": source_ids}}).sort("order", 1)
    return list(cursor)
  except Exception:
    return []


def get_chunks_by_project(project_id: str, source_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
  """
  Retrieves all chunks for a project, optionally filtered by allowed source IDs.
  """
  try:
    collection = get_chunks_collection()
    query: Dict[str, Any] = {"projectId": project_id}
    if source_ids is not None:
      query["sourceId"] = {"$in": source_ids}
    cursor = collection.find(query).sort("order", 1)
    return list(cursor)
  except Exception as e:
    print(f"[ChunkStore] Error retrieving chunks for project {project_id}: {e}")
    return []
