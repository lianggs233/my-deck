# AGENTS.md

## 通用要求

- 全程使用中文输出。
- 遇到任何不确认的内容（需求理解、设计取舍、实现方式、命令效果、完成状态等），必须先向用户确认并获得明确答复后才继续；不得自行假设或先斩后奏。
- 所有 CLI 命令（安装、启动、验证、脚本等）必须自己实际执行测试通过后，才能输出给用户或写入文档；未实际执行验证过的命令不得提供。
- 不得输出幽灵内容：所有陈述（功能完成度、文件内容、命令结果、看板状态、测试结果等）必须有实际验证依据；不确定或未验证的内容必须如实说明，不得编造。

## 仓库现状

- 前端位于 `apps/web`，使用 React、Mantine、TypeScript、Vite 与 pnpm；后端位于 `apps/api`，使用 Python 3.12、FastAPI、uv、Ruff 与 mypy。
- OpenAPI JSON 位于 `packages/contracts/openapi.json`，前端生成类型位于 `apps/web/src/api/schema.d.ts`；两者都是生成产物，不得手动修改。
- 前端安装与启动：在 `apps/web` 执行 `corepack pnpm install --frozen-lockfile`、`corepack pnpm dev`。
- 后端安装与启动：在 `apps/api` 执行 `uv sync`、`uv run uvicorn app.main:app --reload`。
- 修改 API 后，在 `apps/api` 执行 `uv run python scripts/export_openapi.py`，再在 `apps/web` 执行 `corepack pnpm generate:api`。
- 前端验证：`corepack pnpm lint`、`corepack pnpm lint:style`、`corepack pnpm typecheck`、`corepack pnpm format:check`、`corepack pnpm build`。
- 后端验证：`uv run ruff format --check .`、`uv run ruff check .`、`uv run mypy app scripts`。
- 前端已按 Penpot「all page」切片重写（2026-11-18）：`src/theme.ts` 锚定切片色板（teal #12836F 主色、navy/yellow/mint/muted/error），共用元件集中于 `src/components/ui/`（BrandMark、AuthLayout、AppHeader、StatusPill、HeroBanner、EmptyStateCard、PageHeading、CoursewareRow、SlideCanvas、ConfirmDialog 等 14 个），页面对应 PG-001～014 与 OL-001～011 切片（`mvp - wireframe` 页不作开发参考）。
- 前端已完成真實 API 對接（2026-11-18）：`src/api/http.ts` 封裝 fetch（Session Cookie、`my_deck_csrf` CSRF token、401/403 處理、統一錯誤格式），`src/api/mvp.ts` 改為真實 adapter（保留 authApi/courseApi/coursewareApi/annotationApi 匯出名）；註冊改走免驗證碼 `POST /api/v1/auth/register/direct`（後端新增，不簽 session，註冊後回登入頁）；註冊擁有者驗證碼已移至後續優化（2026-11-18 確認，後端已實作的驗證碼註冊端點保留不動，看板 TASK-020～025 轉「非 MVP」）；忘記密碼走 `password-reset/verification-codes`（outbox 取碼）→ `password-reset`（成功撤銷全部 session）；上傳三步（建立→PUT→complete）後輪詢轉換狀態；標註以 position（0–1 座標）釘選頁面、樂觀鎖 409；Vite dev proxy `/api` → `127.0.0.1:8000`。mock 模式已移除，啟動前須先跑後端與 seed。
- 后端已完成 MVP P0 API：`apps/api/app` 提供注册（验证码 challenge 绑定完整注册内容，验证码写入本地 outbox；另有免验证码 `POST /api/v1/auth/register/direct` 供 MVP 前端使用）、登录（失败锁定）、忘记密码（`password-reset/verification-codes` 防枚举＋`password-reset` 成功撤销全部 session）、Session Cookie＋CSRF、`/api/v1/me`、课程建立／列表／课程码加入／详情、课件上传（本机存储适配预签 PUT，`PUT /api/v1/uploads/{id}/content`）／完成（`/courses/{id}/coursewares/{upload_id}/upload/complete`）／转换（asyncio 背景工作——任务以模块级集合保留强引用防 GC 回收，Pillow demo 转换器输出 WebP 页图，.ppt 无 LibreOffice 时失败并附原因）／页预览／重试、学生个人文字标注 CRUD（position 0–1 坐标钉选页面、乐观锁 expectedVersion、本人隔离）；统一 `{error:{code,message,fields,requestId}}` 错误格式，6 个写入端点支持 Idempotency-Key。
- 后端演示数据：`uv run python scripts/seed_demo.py` 创建数据表与演示账号（teacher@mydeck.dev／student@mydeck.dev，密码 MyDeck#2026）及课程成员关系；数据库与存储默认在 `apps/api/var/`（已 gitignore）。
- 目前未新增前端测试命令；新增结构、依赖或命令后应重新检查并更新本文件及 README。

## 需求、原型与测试

- 执行需求分析、工时估算、原型制作或测试设计前，必须阅读并遵循 `skills/skill.md`。
- 严格按以下顺序交付：`docs/requirements.md` → `docs/breakdown.md` → 可交互原型 → **用户明确确认原型** → `docs/test-cases.md`。原型未获明确确认，不得编写测试用例。
- Skill 流程生成的 Markdown 文件统一放在 `docs/` 文件夹；`AGENTS.md`、`README.md` 和 `skills/skill.md` 等仓库说明文件不属于流程产物，不得因此移动。
- 使用 `REQ-###`、`TASK-###`、`TC-###` 统一编号，确保需求、任务和测试用例可互相追踪。
- 需求拆分必须按功能点逐层细分至可独立验收的具体交互，例如点击按钮、提交表单或翻页，并明确触发条件、系统反馈和异常结果；不得只按页面、模块或前后端工作粗分。
- 需求文档中的大点不能只写标题或一句概括，必须继续细化记录具体子功能和操作；每项至少明确入口或触发条件、前置条件、主要流程、系统反馈、数据及权限变化、成功结果、失败或异常结果和验收标准。复杂需求可使用 `REQ-001-01` 等子编号，保持后续任务与测试可追踪；预留功能必须与本期待交付内容分开记录。
- 工时统一按小时估算；单项任务超过 8 小时时应继续拆分，无法拆分时须说明原因。
- 原型变更后，必须同步更新需求和拆分文档，并重新取得用户确认。
- 本地原型必须是可直接打开的 HTML 文件，CSS 和 JavaScript 内嵌且交互可操作；外部原型链接必须实际验证可访问及权限适当，不得提供未创建或未验证的链接。

## Skill 执行时间线

- 时间线独立记录在 `docs/timeline.md`，不得在 `AGENTS.md` 内重复维护表格。
- 执行 `skills/skill.md` 每个步骤时，必须按该文件规则即时更新开始时间、完成时间、状态、轮次及产出位置。
