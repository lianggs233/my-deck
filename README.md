# My Deck

Web PPT 互動教學系統。目前完成前後端專案初始化；後端 MVP P0 API 已完成（註冊／登入／課程／課件上傳轉換／個人標註，見下方「後端 MVP 快速開始」）；前端已依 Penpot 切片建立登入／註冊、老師與學生課程、課件預覽及個人標註頁面骨架，業務資料暫由 mock adapter 提供，待與後端對接。

## 後端 MVP 快速開始

```bash
cd apps/api
cp .env.example .env
uv sync
uv run python scripts/seed_demo.py    # 建表＋演示帳號與課程成員
uv run uvicorn app.main:app --reload
```

演示帳號：`teacher@mydeck.dev`／`student@mydeck.dev`，密碼 `MyDeck#2026`。註冊驗證碼會寫入 `var/outbox/` 的 JSON 檔（MVP 本機開發以檔案取代真實 SMS／Email）。課件轉換目前使用 Pillow demo 轉換器（輸出文字摘要預覽圖，正式渲染待 LibreOffice 整合）；`.ppt` 舊格式在未安裝 LibreOffice 時會回報明確失敗原因。

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

開啟 `http://127.0.0.1:5173`。MVP 前端路由包括 `/login`、`/register`、`/teacher`、`/student`、`/status`；業務 API 未對接前使用 `apps/web/src/api/mvp.ts` 的 mock adapter。後端未啟動時，`/status` 仍會顯示可重試的錯誤提示。

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
