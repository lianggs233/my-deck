import secrets

COURSE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_id(prefix: str) -> str:
    """Opaque prefixed identifier, e.g. usr_x9..."""
    return f"{prefix}_{secrets.token_urlsafe(16)}"


def new_course_code() -> str:
    return "".join(secrets.choice(COURSE_CODE_ALPHABET) for _ in range(8))


def new_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def new_token(size: int = 32) -> str:
    return secrets.token_urlsafe(size)
