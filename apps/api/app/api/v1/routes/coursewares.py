from __future__ import annotations

import asyncio
import hashlib
from datetime import timedelta

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    CsrfDep,
    CurrentUser,
    DbDep,
    IdempotencyManager,
    TeacherUser,
    idempotency_manager,
)
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ids import new_id
from app.core.security import sha256_file
from app.db.base import utcnow
from app.db.models import (
    ConversionAttempt,
    Course,
    CourseMembership,
    Courseware,
    CoursewarePage,
    Upload,
    User,
)
from app.schemas.courseware import (
    ConversionAttemptItem,
    CoursewareDetail,
    CoursewareDetailResponse,
    CoursewareFailure,
    CoursewareListResponse,
    CoursewarePagesResponse,
    CoursewareSummary,
    PreviewPage,
    RetryResponse,
    UploadCompleteRequest,
    UploadCreateRequest,
    UploadCreateResponse,
)
from app.services.conversion import (
    mark_conversion_timed_out,
    next_attempt_no,
    run_conversion,
)
from app.services.storage import exists, upload_object_path

router = APIRouter(tags=["coursewares"])

READY_STATUSES = {"READY", "READY_WITH_WARNINGS"}
MAX_PAGE_SIZE = 50


async def _course_for_teacher(db: AsyncSession, course_id: str, teacher: User) -> Course:
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if course is None:
        raise ApiError(404, "COURSE_NOT_FOUND", "課程不存在。")
    if course.teacher_id != teacher.id:
        raise ApiError(403, "COURSE_FORBIDDEN", "只能管理自己負責的課程。")
    return course


async def _course_for_member(db: AsyncSession, course_id: str, user: User) -> Course:
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if course is None:
        raise ApiError(404, "COURSE_NOT_FOUND", "課程不存在。")
    if user.role == "TEACHER":
        if course.teacher_id != user.id:
            raise ApiError(403, "COURSE_FORBIDDEN", "只能查看自己負責的課程。")
        return course
    membership = await db.execute(
        select(CourseMembership.id).where(
            CourseMembership.course_id == course.id,
            CourseMembership.student_id == user.id,
        )
    )
    if membership.first() is None:
        raise ApiError(403, "COURSE_FORBIDDEN", "尚未加入此課程。")
    return course


async def _courseware(db: AsyncSession, course_id: str, courseware_id: str) -> Courseware:
    result = await db.execute(
        select(Courseware).where(Courseware.id == courseware_id, Courseware.course_id == course_id)
    )
    courseware = result.scalar_one_or_none()
    if courseware is None:
        raise ApiError(404, "COURSEWARE_NOT_FOUND", "課件不存在。")
    return courseware


def _summary(courseware: Courseware) -> CoursewareSummary:
    return CoursewareSummary(
        id=courseware.id,
        file_name=courseware.file_name,
        byte_size=courseware.byte_size,
        page_count=courseware.page_count,
        version=courseware.version,
        status=courseware.status,
        warning=courseware.warning,
        created_at=courseware.created_at,
        updated_at=courseware.updated_at,
    )


async def _detail(
    db: AsyncSession, courseware: Courseware, *, is_teacher: bool
) -> CoursewareDetail:
    settings = get_settings()
    due_at = None
    if courseware.conversion_started_at is not None:
        due_at = courseware.conversion_started_at + timedelta(
            seconds=settings.conversion_timeout_seconds
        )
    failure = None
    if is_teacher and courseware.failure_code:
        failure = CoursewareFailure(
            code=courseware.failure_code,
            message=courseware.failure_message,
            detail=courseware.failure_detail,
        )
    attempt_rows = (
        (
            await db.execute(
                select(ConversionAttempt)
                .where(ConversionAttempt.courseware_id == courseware.id)
                .order_by(ConversionAttempt.attempt_no.asc())
            )
        )
        .scalars()
        .all()
    )
    attempts = [
        ConversionAttemptItem(
            attempt_no=attempt.attempt_no,
            status=attempt.status,
            error_code=attempt.error_code,
            error_message=attempt.error_message,
            started_at=attempt.started_at,
            finished_at=attempt.finished_at,
        )
        for attempt in attempt_rows
    ]
    return CoursewareDetail(
        **_summary(courseware).model_dump(),
        conversion_due_at=due_at if is_teacher else None,
        can_retry=is_teacher and courseware.status in {"FAILED", "TIMED_OUT"},
        can_preview=courseware.status in READY_STATUSES,
        failure=failure,
        latest_attempt=attempt_rows[-1].attempt_no if attempt_rows else 0,
        attempts=attempts,
    )


# 背景轉換任務的強引用集合：事件循環只弱引用 task，
# 不保留引用可能導致任務在完成前被 GC 回收而永久停在 CONVERTING。
_BACKGROUND_TASKS: set[asyncio.Task[None]] = set()


def _start_conversion(courseware: Courseware, attempt: ConversionAttempt) -> None:
    """標記進入轉換中（隨請求交易一併 commit）；背景任務由 _launch_conversion 啟動。"""
    courseware.status = "CONVERTING"
    # 逾時計時從本次嘗試開始起算（2026-11-19 確認：每次手動重試有獨立窗口），
    # 不因查看、離開或刷新重新起算。
    courseware.conversion_started_at = utcnow()
    courseware.failure_code = None
    courseware.failure_message = None
    courseware.failure_detail = None
    courseware.warning = None


def _launch_conversion(courseware_id: str, attempt_no: int) -> None:
    """commit 後才啟動背景轉換：新任務以獨立 session 讀取課件，
    若在 commit 前啟動會讀不到未落庫的課件而靜默結束（課件卡在轉換中）。"""
    task = asyncio.create_task(_run_conversion_with_timeout(courseware_id, attempt_no))
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


async def _run_conversion_with_timeout(courseware_id: str, attempt_no: int) -> None:
    """watchdog：轉換超過 conversion_timeout_seconds 即標 TIMED_OUT 並提供重試入口。"""
    settings = get_settings()
    try:
        await asyncio.wait_for(
            run_conversion(courseware_id, attempt_no),
            timeout=settings.conversion_timeout_seconds,
        )
    except TimeoutError:
        await mark_conversion_timed_out(courseware_id, attempt_no)


@router.post(
    "/courses/{course_id}/coursewares/uploads",
    status_code=201,
    response_model=UploadCreateResponse,
)
async def create_upload(
    course_id: str,
    payload: UploadCreateRequest,
    request: Request,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> UploadCreateResponse | JSONResponse:
    settings = get_settings()
    await _course_for_teacher(db, course_id, teacher)
    if payload.byte_size > settings.max_upload_bytes:
        raise ApiError(
            422,
            "UPLOAD_TOO_LARGE",
            "檔案超過大小上限。",
            fields={"byteSize": f"檔案不可超過 {settings.max_upload_bytes} bytes。"},
        )
    file_name = payload.file_name.strip()
    if not file_name.lower().endswith((".pptx", ".ppt")):
        raise ApiError(
            422,
            "UNSUPPORTED_FORMAT",
            "只支援 .pptx 或 .ppt 簡報檔。",
            fields={"fileName": "副檔名必須是 .pptx 或 .ppt。"},
        )

    idem: IdempotencyManager = await idempotency_manager(request, teacher.id)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    upload = Upload(
        id=new_id("upl"),
        course_id=course_id,
        file_name=file_name,
        byte_size=payload.byte_size,
        content_type=payload.content_type,
        status="CREATED",
        object_key=f"uploads/{new_id('obj')}/{file_name}",
    )
    db.add(upload)
    await db.flush()
    result = UploadCreateResponse(
        upload_id=upload.id,
        upload_url=f"/api/v1/uploads/{upload.id}/content",
        method="PUT",
        headers={"Content-Type": payload.content_type},
        expires_at=utcnow() + timedelta(seconds=settings.upload_expiry_seconds),
        max_bytes=settings.max_upload_bytes,
    )
    await idem.store(db, status_code=201, payload=result)
    await db.commit()
    return result


@router.put("/uploads/{upload_id}/content")
async def receive_upload_content(
    upload_id: str,
    request: Request,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> dict[str, str]:
    """本機開發適配：以 API 自身端點取代真實預簽 URL，接收原始檔案位元組。"""
    settings = get_settings()
    result = await db.execute(select(Upload).where(Upload.id == upload_id))
    upload = result.scalar_one_or_none()
    if upload is None:
        raise ApiError(404, "UPLOAD_NOT_FOUND", "上傳工作不存在。")
    await _course_for_teacher(db, upload.course_id, teacher)
    if upload.status == "RECEIVED":
        return {"status": "RECEIVED", "sha256": upload.sha256_expected or ""}

    # 邊收邊寫檔並增量計算 SHA-256：避免 `await request.body()` 把整個檔案載入記憶體
    target = upload_object_path(upload.object_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_path = target.with_name(f"{target.name}.part")
    hasher = hashlib.sha256()
    size = 0
    try:
        with temp_path.open("wb") as handle:
            async for chunk in request.stream():
                if not chunk:
                    continue
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    raise ApiError(422, "UPLOAD_TOO_LARGE", "檔案超過大小上限。")
                hasher.update(chunk)
                handle.write(chunk)
        if size == 0:
            raise ApiError(400, "VALIDATION_ERROR", "上傳內容不可為空。")
        temp_path.replace(target)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise

    upload.byte_size = size
    upload.sha256_expected = hasher.hexdigest()
    upload.status = "RECEIVED"
    await db.commit()
    return {"status": "RECEIVED", "sha256": upload.sha256_expected}


@router.post(
    "/courses/{course_id}/coursewares/{upload_id}/upload/complete",
    status_code=201,
    response_model=CoursewareDetailResponse,
)
async def complete_upload(
    course_id: str,
    upload_id: str,
    payload: UploadCompleteRequest,
    request: Request,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> CoursewareDetailResponse | JSONResponse:
    await _course_for_teacher(db, course_id, teacher)
    result = await db.execute(
        select(Upload).where(Upload.id == upload_id, Upload.course_id == course_id)
    )
    upload = result.scalar_one_or_none()
    if upload is None:
        raise ApiError(404, "UPLOAD_NOT_FOUND", "上傳工作不存在。")
    if upload.status != "RECEIVED" or not exists(upload.object_key):
        raise ApiError(409, "UPLOAD_NOT_RECEIVED", "尚未收到檔案內容，請先完成上傳。")

    actual = sha256_file(upload_object_path(upload.object_key))
    if actual != payload.sha256.lower():
        raise ApiError(
            422,
            "CHECKSUM_MISMATCH",
            "檔案校驗碼不符，請重新上傳。",
            fields={"sha256": "伺服器計算的校驗碼與提交不符。"},
        )

    idem: IdempotencyManager = await idempotency_manager(request, teacher.id)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    existing = await db.execute(select(Courseware).where(Courseware.upload_id == upload.id))
    courseware = existing.scalar_one_or_none()
    launch: tuple[str, int] | None = None
    if courseware is None:
        courseware = Courseware(
            id=new_id("cw"),
            course_id=course_id,
            upload_id=upload.id,
            file_name=upload.file_name,
            byte_size=upload.byte_size,
            status="QUEUED",
            original_object_key=upload.object_key,
        )
        db.add(courseware)
        await db.flush()
        attempt_no = await next_attempt_no(db, courseware.id)
        attempt = ConversionAttempt(
            id=new_id("cva"), courseware_id=courseware.id, attempt_no=attempt_no, status="RUNNING"
        )
        db.add(attempt)
        await db.flush()
        _start_conversion(courseware, attempt)
        launch = (courseware.id, attempt.attempt_no)
    result_body = CoursewareDetailResponse(
        courseware=await _detail(db, courseware, is_teacher=True)
    )
    await idem.store(db, status_code=201, payload=result_body)
    await db.commit()
    if launch is not None:
        _launch_conversion(*launch)
    return result_body


@router.get("/courses/{course_id}/coursewares")
async def list_coursewares(
    course_id: str,
    user: CurrentUser,
    db: DbDep,
    page: int = 1,
    page_size: int = 20,
) -> CoursewareListResponse:
    await _course_for_member(db, course_id, user)
    if page < 1 or not 1 <= page_size <= MAX_PAGE_SIZE:
        raise ApiError(400, "VALIDATION_ERROR", "分頁參數不正確。")
    base = select(Courseware).where(Courseware.course_id == course_id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                base.order_by(Courseware.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return CoursewareListResponse(
        items=[_summary(courseware) for courseware in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/courses/{course_id}/coursewares/{courseware_id}")
async def get_courseware(
    course_id: str, courseware_id: str, user: CurrentUser, db: DbDep
) -> CoursewareDetailResponse:
    await _course_for_member(db, course_id, user)
    courseware = await _courseware(db, course_id, courseware_id)
    return CoursewareDetailResponse(
        courseware=await _detail(db, courseware, is_teacher=user.role == "TEACHER")
    )


@router.get("/courses/{course_id}/coursewares/{courseware_id}/pages")
async def get_courseware_pages(
    course_id: str, courseware_id: str, user: CurrentUser, db: DbDep
) -> CoursewarePagesResponse:
    await _course_for_member(db, course_id, user)
    courseware = await _courseware(db, course_id, courseware_id)
    if courseware.status not in READY_STATUSES:
        raise ApiError(409, "COURSEWARE_NOT_READY", "課件尚未轉換完成，暫時不能預覽。")
    rows = (
        (
            await db.execute(
                select(CoursewarePage)
                .where(CoursewarePage.courseware_id == courseware.id)
                .order_by(CoursewarePage.page_index.asc())
            )
        )
        .scalars()
        .all()
    )
    pages = [
        PreviewPage(
            index=page.page_index,
            full=f"/api/v1/media/{page.full_key}",
            thumb=f"/api/v1/media/{page.thumb_key}",
            width=page.width,
            height=page.height,
            version=page.version,
        )
        for page in rows
    ]
    return CoursewarePagesResponse(
        courseware_id=courseware.id, version=courseware.version, pages=pages
    )


@router.post(
    "/courses/{course_id}/coursewares/{courseware_id}/conversion-attempts",
    status_code=202,
    response_model=RetryResponse,
)
async def retry_conversion(
    course_id: str,
    courseware_id: str,
    request: Request,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> RetryResponse | JSONResponse:
    await _course_for_teacher(db, course_id, teacher)
    courseware = await _courseware(db, course_id, courseware_id)
    if courseware.status not in {"FAILED", "TIMED_OUT"}:
        raise ApiError(409, "CONVERSION_NOT_RETRYABLE", "只有失敗或逾時的課件可以重新轉換。")

    idem: IdempotencyManager = await idempotency_manager(request, teacher.id)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    attempt_no = await next_attempt_no(db, courseware.id)
    attempt = ConversionAttempt(
        id=new_id("cva"), courseware_id=courseware.id, attempt_no=attempt_no, status="RUNNING"
    )
    db.add(attempt)
    await db.flush()
    _start_conversion(courseware, attempt)
    result = RetryResponse(
        courseware_id=courseware.id, status=courseware.status, attempt_no=attempt_no
    )
    await idem.store(db, status_code=202, payload=result)
    await db.commit()
    _launch_conversion(courseware.id, attempt_no)
    return result


@router.get("/media/{object_key:path}")
async def serve_media(object_key: str, user: CurrentUser, db: DbDep) -> FileResponse:
    """授權後提供轉換頁面圖；老師限本人課程，學生限已加入課程。"""
    result = await db.execute(
        select(CoursewarePage, Courseware)
        .join(Courseware, Courseware.id == CoursewarePage.courseware_id)
        .where(or_(CoursewarePage.full_key == object_key, CoursewarePage.thumb_key == object_key))
    )
    row = result.first()
    if row is None:
        raise ApiError(404, "MEDIA_NOT_FOUND", "資源不存在。")
    page, courseware = row
    await _course_for_member(db, courseware.course_id, user)
    path = upload_object_path(object_key)
    if not path.exists():
        raise ApiError(404, "MEDIA_NOT_FOUND", "資源不存在。")
    return FileResponse(path, media_type="image/webp")


# 保留給註解路由使用的查詢工具。
async def courseware_for_annotation_access(
    db: AsyncSession, course_id: str, courseware_id: str, user: User
) -> Courseware:
    if user.role != "STUDENT":
        raise ApiError(403, "PERSONAL_ANNOTATION_FORBIDDEN", "個人標註只開放給學生本人管理。")
    await _course_for_member(db, course_id, user)
    return await _courseware(db, course_id, courseware_id)


__all__ = ["router", "courseware_for_annotation_access"]
