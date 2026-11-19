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


class PageTurnRequest(ApiModel):
    direction: Literal["NEXT", "PREV", "GOTO"]
    page_index: int | None = Field(default=None, ge=0)
    expected_state_version: int = Field(ge=1)


class PageStateResponse(ApiModel):
    classroom_id: str
    page_index: int
    page_count: int
    state_version: int
