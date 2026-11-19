from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="MY_DECK_",
        extra="ignore",
    )

    app_name: str = "My Deck API"
    app_version: str = "0.1.0"
    environment: Literal["development", "test", "production"] = "development"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # 安全與密鑰；正式環境必須以環境變數覆寫。
    secret_key: str = "my-deck-dev-secret-change-me"

    # 資料庫：MVP 本機開發使用 SQLite；正式環境改為 PostgreSQL async URL。
    database_url: str = "sqlite+aiosqlite:///./var/mydeck.db"

    # 本機私有儲存（MVP 取代 S3 的開發適配）。
    storage_dir: Path = Path("./var/storage")
    outbox_file: Path = Path("./var/outbox.log")

    # Session／CSRF Cookie。
    session_cookie_name: str = "my_deck_session"
    csrf_cookie_name: str = "my_deck_csrf"
    csrf_header_name: str = "X-CSRF-Token"
    session_cookie_secure: bool = False
    session_sliding_days: int = 7
    session_idle_hours: int = 168
    session_absolute_days: int = 30

    # 驗證碼與登入鎖定。
    verification_code_ttl_seconds: int = 600
    verification_resend_seconds: int = 60
    verification_max_attempts: int = 5
    login_max_failures: int = 5
    login_lock_minutes: int = 15

    # 課程碼加入限流（REQ-003：對同一學生帳號及來源 IP 的無效嘗試可配置限流）。
    course_join_max_failures: int = 10
    course_join_ip_max_failures: int = 30
    course_join_lock_minutes: int = 15

    # 上傳與轉換。
    upload_expiry_seconds: int = 600
    max_upload_bytes: int = 104_857_600
    max_courseware_pages: int = 100
    converter: Literal["placeholder", "libreoffice"] = "placeholder"
    conversion_timeout_seconds: int = 300

    @property
    def database_sync_url(self) -> str:
        """Sync driver URL for Alembic migrations."""
        return self.database_url.replace("+aiosqlite", "+pysqlite").replace("+asyncpg", "+psycopg")


@lru_cache
def get_settings() -> Settings:
    return Settings()
