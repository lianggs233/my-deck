from __future__ import annotations

import hmac
import json
from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ids import new_id
from app.core.security import sha256_hex
from app.db.engine import get_db
from app.db.models import IdempotencyRecord, Session, User
from app.services.sessions import get_valid_session, touch_session

DbDep = Annotated[AsyncSession, Depends(get_db)]

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def get_current_session(request: Request, response: Response, db: DbDep) -> Session:
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        raise ApiError(401, "SESSION_INVALID", "尚未登入或工作階段已失效。")
    session = await get_valid_session(db, raw_token)
    if session is None:
        raise ApiError(401, "SESSION_INVALID", "尚未登入或工作階段已失效。")
    await touch_session(db, session)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=settings.session_sliding_days * 86400,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )
    return session


async def get_current_user(
    session: Annotated[Session, Depends(get_current_session)], db: DbDep
) -> User:
    result = await db.execute(select(User).where(User.id == session.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise ApiError(401, "SESSION_INVALID", "尚未登入或工作階段已失效。")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: str) -> Callable[[User], Coroutine[Any, Any, User]]:
    async def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise ApiError(403, "ROLE_FORBIDDEN", "目前帳號沒有此操作的權限。")
        return user

    return checker


TeacherUser = Annotated[User, Depends(require_role("TEACHER"))]
StudentUser = Annotated[User, Depends(require_role("STUDENT"))]


def verify_csrf(request: Request, session: Session | None) -> None:
    """CSRF 檢查：已登入時比對 session 綁定 token，匿名時用 double-submit cookie。"""
    if request.method in SAFE_METHODS:
        return
    settings = get_settings()
    header_token = request.headers.get("x-csrf-token", "")
    cookie_token = request.cookies.get(settings.csrf_cookie_name)
    if not header_token or not cookie_token or not hmac.compare_digest(header_token, cookie_token):
        raise ApiError(403, "CSRF_INVALID", "CSRF 驗證失敗，請重新整理後再試。")
    if session is not None and not hmac.compare_digest(
        sha256_hex(header_token), session.csrf_token_hash
    ):
        raise ApiError(403, "CSRF_INVALID", "CSRF 驗證失敗，請重新整理後再試。")


async def csrf_check(request: Request, db: DbDep) -> None:
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    session = await get_valid_session(db, raw_token) if raw_token else None
    verify_csrf(request, session)


CsrfDep = Annotated[None, Depends(csrf_check)]


class IdempotencyManager:
    """Idempotency-Key 重放：相同 key＋內容回傳原結果，不同內容回 409。"""

    def __init__(
        self, *, key: str | None, user_id: str | None, method: str, path: str, body: bytes
    ) -> None:
        self.key = key
        self.user_id = user_id
        self.method = method
        self.path = path
        self.request_hash = sha256_hex(body)

    async def lookup(self, db: AsyncSession) -> JSONResponse | None:
        if not self.key:
            return None
        result = await db.execute(
            select(IdempotencyRecord).where(
                IdempotencyRecord.key == self.key,
                IdempotencyRecord.user_id == self.user_id,
                IdempotencyRecord.method == self.method,
                IdempotencyRecord.path == self.path,
            )
        )
        record = result.scalar_one_or_none()
        if record is None:
            return None
        if record.request_hash != self.request_hash:
            raise ApiError(
                409, "IDEMPOTENCY_CONFLICT", "相同的 Idempotency-Key 不可重複用於不同內容。"
            )
        body: Any = json.loads(record.response_body or "null")
        return JSONResponse(status_code=record.response_status or 200, content=body)

    async def store(
        self, db: AsyncSession, *, status_code: int, payload: BaseModel | dict[str, Any]
    ) -> None:
        if not self.key:
            return
        body = (
            payload.model_dump(mode="json", by_alias=True)
            if isinstance(payload, BaseModel)
            else payload
        )
        record = IdempotencyRecord(
            id=new_id("idr"),
            key=self.key,
            user_id=self.user_id,
            method=self.method,
            path=self.path,
            request_hash=self.request_hash,
            response_status=status_code,
            response_body=json.dumps(body, ensure_ascii=False),
        )
        db.add(record)
        await db.flush()


async def idempotency_manager(request: Request, user_id: str | None = None) -> IdempotencyManager:
    body = await request.body()
    return IdempotencyManager(
        key=request.headers.get("idempotency-key"),
        user_id=user_id,
        method=request.method,
        path=request.url.path,
        body=body,
    )
