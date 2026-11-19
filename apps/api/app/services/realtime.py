"""即時通道（REQ-006 就緒檢查＋REQ-007 課堂狀態推送）。

MVP 階段：單一程序內以 asyncio 佇列廣播，由 SSE 端點（`GET /classrooms/{id}/events`）消費；
學生端同時有 3 秒輪詢作後備，確保推送通道斷線時仍能跟上當前頁。
後續 REQ-008 會以 WebSocket 取代此通道，對外介面保持不變。
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any


class RealtimeHub:
    """單程序即時通道：每個頻道一組訂閱佇列，滿了丟棄最舊事件。"""

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)

    def is_ready(self) -> bool:
        return True

    @asynccontextmanager
    async def subscribe(self, channel: str) -> AsyncIterator[asyncio.Queue[dict[str, Any]]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=8)
        self._subscribers[channel].add(queue)
        try:
            yield queue
        finally:
            self._subscribers[channel].discard(queue)
            if not self._subscribers[channel]:
                self._subscribers.pop(channel, None)

    def publish(self, channel: str, event: dict[str, Any]) -> None:
        for queue in list(self._subscribers.get(channel, ())):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:  # pragma: no cover - 併發下的極窄競態
                    pass
            queue.put_nowait(event)


realtime_hub = RealtimeHub()
