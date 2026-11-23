# AGENTS.md

## 通用要求

- 全程使用中文输出。
- 遇到任何不确认的内容（需求理解、设计取舍、实现方式、命令效果、完成状态等），必须先向用户确认并获得明确答复后才继续；不得自行假设或先斩后奏。
- 所有 CLI 命令（安装、启动、验证、脚本等）必须自己实际执行测试通过后，才能输出给用户或写入文档；未实际执行验证过的命令不得提供。
- 不得输出幽灵内容：所有陈述（功能完成度、文件内容、命令结果、看板状态、测试结果等）必须有实际验证依据；不确定或未验证的内容必须如实说明，不得编造。
- 看板任務流程（2026-11-19 確認）：① 每個任務必須記錄實際工時（開始／完成時間，寫入 `docs/timeline.md`）；② 開始處理任務時，主動將 GitHub Project 該卡片狀態轉為「In progress」（option id `23cd56b0`）；③ 任務完成後不得自行標「Done」，先向用戶匯報實際驗證結果，由用戶檢查確認後才轉「Done」。

## 仓库现状

- 前端位于 `apps/web`，使用 React、Mantine、TypeScript、Vite 与 pnpm；后端位于 `apps/api`，使用 Python 3.12、FastAPI、uv、Ruff 与 mypy。
- OpenAPI JSON 位于 `packages/contracts/openapi.json`，前端生成类型位于 `apps/web/src/api/schema.d.ts`；两者都是生成产物，不得手动修改。
- 前端安装与启动：在 `apps/web` 执行 `corepack pnpm install --frozen-lockfile`、`corepack pnpm dev`。
- 后端安装与启动：在 `apps/api` 执行 `uv sync`、`uv run uvicorn app.main:app --reload`。
- 修改 API 后，在 `apps/api` 执行 `uv run python scripts/export_openapi.py`，再在 `apps/web` 执行 `corepack pnpm generate:api`。
- 前端验证：`corepack pnpm lint`、`corepack pnpm lint:style`、`corepack pnpm typecheck`、`corepack pnpm format:check`、`corepack pnpm build`。
- 后端验证：`uv run ruff format --check .`、`uv run ruff check .`、`uv run mypy app scripts`。
- 前端已按 Penpot「all page」切片重写（2026-11-18）：`src/theme.ts` 锚定切片色板（teal #12836F 主色、navy/yellow/mint/muted/error），共用元件集中于 `src/components/ui/`（BrandMark、AuthLayout、AppHeader、StatusPill、HeroBanner、EmptyStateCard、PageHeading、CoursewareRow、SlideCanvas、ConfirmDialog 等 14 个），页面对应 PG-001～014 与 OL-001～011 切片（`mvp - wireframe` 页不作开发参考）。
- 版式規則（2026-11-19 確認）：**所有主頁面（視窗）不允許出現滾動條，只能在內容區內滾動**。實作：`.md-viewport`（`height:100vh/100dvh; overflow:hidden`）套於 `AuthLayout` 與 `AppLayout` 根節點；認證頁右欄 `section` 為捲動區（白卡 `margin:auto` 置中，超高時區內捲動不裁頂），內頁頂欄固定 96px、內容區 `flex:1; overflow-y:auto`；新增頁面必須沿用此結構。
- 版式規則（2026-11-20 確認）：**頁面邊緣上下左右留白最多 2rem**（AppHeader／`.md-container`／觀看頁頂欄皆 2rem、AppLayout 內容區 py 2rem）；**AuthLayout 認證頁（登入／註冊／忘記密碼／加入課堂）除外，維持 1rem**；`.md-container` 不設寬度上限，內容填滿視窗寬度；**頁面級板塊間距（主 Stack）統一 2rem**（各頁主 Stack `gap={32}`，卡片／Modal／元件內部間距不在此限）。
- 前端已完成真實 API 對接（2026-11-18）：`src/api/http.ts` 封裝 fetch（Session Cookie、`my_deck_csrf` CSRF token、401/403 處理、統一錯誤格式），`src/api/mvp.ts` 改為真實 adapter（保留 authApi/courseApi/coursewareApi/annotationApi 匯出名）；註冊改走免驗證碼 `POST /api/v1/auth/register/direct`（後端新增，不簽 session，註冊後回登入頁）；註冊擁有者驗證碼已移至後續優化（2026-11-18 確認，後端已實作的驗證碼註冊端點保留不動，看板 TASK-020～025 轉「非 MVP」）；忘記密碼本期以舊密碼驗證直接重設（2026-11-18 確認，`POST /api/v1/auth/password-reset/direct`，帳號＋舊密碼＋新密碼，不發驗證碼；失敗計入登入鎖定，成功撤銷全部 session；驗證碼重設端點保留不動屬後續優化）；上傳三步（建立→PUT→complete）後輪詢轉換狀態；標註以 position（0–1 座標）釘選頁面、樂觀鎖 409；Vite dev proxy `/api` → `127.0.0.1:8000`。mock 模式已移除，啟動前須先跑後端與 seed。
- 后端已完成 MVP P0 API：`apps/api/app` 提供注册（验证码 challenge 绑定完整注册内容，验证码写入本地 outbox；另有免验证码 `POST /api/v1/auth/register/direct` 供 MVP 前端使用）、登录（失败锁定）、忘记密码（本期以旧密码验证 `POST /api/v1/auth/password-reset/direct` 直接重设，不发验证码；失败计入登录锁定，成功撤销全部 session；验证码重设端点 `password-reset/verification-codes`＋`password-reset` 保留不动属后续优化）、Session Cookie＋CSRF、`/api/v1/me`、课程建立／列表／课程码加入／详情、课件上传（本机存储适配预签 PUT，`PUT /api/v1/uploads/{id}/content`）／完成（`/courses/{id}/coursewares/{upload_id}/upload/complete`）／转换（asyncio 背景工作＋asyncio.wait_for 逾時標記＋啟動收斂中斷轉換；**LibreOffice 正式轉換器**：soffice→PDF→pdftoppm→WebP，PPT/PPTX 皆支援並回 READY（`asyncio.Semaphore` 限制同時只跑 1 個 soffice 轉換，避免低記憶體主機 OOM）；`MY_DECK_CONVERTER=placeholder` 可回退 Pillow demo 後端，僅 .pptx 並回 READY_WITH_WARNINGS；需系統已裝 libreoffice-impress 與 poppler-utils）／页预览／重试、学生个人文字标注 CRUD（position 0–1 坐标钉选页面、乐观锁 expectedVersion、本人隔离）；统一 `{error:{code,message,fields,requestId}}` 错误格式，6 个写入端点支持 Idempotency-Key。
- 即時課堂（REQ-006，2026-11-19）：後端 `app/api/v1/routes/classrooms.py`＋`app/schemas/classroom.py`＋`app/services/realtime.py`（單程序即時通道 stub）＋`classrooms` 表（6 位課堂碼、`page_index`／`page_count`／`state_version`，partial unique index 保證同課程與同老師各只有一個 `LIVE` 課堂）；端點 `POST /courses/{id}/classrooms`（201，含 `joinInfo`）、`GET /courses/{id}/classrooms/{id}`、`GET /classrooms/{id}/join-info`、`POST /classrooms/{id}/pages`（NEXT／PREV／GOTO＋`expectedStateVersion` 樂觀鎖）。前端 `classroomApi`＋課件詳情頁「開始授課」對話框＋授課控制頁 `/teacher/courses/:courseId/classrooms/:classroomId`（頁碼翻頁、課堂碼顯示與複製、加入資訊開關，不含學生控制項）。技術債 B-2（PostgreSQL／Redis／Celery）依用戶指示暫緩，本期續用 SQLite＋asyncio。
- 課堂加入（REQ-007，2026-11-19）：後端新增 `guest_identities`／`classroom_participants`／`classroom_join_attempts` 三表；端點 `POST /classrooms/join`（課堂碼 trim＋轉大寫、6 位、帳號及 IP 可配置限流 429、未加入課程學生可加入但不建課程成員）、`POST /classrooms/{id}/join`（已加入課程學生由課程頁進入）、`GET /classrooms/{id}/snapshot?guestId=`（學生／訪客／老師）、`GET /classrooms/{id}/events`（SSE 翻頁觸發器，心跳 15 秒）、`GET /courses/{id}/classrooms/active`（課程頁橫幅用）；訪客由服務端產生 `訪客-XXXX` 隨機名，`guestId` 只存瀏覽器 localStorage `my_deck_guest_id`，ID 失效須使用者確認後才建新身份；訪客 `canWrite`／`canViewShared` 一律 false。前端新增公開頁 `/join`、`/join/:code`（6 位課堂碼輸入；UI 明確標示課堂碼 6 位、課程碼 8 位）與 `/classrooms/:classroomId`（3 秒輪詢＋SSE 觸發同步、僅顯示目前頁、無翻頁／標註控件）；學生課程頁頂部「課堂進行中」橫幅一鍵進入。
- 翻頁同步與重連（REQ-008／009，2026-11-19）：教師授課控制頁新增縮圖列（128px 16:9，`nav aria-label="選擇頁面"`，當前頁 3px teal 邊框＋aria-current，點擊 GOTO）；turnMutation 支援 GOTO 且 onSuccess 只在 `stateVersion` 變大時更新（防舊回應覆蓋）。學生／訪客觀看頁：SSE `state` 事件以 `stateVersionRef` 只升不降防亂序；`navigator.onLine`＋online/offline 事件顯示「已離線，顯示最後確認畫面」並停輪詢，恢復連線立即取快照；錯誤視圖分層 401（工作階段已失效＋重新登入）／403（未加入＋/join 引導）／其他（重試恢復按鈕），401/403 時即使保留舊快照也強制顯示錯誤視圖不冒用；學生身份在當前頁疊本人個人標註唯讀圓點（訪客無）；SlideCanvas 圖片載入失敗顯示「目前頁面載入失敗」＋重試（key 重掛），不把空白頁當成功。後端 `classroom_events` 在授權後 `await db.close()`（SSE 串流不再佔用 DB 連線，修復 100 並發訂閱耗盡 QueuePool size 5＋overflow 10 導致全站 TimeoutError）；新增 `_ensure_not_stale_session`（帶失效 session cookie → 401 SESSION_INVALID，掛於 snapshot／events）。TASK-144 量測：100 個 SSE 客戶端同時訂閱，教師翻頁後 100/100 收到事件，延遲 min 25.8／median 65.3／p95 84.1／max 85.5 ms（NFR-004 ≤300ms 達標）。TASK-149～151（簽到／答題／共享標註恢復）依賴 REQ-011～016，保持非 MVP。
- 共享標註（REQ-011～013，2026-11-20）：後端 `app/api/v1/routes/shared_annotations.py`＋`app/schemas/shared_annotation.py`，4 新表（`shared_annotation_groups`（位置在群組上）／`shared_annotations`（status VISIBLE/HIDDEN/DELETED/CLEARED＋version 樂觀鎖）／`shared_annotation_replies`（軟刪 deleted_at）／`classroom_share_grants`（classroom+student unique））共 11 端點；回覆路由無 annotation 段（`{SA}/replies/{id}`）；position 移動僅限獨立標記（群組有他人留言→409 GROUP_NOT_MOVABLE）；所有變更經 SSE publish `{type:'shared-annotation', op, pageIndex}`（含 grant）；列表老師可篩 visibility、學生僅 VISIBLE、訪客 403。前端共用元件 `src/components/ui/SharedAnnotationLayer.tsx`（groupId 聚合標記 `aria-label="共享標註，N 則留言"`＋Popover：作者／師生 badge／時間／回覆列／編輯刪除／隱藏顯示；**標記按鈕必須 stopPropagation，否則冒泡到 SlideCanvas 誤開建立標註 Modal**）；教師授課控制頁標註模式＋權限 modal（Switch，`aria-label="共享權限：{名}"`）＋管理 modal（SegmentedControl 全部/可見/隱藏＋清除本頁 ConfirmDialog）＋**SSE 訂閱即時重整共享層**（學生留言即時出現）；學生觀看頁 canShare 寫入、訪客無共享層。（2026-11-23 起）**新進入學生加入課堂時預設自動建立 `ClassroomShareGrant(granted=True)`**（`_resolve_participant` 同事務建立，訪客除外；老師收回後記錄保留 granted=False，重入不恢復）；`Popover.Dropdown` 須 `onClick stopPropagation`（React 合成事件沿元件樹冒泡，portal 不阻斷，否則點留言區誤開「新增共享標註」Modal，學生頁與老師頁共用此元件單點修復）。驗證：`verify_req011.py` 47/47、`req011-check.mjs` 26/26。注意：演示 DB 新增表後須手動 `Base.metadata.create_all`（seed 不會自動補）；以 serve.mjs 之類代理測試 SSE 時，代理必須串流回傳（`arrayBuffer()` 整段緩衝會讓 SSE 永不送達）。
- 課堂簽到（REQ-014，2026-11-20）：後端 `app/api/v1/routes/activities.py`＋`app/schemas/activity.py`，2 新表（`classroom_activities`（type CHECKIN/SINGLE_CHOICE/MULTI_CHOICE/JUDGE/POLL、status DRAFT/OPEN/CLOSED；**部分唯一索引 `uq_activity_open_classroom`** 保證同課堂同時一個 OPEN）／`activity_submissions`（UniqueConstraint(activity_id, student_id) 並發兜底））共 7 端點；本期僅 CHECKIN（其他型 422 ACTIVITY_TYPE_UNSUPPORTED）；建立支援 Idempotency-Key 重放回原活動；重複發布／結束回 200 原狀態（冪等）；重複提交回 alreadySubmitted=true 原記錄；SSE publish `{type:'activity', op, activityId, status, stateVersion}`。前端 `activityApi`（mvp.ts）＋教師授課控制頁右欄「課堂簽到」Paper（發起 ConfirmDialog→create+publish 帶每對話框一組 crypto.randomUUID() 冪等鍵；OPEN 顯示已簽 X/Y＋結束；CLOSED 顯示已簽／未簽名單；3 秒輪詢＋SSE activity 事件重整；**活動列表後端不回保排序，前端須按 createdAt 取最新**）＋學生觀看頁簽到卡（OPEN 顯示「簽到」按鈕／已簽顯示完成時間；訪客無，僅提示不可簽到）。驗證：`verify_req014.py` 45/45、`req014-check.mjs` 25/25。
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
