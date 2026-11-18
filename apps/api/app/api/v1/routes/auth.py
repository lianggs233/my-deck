from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    CsrfDep,
    CurrentUser,
    DbDep,
    IdempotencyManager,
    idempotency_manager,
)
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ids import new_id, new_token
from app.core.security import (
    hash_password,
    identifier_delivery,
    normalize_identifier,
    password_strength_score,
    sha256_hex,
    validate_identifier,
    verify_password,
)
from app.db.models import LoginAttempt, User
from app.schemas.auth import (
    AuthUserResponse,
    CsrfResponse,
    LoginRequest,
    PasswordResetCompleteRequest,
    PasswordResetStartRequest,
    RegisterCompleteRequest,
    RegisterStartRequest,
    RegisterStartResponse,
    UserPublic,
)
from app.services.sessions import issue_session, revoke_all_user_sessions, revoke_session
from app.services.verification import (
    PURPOSE_PASSWORD_RESET,
    create_challenge,
    create_register_challenge,
    verify_code,
    verify_register_code,
)

router = APIRouter(prefix="/auth", tags=["auth"])
me_router = APIRouter(tags=["auth"])

ROLES = {"TEACHER", "STUDENT"}


def _user_public(user: User) -> UserPublic:
    return UserPublic(id=user.id, display_name=user.display_name, role=user.role)


def _identifier_hint(identifier: str) -> str:
    if "@" in identifier:
        local, _, domain = identifier.partition("@")
        head = local[:2] if len(local) > 2 else local[:1]
        return f"{head}***@{domain}"
    return f"{identifier[:4]}****{identifier[-2:]}"


def _set_session_cookies(response: Response, *, raw_token: str, csrf_token: str) -> None:
    settings = get_settings()
    max_age = settings.session_sliding_days * 86400
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=max_age,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=max_age,
        httponly=False,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def _mask_delivery(channel: str) -> str:
    return channel.lower()


@router.get("/csrf")
async def get_csrf_token(
    request: Request,
    response: Response,
    db: DbDep,
) -> CsrfResponse:
    """登入前後均可取得 CSRF token；匿名以 double-submit cookie 綁定。"""
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    csrf_token = new_token(24)
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        max_age=settings.session_sliding_days * 86400,
        httponly=False,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )
    if raw_token:
        from app.services.sessions import get_valid_session

        session = await get_valid_session(db, raw_token)
        if session is not None:
            session.csrf_token_hash = sha256_hex(csrf_token)
            await db.commit()
    return CsrfResponse(csrf_token=csrf_token)


def _validate_registration_fields(
    *, identifier: str, role: str, display_name: str, password: str
) -> dict[str, str]:
    fields: dict[str, str] = {}
    if not validate_identifier(identifier):
        fields["identifier"] = "請輸入有效的 +852 手機號碼或電郵地址。"
    if role not in ROLES:
        fields["role"] = "角色必須是 TEACHER 或 STUDENT。"
    if not 2 <= len(display_name) <= 30:
        fields["displayName"] = "顯示名稱須為 2–30 個字元。"
    if not 8 <= len(password) <= 64 or password_strength_score(password) < 3:
        fields["password"] = "密碼須為 8–64 個字元且強度不足。"
    return fields


async def _create_user(
    db: AsyncSession, *, identifier: str, display_name: str, role: str, password_hash: str
) -> User:
    user = User(
        id=new_id("usr"),
        identifier=identifier,
        identifier_type="EMAIL" if "@" in identifier else "PHONE",
        display_name=display_name,
        role=role,
        password_hash=password_hash,
    )
    db.add(user)
    await db.flush()
    return user


@router.post("/register/verification-codes", status_code=201)
async def start_registration(
    payload: RegisterStartRequest,
    db: DbDep,
    _: CsrfDep,
) -> RegisterStartResponse:
    settings = get_settings()
    identifier = normalize_identifier(payload.identifier)
    role = payload.role.strip().upper()
    display_name = payload.display_name.strip()

    fields = _validate_registration_fields(
        identifier=identifier, role=role, display_name=display_name, password=payload.password
    )
    if fields:
        raise ApiError(400, "VALIDATION_ERROR", "註冊資料不正確。", fields=fields)

    existing = await db.execute(select(User.id).where(User.identifier == identifier))
    if existing.first() is not None:
        raise ApiError(409, "IDENTIFIER_TAKEN", "此手機號碼或電郵已註冊。")

    registration_payload = {
        "displayName": display_name,
        "role": role,
        "identifier": identifier,
        "passwordHash": hash_password(payload.password),
    }
    channel = identifier_delivery(identifier)
    challenge, _code, _outbox_path = await create_register_challenge(
        db,
        identifier=identifier,
        channel=channel,
        recipient_hint=_identifier_hint(identifier),
        registration_payload=registration_payload,
    )
    await db.commit()
    return RegisterStartResponse(
        challenge_id=challenge.id,
        delivery=_mask_delivery(channel),
        identifier_hint=_identifier_hint(identifier),
        expires_in=settings.verification_code_ttl_seconds,
        resend_after=settings.verification_resend_seconds,
    )


@router.post("/register", status_code=201, response_model=AuthUserResponse)
async def complete_registration(
    payload: RegisterCompleteRequest,
    request: Request,
    response: Response,
    db: DbDep,
    _: CsrfDep,
) -> AuthUserResponse | JSONResponse:
    idem: IdempotencyManager = await idempotency_manager(request, None)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    challenge = await verify_register_code(db, challenge_id=payload.challenge_id, code=payload.code)
    stored = json.loads(challenge.payload_json or "{}")
    display_name = str(stored.get("displayName", ""))
    role = str(stored.get("role", ""))
    identifier = challenge.identifier
    password_hash = str(stored.get("passwordHash", ""))
    if not display_name or role not in ROLES or not password_hash:
        raise ApiError(
            400, "VERIFICATION_CHALLENGE_INVALID", "驗證碼工作階段無效，請重新發送驗證碼。"
        )

    existing = await db.execute(select(User.id).where(User.identifier == identifier))
    if existing.first() is not None:
        raise ApiError(409, "IDENTIFIER_TAKEN", "此手機號碼或電郵已註冊。")

    user = User(
        id=new_id("usr"),
        identifier=identifier,
        identifier_type="EMAIL" if "@" in identifier else "PHONE",
        display_name=display_name,
        role=role,
        password_hash=password_hash,
    )
    db.add(user)
    await db.flush()

    issued = await issue_session(db, user)
    result = AuthUserResponse(user=_user_public(user))
    await idem.store(db, status_code=201, payload=result)
    await db.commit()
    _set_session_cookies(response, raw_token=issued.raw_token, csrf_token=issued.csrf_token)
    return result


@router.post("/register/direct", status_code=201, response_model=AuthUserResponse)
async def register_direct(
    payload: RegisterStartRequest,
    request: Request,
    db: DbDep,
    _: CsrfDep,
) -> AuthUserResponse | JSONResponse:
    """免驗證碼註冊（本版本註冊流程不使用驗證碼）；成功後不簽發工作階段，需另行登入。"""
    idem: IdempotencyManager = await idempotency_manager(request, None)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    identifier = normalize_identifier(payload.identifier)
    role = payload.role.strip().upper()
    display_name = payload.display_name.strip()

    fields = _validate_registration_fields(
        identifier=identifier, role=role, display_name=display_name, password=payload.password
    )
    if fields:
        raise ApiError(400, "VALIDATION_ERROR", "註冊資料不正確。", fields=fields)

    existing = await db.execute(select(User.id).where(User.identifier == identifier))
    if existing.first() is not None:
        raise ApiError(409, "IDENTIFIER_TAKEN", "此手機號碼或電郵已註冊。")

    user = await _create_user(
        db,
        identifier=identifier,
        display_name=display_name,
        role=role,
        password_hash=hash_password(payload.password),
    )
    result = AuthUserResponse(user=_user_public(user))
    await idem.store(db, status_code=201, payload=result)
    await db.commit()
    return result


@router.post("/password-reset/verification-codes", status_code=201)
async def start_password_reset(
    payload: PasswordResetStartRequest,
    db: DbDep,
    _: CsrfDep,
) -> RegisterStartResponse:
    """發送重設密碼驗證碼；為防帳號枚舉，無論帳號是否存在皆回 201。"""
    settings = get_settings()
    identifier = normalize_identifier(payload.identifier)
    hint = _identifier_hint(identifier)
    channel = identifier_delivery(identifier)

    result = await db.execute(select(User.id).where(User.identifier == identifier))
    if result.first() is not None:
        challenge, _code, _outbox_path = await create_challenge(
            db,
            purpose=PURPOSE_PASSWORD_RESET,
            identifier=identifier,
            channel=channel,
            recipient_hint=hint,
            payload={"identifier": identifier},
        )
        await db.commit()
        challenge_id = challenge.id
    else:
        # 帳號不存在：回傳無法通過驗證的假 challenge，避免洩露註冊狀態。
        challenge_id = new_id("vch")

    return RegisterStartResponse(
        challenge_id=challenge_id,
        delivery=_mask_delivery(channel),
        identifier_hint=hint,
        expires_in=settings.verification_code_ttl_seconds,
        resend_after=settings.verification_resend_seconds,
    )


@router.post("/password-reset", status_code=204)
async def complete_password_reset(
    payload: PasswordResetCompleteRequest,
    db: DbDep,
    _: CsrfDep,
) -> Response:
    """以驗證碼重設密碼；成功後撤銷該帳號所有工作階段。"""
    fields: dict[str, str] = {}
    if not 8 <= len(payload.password) <= 64 or password_strength_score(payload.password) < 3:
        fields["password"] = "密碼須為 8–64 個字元且強度不足。"
    if fields:
        raise ApiError(400, "VALIDATION_ERROR", "新密碼不符合安全要求。", fields=fields)

    challenge = await verify_code(
        db,
        purpose=PURPOSE_PASSWORD_RESET,
        challenge_id=payload.challenge_id,
        code=payload.code,
    )
    result = await db.execute(select(User).where(User.identifier == challenge.identifier))
    user = result.scalar_one_or_none()
    if user is None:
        raise ApiError(
            400, "VERIFICATION_CHALLENGE_INVALID", "驗證碼工作階段無效，請重新發送驗證碼。"
        )

    user.password_hash = hash_password(payload.password)
    await revoke_all_user_sessions(db, user.id)
    await db.commit()
    return Response(status_code=204)


@router.post("/login")
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DbDep,
    _: CsrfDep,
) -> AuthUserResponse:
    settings = get_settings()
    identifier = normalize_identifier(payload.identifier)
    ip = request.client.host if request.client else "unknown"
    now = datetime.now(UTC)
    lock_window_start = now - timedelta(minutes=settings.login_lock_minutes)

    failures = await db.execute(
        select(func.count(LoginAttempt.id)).where(
            LoginAttempt.identifier == identifier,
            LoginAttempt.success.is_(False),
            LoginAttempt.created_at >= lock_window_start,
        )
    )
    if (failures.scalar() or 0) >= settings.login_max_failures:
        raise ApiError(429, "LOGIN_LOCKED", "登入失敗次數過多，請稍後再試。")

    result = await db.execute(select(User).where(User.identifier == identifier))
    user = result.scalar_one_or_none()
    ok = user is not None and verify_password(user.password_hash, payload.password)
    db.add(LoginAttempt(identifier=identifier, ip=ip, success=ok))
    if not ok or user is None:
        await db.commit()
        raise ApiError(401, "AUTH_INVALID_CREDENTIALS", "帳號或密碼不正確。")

    issued = await issue_session(db, user)
    await db.commit()
    _set_session_cookies(response, raw_token=issued.raw_token, csrf_token=issued.csrf_token)
    return AuthUserResponse(user=_user_public(user))


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    db: DbDep,
    _: CsrfDep,
) -> Response:
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token:
        from app.services.sessions import get_valid_session

        session = await get_valid_session(db, raw_token)
        if session is not None:
            await revoke_session(db, session)
            await db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")
    response.status_code = 204
    return response


@me_router.get("/me")
async def get_me(user: CurrentUser) -> AuthUserResponse:
    return AuthUserResponse(user=_user_public(user))
