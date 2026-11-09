import os

os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-internal-service-key-secret-12345")
os.environ.setdefault("WEBHOOK_HMAC_SECRET", "dev-webhook-hmac-secret-12345678901234567890")
os.environ.setdefault("BACKEND_INTERNAL_URL", "http://localhost:5000")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/knowledge-handover-test")
os.environ.setdefault("OPENAI_MODEL", "gpt-4o")
os.environ.setdefault("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
os.environ.setdefault("EMBEDDING_PROVIDER", "deterministic")
