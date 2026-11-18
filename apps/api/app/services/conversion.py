from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.ids import new_id
from app.db.base import utcnow
from app.db.engine import session_factory
from app.db.models import ConversionAttempt, Courseware, CoursewarePage
from app.services.storage import read_bytes, save_bytes

FULL_LONG_EDGE = 1920
THUMB_LONG_EDGE = 320
PAGE_WIDTH = 1600
PAGE_HEIGHT = 900


@dataclass
class ConversionResult:
    page_count: int
    warning: str | None


def _extract_slide_texts(original: bytes) -> list[str]:
    """以 python-pptx 讀取每張投影片的文字（MVP demo 轉換器）。"""
    presentation = Presentation(io.BytesIO(original))
    texts: list[str] = []
    for index, slide in enumerate(presentation.slides, start=1):
        parts: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                text = shape.text_frame.text.strip()
                if text:
                    parts.append(text)
        texts.append("\n".join(parts) if parts else f"第 {index} 頁")
    return texts


def _render_page(text: str, index: int, total: int) -> Image.Image:
    """產生示範頁面圖像（非真實簡報渲染，僅供 MVP 流程驗證）。"""
    image = Image.new("RGB", (PAGE_WIDTH, PAGE_HEIGHT), "#f8fafc")
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, 0, PAGE_WIDTH, 96], fill="#1e3a8a")
    font = ImageFont.load_default(size=28)
    small = ImageFont.load_default(size=20)
    draw.text((48, 34), "My Deck Demo 轉換預覽（非真實內容）", fill="#ffffff", font=font)
    draw.text((48, 140), f"第 {index} / {total} 頁", fill="#1e3a8a", font=font)
    y = 210
    for line in text.splitlines()[:18]:
        draw.text((72, y), line[:88], fill="#111827", font=small)
        y += 44
    draw.rectangle([0, PAGE_HEIGHT - 56, PAGE_WIDTH, PAGE_HEIGHT], fill="#e2e8f0")
    draw.text(
        (48, PAGE_HEIGHT - 40),
        "正式版將以 LibreOffice 渲染完整簡報內容",
        fill="#475569",
        font=small,
    )
    return image


def _to_webp(image: Image.Image, long_edge: int) -> bytes:
    scale = min(1.0, long_edge / max(image.size))
    if scale < 1.0:
        image = image.resize((int(image.width * scale), int(image.height * scale)))
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=85)
    return buffer.getvalue()


async def run_conversion(courseware_id: str, attempt_no: int) -> None:
    """背景轉換工作（MVP 以 asyncio 執行；正式環境由 Celery worker 取代）。"""
    settings = get_settings()
    async with session_factory() as db:
        result = await db.execute(select(Courseware).where(Courseware.id == courseware_id))
        courseware = result.scalar_one_or_none()
        if courseware is None:
            return
        attempt_result = await db.execute(
            select(ConversionAttempt).where(
                ConversionAttempt.courseware_id == courseware_id,
                ConversionAttempt.attempt_no == attempt_no,
            )
        )
        attempt = attempt_result.scalar_one_or_none()
        try:
            original = read_bytes(courseware.original_object_key)
            is_pptx = courseware.file_name.lower().endswith(".pptx")
            if not is_pptx:
                raise _UnsupportedFormat(
                    "目前環境未安裝 LibreOffice，.ppt 舊格式暫不支援，請改用 .pptx。"
                )
            texts = _extract_slide_texts(original)
            if len(texts) > settings.max_courseware_pages:
                raise _TooManyPages(
                    f"投影片頁數 {len(texts)} 超過上限 {settings.max_courseware_pages} 頁。"
                )

            total = len(texts)
            for index, text in enumerate(texts, start=1):
                image = _render_page(text, index, total)
                full = _to_webp(image.copy(), FULL_LONG_EDGE)
                thumb = _to_webp(image, THUMB_LONG_EDGE)
                base_key = f"coursewares/{courseware.id}/pages/{index - 1}"
                save_bytes(f"{base_key}.webp", full)
                save_bytes(f"{base_key}.thumb.webp", thumb)
                db.add(
                    CoursewarePage(
                        id=new_id("page"),
                        courseware_id=courseware.id,
                        page_index=index - 1,
                        width=image.width,
                        height=image.height,
                        full_key=f"{base_key}.webp",
                        thumb_key=f"{base_key}.thumb.webp",
                        version=courseware.version,
                    )
                )

            courseware.status = "READY_WITH_WARNINGS"
            courseware.page_count = total
            courseware.warning = (
                "Demo 轉換器：目前以文字摘要產生預覽圖，正式渲染待 LibreOffice 整合。"
            )
            courseware.failure_code = None
            courseware.failure_message = None
            courseware.failure_detail = None
            if attempt is not None:
                attempt.status = "SUCCEEDED"
                attempt.finished_at = utcnow()
            await db.commit()
        except _UnsupportedFormat as error:
            await _fail(db, courseware, attempt, "UNSUPPORTED_FORMAT", str(error))
        except _TooManyPages as error:
            await _fail(db, courseware, attempt, "TOO_MANY_PAGES", str(error))
        except Exception as error:  # noqa: BLE001
            await _fail(db, courseware, attempt, "CONVERSION_FAILED", f"轉換失敗：{error}")


async def _fail(
    db: AsyncSession,
    courseware: Courseware,
    attempt: ConversionAttempt | None,
    code: str,
    message: str,
) -> None:
    courseware.status = "FAILED"
    courseware.failure_code = code
    courseware.failure_message = message
    courseware.failure_detail = message
    if attempt is not None:
        attempt.status = "FAILED"
        attempt.error_code = code
        attempt.error_message = message
        attempt.finished_at = utcnow()
    await db.commit()


async def next_attempt_no(db: AsyncSession, courseware_id: str) -> int:
    result = await db.execute(
        select(func.max(ConversionAttempt.attempt_no)).where(
            ConversionAttempt.courseware_id == courseware_id
        )
    )
    current = result.scalar_one_or_none()
    return int(current or 0) + 1


class _UnsupportedFormat(Exception):
    pass


class _TooManyPages(Exception):
    pass
