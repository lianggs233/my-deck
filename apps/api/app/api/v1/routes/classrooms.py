"""即時課堂路由（REQ-006：開始授課；REQ-007：學生／訪客加入與快照）。"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import (
    CsrfDep,
    CurrentUser,
    DbDep,
    OptionalUser,
    StudentUser,
    TeacherUser,
    idempotency_manager,
)
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ids import COURSE_CODE_ALPHABET, new_classroom_code, new_guest_name, new_id
from app.db.base import utcnow
from app.db.models import (
    Classroom,
    ClassroomJoinAttempt,
    ClassroomParticipant,
    Course,
    Courseware,
    CoursewarePage,
    GuestIdentity,
)
from app.schemas.classroom import (
    ActiveClassroomResponse,
    ClassroomDetailResponse,
    ClassroomJoinRequest,
    ClassroomJoinResponse,
    ClassroomLiveState,
    ClassroomSnapshot,
    ClassroomSnapshotResponse,
    ClassroomStartRequest,
    ClassroomStartResponse,
    ClassroomSummary,
    JoinInfo,
    JoinInfoResponse,
    PageStateResponse,
    PageTurnRequest,
    ParticipantSummary,
)
from app.services.realtime import realtime_hub

from .coursewares import READY_STATUSES, _course_for_member, _course_for_teacher

router = APIRouter(tags=["classrooms"])

MAX_CODE_ATTEMPTS = 5
CLASSROOM_LIVE = "LIVE"
CLASSROOM_ENDED = "ENDED"
CLASSROOM_CODE_LENGTH = 6


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


def _live_state(classroom: Classroom) -> ClassroomLiveState:
    return ClassroomLiveState(
        id=classroom.id,
        name=classroom.name,
        course_id=classroom.course_id,
        courseware_id=classroom.courseware_id,
        courseware_version=classroom.courseware_version,
        status=classroom.status,
        page_index=classroom.page_index,
        page_count=classroom.page_count,
        state_version=classroom.state_version,
        started_at=classroom.started_at,
    )


def _participant_summary(participant: ClassroomParticipant) -> ParticipantSummary:
    is_guest = participant.role == "GUEST"
    return ParticipantSummary(
        id=participant.id,
        role=participant.role,
        display_name=participant.display_name,
        guest_id=participant.guest_id,
        # 訪客只能觀看目前頁：不可簽到、答題、標註，亦不可查看共享層／老師回覆
        can_write=not is_guest,
        can_view_shared=not is_guest,
    )


async def _snapshot(db: DbDep, classroom: Classroom) -> ClassroomSnapshot:
    page = (
        await db.execute(
            select(CoursewarePage).where(
                CoursewarePage.courseware_id == classroom.courseware_id,
                CoursewarePage.page_index == classroom.page_index,
            )
        )
    ).scalar_one_or_none()
    return ClassroomSnapshot(
        page_index=classroom.page_index,
        page_count=classroom.page_count,
        state_version=classroom.state_version,
        status=classroom.status,
        page_image_url=f"/api/v1/media/{page.full_key}" if page is not None else None,
        page_thumb_url=f"/api/v1/media/{page.thumb_key}" if page is not None else None,
    )


def _parse_classroom_code(raw: str) -> str | None:
    """課堂碼：去首尾空白轉大寫，須為 6 位且字元集排除 0/O/1/I（REQ-007）。"""
    code = raw.strip().upper()
    if len(code) != CLASSROOM_CODE_LENGTH:
        return None
    if any(ch not in COURSE_CODE_ALPHABET for ch in code):
        return None
    return code


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def _ensure_join_allowed(db: DbDep, user_id: str | None, ip: str) -> None:
    """無效課堂碼嘗試限流：帳號與來源 IP 皆計數，達上限一律 429（不查課程，避免泄露）。"""
    settings = get_settings()
    window_start = utcnow() - timedelta(minutes=settings.classroom_join_lock_minutes)
    if user_id is not None:
        account_failures = (
            await db.execute(
                select(func.count(ClassroomJoinAttempt.id)).where(
                    ClassroomJoinAttempt.user_id == user_id,
                    ClassroomJoinAttempt.success.is_(False),
                    ClassroomJoinAttempt.created_at >= window_start,
                )
            )
        ).scalar() or 0
        if account_failures >= settings.classroom_join_max_failures:
            raise ApiError(429, "CLASSROOM_JOIN_RATE_LIMITED", "嘗試次數過多，請稍後再試。")
    ip_failures = (
        await db.execute(
            select(func.count(ClassroomJoinAttempt.id)).where(
                ClassroomJoinAttempt.ip == ip,
                ClassroomJoinAttempt.success.is_(False),
                ClassroomJoinAttempt.created_at >= window_start,
            )
        )
    ).scalar() or 0
    if ip_failures >= settings.classroom_join_ip_max_failures:
        raise ApiError(429, "CLASSROOM_JOIN_RATE_LIMITED", "嘗試次數過多，請稍後再試。")


async def _record_join_attempt(db: DbDep, *, user_id: str | None, ip: str, success: bool) -> None:
    db.add(ClassroomJoinAttempt(user_id=user_id, ip=ip, success=success))
    await db.commit()


async def _resolve_guest(db: DbDep, guest_id: str | None) -> GuestIdentity:
    """訪客身份：帶有效 guestId 重用原身份；否則由服務端建立新的隨機名稱與 ID。"""
    if guest_id:
        identity = await db.get(GuestIdentity, guest_id)
        if identity is None:
            raise ApiError(
                409,
                "GUEST_IDENTITY_INVALID",
                "訪客身份已失效，需確認後建立新身份。",
                fields={"guestId": guest_id},
            )
        identity.last_seen_at = utcnow()
        return identity
    identity = GuestIdentity(id=new_id("gst"), display_name=new_guest_name())
    db.add(identity)
    await db.flush()
    return identity


async def _resolve_participant(
    db: DbDep,
    classroom: Classroom,
    user_id: str | None,
    guest_id: str | None,
) -> ClassroomParticipant:
    """取得（必要時建立）課堂參與者；學生不建立課程成員關係，訪客以 guestId 識別。"""
    if user_id is not None:
        participant = (
            await db.execute(
                select(ClassroomParticipant).where(
                    ClassroomParticipant.classroom_id == classroom.id,
                    ClassroomParticipant.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if participant is not None:
            participant.last_seen_at = utcnow()
            return participant
        participant = ClassroomParticipant(
            id=new_id("prt"),
            classroom_id=classroom.id,
            user_id=user_id,
            guest_id=None,
            role="STUDENT",
            display_name="",
        )
    else:
        identity = await _resolve_guest(db, guest_id)
        participant = (
            await db.execute(
                select(ClassroomParticipant).where(
                    ClassroomParticipant.classroom_id == classroom.id,
                    ClassroomParticipant.guest_id == identity.id,
                )
            )
        ).scalar_one_or_none()
        if participant is not None:
            participant.last_seen_at = utcnow()
            return participant
        participant = ClassroomParticipant(
            id=new_id("prt"),
            classroom_id=classroom.id,
            user_id=None,
            guest_id=identity.id,
            role="GUEST",
            display_name=identity.display_name,
        )
    try:
        async with db.begin_nested():
            db.add(participant)
            await db.flush()
    except IntegrityError:
        # 併發加入：唯一索引保證同一课堂同一身份只有一條參與者記錄
        conditions = (
            ClassroomParticipant.user_id == user_id
            if user_id is not None
            else ClassroomParticipant.guest_id == guest_id
        )
        existing = (
            await db.execute(
                select(ClassroomParticipant).where(
                    ClassroomParticipant.classroom_id == classroom.id,
                    conditions,
                )
            )
        ).scalar_one()
        existing.last_seen_at = utcnow()
        return existing
    return participant


async def _resolve_viewer(
    db: DbDep,
    classroom: Classroom,
    user: CurrentUser | None,
    guest_id: str | None,
) -> ClassroomParticipant | None:
    """快照／事件訂閱的授權：負責老師放行（回 None），學生或訪客必須已加入此課堂。"""
    if user is not None:
        if user.id == classroom.teacher_id:
            return None
        if user.role != "STUDENT":
            raise ApiError(403, "CLASSROOM_FORBIDDEN", "只有本課堂的參與者可以查看課堂內容。")
        participant = (
            await db.execute(
                select(ClassroomParticipant).where(
                    ClassroomParticipant.classroom_id == classroom.id,
                    ClassroomParticipant.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if participant is None:
            raise ApiError(403, "CLASSROOM_PARTICIPANT_REQUIRED", "請先輸入課堂碼加入課堂。")
        return participant
    if guest_id:
        guest_participant = (
            await db.execute(
                select(ClassroomParticipant).where(
                    ClassroomParticipant.classroom_id == classroom.id,
                    ClassroomParticipant.guest_id == guest_id,
                )
            )
        ).scalar_one_or_none()
        if guest_participant is not None:
            return guest_participant
    raise ApiError(403, "CLASSROOM_PARTICIPANT_REQUIRED", "請先輸入課堂碼加入課堂。")


@router.get("/courses/{course_id}/classrooms/active", response_model=ActiveClassroomResponse)
async def get_active_classroom(
    course_id: str,
    user: CurrentUser,
    db: DbDep,
) -> ActiveClassroomResponse:
    """課程入口橫幅：查目前是否有進行中的課堂（已加入課程的學生／老師可讀）。"""
    course = await _course_for_member(db, course_id, user)
    classroom = (
        await db.execute(
            select(Classroom).where(
                Classroom.course_id == course.id,
                Classroom.status == CLASSROOM_LIVE,
            )
        )
    ).scalar_one_or_none()
    return ActiveClassroomResponse(
        classroom=_live_state(classroom) if classroom is not None else None,
        course_name=course.name,
    )


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
    # 推送給已訂閱的學生／訪客（SSE）：翻頁即時同步，輪詢作後備
    realtime_hub.publish(
        f"classroom:{classroom.id}",
        {
            "pageIndex": body.page_index,
            "pageCount": body.page_count,
            "stateVersion": body.state_version,
        },
    )
    return body


@router.post("/classrooms/join", response_model=ClassroomJoinResponse)
async def join_classroom(
    payload: ClassroomJoinRequest,
    request: Request,
    user: OptionalUser,
    db: DbDep,
    _: CsrfDep,
) -> ClassroomJoinResponse:
    """以課堂碼加入（學生或訪客）。

    REQ-007：無效嘗試按帳號及來源 IP 可配置限流；未加入課程的學生加入課堂但不成為課程成員；
    訪客由服務端產生不可修改的隨機名稱及唯一 guestId，重複加入回傳同一參與者記錄。
    """
    ip = _client_ip(request)
    await _ensure_join_allowed(db, user.id if user is not None else None, ip)

    code = _parse_classroom_code(payload.code)
    if code is None:
        await _record_join_attempt(
            db, user_id=user.id if user is not None else None, ip=ip, success=False
        )
        raise ApiError(
            400,
            "CLASSROOM_CODE_INVALID",
            "課堂碼不正確。",
            fields={"code": "課堂碼為 6 位大寫字母或數字。"},
        )

    classroom = (
        await db.execute(select(Classroom).where(Classroom.code == code))
    ).scalar_one_or_none()
    if classroom is None:
        await _record_join_attempt(
            db, user_id=user.id if user is not None else None, ip=ip, success=False
        )
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "找不到此課堂碼對應的課堂。")
    if classroom.status != CLASSROOM_LIVE:
        await _record_join_attempt(
            db, user_id=user.id if user is not None else None, ip=ip, success=False
        )
        raise ApiError(409, "CLASSROOM_ENDED", "課堂已結束，無法加入。")

    if user is not None and user.role != "STUDENT":
        raise ApiError(403, "ROLE_FORBIDDEN", "只有學生或訪客可以加入課堂。")

    participant = await _resolve_participant(
        db,
        classroom,
        user.id if user is not None else None,
        payload.guest_id,
    )
    if participant.display_name == "" and user is not None:
        participant.display_name = user.display_name
    snapshot = await _snapshot(db, classroom)
    body = ClassroomJoinResponse(
        participant=_participant_summary(participant),
        classroom=_live_state(classroom),
        snapshot=snapshot,
    )
    await _record_join_attempt(
        db, user_id=user.id if user is not None else None, ip=ip, success=True
    )
    return body


@router.post("/classrooms/{classroom_id}/join", response_model=ClassroomJoinResponse)
async def join_classroom_from_course(
    classroom_id: str,
    student: StudentUser,
    db: DbDep,
    _: CsrfDep,
) -> ClassroomJoinResponse:
    """已加入課程的學生由課程入口直接加入；重複加入回傳同一參與者記錄。

    REQ-007：加入課堂不會建立課程成員關係；此端點只允許該課程的已加入學生。
    """
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None:
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "課堂不存在。")
    if classroom.status != CLASSROOM_LIVE:
        raise ApiError(409, "CLASSROOM_ENDED", "課堂已結束，無法加入。")
    await _course_for_member(db, classroom.course_id, student)
    participant = await _resolve_participant(db, classroom, student.id, None)
    body = ClassroomJoinResponse(
        participant=_participant_summary(participant),
        classroom=_live_state(classroom),
        snapshot=await _snapshot(db, classroom),
    )
    await db.commit()
    return body


@router.get("/classrooms/{classroom_id}/snapshot", response_model=ClassroomSnapshotResponse)
async def get_classroom_snapshot(
    classroom_id: str,
    user: OptionalUser,
    db: DbDep,
    guest_id: str | None = Query(default=None, alias="guestId"),
) -> ClassroomSnapshotResponse:
    """權威快照：學生重連／輪詢取得教師當前頁與本人可見資料。"""
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None:
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "課堂不存在。")
    participant = await _resolve_viewer(db, classroom, user, guest_id)
    course = await db.get(Course, classroom.course_id)
    return ClassroomSnapshotResponse(
        classroom=_live_state(classroom),
        snapshot=await _snapshot(db, classroom),
        participant=_participant_summary(participant) if participant is not None else None,
        course_name=course.name if course is not None else "",
    )


@router.get("/classrooms/{classroom_id}/events")
async def classroom_events(
    classroom_id: str,
    user: OptionalUser,
    db: DbDep,
    guest_id: str | None = Query(default=None, alias="guestId"),
) -> StreamingResponse:
    """課堂狀態推送（SSE）：老師翻頁後學生／訪客即時跟上；客戶端仍有 3 秒輪詢作後備。"""
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None:
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "課堂不存在。")
    await _resolve_viewer(db, classroom, user, guest_id)
    initial = {
        "pageIndex": classroom.page_index,
        "pageCount": classroom.page_count,
        "stateVersion": classroom.state_version,
    }

    async def event_stream() -> AsyncIterator[str]:
        yield ": connected\n\n"
        # 立即送出目前狀態，讓重連／新訂閱者不必等下一個事件
        yield f"event: state\ndata: {json.dumps(initial, ensure_ascii=False)}\n\n"
        async with realtime_hub.subscribe(f"classroom:{classroom_id}") as queue:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                yield f"event: state\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
