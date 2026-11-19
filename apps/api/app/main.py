from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import ApiError, error_response
from app.services.conversion import recover_interrupted_conversions

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # 啟動收斂：上次程序遺留的 CONVERTING 課件標逾時／中斷，不得永久停在轉換中。
    # 資料表尚未建立（首次啟動未跑 seed）時略過。
    try:
        await recover_interrupted_conversions()
    except Exception:  # noqa: BLE001
        pass
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    from app.core.ids import new_id

    request.state.request_id = new_id("req")
    return await call_next(request)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):  # type: ignore[no-untyped-def]
    return error_response(request, exc.status_code, exc.code, exc.message, exc.fields)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):  # type: ignore[no-untyped-def]
    fields: dict[str, str] = {}
    for error in exc.errors():
        loc = [str(part) for part in error.get("loc", []) if part not in {"body", "query", "path"}]
        name = ".".join(loc) or "body"
        fields.setdefault(name, str(error.get("msg", "不正確的輸入。")))
    return error_response(request, 400, "VALIDATION_ERROR", "請求內容不正確。", fields)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
