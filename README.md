# My Deck

Web PPT 互動教學系統。目前完成前後端專案初始化、公開健康檢查，以及由 FastAPI OpenAPI 生成前端 TypeScript 型別的契約流程；登入、課程、課件及標註功能尚未開始實作。

## 專案結構

```text
apps/
  web/                 React、Mantine、TypeScript、Vite 前端
  api/                 Python、FastAPI 後端
packages/
  contracts/           由後端生成的 OpenAPI JSON
docs/                  需求、拆分、API、權限及設計文件
skills/                專案流程指引
```

## 環境需求

- Node.js 24 與 Corepack（使用 pnpm 12）。
- Python 3.12 與 uv。
- 目前僅需本機 Python 與 Node.js；PostgreSQL、Redis、物件儲存及背景工作者會在對應功能實作時加入。

## 啟動後端

```bash
cd apps/api
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- 健康檢查：`GET http://127.0.0.1:8000/api/v1/health`
- OpenAPI：`http://127.0.0.1:8000/openapi.json`
- Swagger UI：`http://127.0.0.1:8000/docs`

## 啟動前端

另開終端機：

```bash
cd apps/web
cp .env.example .env
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

開啟 `http://127.0.0.1:5173`。初始化頁會透過 Vite `/api` proxy 呼叫後端健康檢查，並顯示連線中、成功或失敗狀態。後端未啟動時，頁面會顯示可重試的錯誤提示。

## 更新 API 契約與前端型別

修改 FastAPI Pydantic schema 或路由後，依序執行：

```bash
cd apps/api
uv run python scripts/export_openapi.py

cd ../web
corepack pnpm generate:api
```

這會更新 `packages/contracts/openapi.json` 與 `apps/web/src/api/schema.d.ts`。兩者均為生成產物，不應手動修改。前端透過 `src/api/client.ts` 的 `openapi-fetch` 呼叫 API。

## 品質檢查

後端：

```bash
cd apps/api
uv run ruff format --check .
uv run ruff check .
uv run mypy app scripts
```

前端：

```bash
cd apps/web
corepack pnpm lint
corepack pnpm lint:style
corepack pnpm typecheck
corepack pnpm format:check
corepack pnpm build
```

尚未建立測試用例；依專案流程，須待互動原型取得使用者明確確認後才可編寫 `docs/test-cases.md`。

## 主要文件

- `docs/requirements.md`：完整產品需求。
- `docs/mvp-priority.md`：MVP 範圍與優先級。
- `docs/breakdown.md`：功能任務、依賴及小時估算。
- `docs/api-design.md`：REST、Socket.IO 與錯誤碼設計。
- `docs/api-schemas.md`：request／response 欄位契約。
- `docs/auth-permission-design.md`：認證、Session、CSRF 及權限設計。
