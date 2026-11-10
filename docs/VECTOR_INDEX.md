# MongoDB Atlas Vector Search Index Configuration

The **Knowledge Handover Platform** uses MongoDB Atlas as a unified single database for all application collections and chunk vector embeddings via Atlas Vector Search (`$vectorSearch`).

## 1. Index Specification

- **Database:** `knowledge_handover` (or the database specified in your `MONGODB_URI`)
- **Collection:** `chunks`
- **Index Name:** `vector_index`

### JSON Index Definition

When creating the search index in MongoDB Atlas (Search & Vector Search tab), use the following JSON configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "projectId"
    },
    {
      "type": "filter",
      "path": "sourceId"
    }
  ]
}
```

---

## 2. Step-by-Step Atlas UI Configuration

1. Log into your [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. Navigate to your cluster and select the **Atlas Search** tab.
3. Click **Create Search Index**.
4. Choose **Atlas Vector Search** (JSON Editor).
5. Select:
   - **Database:** `knowledge_handover`
   - **Collection:** `chunks`
6. In the Index Name field, enter: `vector_index`
7. Paste the JSON configuration block shown above.
8. Click **Next** and then **Create Vector Search Index**.
9. Wait 1–2 minutes for the initial index build to transition to **Active**.

---

## 3. Creating the Index via Atlas CLI (Optional)

If using the MongoDB Atlas CLI (`atlas`):

```bash
atlas clusters search indexes create \
  --clusterName <YOUR_CLUSTER_NAME> \
  --file docs/vector-index-config.json
```

Where `docs/vector-index-config.json` contains:
```json
{
  "name": "vector_index",
  "database": "knowledge_handover",
  "collectionName": "chunks",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      },
      {
        "type": "filter",
        "path": "projectId"
      },
      {
        "type": "filter",
        "path": "sourceId"
      }
    ]
  }
}
```

---

## 4. Query-time Aggregation Pipeline Structure

The AI service executes vector searches with strict permission pre-filtering using this MongoDB aggregation pipeline:

```python
pipeline = [
    {
        "$vectorSearch": {
            "index": "vector_index",
            "path": "embedding",
            "queryVector": query_embedding,
            "numCandidates": 50,
            "limit": limit,
            "filter": {
                "$and": [
                    {"projectId": {"$eq": project_id}},
                    {"sourceId": {"$in": allowed_source_ids}}
                ]
            }
        }
    },
    {
        "$project": {
            "_id": 0,
            "chunkId": 1,
            "sourceId": 1,
            "projectId": 1,
            "text": 1,
            "locator": 1,
            "score": {"$meta": "vectorSearchScore"}
        }
    }
]
```

> [!IMPORTANT]
> The `filter` block guarantees that no chunk is ever scored or returned if its `sourceId` is not present in the user's computed `allowedSourceIds`. This satisfies the strict backend security boundary.

