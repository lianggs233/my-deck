from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import (
    CsrfDep,
    CurrentUser,
    DbDep,
    IdempotencyManager,
    StudentUser,
    TeacherUser,
    idempotency_manager,
)
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.ids import new_course_code, new_id
from app.db.models import Course, CourseJoinAttempt, CourseMembership, User
from app.schemas.course import (
    CourseCreated,
    CourseCreateRequest,
    CourseDetailCourse,
    CourseDetailResponse,
    CourseListResponse,
    CourseSummary,
    JoinCourseRequest,
    MembershipListResponse,
    MembershipSummary,
)

router = APIRouter(tags=["courses"])

MAX_PAGE_SIZE = 50

# 課程碼碰撞重試上限：8 位碼空間極大（32^8），連續碰撞 5 次視為異常並回報可重試錯誤
MAX_CODE_ATTEMPTS = 5


def _course_summary(course: Course) -> CourseSummary:
    return CourseSummary(
        id=course.id, name=course.name, code=course.code, created_at=course.created_at
    )


def _paging(page: int, page_size: int) -> tuple[int, int]:
    if page < 1:
        raise ApiError(
            400, "VALIDATION_ERROR", "分頁參數不正確。", fields={"page": "page 必須 ≥ 1。"}
        )
    if not 1 <= page_size <= MAX_PAGE_SIZE:
        raise ApiError(
            400,
            "VALIDATION_ERROR",
            "分頁參數不正確。",
            fields={"pageSize": f"pageSize 必須介乎 1–{MAX_PAGE_SIZE}。"},
        )
    return page, page_size


@router.post("/courses", status_code=201, response_model=CourseCreated)
async def create_course(
    payload: CourseCreateRequest,
    request: Request,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> CourseCreated | JSONResponse:
    idem: IdempotencyManager = await idempotency_manager(request, teacher.id)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    name = payload.name.strip()
    if not name:
        raise ApiError(
            400, "VALIDATION_ERROR", "課程名稱不正確。", fields={"name": "名稱不可為空白。"}
        )
    course: Course | None = None
    for _attempt in range(MAX_CODE_ATTEMPTS):
        candidate = Course(
            id=new_id("crs"), name=name, code=new_course_code(), teacher_id=teacher.id
        )
        try:
            # savepoint 內才 add＋flush：碰撞時只回滾本次插入，不影響同一交易內的其他操作
            async with db.begin_nested():
                db.add(candidate)
                await db.flush()
        except IntegrityError:
            # 課程碼唯一約束碰撞：savepoint 回滾後候選已 detached，直接重新生成
            continue
        course = candidate
        break
    if course is None:
        raise ApiError(503, "COURSE_CODE_GENERATION_FAILED", "系統暫時未能建立課程，請重試。")
    result = CourseCreated(course=_course_summary(course))
    await idem.store(db, status_code=201, payload=result)
    await db.commit()
    return result


@router.get("/courses")
async def list_courses(
    teacher: TeacherUser, db: DbDep, page: int = 1, page_size: int = 20
) -> CourseListResponse:
    page, page_size = _paging(page, page_size)
    base = select(Course).where(Course.teacher_id == teacher.id)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                base.order_by(Course.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return CourseListResponse(
        items=[_course_summary(course) for course in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/me/course-memberships")
async def list_memberships(
    student: StudentUser, db: DbDep, page: int = 1, page_size: int = 20
) -> MembershipListResponse:
    page, page_size = _paging(page, page_size)
    base = (
        select(CourseMembership, Course, User)
        .join(Course, Course.id == CourseMembership.course_id)
        .join(User, User.id == Course.teacher_id)
        .where(CourseMembership.student_id == student.id)
    )
    total = (
        await db.execute(
            select(func.count())
            .select_from(CourseMembership)
            .where(CourseMembership.student_id == student.id)
        )
    ).scalar_one()
    rows = (
        await db.execute(
            base.order_by(CourseMembership.joined_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    items = [
        MembershipSummary(
            id=membership.id,
            joined_at=membership.joined_at,
            course=_course_summary(course),
            teacher_name=teacher.display_name,
        )
        for membership, course, teacher in rows
    ]
    return MembershipListResponse(items=items, page=page, page_size=page_size, total=total)


@router.post("/course-memberships/join", status_code=201)
async def join_course(
    payload: JoinCourseRequest,
    request: Request,
    student: StudentUser,
    db: DbDep,
    _: CsrfDep,
) -> JSONResponse:
    """以課程碼加入課程；重複加入回傳原成員記錄（冪等）。

    REQ-003 安全限制：對同一學生帳號及來源 IP 的頻繁無效課程碼嘗試限流；
    限制期間一律回 429（不查詢課程，避免泄露課程資料），不建立任何成員記錄。
    """
    settings = get_settings()
    ip = request.client.host if request.client else "unknown"
    now = datetime.now(UTC)
    window_start = now - timedelta(minutes=settings.course_join_lock_minutes)

    account_failures = (
        await db.execute(
            select(func.count(CourseJoinAttempt.id)).where(
                CourseJoinAttempt.student_id == student.id,
                CourseJoinAttempt.success.is_(False),
                CourseJoinAttempt.created_at >= window_start,
            )
        )
    ).scalar() or 0
    ip_failures = (
        await db.execute(
            select(func.count(CourseJoinAttempt.id)).where(
                CourseJoinAttempt.ip == ip,
                CourseJoinAttempt.success.is_(False),
                CourseJoinAttempt.created_at >= window_start,
            )
        )
    ).scalar() or 0
    if (
        account_failures >= settings.course_join_max_failures
        or ip_failures >= settings.course_join_ip_max_failures
    ):
        raise ApiError(429, "COURSE_JOIN_RATE_LIMITED", "嘗試次數過多，請稍後再試。")

    code = payload.code.strip().upper()
    if len(code) != 8:
        db.add(CourseJoinAttempt(student_id=student.id, ip=ip, success=False))
        await db.commit()
        raise ApiError(
            400, "COURSE_CODE_INVALID", "課程碼不正確。", fields={"code": "課程碼為 8 位字元。"}
        )
    result = await db.execute(select(Course).where(Course.code == code))
    course = result.scalar_one_or_none()
    if course is None:
        db.add(CourseJoinAttempt(student_id=student.id, ip=ip, success=False))
        await db.commit()
        raise ApiError(404, "COURSE_NOT_FOUND", "找不到此課程碼對應的課程。")

    existing = await db.execute(
        select(CourseMembership).where(
            CourseMembership.course_id == course.id,
            CourseMembership.student_id == student.id,
        )
    )
    membership = existing.scalar_one_or_none()
    status_code = 200
    if membership is None:
        membership = CourseMembership(id=new_id("mem"), course_id=course.id, student_id=student.id)
        db.add(membership)
        await db.flush()
        status_code = 201
    db.add(CourseJoinAttempt(student_id=student.id, ip=ip, success=True))
    await db.commit()
    teacher = (await db.execute(select(User).where(User.id == course.teacher_id))).scalar_one()
    body = MembershipSummary(
        id=membership.id,
        joined_at=membership.joined_at,
        course=_course_summary(course),
        teacher_name=teacher.display_name,
    ).model_dump(mode="json", by_alias=True)
    return JSONResponse(status_code=status_code, content={"membership": body})


@router.get("/courses/{course_id}")
async def get_course(course_id: str, user: CurrentUser, db: DbDep) -> CourseDetailResponse:
    result = await db.execute(
        select(Course, User).join(User, User.id == Course.teacher_id).where(Course.id == course_id)
    )
    row = result.first()
    if row is None:
        raise ApiError(404, "COURSE_NOT_FOUND", "課程不存在。")
    course, teacher = row
    if user.role == "TEACHER":
        if course.teacher_id != user.id:
            raise ApiError(403, "COURSE_FORBIDDEN", "只能查看自己負責的課程。")
        code: str | None = course.code
    else:
        membership = await db.execute(
            select(CourseMembership.id).where(
                CourseMembership.course_id == course.id,
                CourseMembership.student_id == user.id,
            )
        )
        if membership.first() is None:
            raise ApiError(403, "COURSE_FORBIDDEN", "尚未加入此課程。")
        code = None
    student_count = (
        await db.execute(
            select(func.count())
            .select_from(CourseMembership)
            .where(CourseMembership.course_id == course.id)
        )
    ).scalar_one()
    return CourseDetailResponse(
        course=CourseDetailCourse(
            id=course.id,
            name=course.name,
            code=code,
            teacher_name=teacher.display_name,
            student_count=student_count,
            created_at=course.created_at,
        )
    )
