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

目前只有初始化健康檢查頁；業務功能與測試會按已確認流程另行加入。
