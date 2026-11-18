from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.base import ApiModel


class CourseCreateRequest(ApiModel):
    name: str = Field(min_length=1, max_length=50)


class CourseSummary(ApiModel):
    id: str
    name: str
    code: str
    created_at: datetime


class CourseCreated(ApiModel):
    course: CourseSummary


class CourseListResponse(ApiModel):
    items: list[CourseSummary]
    page: int
    page_size: int
    total: int


class JoinCourseRequest(ApiModel):
    code: str


class MembershipSummary(ApiModel):
    id: str
    joined_at: datetime
    course: CourseSummary
    teacher_name: str


class MembershipListResponse(ApiModel):
    items: list[MembershipSummary]
    page: int
    page_size: int
    total: int


class CourseDetailCourse(ApiModel):
    id: str
    name: str
    code: str | None = None
    teacher_name: str
    created_at: datetime


class CourseDetailResponse(ApiModel):
    course: CourseDetailCourse
