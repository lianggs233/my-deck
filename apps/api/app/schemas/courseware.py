from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.base import ApiModel


class UploadCreateRequest(ApiModel):
    file_name: str = Field(min_length=1, max_length=255)
    byte_size: int = Field(ge=1)
    content_type: str


class UploadCreateResponse(ApiModel):
    upload_id: str
    upload_url: str
    method: str
    headers: dict[str, str]
    expires_at: datetime
    max_bytes: int


class UploadCompleteRequest(ApiModel):
    sha256: str = Field(min_length=64, max_length=64)


class CoursewareSummary(ApiModel):
    id: str
    file_name: str
    page_count: int | None
    version: int
    status: str
    warning: str | None = None
    updated_at: datetime


class CoursewareListResponse(ApiModel):
    items: list[CoursewareSummary]
    page: int
    page_size: int
    total: int


class CoursewareFailure(ApiModel):
    code: str | None = None
    message: str | None = None
    detail: str | None = None


class CoursewareDetail(CoursewareSummary):
    conversion_due_at: datetime | None = None
    can_retry: bool
    can_preview: bool
    failure: CoursewareFailure | None = None


class CoursewareDetailResponse(ApiModel):
    courseware: CoursewareDetail


class PreviewPage(ApiModel):
    index: int
    full: str
    thumb: str
    width: int
    height: int
    version: int


class CoursewarePagesResponse(ApiModel):
    courseware_id: str
    version: int
    pages: list[PreviewPage]


class RetryResponse(ApiModel):
    courseware_id: str
    status: str
    attempt_no: int
