"""共享標註路由（REQ-011 建立與授權、REQ-012 聚合與回覆、REQ-013 管理與狀態恢復）。"""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CsrfDep, CurrentUser, DbDep, OptionalUser, TeacherUser
from app.core.errors import ApiError
from app.core.ids import new_id
from app.db.base import utcnow
from app.db.models import (
    Classroom,
    ClassroomParticipant,
    ClassroomShareGrant,
    SharedAnnotation,
    SharedAnnotationGroup,
    SharedAnnotationReply,
    User,
)
from app.schemas.shared_annotation import (
    ClearPageRequest,
    ClearPageResponse,
    ReplyCreateRequest,
    ReplyPatchRequest,
    ReplyResponse,
    SharedAnnotationCreateRequest,
    SharedAnnotationItem,
    SharedAnnotationListResponse,
    SharedAnnotationPatchRequest,
    SharedAnnotationResponse,
    SharedAuthor,
    SharedReplyItem,
    SharePermissionListResponse,
    SharePermissionRequest,
    SharePermissionStudent,
    VisibilityRequest,
)
from app.services.realtime import realtime_hub

router = APIRouter(tags=["shared-annotations"])

STATUS_VISIBLE = "VISIBLE"
STATUS_HIDDEN = "HIDDEN"
STATUS_DELETED = "DELETED"
STATUS_CLEARED = "CLEARED"
LISTABLE_STATUSES = (STATUS_VISIBLE, STATUS_HIDDEN)


def _trim_content(raw: str) -> str:
    content = raw.strip()
    if not content:
        raise ApiError(
            422,
            "ANNOTATION_CONTENT_EMPTY",
            "標註內容不可為空白。",
            fields={"content": "請輸入 1–100 個字元。"},
        )
    if len(content) > 100:
        raise ApiError(
            422,
            "ANNOTATION_CONTENT_TOO_LONG",
            "標註內容不可超過 100 個字元。",
            fields={"content": "請輸入 1–100 個字元。"},
        )
    return content


async def _classroom_or_404(db: DbDep, classroom_id: str) -> Classroom:
    classroom = await db.get(Classroom, classroom_id)
    if classroom is None:
        raise ApiError(404, "CLASSROOM_NOT_FOUND", "課堂不存在。")
    return classroom


def _ensure_live(classroom: Classroom) -> None:
    if classroom.status != "LIVE":
        raise ApiError(409, "CLASSROOM_ENDED", "課堂已結束，無法變更共享標註。")


async def _ensure_teacher(classroom: Classroom, user: User) -> None:
    if user.id != classroom.teacher_id:
        raise ApiError(403, "CLASSROOM_FORBIDDEN", "只有負責老師可以管理共享標註。")


async def _ensure_student_participant(db: DbDep, classroom: Classroom, user: User) -> None:
    if user.role != "STUDENT":
        raise ApiError(403, "ROLE_FORBIDDEN", "只有學生可以執行此操作。")
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


async def _grant(db: DbDep, classroom_id: str, student_id: str) -> ClassroomShareGrant | None:
    return (
        await db.execute(
            select(ClassroomShareGrant).where(
                ClassroomShareGrant.classroom_id == classroom_id,
                ClassroomShareGrant.student_id == student_id,
                ClassroomShareGrant.granted.is_(True),
            )
        )
    ).scalar_one_or_none()


async def _ensure_write_permission(db: DbDep, classroom: Classroom, user: User) -> None:
    """老師永遠可寫共享層；學生須為課堂參與者且持有有效授權。"""
    if user.id == classroom.teacher_id:
        return
    await _ensure_student_participant(db, classroom, user)
    if await _grant(db, classroom.id, user.id) is None:
        raise ApiError(403, "SHARE_PERMISSION_REQUIRED", "老師尚未授權你使用共享標註。")


def _publish(classroom: Classroom, op: str, page_index: int) -> None:
    realtime_hub.publish(
        f"classroom:{classroom.id}",
        {"type": "shared-annotation", "op": op, "pageIndex": page_index},
    )


def _author(user: User, role: str | None = None) -> SharedAuthor:
    return SharedAuthor(id=user.id, display_name=user.display_name, role=role or user.role)


async def _to_item(
    db: DbDep,
    annotation: SharedAnnotation,
    group: SharedAnnotationGroup,
    author: User,
) -> SharedAnnotationItem:
    reply_rows = (
        await db.execute(
            select(SharedAnnotationReply, User)
            .join(User, User.id == SharedAnnotationReply.teacher_id)
            .where(
                SharedAnnotationReply.annotation_id == annotation.id,
                SharedAnnotationReply.deleted_at.is_(None),
            )
            .order_by(SharedAnnotationReply.created_at.asc())
        )
    ).all()
    replies = [
        SharedReplyItem(
            id=reply.id,
            content=reply.content,
            author=_author(teacher, "TEACHER"),
            version=reply.version,
            created_at=reply.created_at,
            updated_at=reply.updated_at,
        )
        for reply, teacher in reply_rows
    ]
    return SharedAnnotationItem(
        id=annotation.id,
        classroom_id=annotation.classroom_id,
        group_id=annotation.group_id,
        page_index=annotation.page_index,
        content=annotation.content,
        position={"x": group.x, "y": group.y},
        author=_author(author, annotation.author_role),
        visibility=annotation.status,
        version=annotation.version,
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
        replies=replies,
    )


async def _get_annotation(db: DbDep, classroom_id: str, annotation_id: str) -> SharedAnnotation:
    annotation = await db.get(SharedAnnotation, annotation_id)
    if annotation is None or annotation.classroom_id != classroom_id:
        raise ApiError(404, "ANNOTATION_NOT_FOUND", "共享標註不存在。")
    return annotation


async def _can_share(db: DbDep, classroom: Classroom, user: User | None) -> bool:
    if user is None:
        return False
    if user.id == classroom.teacher_id:
        return True
    if user.role != "STUDENT":
        return False
    return await _grant(db, classroom.id, user.id) is not None


@router.get(
    "/classrooms/{classroom_id}/shared-annotations",
    response_model=SharedAnnotationListResponse,
)
async def list_shared_annotations(
    classroom_id: str,
    user: OptionalUser,
    db: DbDep,
    page_index: int = Query(ge=0),
    visibility: str | None = Query(default=None),
) -> SharedAnnotationListResponse:
    """共享層查詢：老師可篩選全部／可見／隱藏；學生只看可見；訪客一律 403。"""
    classroom = await _classroom_or_404(db, classroom_id)
    if user is None:
        raise ApiError(401, "SESSION_INVALID", "尚未登入或工作階段已失效。")
    is_teacher = user.id == classroom.teacher_id
    if not is_teacher:
        await _ensure_student_participant(db, classroom, user)

    conditions = [
        SharedAnnotation.classroom_id == classroom.id,
        SharedAnnotation.page_index == page_index,
        SharedAnnotation.status.in_(LISTABLE_STATUSES),
    ]
    if is_teacher:
        if visibility in (STATUS_VISIBLE, STATUS_HIDDEN):
            conditions.append(SharedAnnotation.status == visibility)
        elif visibility not in (None, "ALL"):
            raise ApiError(422, "VISIBILITY_INVALID", "不支援的篩選條件。")
    else:
        conditions.append(SharedAnnotation.status == STATUS_VISIBLE)

    rows = (
        await db.execute(
            select(SharedAnnotation, SharedAnnotationGroup, User)
            .join(SharedAnnotationGroup, SharedAnnotationGroup.id == SharedAnnotation.group_id)
            .join(User, User.id == SharedAnnotation.author_id)
            .where(*conditions)
            .order_by(SharedAnnotation.created_at.asc())
        )
    ).all()
    items = [await _to_item(db, annotation, group, author) for annotation, group, author in rows]
    return SharedAnnotationListResponse(
        items=items, can_share=await _can_share(db, classroom, user)
    )


@router.post(
    "/classrooms/{classroom_id}/shared-annotations",
    response_model=SharedAnnotationResponse,
    status_code=201,
)
async def create_shared_annotation(
    classroom_id: str,
    payload: SharedAnnotationCreateRequest,
    user: CurrentUser,
    db: DbDep,
    _: CsrfDep,
) -> SharedAnnotationResponse:
    """建立共享標註：老師直接建立；學生須有當前課堂授權（REQ-011）。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_write_permission(db, classroom, user)
    content = _trim_content(payload.content)
    if payload.page_index >= classroom.page_count:
        raise ApiError(409, "PAGE_OUT_OF_RANGE", "頁面超出課件範圍。")

    role = "TEACHER" if user.id == classroom.teacher_id else "STUDENT"
    if payload.group_id is not None:
        # 在既有標記下新增留言：群組必須存在且屬於本課堂同一頁
        group = await db.get(SharedAnnotationGroup, payload.group_id)
        if (
            group is None
            or group.classroom_id != classroom.id
            or group.page_index != payload.page_index
        ):
            raise ApiError(404, "ANNOTATION_GROUP_NOT_FOUND", "標記不存在或已移除。")
    else:
        if payload.position is None:
            raise ApiError(
                422, "POSITION_REQUIRED", "請先點選標註位置。", fields={"position": "缺少座標。"}
            )
        group = SharedAnnotationGroup(
            id=new_id("grp"),
            classroom_id=classroom.id,
            page_index=payload.page_index,
            x=payload.position.x,
            y=payload.position.y,
        )
        db.add(group)
        await db.flush()

    annotation = SharedAnnotation(
        id=new_id("ann"),
        classroom_id=classroom.id,
        group_id=group.id,
        author_id=user.id,
        author_role=role,
        content=content,
        page_index=payload.page_index,
    )
    db.add(annotation)
    await db.flush()
    item = await _to_item(db, annotation, group, user)
    await db.commit()
    _publish(classroom, "created", payload.page_index)
    return SharedAnnotationResponse(annotation=item)


async def _patchable_annotation(
    db: DbDep, classroom: Classroom, annotation_id: str, user: User
) -> SharedAnnotation:
    annotation = await _get_annotation(db, classroom.id, annotation_id)
    if annotation.author_id != user.id:
        raise ApiError(403, "ANNOTATION_FORBIDDEN", "只能修改自己的共享標註。")
    if annotation.status != STATUS_VISIBLE:
        raise ApiError(409, "ANNOTATION_NOT_EDITABLE", "此共享標註已不可編輯。")
    if user.id != classroom.teacher_id and await _grant(db, classroom.id, user.id) is None:
        raise ApiError(403, "SHARE_PERMISSION_REQUIRED", "共享權限已被收回。")
    return annotation


@router.patch(
    "/classrooms/{classroom_id}/shared-annotations/{annotation_id}",
    response_model=SharedAnnotationResponse,
)
async def patch_shared_annotation(
    classroom_id: str,
    annotation_id: str,
    payload: SharedAnnotationPatchRequest,
    user: CurrentUser,
    db: DbDep,
    _: CsrfDep,
) -> SharedAnnotationResponse:
    """作者修改文字或位置；學生須仍持有效授權；不可改作者或群組。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    annotation = await _patchable_annotation(db, classroom, annotation_id, user)
    if payload.expected_version != annotation.version:
        raise ApiError(
            409,
            "ANNOTATION_VERSION_CONFLICT",
            "標註已被其他人變更，請重新載入。",
            fields={"currentVersion": str(annotation.version)},
        )

    group = await db.get(SharedAnnotationGroup, annotation.group_id)
    assert group is not None
    if payload.content is not None:
        annotation.content = _trim_content(payload.content)
    if payload.position is not None:
        # 只允許移動「獨立標記」（群組內可見留言皆屬本人），不拖動他人留言所在標記
        others = (
            (
                await db.execute(
                    select(SharedAnnotation).where(
                        SharedAnnotation.group_id == group.id,
                        SharedAnnotation.status.in_(LISTABLE_STATUSES),
                        SharedAnnotation.author_id != user.id,
                    )
                )
            )
            .scalars()
            .first()
        )
        if others is not None:
            raise ApiError(409, "GROUP_NOT_MOVABLE", "此標記包含其他使用者的留言，無法移動。")
        group.x = payload.position.x
        group.y = payload.position.y
    annotation.version += 1
    annotation.updated_at = utcnow()
    item = await _to_item(db, annotation, group, user)
    await db.commit()
    _publish(classroom, "updated", annotation.page_index)
    return SharedAnnotationResponse(annotation=item)


@router.delete("/classrooms/{classroom_id}/shared-annotations/{annotation_id}", status_code=204)
async def delete_shared_annotation(
    classroom_id: str,
    annotation_id: str,
    user: CurrentUser,
    db: DbDep,
    _: CsrfDep,
) -> None:
    """作者刪除自己的共享標註（軟刪除）；老師不能代刪學生原文。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    annotation = await _patchable_annotation(db, classroom, annotation_id, user)
    annotation.status = STATUS_DELETED
    annotation.version += 1
    annotation.updated_at = utcnow()
    await db.commit()
    _publish(classroom, "deleted", annotation.page_index)


@router.post(
    "/classrooms/{classroom_id}/shared-annotations/{annotation_id}/replies",
    response_model=ReplyResponse,
    status_code=201,
)
async def create_reply(
    classroom_id: str,
    annotation_id: str,
    payload: ReplyCreateRequest,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> ReplyResponse:
    """負責老師回覆學生的共享標註（獨立記錄，不覆蓋原文）。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_teacher(classroom, teacher)
    annotation = await _get_annotation(db, classroom.id, annotation_id)
    if annotation.status != STATUS_VISIBLE:
        raise ApiError(409, "ANNOTATION_NOT_EDITABLE", "此共享標註已不可回覆。")
    if annotation.author_role != "STUDENT":
        raise ApiError(422, "REPLY_TARGET_INVALID", "只能回覆學生的共享標註。")
    reply = SharedAnnotationReply(
        id=new_id("rpl"),
        annotation_id=annotation.id,
        teacher_id=teacher.id,
        content=_trim_content(payload.content),
    )
    db.add(reply)
    await db.flush()
    item = SharedReplyItem(
        id=reply.id,
        content=reply.content,
        author=_author(teacher, "TEACHER"),
        version=reply.version,
        created_at=reply.created_at,
        updated_at=reply.updated_at,
    )
    await db.commit()
    _publish(classroom, "reply", annotation.page_index)
    return ReplyResponse(reply=item)


async def _owned_reply(
    db: DbDep, classroom_id: str, reply_id: str, teacher: User
) -> SharedAnnotationReply:
    reply = await db.get(SharedAnnotationReply, reply_id)
    if reply is None or reply.deleted_at is not None:
        raise ApiError(404, "REPLY_NOT_FOUND", "回覆不存在。")
    annotation = await db.get(SharedAnnotation, reply.annotation_id)
    if annotation is None or annotation.classroom_id != classroom_id:
        raise ApiError(404, "REPLY_NOT_FOUND", "回覆不存在。")
    if reply.teacher_id != teacher.id:
        raise ApiError(403, "REPLY_FORBIDDEN", "只能修改自己的回覆。")
    return reply


@router.patch(
    "/classrooms/{classroom_id}/shared-annotations/replies/{reply_id}",
    response_model=ReplyResponse,
)
async def patch_reply(
    classroom_id: str,
    reply_id: str,
    payload: ReplyPatchRequest,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> ReplyResponse:
    """老師修改自己的回覆（expectedVersion 樂觀鎖），學生原文不受影響。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_teacher(classroom, teacher)
    reply = await _owned_reply(db, classroom_id, reply_id, teacher)
    if payload.expected_version != reply.version:
        raise ApiError(
            409,
            "REPLY_VERSION_CONFLICT",
            "回覆已被變更，請重新載入。",
            fields={"currentVersion": str(reply.version)},
        )
    reply.content = _trim_content(payload.content)
    reply.version += 1
    reply.updated_at = utcnow()
    item = SharedReplyItem(
        id=reply.id,
        content=reply.content,
        author=_author(teacher, "TEACHER"),
        version=reply.version,
        created_at=reply.created_at,
        updated_at=reply.updated_at,
    )
    annotation = await db.get(SharedAnnotation, reply.annotation_id)
    await db.commit()
    _publish(classroom, "reply", annotation.page_index if annotation else 0)
    return ReplyResponse(reply=item)


@router.delete("/classrooms/{classroom_id}/shared-annotations/replies/{reply_id}", status_code=204)
async def delete_reply(
    classroom_id: str,
    reply_id: str,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> None:
    """老師刪除自己的回覆（軟刪除），保留學生原文。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_teacher(classroom, teacher)
    reply = await _owned_reply(db, classroom_id, reply_id, teacher)
    reply.deleted_at = utcnow()
    reply.version += 1
    annotation = await db.get(SharedAnnotation, reply.annotation_id)
    await db.commit()
    _publish(classroom, "reply", annotation.page_index if annotation else 0)


@router.put(
    "/classrooms/{classroom_id}/shared-annotations/{annotation_id}/visibility",
    response_model=SharedAnnotationResponse,
)
async def set_visibility(
    classroom_id: str,
    annotation_id: str,
    payload: VisibilityRequest,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> SharedAnnotationResponse:
    """老師顯示／隱藏共享標註（REQ-013）；已刪除／清除內容不可藉此復活。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_teacher(classroom, teacher)
    annotation = await _get_annotation(db, classroom.id, annotation_id)
    if annotation.status in (STATUS_DELETED, STATUS_CLEARED):
        raise ApiError(409, "ANNOTATION_NOT_EDITABLE", "已刪除或清除的標註無法變更可見性。")
    annotation.status = payload.visibility
    annotation.version += 1
    annotation.updated_at = utcnow()
    group = await db.get(SharedAnnotationGroup, annotation.group_id)
    author = await db.get(User, annotation.author_id)
    assert group is not None and author is not None
    item = await _to_item(db, annotation, group, author)
    await db.commit()
    _publish(classroom, "visibility", annotation.page_index)
    return SharedAnnotationResponse(annotation=item)


@router.post(
    "/classrooms/{classroom_id}/shared-annotations/clear",
    response_model=ClearPageResponse,
)
async def clear_page(
    classroom_id: str,
    payload: ClearPageRequest,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> ClearPageResponse:
    """老師二次確認後清除目前頁共享內容（不可經介面恢復）；個人標註與其他頁不受影響。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_teacher(classroom, teacher)
    if payload.page_index >= classroom.page_count:
        raise ApiError(409, "PAGE_OUT_OF_RANGE", "頁面超出課件範圍。")
    annotations = (
        (
            await db.execute(
                select(SharedAnnotation).where(
                    SharedAnnotation.classroom_id == classroom.id,
                    SharedAnnotation.page_index == payload.page_index,
                    SharedAnnotation.status.in_(LISTABLE_STATUSES),
                )
            )
        )
        .scalars()
        .all()
    )
    for annotation in annotations:
        annotation.status = STATUS_CLEARED
        annotation.version += 1
        annotation.updated_at = utcnow()
    await db.commit()
    _publish(classroom, "cleared", payload.page_index)
    return ClearPageResponse(cleared_count=len(annotations), page_index=payload.page_index)


@router.get(
    "/classrooms/{classroom_id}/share-permissions",
    response_model=SharePermissionListResponse,
)
async def list_share_permissions(
    classroom_id: str,
    teacher: TeacherUser,
    db: DbDep,
) -> SharePermissionListResponse:
    """老師查看當前課堂學生及授權狀態（只回傳授權所需最少資料）。"""
    classroom = await _classroom_or_404(db, classroom_id)
    await _ensure_teacher(classroom, teacher)
    students = (
        await db.execute(
            select(ClassroomParticipant, User)
            .join(User, User.id == ClassroomParticipant.user_id)
            .where(
                ClassroomParticipant.classroom_id == classroom.id,
                ClassroomParticipant.role == "STUDENT",
            )
            .order_by(ClassroomParticipant.created_at.asc())
        )
    ).all()
    grants = (
        (
            await db.execute(
                select(ClassroomShareGrant).where(ClassroomShareGrant.classroom_id == classroom.id)
            )
        )
        .scalars()
        .all()
    )
    granted_map = {grant.student_id: grant.granted for grant in grants}
    return SharePermissionListResponse(
        items=[
            SharePermissionStudent(
                student_id=student.id,
                display_name=student.display_name,
                granted=granted_map.get(student.id, False),
            )
            for _, student in students
        ]
    )


@router.put(
    "/classrooms/{classroom_id}/students/{student_id}/share-permission",
    response_model=SharePermissionStudent,
)
async def set_share_permission(
    classroom_id: str,
    student_id: str,
    payload: SharePermissionRequest,
    teacher: TeacherUser,
    db: DbDep,
    _: CsrfDep,
) -> SharePermissionStudent:
    """授予／收回學生共享標註權限（僅限當前課堂）；收回後既有內容保留但禁止變更。"""
    classroom = await _classroom_or_404(db, classroom_id)
    _ensure_live(classroom)
    await _ensure_teacher(classroom, teacher)
    participant = (
        await db.execute(
            select(ClassroomParticipant).where(
                ClassroomParticipant.classroom_id == classroom.id,
                ClassroomParticipant.user_id == student_id,
                ClassroomParticipant.role == "STUDENT",
            )
        )
    ).scalar_one_or_none()
    if participant is None:
        raise ApiError(404, "PARTICIPANT_NOT_FOUND", "此學生不在當前課堂。")
    grant = (
        await db.execute(
            select(ClassroomShareGrant).where(
                ClassroomShareGrant.classroom_id == classroom.id,
                ClassroomShareGrant.student_id == student_id,
            )
        )
    ).scalar_one_or_none()
    if grant is None:
        grant = ClassroomShareGrant(
            id=new_id("grt"),
            classroom_id=classroom.id,
            student_id=student_id,
            granted=payload.granted,
        )
        db.add(grant)
    else:
        grant.granted = payload.granted
        grant.updated_at = utcnow()
    await db.commit()
    _publish(classroom, "grant", classroom.page_index)
    student = await db.get(User, student_id)
    return SharePermissionStudent(
        student_id=student_id,
        display_name=student.display_name if student else "",
        granted=grant.granted,
    )
