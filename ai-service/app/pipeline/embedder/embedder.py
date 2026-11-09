import abc
import hashlib
import math
from typing import List
import httpx
from app.config import settings


class BaseEmbedder(abc.ABC):
    @abc.abstractmethod
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        pass


class OpenAIEmbedder(BaseEmbedder):
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model = model

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        # If no API key configured, use deterministic hash vectors
        if not self.api_key or not self.api_key.strip():
            return [generate_deterministic_vector(t) for t in texts]

        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "input": texts,
            "model": self.model
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    # Return embeddings ordered by index
                    sorted_data = sorted(data["data"], key=lambda x: x["index"])
                    return [item["embedding"] for item in sorted_data]
                else:
                    print(f"[OpenAIEmbedder] Warning: API returned {res.status_code}, falling back to deterministic vectors")
                    return [generate_deterministic_vector(t) for t in texts]
        except Exception as e:
            print(f"[OpenAIEmbedder] Exception calling OpenAI: {e}, falling back to deterministic vectors")
            return [generate_deterministic_vector(t) for t in texts]


def generate_deterministic_vector(text: str, dim: int = 1536) -> List[float]:
    """
    Generates a normalized deterministic float vector of dimension `dim` based on SHA-256 hash.
    Used for local test environments when OPENAI_API_KEY is not configured.
    """
    vec = []
    text_bytes = text.encode("utf-8")
    for i in range(dim):
        h = hashlib.sha256(text_bytes + str(i).encode("utf-8")).digest()
        val = (int.from_bytes(h[:4], "big") / 0xFFFFFFFF) - 0.5
        vec.append(val)

    # Normalize vector to unit length
    magnitude = math.sqrt(sum(v * v for v in vec))
    if magnitude > 0:
        vec = [v / magnitude for v in vec]
    return vec


def get_embedder() -> BaseEmbedder:
    return OpenAIEmbedder(
        api_key=settings.OPENAI_API_KEY,
        model=settings.OPENAI_EMBEDDING_MODEL
    )

