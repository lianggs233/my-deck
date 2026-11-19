import secrets

COURSE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def new_id(prefix: str) -> str:
    """Opaque prefixed identifier, e.g. usr_x9..."""
    return f"{prefix}_{secrets.token_urlsafe(16)}"


def new_course_code() -> str:
    return "".join(secrets.choice(COURSE_CODE_ALPHABET) for _ in range(8))


def new_classroom_code() -> str:
    """6 位課堂碼：大寫字母＋數字，排除 0/O/1/I（REQ-006）。"""
    return "".join(secrets.choice(COURSE_CODE_ALPHABET) for _ in range(6))


def new_guest_name() -> str:
    """訪客隨機顯示名稱（不可修改）：訪客-XXXX，字元集排除易混淆字元（REQ-007）。"""
    suffix = "".join(secrets.choice(COURSE_CODE_ALPHABET) for _ in range(4))
    return f"訪客-{suffix}"


def new_verification_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def new_token(size: int = 32) -> str:
    return secrets.token_urlsafe(size)
