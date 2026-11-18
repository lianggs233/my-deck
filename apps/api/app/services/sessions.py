from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.ids import new_id, new_token
from app.core.security import sha256_hex
from app.db.base import utcnow
from app.db.models import Session, User


class IssuedSession(NamedTuple):
    session: Session
    raw_token: str
    csrf_token: str


async def issue_session(db: AsyncSession, user: User) -> IssuedSession:
    """登入／註冊成功後簽發新工作階段。"""
    settings = get_settings()
    now = datetime.now(UTC)
    raw_token = new_token(32)
    csrf_token = new_token(24)
    session = Session(
        id=new_id("ses"),
        token_hash=sha256_hex(raw_token),
        csrf_token_hash=sha256_hex(csrf_token),
        user_id=user.id,
        expires_at=now + timedelta(hours=settings.session_idle_hours),
        absolute_expires_at=now + timedelta(days=settings.session_absolute_days),
    )
    db.add(session)
    await db.flush()
    return IssuedSession(session=session, raw_token=raw_token, csrf_token=csrf_token)


async def get_valid_session(db: AsyncSession, raw_token: str) -> Session | None:
    """依 Cookie token 找出有效工作階段；過期或已撤銷回 None。"""
    result = await db.execute(select(Session).where(Session.token_hash == sha256_hex(raw_token)))
    session = result.scalar_one_or_none()
    if session is None:
        return None
    now = utcnow()
    if session.revoked_at is not None:
        return None
    if (
        session.expires_at.replace(tzinfo=UTC) < now
        or session.absolute_expires_at.replace(tzinfo=UTC) < now
    ):
        return None
    return session


async def revoke_session(db: AsyncSession, session: Session) -> None:
    session.revoked_at = utcnow()
    await db.flush()


async def revoke_all_user_sessions(db: AsyncSession, user_id: str) -> int:
    """撤銷指定用戶所有有效工作階段（例如重設密碼後），回傳撤銷數量。"""
    result = await db.execute(
        select(Session).where(
            Session.user_id == user_id,
            Session.revoked_at.is_(None),
        )
    )
    sessions = result.scalars().all()
    now = utcnow()
    for session in sessions:
        session.revoked_at = now
    if sessions:
        await db.flush()
    return len(sessions)


async def touch_session(db: AsyncSession, session: Session) -> None:
    """滑動續期：只在剩餘時間不足一半時更新，避免每個請求都寫入。"""
    settings = get_settings()
    now = utcnow()
    remaining = (session.expires_at.replace(tzinfo=UTC) - now).total_seconds()
    if remaining < settings.session_idle_hours * 3600 / 2:
        new_expiry = now + timedelta(hours=settings.session_idle_hours)
        if new_expiry.replace(tzinfo=UTC) < session.absolute_expires_at.replace(tzinfo=UTC):
            session.expires_at = new_expiry
            await db.flush()
