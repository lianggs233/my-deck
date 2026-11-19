"""LibreOffice 正式轉換管線：PPT/PPTX → PDF → PNG → WebP。

以 `soffice --headless` 把簡報轉成 PDF，再用 `pdftoppm`（poppler）逐頁
渲染成點陣圖，最後以 Pillow 輸出正式頁圖（長邊 1920）與縮圖（長邊 320）。
所有外部程序都在執行緒中同步執行（`asyncio.to_thread`），避免阻塞事件迴圈。
"""

from __future__ import annotations

import asyncio
import io
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

FULL_LONG_EDGE = 1920
THUMB_LONG_EDGE = 320
# 150 DPI：16:9 簡報約渲染成 2000×1125，再縮到長邊 1920。
RENDER_DPI = 150


@dataclass
class RenderedPage:
    full: bytes
    thumb: bytes
    width: int
    height: int


class OfficeConversionError(Exception):
    """LibreOffice／PDF 渲染失敗（訊息需可讀，會進入 failure_message）。"""


def to_webp(image: Image.Image, long_edge: int) -> tuple[bytes, int, int]:
    """等比縮放至長邊上限並輸出 WebP，回傳（資料, 寬, 高）。"""
    scale = min(1.0, long_edge / max(image.size))
    if scale < 1.0:
        image = image.resize((int(image.width * scale), int(image.height * scale)))
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=85)
    return buffer.getvalue(), image.width, image.height


async def render_office_pages(
    original: bytes,
    file_name: str,
    *,
    soffice_bin: str,
    timeout_seconds: int,
) -> list[RenderedPage]:
    """把簡報原檔渲染成逐頁 WebP（在執行緒中執行外部程序）。"""
    return await asyncio.to_thread(
        _render_office_pages_sync,
        original,
        file_name,
        soffice_bin=soffice_bin,
        timeout_seconds=timeout_seconds,
    )


def _render_office_pages_sync(
    original: bytes,
    file_name: str,
    *,
    soffice_bin: str,
    timeout_seconds: int,
) -> list[RenderedPage]:
    suffix = Path(file_name).suffix.lower() or ".pptx"
    with tempfile.TemporaryDirectory(prefix="mydeck-conv-") as tmp:
        work = Path(tmp)
        source = work / f"source{suffix}"
        source.write_bytes(original)

        # 獨立 UserInstallation，避免並發轉換共用 profile 互相干擾。
        profile = work / "lo-profile"
        convert_cmd = [
            soffice_bin,
            "--headless",
            "--norestore",
            "--nolockcheck",
            f"-env:UserInstallation=file://{profile}",
            "--convert-to",
            "pdf",
            "--outdir",
            str(work),
            str(source),
        ]
        try:
            proc = subprocess.run(
                convert_cmd,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except FileNotFoundError as error:
            raise OfficeConversionError(
                f"找不到 LibreOffice 執行檔（{soffice_bin}），請確認伺服器已安裝。"
            ) from error
        except subprocess.TimeoutExpired as error:
            raise OfficeConversionError(
                f"LibreOffice 轉換超過 {timeout_seconds} 秒，檔案可能過大或損壞。"
            ) from error

        pdf_path = work / "source.pdf"
        if proc.returncode != 0 or not pdf_path.exists():
            detail = (proc.stderr or proc.stdout or "").strip().splitlines()
            reason = detail[-1][:200] if detail else "未知原因"
            raise OfficeConversionError(f"LibreOffice 無法轉換此檔案（{reason}）。")

        prefix = work / "page"
        try:
            render_proc = subprocess.run(
                ["pdftoppm", "-png", "-r", str(RENDER_DPI), str(pdf_path), str(prefix)],
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired as error:
            raise OfficeConversionError(
                f"頁面渲染超過 {timeout_seconds} 秒，檔案可能過大。"
            ) from error
        if render_proc.returncode != 0:
            render_detail = (render_proc.stderr or "").strip()[:200]
            raise OfficeConversionError(f"頁面渲染失敗（{render_detail or '未知原因'}）。")

        pngs = sorted(
            work.glob("page-*.png"),
            key=lambda path: int(path.stem.rsplit("-", maxsplit=1)[-1]),
        )
        if not pngs:
            raise OfficeConversionError("轉換結果沒有任何頁面。")

        pages: list[RenderedPage] = []
        for png in pngs:
            with Image.open(png) as image:
                rgb = image.convert("RGB")
                full, width, height = to_webp(rgb.copy(), FULL_LONG_EDGE)
                thumb, _, _ = to_webp(rgb, THUMB_LONG_EDGE)
            pages.append(RenderedPage(full=full, thumb=thumb, width=width, height=height))
        return pages
