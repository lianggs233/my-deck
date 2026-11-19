from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import UTC, timedelta

from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.ids import new_id
from app.db.base import utcnow
from app.db.engine import session_factory
from app.db.models import ConversionAttempt, Courseware, CoursewarePage
from app.services.office_convert import (
    FULL_LONG_EDGE,
    THUMB_LONG_EDGE,
    OfficeConversionError,
    RenderedPage,
    render_office_pages,
    to_webp,
)
from app.services.storage import read_bytes, save_bytes, upload_object_path

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


async def _is_latest_attempt(db: AsyncSession, courseware_id: str, attempt_no: int) -> bool:
    """舊回調防護：只有目前最新的轉換嘗試可以寫入課件狀態。

    已逾時／已失敗工作的延遲回調（例如被 watchdog 取消後才返回的舊任務）
    不得把狀態或頁面資源覆蓋成新嘗試的結果。
    """
    result = await db.execute(
        select(func.max(ConversionAttempt.attempt_no)).where(
            ConversionAttempt.courseware_id == courseware_id
        )
    )
    latest = int(result.scalar_one_or_none() or 0)
    return latest == attempt_no


async def _render_pages(
    settings: Settings, original: bytes, file_name: str
) -> tuple[list[RenderedPage], str, str | None]:
    """依設定選擇轉換器，回傳（頁面圖像, 最終狀態, 警告訊息）。

    - libreoffice：正式渲染（PPT/PPTX 皆支援）→ READY；
    - placeholder：MVP 文字摘要預覽（僅 .pptx）→ READY_WITH_WARNINGS。
    """
    if settings.converter == "libreoffice":
        rendered = await render_office_pages(
            original,
            file_name,
            soffice_bin=settings.libreoffice_bin,
            timeout_seconds=settings.libreoffice_timeout_seconds,
        )
        if len(rendered) > settings.max_courseware_pages:
            raise _TooManyPages(
                f"投影片頁數 {len(rendered)} 超過上限 {settings.max_courseware_pages} 頁。"
            )
        return rendered, "READY", None

    if not file_name.lower().endswith(".pptx"):
        raise _UnsupportedFormat("Demo 轉換器僅支援 .pptx；.ppt 舊格式請改用 LibreOffice 轉換器。")
    texts = _extract_slide_texts(original)
    if len(texts) > settings.max_courseware_pages:
        raise _TooManyPages(
            f"投影片頁數 {len(texts)} 超過上限 {settings.max_courseware_pages} 頁。"
        )
    total = len(texts)
    rendered = []
    for index, text in enumerate(texts, start=1):
        image = _render_page(text, index, total)
        full, width, height = to_webp(image.copy(), FULL_LONG_EDGE)
        thumb, _, _ = to_webp(image, THUMB_LONG_EDGE)
        rendered.append(RenderedPage(full=full, thumb=thumb, width=width, height=height))
    return (
        rendered,
        "READY_WITH_WARNINGS",
        "Demo 轉換器：目前以文字摘要產生預覽圖，正式渲染請啟用 LibreOffice 轉換器。",
    )


async def run_conversion(courseware_id: str, attempt_no: int) -> None:
    """背景轉換工作（MVP 以 asyncio 執行；正式環境由 Celery worker 取代）。

    頁面資源以嘗試編號隔離路徑（attempts/{attempt_no}/），避免舊嘗試的
    延遲寫入覆蓋新嘗試已發布的檔案；最終狀態寫入前會比對最新嘗試。
    """
    settings = get_settings()
    written_keys: list[str] = []
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
            rendered, final_status, warning = await _render_pages(
                settings, original, courseware.file_name
            )

            total = len(rendered)
            pages: list[CoursewarePage] = []
            for index, page_image in enumerate(rendered, start=1):
                base_key = f"coursewares/{courseware.id}/attempts/{attempt_no}/pages/{index - 1}"
                save_bytes(f"{base_key}.webp", page_image.full)
                save_bytes(f"{base_key}.thumb.webp", page_image.thumb)
                written_keys.extend([f"{base_key}.webp", f"{base_key}.thumb.webp"])
                pages.append(
                    CoursewarePage(
                        id=new_id("page"),
                        courseware_id=courseware.id,
                        page_index=index - 1,
                        width=page_image.width,
                        height=page_image.height,
                        full_key=f"{base_key}.webp",
                        thumb_key=f"{base_key}.thumb.webp",
                        version=courseware.version,
                    )
                )

            if not await _is_latest_attempt(db, courseware_id, attempt_no):
                # 舊嘗試的延遲回調：丟棄本次結果，不覆蓋新嘗試的狀態與資源。
                _discard_written_files(written_keys)
                if attempt is not None and attempt.status == "RUNNING":
                    attempt.status = "SUPERSEDED"
                    attempt.error_code = "SUPERSEDED"
                    attempt.error_message = "已有更新的轉換嘗試，本次結果已丟棄。"
                    attempt.finished_at = utcnow()
                    await db.commit()
                return

            db.add_all(pages)
            courseware.status = final_status
            courseware.page_count = total
            courseware.warning = warning
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
        except OfficeConversionError as error:
            await _fail(db, courseware, attempt, "CONVERSION_FAILED", str(error))
        except Exception as error:  # noqa: BLE001
            await _fail(db, courseware, attempt, "CONVERSION_FAILED", f"轉換失敗：{error}")


async def _fail(
    db: AsyncSession,
    courseware: Courseware,
    attempt: ConversionAttempt | None,
    code: str,
    message: str,
) -> None:
    # 舊回調防護：只有最新嘗試的失敗可以改寫課件狀態。
    if courseware.status == "CONVERTING" and await _is_latest_attempt(
        db, courseware.id, attempt.attempt_no if attempt is not None else -1
    ):
        courseware.status = "FAILED"
        courseware.failure_code = code
        courseware.failure_message = message
        courseware.failure_detail = message
    if attempt is not None and attempt.status == "RUNNING":
        attempt.status = "FAILED"
        attempt.error_code = code
        attempt.error_message = message
        attempt.finished_at = utcnow()
    await db.commit()


async def mark_conversion_timed_out(courseware_id: str, attempt_no: int) -> None:
    """watchdog 逾時標記：逾時嘗試標 TIMED_OUT；只有最新嘗試可改寫課件狀態。"""
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
        message = f"轉換超過 {settings.conversion_timeout_seconds} 秒時限，請重新轉換。"
        if attempt is not None and attempt.status == "RUNNING":
            attempt.status = "TIMED_OUT"
            attempt.error_code = "TIMED_OUT"
            attempt.error_message = message
            attempt.finished_at = utcnow()
        if courseware.status == "CONVERTING" and await _is_latest_attempt(
            db, courseware_id, attempt_no
        ):
            courseware.status = "TIMED_OUT"
            courseware.failure_code = "TIMED_OUT"
            courseware.failure_message = message
            courseware.failure_detail = message
        await db.commit()


async def recover_interrupted_conversions() -> None:
    """啟動收斂：上次程序結束遺留的 CONVERTING 課件不得永久停在轉換中。

    - 已超過時限 → TIMED_OUT；
    - 未超時但背景工作已隨程序消失 → FAILED（CONVERSION_INTERRUPTED）。
    兩者都保留手動重試入口，不自動重試。
    """
    settings = get_settings()
    async with session_factory() as db:
        rows = (
            (await db.execute(select(Courseware).where(Courseware.status == "CONVERTING")))
            .scalars()
            .all()
        )
        now = utcnow()
        for courseware in rows:
            attempt_result = await db.execute(
                select(ConversionAttempt)
                .where(
                    ConversionAttempt.courseware_id == courseware.id,
                    ConversionAttempt.status == "RUNNING",
                )
                .order_by(ConversionAttempt.attempt_no.desc())
                .limit(1)
            )
            attempt = attempt_result.scalar_one_or_none()
            # SQLite 讀回的時間不帶時區，統一補上 UTC 再比較（與 sessions 服務同慣例）。
            started_at = (courseware.conversion_started_at or now).replace(tzinfo=UTC)
            overdue = now > started_at + timedelta(seconds=settings.conversion_timeout_seconds)
            if overdue:
                courseware.status = "TIMED_OUT"
                courseware.failure_code = "TIMED_OUT"
                courseware.failure_message = (
                    f"轉換超過 {settings.conversion_timeout_seconds} 秒時限，請重新轉換。"
                )
                courseware.failure_detail = courseware.failure_message
                if attempt is not None:
                    attempt.status = "TIMED_OUT"
                    attempt.error_code = "TIMED_OUT"
                    attempt.error_message = courseware.failure_message
                    attempt.finished_at = now
            else:
                courseware.status = "FAILED"
                courseware.failure_code = "CONVERSION_INTERRUPTED"
                courseware.failure_message = "服務重新啟動導致轉換中斷，請重新轉換。"
                courseware.failure_detail = courseware.failure_message
                if attempt is not None:
                    attempt.status = "FAILED"
                    attempt.error_code = "CONVERSION_INTERRUPTED"
                    attempt.error_message = courseware.failure_message
                    attempt.finished_at = now
        await db.commit()


def _discard_written_files(keys: list[str]) -> None:
    for key in keys:
        upload_object_path(key).unlink(missing_ok=True)


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
