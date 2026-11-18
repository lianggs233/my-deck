# API contracts

`openapi.json` 由 FastAPI 產生，是前後端 HTTP 契約的生成來源；請勿手動修改。

在 `apps/api` 執行：

```bash
uv run python -m scripts.export_openapi ../../packages/contracts/openapi.json
```

然後在 `apps/web` 執行 `pnpm generate:api`，更新前端 TypeScript 型別。
