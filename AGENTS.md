# AGENTS.md

## 通用要求

- 全程使用中文输出。

## 仓库现状

- 前端位于 `apps/web`，使用 React、Mantine、TypeScript、Vite 与 pnpm；后端位于 `apps/api`，使用 Python 3.12、FastAPI、uv、Ruff 与 mypy。
- OpenAPI JSON 位于 `packages/contracts/openapi.json`，前端生成类型位于 `apps/web/src/api/schema.d.ts`；两者都是生成产物，不得手动修改。
- 前端安装与启动：在 `apps/web` 执行 `corepack pnpm install --frozen-lockfile`、`corepack pnpm dev`。
- 后端安装与启动：在 `apps/api` 执行 `uv sync`、`uv run uvicorn app.main:app --reload`。
- 修改 API 后，在 `apps/api` 执行 `uv run python scripts/export_openapi.py`，再在 `apps/web` 执行 `corepack pnpm generate:api`。
- 前端验证：`corepack pnpm lint`、`corepack pnpm lint:style`、`corepack pnpm typecheck`、`corepack pnpm format:check`、`corepack pnpm build`。
- 后端验证：`uv run ruff format --check .`、`uv run ruff check .`、`uv run mypy app scripts`。
- 前端已启动 MVP 页面骨架：`src/types/domain.d.ts` 声明领域类型，`src/api/mvp.ts` 为 mock／API 对接预留层，`src/auth/`、`src/components/`、`src/pages/` 提供登录注册、角色首页、课程详情、课件预览及个人标注交互；生成类型仍未覆盖业务 API，业务后端接口未接入前不得声称已完成对接。
- 后端已完成 MVP P0 API：`apps/api/app` 提供注册（验证码 challenge 绑定完整注册内容，验证码写入本地 outbox）、登录（失败锁定）、Session Cookie＋CSRF、`/api/v1/me`、课程建立／列表／课程码加入／详情、课件上传（本机存储适配预签 PUT，`PUT /api/v1/uploads/{id}/content`）／完成／转换（asyncio 背景工作＋Pillow demo 转换器，输出 WebP 页图，.ppt 无 LibreOffice 时失败并附原因）／页预览／重试、学生个人文字标注 CRUD（乐观锁 expectedVersion、本人隔离）；统一 `{error:{code,message,fields,requestId}}` 错误格式，6 个写入端点支持 Idempotency-Key。
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
