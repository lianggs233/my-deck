"""課堂活動契約（REQ-014 簽到；REQ-015／016 答題與統計預留同一份模型）。"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.base import ApiModel

ActivityType = Literal["CHECKIN", "SINGLE_CHOICE", "MULTI_CHOICE", "JUDGE", "POLL"]
ActivityStatus = Literal["DRAFT", "OPEN", "CLOSED"]


class ActivityOption(ApiModel):
    id: str = Field(min_length=1, max_length=10)
    text: str = Field(min_length=1, max_length=100)


class ActivityCreateRequest(ApiModel):
    """建立活動；本期只開放 CHECKIN，其餘題型於 REQ-015 啟用。"""

    type: ActivityType
    question: str | None = Field(default=None, max_length=200)
    options: list[ActivityOption] | None = None
    correct_option_ids: list[str] | None = None


class SubmissionCreateRequest(ApiModel):
    """學生提交；簽到不帶答案，答題於 REQ-015 啟用 answers。"""

    answers: list[str] | None = None


class SubmissionItem(ApiModel):
    id: str
    activity_id: str
    student_id: str
    submitted_at: datetime


class ActivityItem(ApiModel):
    id: str
    classroom_id: str
    type: str
    status: str
    question: str | None
    options: list[ActivityOption] | None
    submission_count: int
    participant_count: int
    published_at: datetime | None
    closed_at: datetime | None
    created_at: datetime
    # 學生呼叫時附本人提交狀態；老師／訪客為 None
    my_submission: SubmissionItem | None = None


class ActivityResponse(ApiModel):
    activity: ActivityItem


class ActivityListResponse(ApiModel):
    items: list[ActivityItem]
    # 目前開放中的活動（無則 None），學生端據此顯示簽到入口
    open_activity: ActivityItem | None


class SubmissionResponse(ApiModel):
    submission: SubmissionItem
    # True 表示本次為重試／重複提交，回傳既有記錄而非新建
    already_submitted: bool


class MyResultResponse(ApiModel):
    activity: ActivityItem
    submission: SubmissionItem | None


class SignedStudent(ApiModel):
    student_id: str
    display_name: str
    submitted_at: datetime


class UnsignedStudent(ApiModel):
    student_id: str
    display_name: str


class ActivityResultsResponse(ApiModel):
    """簽到結果（REQ-014）：已簽／未簽名單；答題統計於 REQ-016 擴充。"""

    activity: ActivityItem
    signed: list[SignedStudent]
    unsigned: list[UnsignedStudent]
