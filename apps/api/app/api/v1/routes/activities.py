"""課堂活動路由（REQ-014 簽到；REQ-015／016 答題、投票與統計預留同一份端點）。"""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CsrfDep, CurrentUser, DbDep, OptionalUser, TeacherUser, idempotency_manager
from app.core.errors import ApiError
from app.core.ids import new_id
from app.db.base import utcnow
from app.db.models import (
    ActivitySubmission,
    Classroom,
    ClassroomActivity,
    ClassroomParticipant,
    User,
)
from app.schemas.activity import (
    ActivityCreateRequest,
    ActivityItem,
    ActivityListResponse,
    ActivityResponse,
    ActivityResultsResponse,
    MyResultResponse,
    SignedStudent,
    SubmissionCreateRequest,
    SubmissionItem,
    SubmissionResponse,
    UnsignedStudent,
)
from app.services.realtime import realtime_hub

router = APIRouter(tags=["activities"])

STATUS_DRAFT = "DRAFT"
STATUS_OPEN = "OPEN"
STATUS_CLOSED = "CLOSED"
TYPE_CHECKIN = "CHECKIN"
SUPPORTED_TYPES = (TYPE_CHECKIN,)  # 答題／投票題型於 REQ-015 啟用


async def _classroom_or_404(db: DbDep, classroom_id: str) -> Classroom:
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None:
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "課堂不存在。")
    return classroom


def _ensure_live(classroom: Classroom) -> None:
    if classroom.status != "LIVE":
        raise ApiError(409, "CLASSROOM_ENDED", "課堂已結束，無法進行活動操作。")


async def _ensure_teacher(classroom: Classroom, user: User) -> None:
    if user.id != classroom.teacher_id:
        raise ApiError(403, "CLASSROOM_FORBIDDEN", "只有負責老師可以管理課堂活動。")


async def _activity_or_404(db: DbDep, classroom_id: str, activity_id: str) -> ClassroomActivity:
    activity = await db.get(ClassroomActivity, activity_id)
    if activity is None or activity.classroom_id != classroom_id:
        raise ApiError(404, "ACTIVITY_NOT_FOUND", "活動不存在或不屬於此課堂。")
    return activity


async def _student_participant_ids(db: DbDep, classroom_id: str) -> list[str]:
    rows = (
        (
            await db.execute(
                select(ClassroomParticipant.user_id).where(
                    ClassroomParticipant.classroom_id == classroom_id,
                    ClassroomParticipant.role == "STUDENT",
                    ClassroomParticipant.user_id.is_not(None),
                )
            )
        )
        .scalars()
        .all()
    )
    return [user_id for user_id in rows if user_id is not None]


async def _my_submission(
    db: DbDep, activity_id: str, user: User | None
) -> ActivitySubmission | None:
    if user is None or user.role != "STUDENT":
        return None
    return (
        await db.execute(
            select(ActivitySubmission).where(
                ActivitySubmission.activity_id == activity_id,
                ActivitySubmission.student_id == user.id,
            )
        )
    ).scalar_one_or_none()


def _submission_item(submission: ActivitySubmission) -> SubmissionItem:
    return SubmissionItem(
        id=submission.id,
        activity_id=submission.activity_id,
        student_id=submission.student_id,
        submitted_at=submission.submitted_at,
    )


async def _activity_item(
    db: DbDep,
    activity: ClassroomActivity,
    user: User | None,
    *,
    participant_count: int | None = None,
) -> ActivityItem:
    submission_count = (
        await db.execute(
            select(func.count())
            .select_from(ActivitySubmission)
            .where(ActivitySubmission.activity_id == activity.id)
        )
    ).scalar_one()
    if participant_count is None:
        participant_count = len(await _student_participant_ids(db, activity.classroom_id))
    mine = await _my_submission(db, activity.id, user)
    return ActivityItem(
        id=activity.id,
        classroom_id=activity.classroom_id,
        type=activity.type,
        status=activity.status,
        question=activity.question,
        options=None,  # 答題選項於 REQ-015 啟用
        submission_count=submission_count,
        participant_count=participant_count,
        published_at=activity.published_at,
        closed_at=activity.closed_at,
        created_at=activity.created_at,
        my_submission=_submission_item(mine) if mine is not None else None,
    )


def _publish(classroom: Classroom, op: str, activity: ClassroomActivity) -> None:
    realtime_hub.publish(
        f"classroom:{classroom.id}",
        {
            "type": "activity",
            "op": op,
            "activityId": activity.id,
            "activityType": activity.type,
            "status": activity.status,
            "stateVersion": classroom.state_version,
        },
    )


@router.post(
    "/classrooms/{classroom_id}/activities",
    response_model=ActivityResponse,
    status_code=201,
)
async def create_activity(
    classroom_id: str,
    payload: ActivityCreateRequest,
    request: Request,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> ActivityResponse | JSONResponse:
    """老師建立活動（本期僅簽到）；Idempotency-Key 重放回原活動（TASK-249）。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_teacher(classroom, teacher)
    if payload.type not in SUPPORTED_TYPES:
        raise ApiError(
            422, "ACTIVITY_TYPE_UNSUPPORTED", "本期尚未開放答題或投票活動，敬請期待後續版本。"
        )
    if payload.question is not None or payload.options is not None or payload.correct_option_ids:
        raise ApiError(422, "ACTIVITY_FIELD_INVALID", "簽到活動不需要題目或選項。")

    # 冪等重放先於新建：雙擊／網絡重試同一操作應取回原活動
    idem = await idempotency_manager(request, teacher.id)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    activity = ClassroomActivity(
        id=new_id("act"),
        classroom_id=classroom.id,
        type=payload.type,
        status=STATUS_DRAFT,
        created_by=teacher.id,
    )
    db.add(activity)
    await db.flush()
    body = ActivityResponse(activity=await _activity_item(db, activity, teacher))
    await idem.store(db, status_code=201, payload=body)
    await db.commit()
    return body


@router.post(
    "/classrooms/{classroom_id}/activities/{activity_id}/publish",
    response_model=ActivityResponse,
)
async def publish_activity(
    classroom_id: str,
    activity_id: str,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> ActivityResponse:
    """發布活動；同課堂同時只允許一個 OPEN；重複發布回原狀態（TASK-249／258）。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_teacher(classroom, teacher)
    activity = await _activity_or_404(db, classroom.id, activity_id)
    if activity.status == STATUS_OPEN:
        # 重複發布：回傳原活動，不產生新活動或重複通知
        return ActivityResponse(activity=await _activity_item(db, activity, teacher))
    if activity.status != STATUS_DRAFT:
        raise ApiError(409, "ACTIVITY_NOT_OPEN", "活動已結束，無法重新發布。")

    other_open = (
        await db.execute(
            select(ClassroomActivity).where(
                ClassroomActivity.classroom_id == classroom.id,
                ClassroomActivity.status == STATUS_OPEN,
                ClassroomActivity.id != activity.id,
            )
        )
    ).scalar_one_or_none()
    if other_open is not None:
        raise ApiError(409, "ACTIVITY_ALREADY_OPEN", "課堂已有進行中的活動，請先結束後再發布。")

    activity.status = STATUS_OPEN
    activity.published_at = utcnow()
    try:
        async with db.begin_nested():
            await db.flush()
    except IntegrityError:
        # 並發發布另一活動：部分唯一索引兜底（同課堂只有一個 OPEN）
        raise ApiError(
            409, "ACTIVITY_ALREADY_OPEN", "課堂已有進行中的活動，請先結束後再發布。"
        ) from None
    item = await _activity_item(db, activity, teacher)
    await db.commit()
    _publish(classroom, "published", activity)
    return ActivityResponse(activity=item)


@router.post(
    "/classrooms/{classroom_id}/activities/{activity_id}/close",
    response_model=ActivityResponse,
)
async def close_activity(
    classroom_id: str,
    activity_id: str,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> ActivityResponse:
    """結束活動；重複結束回原結果（TASK-258），結束後遲交一律被拒。"""
    classroom = await _classroom_or_404(db, classroom_id)
    await _ensure_teacher(classroom, teacher)
    activity = await _activity_or_404(db, classroom.id, activity_id)
    if activity.status == STATUS_CLOSED:
        # 重複結束／網絡重試：回傳原結束結果，不改寫結束時間
        return ActivityResponse(activity=await _activity_item(db, activity, teacher))
    if activity.status != STATUS_OPEN:
        raise ApiError(409, "ACTIVITY_NOT_OPEN", "活動尚未發布，無法結束。")
    activity.status = STATUS_CLOSED
    activity.closed_at = utcnow()
    item = await _activity_item(db, activity, teacher)
    await db.commit()
    _publish(classroom, "closed", activity)
    return ActivityResponse(activity=item)


@router.get(
    "/classrooms/{classroom_id}/activities",
    response_model=ActivityListResponse,
)
async def list_activities(
    classroom_id: str,
    user: OptionalUser,
    db: DbDep,
) -> ActivityListResponse:
    """活動列表：老師與已加入學生可查；訪客 403、未登入 401（不泄露其他課堂資料）。"""
    classroom = await _classroom_or_404(db, classroom_id)
    if user is None:
        raise ApiError(401, "SESSION_INVALID", "尚未登入或工作階段已失效。")
    is_teacher = user.id == classroom.teacher_id
    if not is_teacher:
        if user.role != "STUDENT":
            raise ApiError(403, "ROLE_FORBIDDEN", "只有學生可以查看課堂活動。")
        participant = (
            await db.execute(
                select(ClassroomParticipant).where(
                    ClassroomParticipant.classroom_id == classroom.id,
                    ClassroomParticipant.user_id == user.id,
                )
            )
        ).scalar_one_or_none()
        if participant is None:
            raise ApiError(403, "CLASSROOM_PARTICIPANT_REQUIRED", "請先加入課堂。")

    activities = (
        (
            await db.execute(
                select(ClassroomActivity)
                .where(ClassroomActivity.classroom_id == classroom.id)
                .order_by(ClassroomActivity.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    participant_count = len(await _student_participant_ids(db, classroom.id))
    viewer = None if is_teacher else user
    items = [
        await _activity_item(db, activity, viewer, participant_count=participant_count)
        for activity in activities
    ]
    open_item = next((item for item in items if item.status == STATUS_OPEN), None)
    return ActivityListResponse(items=items, open_activity=open_item)


@router.get(
    "/classrooms/{classroom_id}/activities/{activity_id}/results",
    response_model=ActivityResultsResponse,
)
async def activity_results(
    classroom_id: str,
    activity_id: str,
    teacher: TeacherUser,
    db: DbDep,
) -> ActivityResultsResponse:
    """老師查看簽到結果：已簽／未簽名單，由原始提交即時重算（TASK-256）。"""
    classroom = await _classroom_or_404(db, classroom_id)
    await _ensure_teacher(classroom, teacher)
    activity = await _activity_or_404(db, classroom.id, activity_id)

    signed_rows = (
        await db.execute(
            select(ActivitySubmission, User)
            .join(User, User.id == ActivitySubmission.student_id)
            .where(ActivitySubmission.activity_id == activity.id)
            .order_by(ActivitySubmission.submitted_at.asc())
        )
    ).all()
    signed_ids = {submission.student_id for submission, _ in signed_rows}
    participant_rows = (
        await db.execute(
            select(ClassroomParticipant, User)
            .join(User, User.id == ClassroomParticipant.user_id)
            .where(
                ClassroomParticipant.classroom_id == classroom.id,
                ClassroomParticipant.role == "STUDENT",
                ClassroomParticipant.user_id.is_not(None),
            )
            .order_by(ClassroomParticipant.created_at.asc())
        )
    ).all()
    return ActivityResultsResponse(
        activity=await _activity_item(db, activity, teacher),
        signed=[
            SignedStudent(
                student_id=student.id,
                display_name=student.display_name,
                submitted_at=submission.submitted_at,
            )
            for submission, student in signed_rows
        ],
        unsigned=[
            UnsignedStudent(student_id=student.id, display_name=student.display_name)
            for _, student in participant_rows
            if student.id not in signed_ids
        ],
    )


@router.post(
    "/classrooms/{classroom_id}/activities/{activity_id}/submissions",
    response_model=SubmissionResponse,
    status_code=201,
)
async def submit_activity(
    classroom_id: str,
    activity_id: str,
    payload: SubmissionCreateRequest,
    user: CurrentUser,
    db: DbDep,
    _: CsrfDep,
) -> SubmissionResponse:
    """學生簽到；重複／並發提交回傳原記錄（TASK-252／253），訪客與老師被拒（TASK-255）。"""
    classroom = await _classroom_or_404(db, classroom_id)
    activity = await _activity_or_404(db, classroom.id, activity_id)
    if user.role != "STUDENT":
        raise ApiError(403, "ROLE_FORBIDDEN", "只有學生可以提交活動。")
    participant = (
        await db.execute(
            select(ClassroomParticipant).where(
                ClassroomParticipant.classroom_id == classroom.id,
                ClassroomParticipant.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if participant is None:
        raise ApiError(403, "CLASSROOM_PARTICIPANT_REQUIRED", "請先加入課堂。")
    _ensure_live(classroom)
    if activity.status == STATUS_DRAFT:
        raise ApiError(409, "ACTIVITY_NOT_OPEN", "活動尚未開放，請稍候再試。")
    if activity.status != STATUS_OPEN:
        raise ApiError(409, "ACTIVITY_NOT_OPEN", "活動已結束，無法再提交。")
    if activity.type == TYPE_CHECKIN and payload.answers:
        raise ApiError(422, "ACTIVITY_FIELD_INVALID", "簽到不需要答案。")

    existing = (
        await db.execute(
            select(ActivitySubmission).where(
                ActivitySubmission.activity_id == activity.id,
                ActivitySubmission.student_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        # 重複點擊／多裝置／重試：回傳首次記錄，不改寫簽到時間（TASK-252）
        return SubmissionResponse(submission=_submission_item(existing), already_submitted=True)

    submission = ActivitySubmission(
        id=new_id("sub"),
        activity_id=activity.id,
        classroom_id=classroom.id,
        student_id=user.id,
        answers_json=None,
    )
    db.add(submission)
    try:
        async with db.begin_nested():
            await db.flush()
    except IntegrityError:
        # 並發提交：唯一約束兜底，回傳首次記錄（TASK-252）
        existing = (
            await db.execute(
                select(ActivitySubmission).where(
                    ActivitySubmission.activity_id == activity.id,
                    ActivitySubmission.student_id == user.id,
                )
            )
        ).scalar_one()
        return SubmissionResponse(submission=_submission_item(existing), already_submitted=True)
    await db.commit()
    _publish(classroom, "submitted", activity)
    return SubmissionResponse(submission=_submission_item(submission), already_submitted=False)


@router.get(
    "/classrooms/{classroom_id}/activities/{activity_id}/me/result",
    response_model=MyResultResponse,
)
async def my_activity_result(
    classroom_id: str,
    activity_id: str,
    user: CurrentUser,
    db: DbDep,
) -> MyResultResponse:
    """學生查看本人提交；老師與未加入者被拒，訪客（未登入）401。"""
    classroom = await _classroom_or_404(db, classroom_id)
    activity = await _activity_or_404(db, classroom.id, activity_id)
    if user.role != "STUDENT":
        raise ApiError(403, "ROLE_FORBIDDEN", "只有學生可以查看本人提交。")
    mine = await _my_submission(db, activity.id, user)
    return MyResultResponse(
        activity=await _activity_item(db, activity, user),
        submission=_submission_item(mine) if mine is not None else None,
    )
