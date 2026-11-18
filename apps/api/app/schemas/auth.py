from __future__ import annotations

from app.schemas.base import ApiModel


class UserPublic(ApiModel):
    id: str
    display_name: str
    role: str


class CsrfResponse(ApiModel):
    csrf_token: str


class RegisterStartRequest(ApiModel):
    display_name: str
    role: str
    identifier: str
    password: str


class RegisterStartResponse(ApiModel):
    challenge_id: str
    delivery: str
    identifier_hint: str
    expires_in: int
    resend_after: int


class RegisterCompleteRequest(ApiModel):
    challenge_id: str
    code: str


class PasswordResetStartRequest(ApiModel):
    identifier: str


class PasswordResetCompleteRequest(ApiModel):
    challenge_id: str
    code: str
    password: str


class PasswordResetDirectRequest(ApiModel):
    identifier: str
    old_password: str
    new_password: str


class LoginRequest(ApiModel):
    identifier: str
    password: str


class AuthUserResponse(ApiModel):
    user: UserPublic
