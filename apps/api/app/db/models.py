from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    identifier: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    identifier_type: Mapped[str] = mapped_column(String(10))
    display_name: Mapped[str] = mapped_column(String(50))
    role: Mapped[str] = mapped_column(String(10))  # TEACHER / STUDENT
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_token_hash: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class VerificationChallenge(Base):
    __tablename__ = "verification_challenges"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    purpose: Mapped[str] = mapped_column(String(20))  # REGISTER
    identifier: Mapped[str] = mapped_column(String(255), index=True)
    payload_hash: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    code_hash: Mapped[str] = mapped_column(String(64))
    channel: Mapped[str] = mapped_column(String(10))  # SMS / EMAIL
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    identifier: Mapped[str] = mapped_column(String(255), index=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    success: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CourseJoinAttempt(Base):
    """課程碼加入嘗試（REQ-003 無效嘗試限流：按學生帳號及來源 IP 計數）。"""

    __tablename__ = "course_join_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(String(40), index=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    success: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CourseMembership(Base):
    __tablename__ = "course_memberships"
    __table_args__ = (
        UniqueConstraint("course_id", "student_id", name="uq_membership_course_student"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    byte_size: Mapped[int] = mapped_column(BigInteger)
    content_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="CREATED")  # CREATED / RECEIVED
    object_key: Mapped[str] = mapped_column(String(255))
    sha256_expected: Mapped[str | None] = mapped_column(String(64), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Courseware(Base):
    __tablename__ = "coursewares"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    upload_id: Mapped[str | None] = mapped_column(ForeignKey("uploads.id"), default=None)
    file_name: Mapped[str] = mapped_column(String(255))
    byte_size: Mapped[int] = mapped_column(BigInteger)
    page_count: Mapped[int | None] = mapped_column(Integer, default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="QUEUED")
    original_object_key: Mapped[str] = mapped_column(String(255))
    failure_code: Mapped[str | None] = mapped_column(String(50), default=None)
    failure_message: Mapped[str | None] = mapped_column(String(255), default=None)
    failure_detail: Mapped[str | None] = mapped_column(Text, default=None)
    warning: Mapped[str | None] = mapped_column(String(255), default=None)
    conversion_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class CoursewarePage(Base):
    __tablename__ = "courseware_pages"
    __table_args__ = (
        UniqueConstraint("courseware_id", "page_index", name="uq_page_courseware_index"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    courseware_id: Mapped[str] = mapped_column(ForeignKey("coursewares.id"), index=True)
    page_index: Mapped[int] = mapped_column(Integer)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    full_key: Mapped[str] = mapped_column(String(255))
    thumb_key: Mapped[str] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer, default=1)


class ConversionAttempt(Base):
    __tablename__ = "conversion_attempts"
    __table_args__ = (
        UniqueConstraint("courseware_id", "attempt_no", name="uq_attempt_courseware_no"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    courseware_id: Mapped[str] = mapped_column(ForeignKey("coursewares.id"), index=True)
    attempt_no: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))  # RUNNING / SUCCEEDED / FAILED
    error_code: Mapped[str | None] = mapped_column(String(50), default=None)
    error_message: Mapped[str | None] = mapped_column(String(255), default=None)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class Annotation(Base):
    __tablename__ = "annotations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    courseware_id: Mapped[str] = mapped_column(ForeignKey("coursewares.id"), index=True)
    courseware_version: Mapped[int] = mapped_column(Integer, default=1)
    page_index: Mapped[int] = mapped_column(Integer)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    content: Mapped[str] = mapped_column(String(100))
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    version: Mapped[int] = mapped_column(Integer, default=1)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("key", "user_id", "method", "path", name="uq_idem_key_user_route"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    key: Mapped[str] = mapped_column(String(80), index=True)
    user_id: Mapped[str | None] = mapped_column(String(40), default=None)
    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(255))
    request_hash: Mapped[str] = mapped_column(String(64))
    response_status: Mapped[int | None] = mapped_column(Integer, default=None)
    response_body: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Classroom(Base):
    """即時課堂（REQ-006）：同課程／同老師各只允許一個進行中課堂（部分唯一索引）。"""

    __tablename__ = "classrooms"
    __table_args__ = (
        Index(
            "uq_classroom_live_course",
            "course_id",
            unique=True,
            sqlite_where=text("status = 'LIVE'"),
        ),
        Index(
            "uq_classroom_live_teacher",
            "teacher_id",
            unique=True,
            sqlite_where=text("status = 'LIVE'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    course_id: Mapped[str] = mapped_column(String(40), ForeignKey("courses.id"), index=True)
    courseware_id: Mapped[str] = mapped_column(String(40), ForeignKey("coursewares.id"))
    courseware_version: Mapped[int] = mapped_column(Integer)
    teacher_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    code: Mapped[str] = mapped_column(String(6), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="LIVE", index=True)  # LIVE / ENDED
    page_index: Mapped[int] = mapped_column(Integer, default=0)
    page_count: Mapped[int] = mapped_column(Integer)
    state_version: Mapped[int] = mapped_column(Integer, default=1)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class GuestIdentity(Base):
    """訪客身份（REQ-007）：不可修改的隨機顯示名稱；瀏覽器只在 localStorage 保存 guestId。"""

    __tablename__ = "guest_identities"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ClassroomParticipant(Base):
    """課堂參與者（REQ-007）：學生加入不建立課程成員；訪客以 guest_id 識別。"""

    __tablename__ = "classroom_participants"
    __table_args__ = (
        Index(
            "uq_participant_classroom_user",
            "classroom_id",
            "user_id",
            unique=True,
            sqlite_where=text("user_id IS NOT NULL"),
        ),
        Index(
            "uq_participant_classroom_guest",
            "classroom_id",
            "guest_id",
            unique=True,
            sqlite_where=text("guest_id IS NOT NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    classroom_id: Mapped[str] = mapped_column(String(40), ForeignKey("classrooms.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(
        String(40), ForeignKey("users.id"), nullable=True, default=None
    )
    guest_id: Mapped[str | None] = mapped_column(
        String(40), ForeignKey("guest_identities.id"), nullable=True, default=None
    )
    role: Mapped[str] = mapped_column(String(10))  # STUDENT / GUEST
    display_name: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ClassroomJoinAttempt(Base):
    """課堂碼加入嘗試（REQ-007 無效嘗試限流：按帳號及來源 IP 計數）。"""

    __tablename__ = "classroom_join_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(40), nullable=True, default=None, index=True)
    ip: Mapped[str] = mapped_column(String(64), index=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SharedAnnotationGroup(Base):
    """共享標記群組（REQ-012）：同一標記下的留言共用明確群組 ID，不依距離自動合併。"""

    __tablename__ = "shared_annotation_groups"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    classroom_id: Mapped[str] = mapped_column(String(40), ForeignKey("classrooms.id"), index=True)
    page_index: Mapped[int] = mapped_column(Integer)
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SharedAnnotation(Base):
    """共享文字標註（REQ-011～013）：作者本人 CRUD；老師以可見性管理，不可改學生原文。"""

    __tablename__ = "shared_annotations"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    classroom_id: Mapped[str] = mapped_column(String(40), ForeignKey("classrooms.id"), index=True)
    group_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("shared_annotation_groups.id"), index=True
    )
    author_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id"), index=True)
    author_role: Mapped[str] = mapped_column(String(10))  # TEACHER / STUDENT
    content: Mapped[str] = mapped_column(String(100))
    page_index: Mapped[int] = mapped_column(Integer)
    # VISIBLE / HIDDEN（老師管理）/ DELETED（作者刪除）/ CLEARED（老師清除整頁，不可恢復）
    status: Mapped[str] = mapped_column(String(16), default="VISIBLE", index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class SharedAnnotationReply(Base):
    """老師對學生共享標註的回覆（REQ-012）：獨立記錄，不覆蓋學生原文。"""

    __tablename__ = "shared_annotation_replies"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    annotation_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("shared_annotations.id"), index=True
    )
    teacher_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id"), index=True)
    content: Mapped[str] = mapped_column(String(100))
    version: Mapped[int] = mapped_column(Integer, default=1)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ClassroomShareGrant(Base):
    """學生共享標註授註授權（REQ-011）：僅限當前課堂；收回後禁止新增／修改／移動／刪除。"""

    __tablename__ = "classroom_share_grants"
    __table_args__ = (UniqueConstraint("classroom_id", "student_id", name="uq_share_grant"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    classroom_id: Mapped[str] = mapped_column(String(40), ForeignKey("classrooms.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id"), index=True)
    granted: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ClassroomActivity(Base):
    """課堂活動（REQ-014 簽到；REQ-015 答題／投票）；同課堂同時只允許一個 OPEN（部分唯一索引）。"""

    __tablename__ = "classroom_activities"
    __table_args__ = (
        Index(
            "uq_activity_open_classroom",
            "classroom_id",
            unique=True,
            sqlite_where=text("status = 'OPEN'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    classroom_id: Mapped[str] = mapped_column(String(40), ForeignKey("classrooms.id"), index=True)
    # CHECKIN / SINGLE_CHOICE / MULTI_CHOICE / JUDGE / POLL
    type: Mapped[str] = mapped_column(String(20))
    # DRAFT / OPEN / CLOSED
    status: Mapped[str] = mapped_column(String(10), default="DRAFT", index=True)
    question: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)
    options_json: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    correct_option_ids_json: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    created_by: Mapped[str] = mapped_column(String(40), ForeignKey("users.id"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ActivitySubmission(Base):
    """活動提交（REQ-014 簽到記錄／REQ-015 答案）：每生每活動最多一條有效記錄（唯一約束兜底）。"""

    __tablename__ = "activity_submissions"
    __table_args__ = (
        UniqueConstraint("activity_id", "student_id", name="uq_submission_activity_student"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    activity_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("classroom_activities.id"), index=True
    )
    classroom_id: Mapped[str] = mapped_column(String(40), ForeignKey("classrooms.id"), index=True)
    student_id: Mapped[str] = mapped_column(String(40), ForeignKey("users.id"), index=True)
    answers_json: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
