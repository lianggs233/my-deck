"""即時通道（REQ-006 就緒檢查）。

MVP 階段：以 asyncio 背景工作於單一程序內處理課堂狀態更新，
頻道「就緒」即程序健康；後續（REQ-011 同步廣播）會替換為正式 hub
（Redis/Celery 遷移時一併處理，現階段保持介面不變）。
"""


class RealtimeHub:
    """單程序即時通道。後續版本提供廣播與訂閱。"""

    def is_ready(self) -> bool:
        return True


realtime_hub = RealtimeHub()
