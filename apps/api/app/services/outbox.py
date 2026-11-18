from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.config import get_settings


def _outbox_dir() -> Path:
    path = Path(get_settings().outbox_file).parent
    path.mkdir(parents=True, exist_ok=True)
    return path


def append_outbox(message: dict[str, Any]) -> Path:
    """把待發送訊息寫入本機 outbox（MVP 以檔案取代真實 SMS／Email）。"""
    outbox_dir = _outbox_dir()
    stamped = {
        "createdAt": datetime.now(UTC).isoformat(),
        **message,
    }
    file_name = f"{datetime.now(UTC):%Y%m%d%H%M%S%f}-{message.get('channel', 'msg')}.json"
    path = outbox_dir / file_name
    path.write_text(json.dumps(stamped, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def read_outbox() -> list[dict[str, Any]]:
    """讀取全部 outbox 訊息（供 demo 取得驗證碼）。僅在本機開發使用。"""
    outbox_dir = _outbox_dir()
    if not outbox_dir.exists():
        return []
    messages: list[dict[str, Any]] = []
    for path in sorted(outbox_dir.glob("*.json")):
        try:
            messages.append(json.loads(path.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            continue
    return messages


def find_code(channel: str, recipient: str, challenge_id: str) -> str | None:
    """依收件人與 challenge 找出最新驗證碼（demo 用途）。"""
    result: str | None = None
    for message in read_outbox():
        if (
            message.get("channel") == channel
            and message.get("recipient") == recipient
            and message.get("challengeId") == challenge_id
        ):
            code = message.get("code")
            if isinstance(code, str):
                result = code
    return result
