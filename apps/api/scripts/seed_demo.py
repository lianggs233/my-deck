"""MVP 演示資料種子：建立資料表、預設老師／學生帳號、課程及成員關係。

用法：uv run python scripts/seed_demo.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ids import new_course_code, new_id
from app.core.security import hash_password
from app.db.base import Base
from app.db.engine import engine, session_factory
from app.db.models import Course, CourseMembership, User

DEMO_PASSWORD = "MyDeck#2026"


async def main() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        teacher = await _ensure_user(db, "teacher@mydeck.dev", "陳老師", "TEACHER")
        student = await _ensure_user(db, "student@mydeck.dev", "李同學", "STUDENT")

        result = await db.execute(select(Course).where(Course.teacher_id == teacher.id).limit(1))
        course = result.scalar_one_or_none()
        if course is None:
            course = Course(
                id=new_id("crs"),
                name="中四數學（演示）",
                code=new_course_code(),
                teacher_id=teacher.id,
            )
            db.add(course)
            await db.flush()

        membership = await db.execute(
            select(CourseMembership).where(
                CourseMembership.course_id == course.id,
                CourseMembership.student_id == student.id,
            )
        )
        if membership.scalar_one_or_none() is None:
            db.add(CourseMembership(id=new_id("mem"), course_id=course.id, student_id=student.id))

        await db.commit()

        print("演示資料已就緒：")
        print(f"  老師：teacher@mydeck.dev / {DEMO_PASSWORD}")
        print(f"  學生：student@mydeck.dev / {DEMO_PASSWORD}")
        print(f"  課程：{course.name}（課程碼 {course.code}）")


async def _ensure_user(db: AsyncSession, identifier: str, display_name: str, role: str) -> User:
    result = await db.execute(select(User).where(User.identifier == identifier))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            id=new_id("usr"),
            identifier=identifier,
            identifier_type="EMAIL",
            display_name=display_name,
            role=role,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(user)
        await db.flush()
    return user


if __name__ == "__main__":
    asyncio.run(main())
