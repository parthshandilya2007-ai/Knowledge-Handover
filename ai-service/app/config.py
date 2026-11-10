import os
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PORT: int = 8000
    MONGODB_URI: str = "mongodb://localhost:27017/knowledge_handover"
    BACKEND_INTERNAL_URL: str = "http://localhost:5000"
    INTERNAL_SERVICE_KEY: str = Field(..., min_length=16, description="Shared secret for Express -> FastAPI calls")
    WEBHOOK_HMAC_SECRET: str = Field(..., min_length=16, description="Shared secret for signing webhooks")

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_PROVIDER: str = "deterministic"
    VECTOR_INDEX_NAME: str = "vector_index"

    @field_validator("BACKEND_INTERNAL_URL", mode="before")
    @classmethod
    def normalize_backend_url(cls, v: str) -> str:
        if not v:
            return "http://localhost:5000"
        val = str(v).strip().rstrip("/")
        if not val.startswith("http://") and not val.startswith("https://"):
            return f"https://{val}"
        return val


settings = Settings()

