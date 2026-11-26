from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.base import ApiModel


class ClassroomStartRequest(ApiModel):
    courseware_id: str = Field(min_length=1, max_length=64)
    name: str | None = Field(default=None, max_length=50)


class ClassroomSummary(ApiModel):
    id: str
    course_id: str
    courseware_id: str
    courseware_version: int
    teacher_id: str
    name: str
    # 課堂碼僅對負責老師回傳；學生／訪客經 join 流程取得課堂
    code: str | None = None
    status: str  # LIVE / ENDED
    page_index: int
    page_count: int
    state_version: int
    started_at: datetime
    ended_at: datetime | None = None


class JoinInfo(ApiModel):
    code: str
    join_url: str
    can_copy: bool


class ClassroomStartResponse(ApiModel):
    classroom: ClassroomSummary
    join_info: JoinInfo


class ClassroomDetailResponse(ApiModel):
    classroom: ClassroomSummary
    course_name: str


class JoinInfoResponse(ApiModel):
    join_info: JoinInfo
    classroom_status: str


class EndClassroomResponse(ApiModel):
    """REQ-017：結束課堂結果；retention_until 為課後內容保留期截止（結束起 168 小時）。"""

    classroom_id: str
    status: str  # ENDED
    ended_at: datetime
    retention_until: datetime
    state_version: int


class PageTurnRequest(ApiModel):
    direction: Literal["NEXT", "PREV", "GOTO"]
    page_index: int | None = Field(default=None, ge=0)
    expected_state_version: int = Field(ge=1)


class PageStateResponse(ApiModel):
    classroom_id: str
    page_index: int
    page_count: int
    state_version: int


class ClassroomLiveState(ApiModel):
    """學生／訪客可見的課堂即時狀態（不含負責老師、課堂碼等管理資訊）。"""

    id: str
    name: str
    course_id: str
    courseware_id: str
    courseware_version: int
    status: str  # LIVE / ENDED
    page_index: int
    page_count: int
    state_version: int
    started_at: datetime


class ParticipantSummary(ApiModel):
    id: str
    role: str  # STUDENT / GUEST
    display_name: str
    guest_id: str | None = None
    # 訪客只能觀看目前頁；學生可寫入（個人標註等，實際由 REQ-010／011 端點把關）
    can_write: bool
    # 訪客不可查看共享標註層與老師回覆
    can_view_shared: bool


class ClassroomSnapshot(ApiModel):
    page_index: int
    page_count: int
    state_version: int
    status: str
    page_image_url: str | None = None
    page_thumb_url: str | None = None
    # 相鄰頁（後兩頁＋前一頁）圖片位址：學生端預取，老師翻頁時立即顯示（REQ-008 延遲優化）
    prefetch_image_urls: list[str] = Field(default_factory=list)


class ClassroomJoinRequest(ApiModel):
    code: str = Field(min_length=1, max_length=32)
    guest_id: str | None = Field(default=None, max_length=64)


class ClassroomJoinResponse(ApiModel):
    participant: ParticipantSummary
    classroom: ClassroomLiveState
    snapshot: ClassroomSnapshot


class ClassroomSnapshotResponse(ApiModel):
    classroom: ClassroomLiveState
    snapshot: ClassroomSnapshot
    participant: ParticipantSummary | None = None
    course_name: str


class ActiveClassroomResponse(ApiModel):
    classroom: ClassroomLiveState | None = None
    course_name: str
