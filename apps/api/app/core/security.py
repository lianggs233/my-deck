import hashlib
import hmac
import json
import re
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error, VerificationError, VerifyMismatchError
from zxcvbn import zxcvbn

from app.core.config import get_settings

_password_hasher = PasswordHasher()

PHONE_PATTERN = re.compile(r"^\+852\d{8}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_identifier(identifier: str) -> str:
    value = identifier.strip()
    if EMAIL_PATTERN.match(value):
        return value.lower()
    compact = re.sub(r"[\s-]+", "", value)
    if compact.startswith("00"):
        compact = "+" + compact[2:]
    return compact


def identifier_delivery(identifier: str) -> str:
    return "EMAIL" if "@" in identifier else "SMS"


def validate_identifier(identifier: str) -> bool:
    return bool(PHONE_PATTERN.match(identifier) or EMAIL_PATTERN.match(identifier))


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, Argon2Error):
        return False


def password_strength_score(password: str) -> int:
    result: dict[str, Any] = zxcvbn(password)
    score = result.get("score", 0)
    return int(score)


def sha256_hex(value: str | bytes) -> str:
    data = value.encode("utf-8") if isinstance(value, str) else value
    return hashlib.sha256(data).hexdigest()


def hmac_hex(value: str) -> str:
    secret = get_settings().secret_key.encode("utf-8")
    return hmac.new(secret, value.encode("utf-8"), hashlib.sha256).hexdigest()


def constant_time_equal(left: str, right: str) -> bool:
    return hmac.compare_digest(left, right)


def canonical_digest(payload: dict[str, Any]) -> str:
    """HMAC digest binding a verification challenge to its canonical payload."""
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hmac_hex(canonical)
