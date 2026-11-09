import hmac
import hashlib
from fastapi import Header, HTTPException, status
from app.config import settings


def verify_internal_key(x_internal_key: str = Header(..., alias="X-Internal-Key")) -> str:
    """
    Validates that the incoming request from Express carries the correct shared internal secret.
    """
    if not hmac.compare_digest(x_internal_key, settings.INTERNAL_SERVICE_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"ok": False, "error": {"code": "UNAUTHORIZED", "message": "Invalid internal service key"}}
        )
    return x_internal_key


def generate_webhook_signature(payload_bytes: bytes) -> str:
    """
    Generates an HMAC-SHA256 signature header formatted as sha256=<hex_digest>
    """
    signature = hmac.new(
        settings.WEBHOOK_HMAC_SECRET.encode("utf-8"),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    return f"sha256={signature}"


def verify_webhook_signature(payload_bytes: bytes, signature_header: str) -> bool:
    """
    Verifies that the provided signature header matches the calculated HMAC-SHA256.
    """
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected_sig = signature_header.split("sha256=")[1]
    calculated_sig = hmac.new(
        settings.WEBHOOK_HMAC_SECRET.encode("utf-8"),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(calculated_sig, expected_sig)

