# My Deck API

Python 3.12、FastAPI 與 Pydantic 後端，使用 uv 管理依賴。

## 本機啟動

```bash
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- 健康檢查：`GET http://localhost:8000/api/v1/health`
- Swagger UI：`http://localhost:8000/docs`
- OpenAPI：`http://localhost:8000/openapi.json`

## 契約與品質命令

```bash
uv run python -m scripts.export_openapi ../../packages/contracts/openapi.json
uv run ruff format --check .
uv run ruff check .
uv run mypy app scripts
```

目前只有初始化健康檢查端點，尚未加入資料庫、Session 或業務路由。
