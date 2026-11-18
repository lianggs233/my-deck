from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings


def _base_dir() -> Path:
    path = Path(get_settings().storage_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def upload_object_path(object_key: str) -> Path:
    """回傳上傳物件的本機路徑（私有儲存，MVP 以 API 自身代理取代真實預簽 URL）。"""
    return _base_dir() / object_key


def save_bytes(object_key: str, data: bytes) -> Path:
    path = upload_object_path(object_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


async def save_upload_file(object_key: str, file: UploadFile) -> int:
    """串流寫入上傳檔案，回傳位元組大小。"""
    path = upload_object_path(object_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    with path.open("wb") as target:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            target.write(chunk)
    return size


def read_bytes(object_key: str) -> bytes:
    return upload_object_path(object_key).read_bytes()


def exists(object_key: str) -> bool:
    return upload_object_path(object_key).exists()
