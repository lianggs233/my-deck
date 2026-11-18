from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ids import new_id, new_verification_code
from app.core.security import canonical_digest, hmac_hex, sha256_hex
from app.db.base import utcnow
from app.db.models import VerificationChallenge
from app.services.outbox import append_outbox


def _error(
    status_code: int, code: str, message: str, fields: dict[str, str] | None = None
) -> ApiError:
    return ApiError(status_code=status_code, code=code, message=message, fields=fields)


async def create_register_challenge(
    db: AsyncSession,
    *,
    identifier: str,
    channel: str,
    recipient_hint: str,
    registration_payload: dict[str, Any],
) -> tuple[VerificationChallenge, str, str]:
    """建立註冊驗證碼 challenge，並把驗證碼寫入 outbox。回傳 (challenge, code, outbox_path)。"""
    settings = get_settings()

    if await _has_pending_challenge(db, identifier):
        raise _error(429, "VERIFICATION_RESEND_TOO_SOON", "驗證碼發送太頻密，請稍後再試。")

    code = new_verification_code()
    challenge = VerificationChallenge(
        id=new_id("vch"),
        purpose="REGISTER",
        identifier=identifier,
        payload_hash=canonical_digest(registration_payload),
        payload_json=json.dumps(registration_payload, ensure_ascii=False),
        code_hash=hmac_hex(code),
        channel=channel,
        attempts=0,
        expires_at=datetime.now(UTC) + timedelta(seconds=settings.verification_code_ttl_seconds),
    )
    db.add(challenge)
    await db.flush()

    outbox_path = append_outbox(
        {
            "channel": channel,
            "recipient": identifier,
            "challengeId": challenge.id,
            "code": code,
            "purpose": "REGISTER",
            "expiresAt": challenge.expires_at.isoformat(),
        }
    )
    return challenge, code, str(outbox_path)


async def _has_pending_challenge(db: AsyncSession, identifier: str) -> bool:
    settings = get_settings()
    cooldown_start = utcnow() - timedelta(seconds=settings.verification_resend_seconds)
    result = await db.execute(
        select(VerificationChallenge.id)
        .where(
            VerificationChallenge.identifier == identifier,
            VerificationChallenge.purpose == "REGISTER",
            VerificationChallenge.used_at.is_(None),
            VerificationChallenge.created_at >= cooldown_start,
        )
        .limit(1)
    )
    return result.first() is not None


async def verify_register_code(
    db: AsyncSession,
    *,
    challenge_id: str,
    code: str,
) -> VerificationChallenge:
    """驗證註冊驗證碼，成功後標記 challenge 已使用。"""
    settings = get_settings()
    result = await db.execute(
        select(VerificationChallenge).where(
            VerificationChallenge.id == challenge_id,
            VerificationChallenge.purpose == "REGISTER",
        )
    )
    challenge = result.scalar_one_or_none()
    if challenge is None or challenge.used_at is not None:
        raise _error(
            400, "VERIFICATION_CHALLENGE_INVALID", "驗證碼工作階段無效，請重新發送驗證碼。"
        )

    if challenge.expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
        raise _error(400, "VERIFICATION_CODE_EXPIRED", "驗證碼已過期，請重新發送。")

    if challenge.attempts >= settings.verification_max_attempts:
        raise _error(429, "VERIFICATION_ATTEMPTS_EXCEEDED", "驗證碼嘗試次數過多，請重新發送。")

    challenge.attempts += 1
    if hmac_hex(code.strip()) != challenge.code_hash:
        await db.flush()
        raise _error(400, "VERIFICATION_CODE_INCORRECT", "驗證碼不正確。")

    challenge.used_at = utcnow()
    await db.flush()
    return challenge


def challenge_payload_digest(challenge: VerificationChallenge) -> str:
    """回傳 challenge 綁定的完整註冊內容摘要。"""
    return sha256_hex(challenge.payload_hash.encode("utf-8"))
