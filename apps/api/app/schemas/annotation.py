from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.base import ApiModel


class Position(ApiModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)


class AnnotationCreateRequest(ApiModel):
    page_index: int = Field(ge=0)
    content: str = Field(min_length=1, max_length=100)
    position: Position


class AnnotationPatchRequest(ApiModel):
    expected_version: int = Field(ge=1)
    content: str | None = Field(default=None, min_length=1, max_length=100)
    position: Position | None = None


class AnnotationItem(ApiModel):
    id: str
    page_index: int
    content: str
    position: Position
    courseware_version: int
    version: int
    created_at: datetime
    updated_at: datetime


class AnnotationListResponse(ApiModel):
    items: list[AnnotationItem]
    page: int
    page_size: int
    total: int


class AnnotationResponse(ApiModel):
    annotation: AnnotationItem
