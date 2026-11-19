"""即時課堂路由（REQ-006：開始授課；翻頁控制供授課控制頁使用）。"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import (
    CsrfDep,
    CurrentUser,
    DbDep,
    TeacherUser,
    idempotency_manager,
)
from app.core.errors import ApiError
from app.core.ids import new_classroom_code, new_id
from app.db.models import Classroom, Courseware, CoursewarePage
from app.schemas.classroom import (
    ClassroomDetailResponse,
    ClassroomStartRequest,
    ClassroomStartResponse,
    ClassroomSummary,
    JoinInfo,
    JoinInfoResponse,
    PageStateResponse,
    PageTurnRequest,
)
from app.services.realtime import realtime_hub

from .coursewares import READY_STATUSES, _course_for_member, _course_for_teacher

router = APIRouter(tags=["classrooms"])

MAX_CODE_ATTEMPTS = 5
CLASSROOM_LIVE = "LIVE"
CLASSROOM_ENDED = "ENDED"


def _summary(classroom: Classroom, *, include_code: bool) -> ClassroomSummary:
    return ClassroomSummary(
        id=classroom.id,
        course_id=classroom.course_id,
        courseware_id=classroom.courseware_id,
        courseware_version=classroom.courseware_version,
        teacher_id=classroom.teacher_id,
        name=classroom.name,
        code=classroom.code if include_code else None,
        status=classroom.status,
        page_index=classroom.page_index,
        page_count=classroom.page_count,
        state_version=classroom.state_version,
        started_at=classroom.started_at,
        ended_at=classroom.ended_at,
    )


def _join_info(classroom: Classroom) -> JoinInfo:
    return JoinInfo(code=classroom.code, join_url=f"/join/{classroom.code}", can_copy=True)


async def _live_conflict(db: DbDep, course_id: str, teacher_id: str) -> ApiError | None:
    """即時課堂唯一性競態：回查是哪一條唯一索引被撞（同一交易建立前先回應）。"""
    live_in_course = (
        await db.execute(
            select(Classroom).where(
                Classroom.course_id == course_id,
                Classroom.status == CLASSROOM_LIVE,
            )
        )
    ).scalar_one_or_none()
    if live_in_course is not None:
        return ApiError(
            409,
            "CLASSROOM_ALREADY_LIVE_IN_COURSE",
            "此課程已有進行中的課堂。",
            fields={"currentClassroomId": live_in_course.id},
        )
    live_for_teacher = (
        await db.execute(
            select(Classroom).where(
                Classroom.teacher_id == teacher_id,
                Classroom.status == CLASSROOM_LIVE,
            )
        )
    ).scalar_one_or_none()
    if live_for_teacher is not None:
        return ApiError(
            409,
            "CLASSROOM_ALREADY_LIVE_FOR_TEACHER",
            "你已有進行中的課堂。",
            fields={"currentClassroomId": live_for_teacher.id},
        )
    return None


@router.post(
    "/courses/{course_id}/classrooms",
    status_code=201,
    response_model=ClassroomStartResponse,
)
async def start_classroom(
    course_id: str,
    payload: ClassroomStartRequest,
    request: Request,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> ClassroomStartResponse | JSONResponse:
    course = await _course_for_teacher(db, course_id, teacher)

    # 即時通道就緒檢查（REQ-006）：未就緒時拒絕建立，避免孤立課堂
    if not realtime_hub.is_ready():
        raise ApiError(503, "CLASSROOM_CHANNEL_UNAVAILABLE", "即時通道尚未就緒，請稍後再試。")

    courseware = await db.get(Courseware, payload.courseware_id)
    if courseware is None or courseware.course_id != course.id:
        raise ApiError(404, "COURSEWARE_NOT_FOUND", "課件不存在或不屬於此課程。")
    if courseware.status not in READY_STATUSES:
        raise ApiError(409, "COURSEWARE_NOT_READY", "所選課件尚未轉換完成，暫時不可用。")
    page_rows = (
        await db.execute(
            select(func.count())
            .select_from(CoursewarePage)
            .where(CoursewarePage.courseware_id == courseware.id)
        )
    ).scalar_one()
    if (
        courseware.page_count is None
        or courseware.page_count == 0
        or page_rows < courseware.page_count
    ):
        raise ApiError(
            409, "COURSEWARE_RESOURCES_INCOMPLETE", "課件頁面資源不完整，請重新轉換後再試。"
        )

    # 冪等重放須先於唯一性預檢：重送同一請求應取回原課堂，而非撞「已有進行中課堂」
    idem = await idempotency_manager(request, teacher.id)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    conflict = await _live_conflict(db, course.id, teacher.id)
    if conflict is not None:
        raise conflict

    name = (payload.name or "").strip() or Path(courseware.file_name).stem
    classroom: Classroom | None = None
    for attempt in range(MAX_CODE_ATTEMPTS):
        candidate = Classroom(
            id=new_id("cls"),
            course_id=course.id,
            courseware_id=courseware.id,
            courseware_version=courseware.version,
            teacher_id=teacher.id,
            name=name,
            code=new_classroom_code(),
            status=CLASSROOM_LIVE,
            page_index=0,
            page_count=courseware.page_count,
            state_version=1,
        )
        try:
            async with db.begin_nested():
                db.add(candidate)
                await db.flush()
        except IntegrityError:
            # 部分唯一索引（同課程／同老師已有 LIVE 課堂）或課堂碼碰撞
            conflict = await _live_conflict(db, course.id, teacher.id)
            if conflict is not None:
                raise conflict from None
            if attempt == MAX_CODE_ATTEMPTS - 1:
                raise ApiError(
                    500, "CLASSROOM_CODE_GENERATION_FAILED", "系統暫時未能建立課堂，請重試。"
                ) from None
            continue
        classroom = candidate
        break
    assert classroom is not None  # 迴圈結束必有結果或已 raise

    body = ClassroomStartResponse(
        classroom=_summary(classroom, include_code=True),
        join_info=_join_info(classroom),
    )
    await idem.store(db, status_code=201, payload=body)
    await db.commit()
    return body


@router.get("/courses/{course_id}/classrooms/{classroom_id}")
async def get_classroom(
    course_id: str,
    classroom_id: str,
    user: CurrentUser,
    db: DbDep,
) -> ClassroomDetailResponse:
    course = await _course_for_member(db, course_id, user)
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None or classroom.course_id != course.id:
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "課堂不存在。")
    return ClassroomDetailResponse(
        classroom=_summary(classroom, include_code=user.id == classroom.teacher_id),
        course_name=course.name,
    )


@router.get("/classrooms/{classroom_id}/join-info")
async def get_join_info(
    classroom_id: str,
    teacher: TeacherUser,
    db: DbDep,
) -> JoinInfoResponse:
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None:
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "課堂不存在。")
    if classroom.teacher_id != teacher.id:
        raise ApiError(403, "CLASSROOM_FORBIDDEN", "只有負責老師可以查看加入資訊。")
    return JoinInfoResponse(
        join_info=_join_info(classroom),
        classroom_status=classroom.status,
    )


@router.post("/classrooms/{classroom_id}/pages", response_model=PageStateResponse)
async def turn_page(
    classroom_id: str,
    payload: PageTurnRequest,
    request: Request,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> PageStateResponse | JSONResponse:
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None:
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "課堂不存在。")
    if classroom.teacher_id != teacher.id:
        raise ApiError(403, "CLASSROOM_FORBIDDEN", "只有負責老師可以控制課堂。")
    if classroom.status != CLASSROOM_LIVE:
        raise ApiError(409, "CLASSROOM_ENDED", "課堂已結束，無法翻頁。")

    idem = await idempotency_manager(request, teacher.id)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    if payload.expected_state_version != classroom.state_version:
        raise ApiError(
            409,
            "STATE_VERSION_CONFLICT",
            "課堂狀態已更新，請重新整理後再試。",
            fields={
                "currentStateVersion": str(classroom.state_version),
                "currentPageIndex": str(classroom.page_index),
            },
        )

    if payload.direction == "NEXT":
        target = classroom.page_index + 1
    elif payload.direction == "PREV":
        target = classroom.page_index - 1
    else:  # GOTO
        if payload.page_index is None:
            raise ApiError(
                422,
                "VALIDATION_ERROR",
                "跳頁需要提供目標頁碼。",
                fields={"pageIndex": "跳頁需要提供目標頁碼。"},
            )
        target = payload.page_index
    if target < 0 or target >= classroom.page_count:
        raise ApiError(
            409,
            "PAGE_OUT_OF_RANGE",
            "頁碼超出範圍。",
            fields={"currentPageIndex": str(classroom.page_index)},
        )

    if target != classroom.page_index:
        classroom.page_index = target
        classroom.state_version += 1

    body = PageStateResponse(
        classroom_id=classroom.id,
        page_index=classroom.page_index,
        page_count=classroom.page_count,
        state_version=classroom.state_version,
    )
    await idem.store(db, status_code=200, payload=body)
    await db.commit()
    return body
