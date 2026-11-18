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

已按 Penpot「all page」切片完成 MVP 前端（`mvp - wireframe` 頁不作開發參考）。設計基準集中於 `src/theme.ts`（切片色板）與 `src/index.css`（CSS 變數），重複版式收斂到 `src/components/ui/` 共用元件（AuthLayout、AppHeader、StatusPill、HeroBanner、EmptyStateCard、CoursewareRow、SlideCanvas、ConfirmDialog 等）。資料暫由 `src/api/mvp.ts` mock adapter 提供：

- 認證群（PG-001～006）：`/login`、`/register`、`/register/verify`、`/forgot-password`、`/reset/verify`、`/reset/password`。
- 老師（PG-007/011/013/014、OL-002/005/006）：`/teacher`、`/teacher/profile`、`/teacher/courses/:courseId`、`.../courseware/:coursewareId`（課件詳情）、`.../preview`（逐頁預覽）；含建立課程、複製課程碼、上傳課件對話框（mock 進度）。
- 學生（PG-008/012、OL-004、OL-010/011）：`/student`、`/student/profile`、`/student/courses/:courseId`（課件/課堂記錄分頁）、`.../courseware/:coursewareId`（逐頁預覽＋點擊新增、編輯、刪除個人文字標註）。
- `/status`：後端健康檢查頁（初始化驗證用）。

領域型別集中於 `src/types/domain.d.ts`；後端業務 API 實作後，應把 mock adapter 改為 `src/api/client.ts` 的 openapi-fetch 呼叫。
