# Skill 執行時間綫

- 本時間綫建立於 2026-11-16 13:57:34 HKT（UTC+08:00）；新增記錄統一使用香港時間，並採用 `YYYY-MM-DD HH:mm:ss HKT` 格式。
- 執行 `skills/skill.md` 的每個步驟時，必須在開始、完成、暫停及重新開啟時立即更新下表；不得憑記憶補造時間。歷史時間沒有記錄的，填寫「未記錄」。
- 每次需求、拆分或原型修改形成新一輪工作時，應新增一行，不覆蓋上一輪記錄；開始但尚未完成的步驟，完成時間填寫「進行中」。
- 狀態統一使用「未開始」「進行中」「待確認」「已完成」或「已暫停」；使用者確認步驟只能在收到明確確認後標記完成，並記錄確認時間及依據。
- 每次更新產物時，應同時更新對應行次、版本、狀態和產出位置，確保時間綫能反映目前真實進度。

| Skill 步驟 | 輪次／版本 | 開始時間（HKT） | 完成時間（HKT） | 狀態 | 產出或確認依據 |
|---|---|---|---|---|---|
| 1. 輸出需求 | 第 1 輪，V0.1–V0.3 | 未記錄 | 未記錄 | 已完成 | `docs/requirements.md`；已納入第 8.4 及原第 8.5 節回饋 |
| 1. 輸出需求 | 第 2 輪，V0.4 | 2026-11-16 14:12:06 HKT | 2026-11-16 14:17:28 HKT | 待確認 | `docs/requirements.md`；已更新老師建立、回覆共享文字標註及角色區分規則；管理員詳細權限仍待確認 |
| 1. 輸出需求 | 第 3 輪，權限規則 V0.1 | 2026-11-16 14:20:52 HKT | 2026-11-16 14:24:40 HKT | 待確認 | `docs/permissions.md`；已建立角色權限矩陣、資料可見性、操作前置條件及待確認事項，並由 `docs/requirements.md` 引用 |
| 1. 輸出需求 | 第 4 輪，V0.5 | 2026-11-16 15:33:13 HKT | 2026-11-16 15:35:51 HKT | 已完成 | `docs/requirements.md`；已確認 REQ-001 使用 8–64 位及 `zxcvbn` 至少 3 分方案 |
| 1. 輸出需求 | 第 5 輪，V0.6／權限 V0.2 | 2026-11-16 16:31:24 HKT | 2026-11-16 16:42:33 HKT | 待確認 | `docs/requirements.md`、`docs/permissions.md`；已確認 +852、帳號驗證、密碼重設、工作階段、登入限制、登出及角色變更規則 |
| 1. 輸出需求 | 第 6 輪，V0.7 | 2026-11-16 17:04:54 HKT | 2026-11-16 17:10:42 HKT | 待確認 | `docs/requirements.md`；已確認 REQ-002 課程欄位、名稱、課程碼、有效期、成功回饋、列表及取消建立規則，新增 DEC-021 |
| 1. 輸出需求 | 第 7 輪，V0.8 | 2026-11-16 17:23:27 HKT | 2026-11-16 17:26:45 HKT | 已完成 | `docs/requirements.md`；使用者明確採納暫定 Mantine、Pear Deck 參考風格及統一 rem 設計規範，新增 NFR-012～NFR-013、DEC-022～DEC-023 |
| 1. 輸出需求 | 第 8 輪，V0.9／權限 V0.3 | 2026-11-16 17:56:34 HKT | 2026-11-16 18:02:50 HKT | 待確認 | `docs/requirements.md`、`docs/permissions.md`；已納入 REQ-003 十項確認方案，新增 DEC-024 及 PERM-D-005 |
| 1. 輸出需求 | 第 9 輪，V0.10 | 2026-11-16 21:06:00 HKT | 2026-11-16 21:07:26 HKT | 已完成 | `docs/requirements.md`；已按使用者指示調整 REQ-001 老師及學生首頁右上個人入口與帳號選單，新增 DEC-025 |
| 1. 輸出需求 | 第 10 輪，V0.11／權限 V0.4 | 2026-11-16 21:53:50 HKT | 2026-11-16 21:59:47 HKT | 待確認 | `docs/requirements.md`、`docs/permissions.md`；已納入 REQ-004 十項確認方案，新增 DEC-026 及 PERM-D-006，明確容量、取消、重試、檔案校驗、列表及原檔權限 |
| 1. 輸出需求 | 第 11 輪，REQ-005／需求 V0.12→V0.13、權限 V0.5 | 2026-11-16 22:47:29 HKT | 2026-11-16 22:55:08 HKT | 待確認 | `docs/requirements.md`、`docs/permissions.md`；已納入 REQ-005 十項確認方案，新增 DEC-027 及 PERM-D-007；V0.13 其後併入 REQ-001 首頁順序調整 |
| 1. 輸出需求 | 第 12 輪，V0.13 | 2026-11-16 22:49:10 HKT | 2026-11-16 22:53:27 HKT | 已完成 | `docs/requirements.md`；按使用者指示把首頁右上角改為用戶名在左、個人圖標在右，更新 REQ-001 及 DEC-025 |
| 1. 輸出需求 | 第 13 輪，全需求頁面切片清單 V0.2 | 2026-11-17 09:12:55 HKT | 2026-11-17 09:22:18 HKT | 已完成 | `docs/page-slices.md`；按 REQ-001～REQ-018 整理 20 個具名獨立頁面、28 個對話框／抽屜／面板及各自狀態、流程、角色差異與 TASK 對照；已同步 REQ-006／BRK-D-044 的課堂碼確認規則；未變更既有業務規則或工時 |
| 1. 輸出需求 | 第 15 輪，REQ-006／V0.14／權限 V0.5 | 2026-11-17 09:23:02 HKT | 2026-11-17 09:23:02 HKT | 待確認 | `docs/requirements.md`、`docs/permissions.md`；納入 REQ-006 十項確認方案，新增 DEC-028 及 PERM-D-008 |
| 1. 輸出需求 | 第 16 輪，REQ-007～REQ-018／V0.15／權限 V0.6 | 2026-11-17 09:44:33 HKT | 2026-11-17 09:44:33 HKT | 待確認 | `docs/requirements.md`、`docs/permissions.md`；按使用者「所有待確認項以建議方案確認」定稿課堂加入、同步、標註、互動、摘要、保留／匯出／刪除規則，新增 DEC-029～DEC-030 及 PERM-D-009～PERM-D-011 |
| 1. 輸出需求 | 第 17 輪，6 天 MVP 優先級 V0.1 | 2026-11-17 10:16:05 HKT | 2026-11-17 10:16:05 HKT | 待確認 | `docs/mvp-priority.md`；依使用者 6 天 MVP 要求劃分 P0／P1／P2，暫以標簽為 PPT 個人標註，並標示完整 P0 約 163.5 小時超出 144 小時上限，需再做 MVP-S 瘦身 |
| 1. 輸出需求 | 第 18 輪，開發技術棧方案 V0.1 | 2026-11-17 15:04:07 HKT | 2026-11-17 15:07:55 HKT | 待確認 | `docs/tech-stack.md`；建議 React／Mantine、NestJS／Fastify、PostgreSQL／Prisma、Redis／BullMQ、Socket.IO、香港私有 S3、隔離 LibreOffice／Sharp worker 及 Docker Compose；含 MVP／完整版邊界、安全、部署、品質工具與 7 項待確認風險；未建立應用程式或測試用例 |
| 1. 輸出需求 | 第 19 輪，Python 後端決策／需求 V0.16／技術棧 V0.2 | 2026-11-17 15:23:29 HKT | 2026-11-17 15:30:46 HKT | 已完成 | 使用者明確確認「改用python」；`docs/tech-stack.md` 已改為 FastAPI／SQLAlchemy／Alembic／Celery／python-socketio／python-pptx；`docs/requirements.md` 新增 NFR-014、CON-007、DEC-031，並將 zxcvbn 改為跨語言共同測試向量驗收；其餘供應商風險保留 |
| 1. 輸出需求 | 第 20 輪，前端 Vite 與 lint／需求 V0.17／技術棧 V0.3 | 2026-11-17 15:56:44 HKT | 2026-11-17 16:02:20 HKT | 已完成 | 使用者要求「前端加入vite 和 lint」；`docs/tech-stack.md` 與 `docs/requirements.md` 已明確 Vite 建置、TypeScript strict、ESLint／Prettier／Stylelint、品質腳本與 CI 驗收，新增 NFR-015、CON-008、DEC-032；Python 後端不變 |
| 補充設計 | MVP API 設計 V0.1 | 2026-11-17 16:16:36 HKT | 2026-11-17 16:16:36 HKT | 待確認 | `docs/api-design.md`；按 P0 MVP 及 FastAPI 技術棧設計 REST／JSON API，涵蓋帳號、課程、私有 PPT 上傳／轉換／預覽及個人文字標註，並定義 Cookie／CSRF、冪等、錯誤格式、分頁、權限與最小資料約束；未建立應用程式或測試用例 |
| 補充檢查 | 全部 docs 一致性審查 | 2026-11-17 16:27:27 HKT | 2026-11-17 17:02:18 HKT | 已完成 | 已完成 8 份文件審查及一致性修正；同步版本與基準，修正驗證碼、TXT、師生課件回應、註冊內容綁定、標註 PATCH、NFR 追蹤、依賴及切片邊界；該輪驗證為 332 項、515 小時；MVP 合法標註入口已於後續確認，Penpot 外部交付仍待同步 |
| 補充設計 | MVP 建議方案確認與同步 | 2026-11-17 17:09:38 HKT | 2026-11-17 17:28:52 HKT | 已完成 | 使用者以「按建議方案吧」確認非課堂個人標註例外、REQ-003 暫緩及預建演示資料、即時課堂維持 P1、只做個人標註、不做管理員後台；已同步 requirements V0.19、permissions V0.8、mvp-priority V0.3、api-design V0.3、breakdown V0.23、page-slices V0.5、tech-stack V0.4；全量為 333 項、517 小時；Penpot 外部連結及外部看板工時仍待同步 |
| 補充檢查 | 全 docs 需求覆蓋與 MVP 一致性複查 | 2026-11-17 17:30:13 HKT | 2026-11-17 17:30:13 HKT | 已完成 | 依使用者「檢查所有docs，確保符合用戶所有需求」完成：requirements V0.19、permissions V0.8、breakdown V0.23、tech-stack V0.4、mvp-priority V0.3、api-design V0.3、page-slices V0.5、timeline；對齊非課堂個人標註例外、REQ-003 暫緩、P0 169.5 小時、333 項／517 小時及跨文件引用；Penpot 外部連結及外部看板工時仍待同步，未建立測試 |
| 補充設計 | 登入、工作階段與權限方案 V0.1 | 2026-11-17 22:10:16 HKT | 2026-11-17 22:10:16 HKT | 待確認 | `docs/auth-permission-design.md`；依使用者前後端并行開發及優先定義 API 的要求，記錄註冊 challenge、登入、Session、CSRF、FastAPI 角色／資源 dependency、MVP 權限落地及 OpenAPI 型別生成流程；未建立應用程式或測試用例 |
| 補充設計 | 管理員分類權限方案 V0.2 | 2026-11-17 22:26:26 HKT | 2026-11-17 22:26:26 HKT | 已完成 | 使用者確認 PERM-Q-003／004／005／006／008 建議方案；已同步 requirements V0.20、permissions V0.9、auth-permission-design V0.2 及跨文件基準；管理員內容查看預設關閉，個人標註不可見，MVP 不建管理介面但服務端仍須強制執行權限 |
| 補充設計 | 完整 API 契約 V0.4 | 2026-11-17 22:39:23 HKT | 2026-11-17 22:39:23 HKT | 已完成 | `docs/api-design.md`；由 MVP P0 擴充至 REQ-001～REQ-018 的 REST／Socket.IO 契約，補齊即時課堂、共享標註、簽到答題、摘要匯出刪除、管理員 scopes、錯誤碼及 OpenAPI 前後端生成；P1／P2 不納入 6 天 MVP，不建立測試 |
| 補充設計 | API Schema V0.1 | 2026-11-17 23:02:23 HKT | 2026-11-17 23:02:23 HKT | 已完成 | `docs/api-schemas.md`；補齊 P0 與完整產品的 request／response、共用 model、認證、權限、標註、課堂、活動、匯出、管理員 audit、Socket.IO payload、錯誤 envelope 及 Endpoint↔schema 對應；`docs/api-design.md` V0.4 已引用為單一欄位基準，供 FastAPI／OpenAPI 及前端型別生成使用 |
| 補充實作 | 前後端專案初始化 | 2026-11-18 09:33:02 HKT | 2026-11-18 10:01:26 HKT | 已完成 | 依使用者「開始初始化項目，分前後端」建立 `apps/web`（React／Mantine／TypeScript／Vite）、`apps/api`（Python／FastAPI）及 `packages/contracts`；完成健康檢查頁與 API、Vite proxy、OpenAPI JSON／TypeScript 生成、ESLint／Prettier／Stylelint／Ruff／mypy、啟動文件與實際前後端連線驗證；尚未實作業務功能，未建立測試用例 |
| 補充實作 | MVP 後端 P0 API | 2026-11-18 10:30:00 HKT | 2026-11-18 11:39:05 HKT | 已完成 | 依使用者「開始mvp的後端開發」完成 `apps/api`：SQLAlchemy async＋SQLite（可切 PostgreSQL）、註冊驗證碼 challenge（payload_json 綁定完整註冊內容、outbox 檔案發送）、登入鎖定、Session＋CSRF、課程 CRUD／課程課程碼加入、課件上傳（本機儲存適配預簽 PUT）／完成（sha256 校驗）／asyncio 背景轉換（Pillow demo 轉換器輸出 WebP 1920／320）／頁面預覽／失敗重試、學生個人標註 CRUD（expectedVersion 樂觀鎖、本人隔離、老師不可讀）、統一錯誤 envelope、Idempotency-Key；Ruff／mypy strict 通過，端到端 smoke（註冊→建課→上傳→轉換→預覽→標註）全數通過；OpenAPI 已重新匯出並生成前端型別；未建立測試用例 |
| 2. 需求拆分與小時估算 | 第 12 輪，REQ-001／V0.12 | 2026-11-16 21:07:26 HKT | 2026-11-16 21:09:03 HKT | 已完成 | `docs/breakdown.md`；新增 TASK-080 首頁個人圖標、帳號選單及個人中心入口，調整 TASK-030 登出入口；REQ-001 為 45 小時，累計 118.5 小時 |
| 2. 需求拆分與小時估算 | 第 1 輪，REQ-001／V0.1 | 2026-11-16 14:33:11 HKT | 2026-11-16 14:36:23 HKT | 待確認 | `docs/breakdown.md`；REQ-001 已拆分為 18 項互動任務，估算 64 小時；其餘 REQ 尚未拆分 |
| 2. 需求拆分與小時估算 | 第 2 輪，REQ-001／V0.2 | 2026-11-16 15:33:13 HKT | 2026-11-16 15:35:51 HKT | 待確認 | `docs/breakdown.md`；TASK-008 調整為 8 小時，REQ-001 總計 68 小時 |
| 2. 需求拆分與小時估算 | 第 3 輪，REQ-001／V0.3 | 2026-11-16 16:19:07 HKT | 2026-11-16 16:22:21 HKT | 待確認 | `docs/breakdown.md`；按 AI 開發代理自身執行基準重估 18 項任務，REQ-001 總計 21.5 小時 |
| 2. 需求拆分與小時估算 | 第 4 輪，REQ-001／V0.4 | 2026-11-16 16:31:24 HKT | 2026-11-16 16:42:33 HKT | 待確認 | `docs/breakdown.md`；納入已確認帳號安全方案，31 項任務，REQ-001 總計 43.5 小時 |
| 2. 需求拆分與小時估算 | 第 5 輪，REQ-001／V0.5 | 2026-11-16 16:48:33 HKT | 2026-11-16 16:49:11 HKT | 已完成 | `docs/breakdown.md`；7 個任務表的分隔行已由 7 欄修正為 6 欄，表格欄數檢查通過；不變更需求或工時 |
| 2. 需求拆分與小時估算 | 第 6 輪，REQ-002／V0.6 | 2026-11-16 16:52:44 HKT | 2026-11-16 16:59:07 HKT | 待確認 | `docs/breakdown.md`；保留 REQ-001，REQ-002 拆分為 TASK-032～TASK-044，共 13 項、16 小時；已拆分累計 59.5 小時 |
| 2. 需求拆分與小時估算 | 第 7 輪，REQ-002／V0.7 | 2026-11-16 17:04:54 HKT | 2026-11-16 17:10:42 HKT | 待確認 | `docs/breakdown.md`；已納入 REQ-002 確認規則；REQ-002 共 13 項、16.5 小時，已拆分累計 60 小時 |
| 2. 需求拆分與小時估算 | 第 8 輪，NFR-012～NFR-013／V0.8 | 2026-11-16 17:23:27 HKT | 2026-11-16 17:26:45 HKT | 已完成 | `docs/breakdown.md`；新增 TASK-045～TASK-046，共 4.5 小時；已拆分累計 64.5 小時，對應已採納的 Mantine 及 rem 規範 |
| 2. 需求拆分與小時估算 | 第 9 輪，REQ-003／V0.9 | 2026-11-16 17:27:18 HKT | 2026-11-16 17:32:34 HKT | 待確認 | `docs/breakdown.md`；REQ-003 拆分為 TASK-047～TASK-060，共 14 項、19.5 小時；已拆分累計 60 項、84 小時；課程碼輸入正規化及不可加入狀態列為待確認假設 |
| 2. 需求拆分與小時估算 | 第 10 輪，REQ-003／V0.10 | 2026-11-16 17:56:34 HKT | 2026-11-16 18:02:50 HKT | 待確認 | `docs/breakdown.md`；REQ-003 共 15 項、21.5 小時，新增 TASK-061 無效碼限流；已拆分累計 61 項、86 小時 |
| 2. 需求拆分與小時估算 | 第 11 輪，REQ-004／V0.11 | 2026-11-16 21:00:46 HKT | 2026-11-16 21:04:33 HKT | 待確認 | `docs/breakdown.md`；REQ-004 拆分為 TASK-062～TASK-079，共 18 項、31 小時；已拆分累計 79 項、117 小時；100 MB 計量、單檔操作、重複檔案及列表規則列為待確認假設 |
| 2. 需求拆分與小時估算 | 第 13 輪，REQ-004／V0.13 | 2026-11-16 21:53:50 HKT | 2026-11-16 21:59:47 HKT | 待確認 | `docs/breakdown.md`；已納入 REQ-004 十項確認方案並保留 TASK-001～080；REQ-004 共 18 項、31.5 小時，已拆分累計 80 項、119 小時 |
| 2. 需求拆分與小時估算 | 第 14 輪，REQ-005／V0.14 | 2026-11-16 22:09:37 HKT | 2026-11-16 22:13:29 HKT | 待確認 | `docs/breakdown.md`；REQ-005 拆分為 TASK-081～TASK-102，共 22 項、40.5 小時；已拆分累計 102 項、159.5 小時；狀態更新、預覽交互、輸出規格及服務依賴列為估算假設 |
| 2. 需求拆分與小時估算 | 第 15 輪，REQ-006～REQ-018／V0.15 | 2026-11-16 22:28:17 HKT | 2026-11-16 22:38:45 HKT | 待確認 | `docs/breakdown.md`；完成全部剩餘需求首輪拆分，新增 TASK-103～330，共 228 項、351 小時；全功能累計 330 項、510.5 小時；REQ-005～REQ-018 估算假設仍待確認 |
| 2. 需求拆分與小時估算 | 第 16 輪，REQ-005／V0.16→V0.17 | 2026-11-16 22:47:29 HKT | 2026-11-16 22:55:08 HKT | 待確認 | `docs/breakdown.md`；納入 REQ-005 十項確認方案，保留 TASK-001～330；REQ-005 共 22 項、41 小時，全功能累計 330 項、511 小時；V0.17 其後併入 REQ-001 首頁順序調整 |
| 2. 需求拆分與小時估算 | 第 17 輪，REQ-001／V0.17 | 2026-11-16 22:49:10 HKT | 2026-11-16 22:53:27 HKT | 已完成 | `docs/breakdown.md`；更新 TASK-080 及 BRK-D-023 的首頁右上角順序為用戶名在左、圖標在右，不變更工時 |
| 2. 需求拆分與小時估算 | 第 18 輪，REQ-006／V0.18 | 2026-11-17 09:22:15 HKT | 2026-11-17 09:22:15 HKT | 待確認 | `docs/breakdown.md`；納入 REQ-006 十項確認方案，TASK-103～114 維持 12 項、20.5 小時，全功能累計 330 項、511 小時 |
| 2. 需求拆分與小時估算 | 第 19 輪，REQ-007～REQ-018／V0.19 | 2026-11-17 09:44:33 HKT | 2026-11-17 09:44:33 HKT | 待確認 | `docs/breakdown.md`、`docs/page-slices.md`；按建議方案定稿全部功能業務假設，TASK-001～330 維持 330 項、511 小時；BRK-A-015～A-024 轉為 BRK-D-046～D-055，頁面切片同步至 V0.2 |
| 2. 需求拆分與小時估算 | 第 20 輪，Python 後端技術約束／V0.20 | 2026-11-17 15:23:29 HKT | 2026-11-17 15:30:46 HKT | 已完成 | `docs/breakdown.md`；同步 NFR-014、TASK-008、BRK-D-001 及新增 BRK-D-056；Python／OpenAPI／JSON Schema 工作融入既有任務，TASK-001～330 及 511 小時不變 |
| 2. 需求拆分與小時估算 | 第 21 輪，前端 Vite 與 lint／V0.21 | 2026-11-17 15:56:44 HKT | 2026-11-17 16:02:20 HKT | 已完成 | `docs/breakdown.md`；新增 TASK-331 Vite 建置及 TASK-332 靜態品質檢查，各 2 小時，新增 BRK-D-057；全量 332 項、515 小時，既有業務任務不重排 |
| 3. 製作可交互原型 | 第 1 輪，REQ-001 | 2026-11-16 17:30:08 HKT | 2026-11-16 17:43:22 HKT | 已完成 | Penpot `my-deck` 檔案 `Page 1`；已建立 10 個帳號相關畫面、15 個點擊跳轉及 2 條流程；檔案驗證無錯誤、文字無溢出 |
| 3. 製作可交互原型 | 第 2 輪，REQ-001 | 2026-11-16 17:45:59 HKT | 2026-11-16 17:49:10 HKT | 已完成 | Penpot `my-deck`／`Page 1`；8 個帳號畫面已移除可見需求 ID，註冊名稱提示改為標籤同列，並修正註冊卡片底部留白；驗證無錯誤、文字無溢出 |
| 3. 製作可交互原型 | 第 3 輪，REQ-001 | 2026-11-16 20:58:14 HKT | 2026-11-16 21:00:10 HKT | 已完成 | Penpot `my-deck`／`Page 1`；已建立 18 個 SVG 圖標，取代品牌、老師、學生、安全、新增及空狀態的文字佔位圖標；驗證無錯誤，15 個交互保留 |
| 3. 製作可交互原型 | 第 4 輪，REQ-001 | 2026-11-16 21:13:45 HKT | 2026-11-16 22:56:59 HKT | 已完成 | Penpot `my-deck`／`Page 1`；首頁右上改為用戶名在左、個人圖標在右，加入帳號彈出選單、個人中心頁及 4 個透明點擊層；檔案驗證無錯誤，33 個交互正常 |
| 3. 製作可交互原型 | 第 5 輪，REQ-001～REQ-018 全頁面切片 | 2026-11-17 09:36:25 HKT | 2026-11-17 11:02:06 HKT | 已完成 | Penpot `my-deck`／`Page 1`；PG-001～020、OL-001～028 全部完成，共 51 個畫板、14 條具名流程、117 個交互；統一 6 位課堂碼及課程示例，無可見 ID、越界、重複／失效交互或檔案驗證錯誤；`docs/page-slices.md` 更新至 V0.3 |
| 3. 製作可交互原型 | 第 6 輪，ERD 實體關係圖 | 2026-11-17 11:18:29 HKT | 2026-11-17 12:03:52 HKT | 已完成 | Penpot `my-deck`／`ERD`；完成 19 實體、14 條正交關係線、FK 對照及保存規則，檔案驗證無錯誤；使用者其後要求進一步置中並把備注集中到右側 |
| 3. 製作可交互原型 | 第 7 輪，ERD 置中及右側備注美化 | 2026-11-17 12:03:52 HKT | 2026-11-17 12:16:15 HKT | 已完成 | Penpot `my-deck`／`ERD`；已按使用者回饋完成 V3 並正式替換舊版：19 實體集中排列、備注集中右側、14 條水平／垂直直線，僅回覆 self-FK 使用直角虛線；唯一主畫板 `dcba8e18-05dc-80ca-8008-f52fb50f97df`，匯出目視檢查通過，無交叉、越界、NaN 或檔案驗證錯誤 |
| 3. 製作可交互原型 | 第 8 輪，ERD 方向箭頭與基數標記 | 2026-11-17 12:20:43 HKT | 2026-11-17 12:48:50 HKT | 已完成 | Penpot `my-deck`／`ERD`；14 條 FK 方向箭頭及 1:N 標記、2 個 N:N 關聯實體、1:1／1:N／N:N 圖例已完成；按使用者回饋把突兀的右上白卡改為整合右欄的淡藍水平圖例，下方備注統一移後；匯出目視檢查通過，19 實體及關係未重建，無越界、NaN 或檔案驗證錯誤 |
| 3. 製作可交互原型 | 第 9 輪，6 天 MVP Wireframe | 2026-11-17 13:56:05 HKT | 2026-11-17 14:15:10 HKT | 已完成 | Penpot `my-deck`／`mvp`；建立 3860×2140 單一主畫板 `a2cfafd3-9175-80f1-8008-f54c1e19b8ea`，含 P0 暫定範圍、帳號／老師／學生三條由左至右泳道、15 張低精細度線框卡及 12 個水平方向箭頭，沒有跨泳道長線；未包含即時課堂、共享標註、簽到、答題或匯出；匯出目視檢查通過，無越界、NaN 或檔案驗證錯誤，`all page` 與 `ERD` 未修改 |
| 4. 使用者明確確認原型 | 第 1 輪，REQ-001 | 2026-11-16 17:43:22 HKT | 進行中 | 待確認 | 使用者提出移除需求 ID 及修正間距，尚未確認原型；未確認前不建立測試用例 |
| 4. 使用者明確確認原型 | 第 2 輪，REQ-001 | 2026-11-16 17:49:10 HKT | 進行中 | 待確認 | 等待使用者確認移除需求 ID 及間距修正後的 Penpot 原型 |
| 4. 使用者明確確認原型 | 第 3 輪，REQ-001 | 2026-11-16 21:00:10 HKT | 進行中 | 待確認 | 等待使用者確認 SVG 圖標更新後的 Penpot 原型 |
| 4. 使用者明確確認原型 | 第 4 輪，REQ-001 | 2026-11-16 22:56:59 HKT | 進行中 | 待確認 | 等待使用者確認帳號選單、個人中心及右上角用戶名／圖標順序更新後的 Penpot 原型 |
| 4. 使用者明確確認原型 | 第 5 輪，REQ-001～REQ-018 全頁面切片 | 2026-11-17 11:02:06 HKT | 進行中 | 待確認 | 等待使用者確認 Penpot `my-deck`／`Page 1` 的 48 個具名切片、14 條流程及主要交互；未確認前不建立測試用例 |
| 4. 使用者明確確認原型 | 第 6 輪，ERD 置中及右側備注版 | 2026-11-17 12:16:15 HKT | 進行中 | 待確認 | 等待使用者確認 Penpot `my-deck`／`ERD` 的置中實體、右側備注及直線關係版面；ERD 調整不代替 UI 原型確認，未確認 UI 原型前不建立測試用例 |
| 4. 使用者明確確認原型 | 第 7 輪，ERD 方向箭頭、基數及整合圖例版 | 2026-11-17 12:48:50 HKT | 進行中 | 待確認 | 等待使用者確認 Penpot `my-deck`／`ERD` 的方向箭頭、1:N／N:N 標記及右欄整合圖例；ERD 調整不代替 UI 原型確認，未確認 UI 原型前不建立測試用例 |
| 4. 使用者明確確認原型 | 第 8 輪，6 天 MVP Wireframe | 2026-11-17 14:15:10 HKT | 2026-11-18 10:17:02 HKT | 已完成 | 使用者於 2026-11-18 10:17:02 HKT 明確回覆「確認原型通過」；以 Penpot `my-deck`／`mvp` 及 `docs/mvp-priority.md` V0.3 的 MVP 範圍作為測試設計基準 |
| 5. 輸出測試用例 | 第 1 輪，MVP V0.2 | 2026-11-18 10:17:02 HKT | 2026-11-18 11:05:15 HKT | 已完成 | 依 `docs/requirements.md` V0.20、`docs/breakdown.md` V0.23、`docs/permissions.md` V0.9、`docs/mvp-priority.md` V0.3 及已確認原型建立 `docs/test-cases.md`；共 TC-001～TC-110，覆蓋 108 項 MVP 任務及 2 項跨模組 NFR 用例；已修正 TC-021 錯字，並將 TASK-161～TASK-178 驗收語境對齊本人課程成功課件預覽的非課堂例外；驗證通過 |
| 補充實作 | MVP 前端首輪 | 未記錄 | 2026-11-18 11:02:56 HKT | 已完成 | 依已確認 MVP 範圍及 Penpot 切片建立 `apps/web/src/types/domain.d.ts`、mock／API 預留層、Auth context、角色路由、登入註冊、老師／學生課程頁、課件預覽及個人標註互動；`lint`、`lint:style`、`typecheck`、`format:check`、`build` 通過，業務 API 尚未對接 |
| 補充實作 | MVP 前端按 all page 切片重寫 | 未記錄 | 2026-11-18 12:55:27 HKT | 已完成 | 依 Penpot「all page」PG-001～014、OL-001～011 切片重寫 `apps/web`；先建 `theme.ts`/`index.css` 與 14 個 `components/ui/` 共用元件再重寫 16 個頁面；mock 層補密碼重設、加入課程、上傳回報與 3 筆課件狀態；typecheck/lint/lint:style/format:check/build 通過 |
| 補充實作 | 註冊頁手機區碼改為不可編輯選擇框 | 未記錄 | 2026-11-18 14:04:20 HKT | 已完成 | 依使用者要求：PG-002 tab 由「+852 手機號碼」改為「手機號碼」，+852 移入手機號碼輸入框左側成為不可編輯地區選擇框（預留後續可選不同地區）；前端 `RegisterPage.tsx` 新增 RegionCodeSelect（Mantine Select disabled）並通過 typecheck/lint/lint:style/format:check；Penpot PG-002 board 已同步（tab 文字、輸入框 +852＋▾＋分隔線＋9123 4567 右移）並導出 PNG 核對一致 |
| 補充實作 | 認證頁按切片修正左欄圖形與文案 | 未記錄 | 2026-11-18 14:26:23 HKT | 已完成 | 依 Penpot PG-001～006 切片修正：左欄裝飾卡由 visibleFrom=lg 改 md 並改 clamp 寬度（修正「左邊的圖都沒有」）、kicker 統一「帳號與安全」、每頁專屬標題副標、Classroom preview 裝飾卡精確化；右卡對齊切片（登入頁移除演示按鈕、註冊頁去步驟 pill、頻道改分段控制、顯示名稱右側提示、各頁文案與置中連結）；typecheck/lint/lint:style/format:check/build 通過 |
| 補充實作 | 註冊按鈕改「註冊」並同步 Penpot PG-002 | 未記錄 | 2026-11-18 14:50:11 HKT | 已完成 | 依用戶指示：PG-002 主按鈕文案由「發送驗證碼」改為「註冊」（前端 RegisterPage.tsx 及 Penpot PG-002 按鈕文字同步置中完成）；「發送驗證碼」按鈕未來應放於手機號/郵箱輸入框右側，本版本不實作；typecheck/lint/lint:style/format:check/build 全過 |
| 補充實作 | 前端真實 API 對接（MVP P0 全部） | 未記錄 | 2026-11-18 16:03:43 HKT | 已完成 | 依用戶決策：註冊改免驗證碼（後端新增 POST /api/v1/auth/register/direct，不簽 session，註冊後回登入頁）、忘記密碼保留並對接（verification-codes 防枚舉＋password-reset 撤銷全部 session）、一次對接全部 P0。後端：register/direct、password-reset 兩端點、sessions.revoke_all_user_sessions、CoursewareSummary 補 byteSize/createdAt、CourseDetail 補 latestAttempt/attempts/studentCount；修復 create_task 未保留強引用致轉換任務被 GC 回收的 bug（模組級集合＋add_done_callback）。前端：新增 api/http.ts（CSRF、401/403、統一錯誤），mvp.ts 改真實 adapter；移除 mock 與 /register/verify；上傳三步傳三步＋轉換輪詢＋重試；標註 position 釘選＋樂觀鎖 409；SlideCanvas 顯示 WebP 頁圖。冒煙測試全過：註冊（含冪等重放/409 重複）、登入、加入課程、上傳→自動轉換→頁面→媒體、標註 CRUD（含 409 版本衝突）、忘記密碼全流程（outbox 取碼→重設→舊 session 401→新密碼登入→還原演示密碼）。openapi.json 已重導、generate:api 已跑；typecheck/lint/lint:style/format:check/build 全過；AGENTS.md、apps/web/README.md 已更新 |
| 補充實作 | GitHub Project 看板同步 MVP 完成狀態 | 未記錄 | 2026-11-18 20:58:54 HKT | 已完成 | 依使用者「檢查mvp完成情況，更新github project 狀態」：盤點倉庫後將 107 張已交付 P0 卡片由 Todo 轉 Done（看板現為 Done 109／Todo 13／非 MVP 210；Done 工時 166.86 小時含設計交付 2.86）；保留 Todo 的 13 張（21 小時）：TASK-020～025 註冊驗證碼 UI（後端已交付、前端走 register/direct 簡化）、TASK-044 課程碼碰撞重試、TASK-055 課程狀態不適用、TASK-061 IP 頻率限制、TASK-090 轉換逾時標記、TASK-172～174 標註移動位置；看板 README 新增「MVP 完成情況」段落說明保留原因與 demo 轉換器限制 |
| 補充實作 | 註冊驗證碼移至後續優化 | 2026-11-18 21:05:00 HKT | 2026-11-18 21:35:00 HKT | 已完成 | 依使用者「將驗證碼部分改到後續優化内容，不再這次開發」，經確認範圍為僅註冊驗證碼（忘記密碼驗證碼維持本期交付）、後端已實作端點保留不動：① 看板 TASK-020～025（9.5 小時）由 Todo 轉「非 MVP」（看板現為 Done 109／Todo 7／非 MVP 216），並修復看板 README 僅存路徑字串的問題、同步「MVP 完成情況」段落（Todo 7 張 11.5 小時）；② 文件同步：requirements V0.20→V0.21（REQ-001 流程／業務規則／異常流程標註、新增 DEC-035）、breakdown V0.23→V0.24（TASK-020～025 標後續優化、BRK-D-002／004 更新）、test-cases V0.2→V0.3（TC-020～025 改列 P1 後續優化本期不執行）、mvp-priority V0.3→V0.4（新增後續優化列）、page-slices V0.5→V0.6（PG-003 標後續優化、PG-002 備註）、api-design V0.4→V0.5（3.2／3.3 節標後續優化、補 register/direct 說明）；③ AGENTS.md 同步 |
| 補充實作 | 忘記密碼改舊密碼驗證（不發驗證碼） | 2026-11-18 21:40:00 HKT | 2026-11-18 22:45:00 HKT | 已完成 | 依使用者「忘記密碼暫時只用舊密碼驗證，不用驗證碼」，經確認：舊密碼正確即直接重設（真的忘記舊密碼者找管理員）、驗證碼重設端點保留不動、失敗套用登入鎖定（連續 5 次鎖 15 分鐘）。① 後端新增 POST /api/v1/auth/password-reset/direct（204，撤銷全部 session，帳號不存在與錯舊密碼一致 401 防枚舉，失敗寫入 LoginAttempt）；ruff／mypy 全綠，openapi.json 已重導。② 前端 ForgotPasswordPage 改單頁表單（帳號＋舊密碼＋新密碼＋確認），刪除 ResetVerifyPage／ResetPasswordPage 及路由，authApi 新增 resetPasswordDirect（驗證碼三方法保留標後續優化）；lint／typecheck／format／build 全過。③ 端到端 curl 全過：錯舊密碼 401、帳號不存在一致 401、弱密碼 400、成功 204→舊 session 401→新密碼可登入、連續 5 次失敗→429 LOGIN_LOCKED；演示帳號密碼已還原。④ 文件同步：requirements V0.22（DEC-036）、breakdown V0.25（TASK-026～028 改寫）、test-cases V0.4（TC-026～028 改寫）、api-design V0.6（新增 3.4）、api-schemas V0.3、permissions V0.11、auth-permission-design V0.4、tech-stack V0.6、mvp-priority V0.5、page-slices V0.7（PG-004 單頁、PG-005／006 後續優化）、AGENTS.md；看板 TASK-026～028 標題同步 |

| 補充實作 | 主頁面滾動條修復（版式規則確立） | 2026-11-19 08:30:00 HKT（約） | 2026-11-19 09:30:00 HKT（約） | 已完成 | 依使用者「找回密碼頁面尺寸有問題，主頁面有滾動條。後續所有主頁面不允許有滾動條，只能在内容區滾動」：① 根因為改版後忘記密碼單頁表單內容總高超過視窗，AuthLayout／AppLayout 根節點僅設 mih=100vh 致視窗出現滾動條；② 新增 `.md-viewport`（100vh/100dvh＋overflow hidden）套於 AuthLayout 與 AppLayout 根節點，認證頁右欄改為捲動區（白卡 margin:auto 置中、超高區內捲動不裁頂），內頁頂欄固定 96px＋內容區 flex:1 overflow-y:auto；③ 覆蓋 PG-001/002/004 及全部內頁；④ lint／lint:style／typecheck／format:check／build 全過（當時無瀏覽器，依 CSS 結構推論）；⑤ AGENTS.md 新增版式規則條目。commit cf67d04 已推送 develop |
| 補充實作 | 瀏覽器自動化驗證滾動條修復（Playwright） | 2026-11-19 09:30:00 HKT（約） | 2026-11-19 10:50:00 HKT（約） | 已完成 | 依使用者「有沒有供你驗證的瀏覽器plugin，幫我安裝」，經確認採臨時安裝（不動倉庫）：① 安裝 Playwright＋Chromium（npm 項目落於 /root/pw-verify、瀏覽器二進制 /root/.cache/ms-playwright，避開會被清空的 /tmp）；② 踩坑：pkill -f 會匹配自身命令列自殺、長駐服務須用 background 參數、Vite dev 下 Chromium 不穩，改以生產 build＋自建靜態伺服器（serve.mjs，4173 端口代理 /api）＋每檢查全新 context＋攔截外網字體請求後 100% 穩定；③ verify.mjs 27 項檢查全過：公開頁（login/register/forgot）×4 視窗＋老師 3 頁×3 視窗＋學生 3 頁×2 視窗（含 1280x600 短視窗與 390x844 手機），全部 scrollHeight==clientHeight，視窗無垂直滾動條；hcheck.mjs 390px 水平檢查 7 頁全過（scrollWidth==clientWidth）；截圖抽查 forgot-1280x600 內容區內滾動不裁頂、teacher-preview 頂欄固定；④ 驗證用生產 build（dist）＋真實後端＋seed 演示資料，服務已停止 |

| 補充實作 | 統一錯誤提示（頂部 Alert）＋登入頁分頁＋錯誤收集器 | 2026-11-19 10:50:00 HKT（約） | 2026-11-19 12:10:00 HKT（約） | 已完成 | 依使用者三項需求：「錯誤提示統一Alert頂部，展示5秒（後定為10秒），可主動點最右邊x關閉」、「登錄頁分手機登錄和郵箱登錄，跟注冊頁一樣（完全鏡像註冊頁）」、「然後加上錯誤收集器，只在開發狀態輸出」。① 先在 Penpot 更新 PG-001 登入畫板（分段控制＋手機欄克隆自 PG-002）並新建 Library 元件「Alert / Error（置頂）」（#FEF2F2 底／#FECACA 邊／#B42318 文，480×56 radius 12，紅圓!＋訊息＋×），經 MCP 直連繞道（opencode 代理壞）完成，導出 PNG 目視後獲使用者確認通過；成功提示（註冊成功／密碼已重設綠字）確認保留表單內。② 前端實作：新增 utils/error-collector.ts（僅 import.meta.env.DEV 收集＋console.error＋window.__MD_ERRORS__ 200 筆，生產不收集）、utils/phone.ts（REGION_CODE＋normalizeHongKongPhone）、ui/RegionCodeSelect.tsx、ui/ChannelTabs.tsx（分段控制共用件）、ui/ErrorAlertProvider.tsx＋ui/error-alert-context.ts（單槽頂部 Alert：fixed top24 置中 z1000，10s 自動關，× 手動關，showError 時收集）；LoginPage 完全鏡像註冊頁分段（手機預設＋852 前綴框／電郵欄，手機格式錯即 Alert）；全站 10 頁 inline 紅字錯誤移除改走 showError（含 query 載入失敗與 mutation onError；not-found 頁面觸發 Alert 後 return null 僅剩頂欄，經使用者確認）；保留「轉換失敗可重試」狀態列與成功綠字。③ 驗證：lint／lint:style／typecheck／format:check／build 全過（曾修 react-refresh 規則拆分 context 檔）；Playwright alert-check.mjs 11 項全過（tab 切換、預設、前綴、Alert 位置 top24 置中、× 關閉、10s 消失、手機／電郵登入）；verify.mjs 滾動回歸 27/27；DEV 收集器實測收集 alert／api 兩類（api 附 status/code/requestId）並 console.error 輸出；測試工具 serve.mjs 修 Set-Cookie 合併 bug（getSetCookie 逐條回傳）。 |

| 補充實作 | 忘記密碼頁統一手機輸入與版面收緊 | 2026-11-19 13:05:00 HKT（約） | 2026-11-19 13:25:00 HKT（約） | 已完成 | 依使用者指示：「所有需要手機號的地方都按注冊的來，還有重設密碼的title和icon可以水平，盡量不要讓頁面留空太多導致出現滾動條」。① ForgotPasswordPage 帳號欄改與註冊／登入一致：ChannelTabs「手機號碼／電子郵件」分段（手機預設）＋RegionCodeSelect +852 前綴框＋normalizeHongKongPhone 正規化，格式錯走頂部 Alert「請輸入 8 位數手機號碼。」；全站三處手機輸入（PG-001 登入、PG-002 註冊、PG-004 忘記密碼）統一共用元件。② 標題與鑰匙 IconBox 改水平排列（Group，icon 56→48、標題 fz 32→28），外層 Stack gap lg→md、表單 gap md→sm、說明 mt sm→xs，右欄內容區 900px 視窗無內部滾動。③ 驗證：lint／typecheck／format:check／build 全過；Playwright forgot-check.mjs 10 項全過（分頁、預設、前綴、標題圖示水平、視窗無滾動、右欄無內部滾動、手機格式 Alert、390x844、完整重設流程成功回登入頁含綠字；測試後以 curl＋CSRF 還原測試帳號密碼 204）；verify.mjs 滾動回歸 27/27 全過。除錯發現後端密碼強度校驗會拒絕弱密碼（VALIDATION_ERROR 附 fields.newPassword），流程與 Alert 顯示正常。 |

---

## 附錄：實際工時記錄（2026-11-19 回填）

- 記錄時間：2026-11-19 10:10:28 HKT；依據使用者指示「更新之前 project 更新過的狀態，記錄實際工時」，經確認記錄位置為看板＋本時間綫，數字依 timeline 時間推算（方案 A，輪次級推算，commit 時間錨定）。
- 看板落地：GitHub Project 1（my-deck checkin）新增 NUMBER 欄位「實際工時」（PVTF_lAHOAw-5Gc4Br8TPzhqgE5I），109 張 Done 卡片全部回填並驗證通過（2.4h×104、1.1h×3、2.86h×2）。同輪卡片同值，看板欄位加總僅作參考，不代表實際總工時；TASK-331/332 已被移至「非 MVP」欄，未回填。

### 輪次工時推算表（11-18 開發日）

| 輪次 | 內容 | 推算依據 | 推算工時 |
|---|---|---|---:|
| 輪38 | 前後端初始化 | timeline 09:33–10:01 | 0.5h |
| 輪39 | 後端 P0 API | timeline 10:30–11:39 | 1.2h |
| 輪79 | MVP 前端首輪 | 上輪完成 10:01→11:02，與後端並行 | 1.0h |
| 輪80 | all page 切片重寫 | 11:02→12:55 | 1.9h |
| 輪81 | 手機區碼選擇框 | 12:55→14:04 | 1.2h |
| 輪82 | 認證頁切片修正 | 14:04→14:26 | 0.4h |
| 輪83 | 註冊按鈕文案 | 14:26→14:50 | 0.4h |
| 輪84 | 前端真實 API 對接 | 14:50→16:03 | 1.2h |
| 輪85 | 看板同步 | 牆鐘 16:03→20:58 含約 4h 空檔，**無法精確推算** | 無法推算 |
| 輪86 | 註冊驗證碼移至後續優化 | timeline 21:05–21:35 | 0.5h |
| 輪87 | 忘記密碼改舊密碼驗證 | timeline 21:40–22:45 | 1.1h |
| 驗收修復 | 三筆 fix commits（無 timeline 輪次記錄） | 16:05→17:56（67adceb／1b73a80／e4ff95f） | 1.9h |
| 設計交付 | 頁面切片＋ERD 兩卡 | 2026-11-17 已記錄，每卡 1.43h | 2.86h |

- **11-18 開發實際工時合計 ≈ 12.3h**（不含輪85 空檔；不含 2026-11-19 的 cf67d04 滾動條修復，屬新一輪工作）。
- 11-17 設計交付 2.86h 另計，兩日合計 ≈ 15.2h。

### 推算口徑與局限（必讀）

1. **開始時間缺失**：多輪僅記錄完成時間，推算以上一可錨點（輪次完成或 commit 時間）為起點，實際起點可能更早。
2. **時間倒掛**：輪79 完成（11:02）早於輪39（11:39），屬前後端並行開發，已如實並列標註，不假設先後。
3. **空檔混入**：輪85 牆鐘 4.9h 含約 4h 非工作空檔（晚餐／等待），不計入合計。
4. **輪次與卡片非一一對應**：一輪涵蓋多張卡片，看板同輪卡片填同一輪次值；看板欄位加總僅參考。
5. **驗收修復無輪次**：三筆 fix commits（67adceb／1b73a80／e4ff95f）在 timeline 無對應輪次記錄，以 commit 時間錨定推算 1.9h。
6. 合計 12.3h 為推算值，非精確計時；如需精確數據，後續應在每輪開始／完成時即時記錄。
