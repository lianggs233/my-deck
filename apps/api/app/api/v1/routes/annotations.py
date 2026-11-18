from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from app.api.deps import CsrfDep, DbDep, IdempotencyManager, StudentUser, idempotency_manager
from app.core.errors import ApiError
from app.core.ids import new_id
from app.db.base import utcnow
from app.db.models import Annotation
from app.schemas.annotation import (
    AnnotationCreateRequest,
    AnnotationItem,
    AnnotationListResponse,
    AnnotationPatchRequest,
    AnnotationResponse,
    Position,
)

from .coursewares import courseware_for_annotation_access

router = APIRouter(tags=["annotations"])

READY_STATUSES = {"READY", "READY_WITH_WARNINGS"}
MAX_PAGE_SIZE = 100


def _item(annotation: Annotation) -> AnnotationItem:
    return AnnotationItem(
        id=annotation.id,
        page_index=annotation.page_index,
        content=annotation.content,
        position=Position(x=annotation.x, y=annotation.y),
        courseware_version=annotation.courseware_version,
        version=annotation.version,
        created_at=annotation.created_at,
        updated_at=annotation.updated_at,
    )


@router.get("/courses/{course_id}/coursewares/{courseware_id}/annotations")
async def list_annotations(
    course_id: str,
    courseware_id: str,
    student: StudentUser,
    db: DbDep,
    page: int = 1,
    page_size: int = 50,
    page_index: int | None = None,
) -> AnnotationListResponse:
    courseware = await courseware_for_annotation_access(db, course_id, courseware_id, student)
    if page < 1 or not 1 <= page_size <= MAX_PAGE_SIZE:
        raise ApiError(400, "VALIDATION_ERROR", "分頁參數不正確。")
    base = select(Annotation).where(
        Annotation.courseware_id == courseware.id,
        Annotation.student_id == student.id,
        Annotation.deleted_at.is_(None),
    )
    if page_index is not None:
        base = base.where(Annotation.page_index == page_index)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        (
            await db.execute(
                base.order_by(Annotation.created_at.asc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        )
        .scalars()
        .all()
    )
    return AnnotationListResponse(
        items=[_item(a) for a in rows], page=page, page_size=page_size, total=total
    )


@router.post(
    "/courses/{course_id}/coursewares/{courseware_id}/annotations",
    status_code=201,
    response_model=AnnotationResponse,
)
async def create_annotation(
    course_id: str,
    courseware_id: str,
    payload: AnnotationCreateRequest,
    request: Request,
    student: StudentUser,
    db: DbDep,
    _: CsrfDep,
) -> AnnotationResponse | JSONResponse:
    courseware = await courseware_for_annotation_access(db, course_id, courseware_id, student)
    if courseware.status not in READY_STATUSES:
        raise ApiError(409, "COURSEWARE_NOT_READY", "課件尚未轉換完成，暫時不能建立標註。")
    if courseware.page_count is None or payload.page_index >= courseware.page_count:
        raise ApiError(
            400,
            "VALIDATION_ERROR",
            "頁碼不正確。",
            fields={"pageIndex": "頁碼超出課件頁數範圍。"},
        )
    content = payload.content.strip()
    if not 1 <= len(content) <= 100:
        raise ApiError(
            400,
            "VALIDATION_ERROR",
            "標註內容不正確。",
            fields={"content": "內容須為 1–100 個字元。"},
        )

    idem: IdempotencyManager = await idempotency_manager(request, student.id)
    replay = await idem.lookup(db)
    if replay is not None:
        return replay

    annotation = Annotation(
        id=new_id("ann"),
        courseware_id=courseware.id,
        courseware_version=courseware.version,
        page_index=payload.page_index,
        student_id=student.id,
        content=content,
        x=payload.position.x,
        y=payload.position.y,
    )
    db.add(annotation)
    await db.flush()
    result = AnnotationResponse(annotation=_item(annotation))
    await idem.store(db, status_code=201, payload=result)
    await db.commit()
    return result


async def _own_annotation(db: DbDep, annotation_id: str, student_id: str) -> Annotation:
    result = await db.execute(
        select(Annotation).where(
            Annotation.id == annotation_id,
            Annotation.deleted_at.is_(None),
        )
    )
    annotation = result.scalar_one_or_none()
    if annotation is None:
        raise ApiError(404, "ANNOTATION_NOT_FOUND", "標註不存在。")
    if annotation.student_id != student_id:
        raise ApiError(403, "PERSONAL_ANNOTATION_FORBIDDEN", "只能管理自己的個人標註。")
    return annotation


@router.patch("/courses/{course_id}/coursewares/{courseware_id}/annotations/{annotation_id}")
async def update_annotation(
    course_id: str,
    courseware_id: str,
    annotation_id: str,
    payload: AnnotationPatchRequest,
    student: StudentUser,
    db: DbDep,
    _: CsrfDep,
) -> AnnotationResponse:
    await courseware_for_annotation_access(db, course_id, courseware_id, student)
    annotation = await _own_annotation(db, annotation_id, student.id)
    if annotation.courseware_id != courseware_id:
        raise ApiError(404, "ANNOTATION_NOT_FOUND", "標註不存在。")
    if payload.expected_version != annotation.version:
        raise ApiError(409, "VERSION_CONFLICT", "標註已被其他操作更新，請重新整理後再試。")
    if payload.content is None and payload.position is None:
        raise ApiError(400, "VALIDATION_ERROR", "沒有需要更新的內容。")

    if payload.content is not None:
        content = payload.content.strip()
        if not 1 <= len(content) <= 100:
            raise ApiError(
                400,
                "VALIDATION_ERROR",
                "標註內容不正確。",
                fields={"content": "內容須為 1–100 個字元。"},
            )
        annotation.content = content
    if payload.position is not None:
        annotation.x = payload.position.x
        annotation.y = payload.position.y
    annotation.version += 1
    await db.commit()
    return AnnotationResponse(annotation=_item(annotation))


@router.delete(
    "/courses/{course_id}/coursewares/{courseware_id}/annotations/{annotation_id}", status_code=204
)
async def delete_annotation(
    course_id: str,
    courseware_id: str,
    annotation_id: str,
    student: StudentUser,
    db: DbDep,
    _: CsrfDep,
) -> None:
    await courseware_for_annotation_access(db, course_id, courseware_id, student)
    annotation = await _own_annotation(db, annotation_id, student.id)
    if annotation.courseware_id != courseware_id:
        raise ApiError(404, "ANNOTATION_NOT_FOUND", "標註不存在。")
    annotation.deleted_at = utcnow()
    annotation.version += 1
    await db.commit()
