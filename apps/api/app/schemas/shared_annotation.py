"""共享標註契約（REQ-011～013）。"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.annotation import Position
from app.schemas.base import ApiModel


class SharedAnnotationCreateRequest(ApiModel):
    page_index: int = Field(ge=0)
    content: str = Field(min_length=1, max_length=100)
    # 新建標記必填；加入既有標記（group_id 提供）時忽略
    position: Position | None = None
    group_id: str | None = Field(default=None, max_length=64)


class SharedAnnotationPatchRequest(ApiModel):
    expected_version: int = Field(ge=1)
    content: str | None = Field(default=None, min_length=1, max_length=100)
    position: Position | None = None


class SharedAuthor(ApiModel):
    id: str
    display_name: str
    role: str  # TEACHER / STUDENT


class SharedReplyItem(ApiModel):
    id: str
    content: str
    author: SharedAuthor
    version: int
    created_at: datetime
    updated_at: datetime


class SharedAnnotationItem(ApiModel):
    id: str
    classroom_id: str
    group_id: str
    page_index: int
    content: str
    position: Position
    author: SharedAuthor
    visibility: str  # VISIBLE / HIDDEN（列表不返回 DELETED/CLEARED；對應 api-design §13）
    version: int
    created_at: datetime
    updated_at: datetime
    replies: list[SharedReplyItem]


class SharedAnnotationListResponse(ApiModel):
    items: list[SharedAnnotationItem]
    # 呼叫者能否建立／編輯共享內容（老師或已授權學生）
    can_share: bool


class SharedAnnotationResponse(ApiModel):
    annotation: SharedAnnotationItem


class ReplyCreateRequest(ApiModel):
    content: str = Field(min_length=1, max_length=100)


class ReplyPatchRequest(ApiModel):
    content: str = Field(min_length=1, max_length=100)
    expected_version: int = Field(ge=1)


class ReplyResponse(ApiModel):
    reply: SharedReplyItem


class VisibilityRequest(ApiModel):
    visibility: Literal["VISIBLE", "HIDDEN"]


class ClearPageRequest(ApiModel):
    page_index: int = Field(ge=0)
    confirm: Literal[True]


class ClearPageResponse(ApiModel):
    cleared_count: int
    page_index: int


class SharePermissionRequest(ApiModel):
    granted: bool


class SharePermissionStudent(ApiModel):
    student_id: str
    display_name: str
    granted: bool


class SharePermissionListResponse(ApiModel):
    items: list[SharePermissionStudent]
