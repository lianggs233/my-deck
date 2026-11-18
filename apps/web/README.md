# My Deck Web

React、TypeScript、Vite 與 Mantine 前端。

## 本機啟動

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

預設網址為 `http://localhost:5173`。Vite 會把 `/api`、`/docs`、`/openapi.json` 與 `/socket.io` 轉送至 `http://127.0.0.1:8000`；可用 `.env` 的 `VITE_API_TARGET` 調整。

## 常用命令

```bash
corepack pnpm generate:api  # 從 packages/contracts/openapi.json 生成型別
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm lint:style
corepack pnpm format:check
corepack pnpm build
```

已按 Penpot「all page」切片完成 MVP 前端（`mvp - wireframe` 頁不作開發參考）。設計基準集中於 `src/theme.ts`（切片色板）與 `src/index.css`（CSS 變數），重複版式收斂到 `src/components/ui/` 共用元件（AuthLayout、AppHeader、StatusPill、HeroBanner、EmptyStateCard、CoursewareRow、SlideCanvas、ConfirmDialog 等）。資料已改由真實後端 API 提供：`src/api/http.ts` 封裝 fetch（Session Cookie、CSRF、統一錯誤格式），`src/api/mvp.ts` 為真實 adapter（保留 authApi/courseApi/coursewareApi/annotationApi 匯出名）。啟動前端前請先啟動後端並執行 `scripts/seed_demo.py`。

- 認證群（PG-001～006）：`/login`、`/register`（免驗證碼註冊，成功後回登入頁）、`/forgot-password`、`/reset/verify`、`/reset/password`（驗證碼由後端寫入 `apps/api/var/` 本機 outbox）。
- 老師（PG-007/011/013/014、OL-002/005/006）：`/teacher`、`/teacher/profile`、`/teacher/courses/:courseId`、`.../courseware/:coursewareId`（課件詳情＋轉換狀態輪詢＋重試）、`.../preview`（逐頁預覽 WebP 頁圖）；含建立課程、複製課程碼、上傳課件對話框（建立→PUT→complete 三步）。
- 學生（PG-008/012、OL-004、OL-010/011）：`/student`、`/student/profile`、`/student/courses/:courseId`（課件/課堂記錄分頁）、`.../courseware/:coursewareId`（逐頁預覽＋點擊新增、編輯、刪除個人文字標註，樂觀鎖 409 處理）。
- `/status`：後端健康檢查頁（初始化驗證用）。

領域型別集中於 `src/types/domain.d.ts`；API 型別由 `packages/contracts/openapi.json` 生成（`corepack pnpm generate:api`）。
