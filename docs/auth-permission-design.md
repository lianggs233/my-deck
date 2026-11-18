# My Deck 登入、工作階段與權限設計方案

- 文件版本：V0.3
- 文件狀態：已按使用者「前後端并行開發、優先定義 API、方便後期對接」要求整理；管理員分類權限已同步；註冊擁有者驗證已確認移至後續優化（2026-11-18），本期註冊採免驗證碼流程，密碼重設驗證維持本期交付
- 建立時間：2026-11-17 22:10:16 HKT
- 需求基準：`docs/requirements.md` V0.21
- 權限基準：`docs/permissions.md` V0.10
- API 基準：`docs/api-design.md` V0.5
- 技術基準：`docs/tech-stack.md` V0.5

## 1. 目標與邊界

1. 前端 React + Vite 與後端 FastAPI 可由不同工作線并行開發，以 OpenAPI／JSON Schema 作為唯一 API 契約。
2. 登入、工作階段、CSRF、角色及資源權限均由後端最終判定；前端只負責呈現與收集輸入。
3. MVP 只交付老師、學生帳號及預建課程成員關係；不開發管理員後台、訪客流程及即時課堂。
4. 本方案不改變已確認需求；只把 `docs/api-design.md` 與 `docs/permissions.md` 轉成可實作的 FastAPI／React 約定。

## 2. 認證與註冊流程

### 2.1 註冊

1. `POST /api/v1/auth/register/verification-codes` 接收完整註冊資料：`identifier`、`displayName`、`role`、`password`。
2. FastAPI 先完整執行格式、唯一性、`zxcvbn` 及角色校驗；合法後建立 `VerificationChallenge`。
3. `VerificationChallenge` 不保存明文驗證碼或明文密碼：
   - 驗證碼只保存散列；
   - 識別資料保存正規化結果；
   - 註冊內容保存為伺服器密鑰保護的 canonical payload digest，綁定用途、角色、顯示名稱、識別資料及密碼承諾；
   - 記錄過期時間、重發限制、嘗試次數及使用狀態。
4. 最終 `POST /api/v1/auth/register` 必須帶同一 `challengeId`、`code` 及完整註冊資料；後端重新計算 digest 並與 challenge 綁定值比對，防止驗證後替換帳號、角色、名稱或密碼。
5. 驗證成功後在同一交易建立啟用帳號、建立工作階段並回傳已登入使用者；失敗不得產生部分帳號。

### 2.2 登入

1. `POST /api/v1/auth/login` 只接受已驗證手機號碼或電子郵件及密碼。
2. 後端按帳號唯一性先作統一防列舉回饋，再校驗密碼散列。
3. 同一帳號及來源 IP 連續失敗 5 次後限制 15 分鐘，限流狀態由後端保存。
4. 登入成功後建立新的伺服器端 Session，並旋轉 CSRF Token；登入失敗不得改變現有工作階段。

### 2.3 忘記密碼

1. 忘記密碼使用獨立用途的 `VerificationChallenge`，不得重用註冊 challenge。
2. 重設成功後撤銷該帳號全部工作階段，使用者須重新登入。

## 3. 工作階段設計

| 項目 | 方案 |
|---|---|
| 前端保存 | 只保存 `HttpOnly; Secure; SameSite=Lax` 的 Session Cookie，不保存密碼、驗證碼或敏感資料 |
| 後端保存 | Session ID 對應的資料保存在 PostgreSQL／Redis；角色、帳號狀態及到期資料以伺服器記錄為準 |
| 滑動到期 | 7 天無活動失效；有效活動可續期 |
| 絕對到期 | 自 Session 建立起最長 30 天 |
| 登出 | `POST /api/v1/auth/logout` 只撤銷目前裝置 Session |
| 密碼變更 | 重設成功後撤銷全部裝置 Session |
| Session 失效 | 前端收到 401 後清除受保護頁面資料並導向登入；不得繼續展示私密內容 |

Session Cookie 不使用 `localStorage`，避免被腳本讀取；跨站請求仍由 SameSite、Origin 及 CSRF Token 共同防護。

## 4. CSRF 與請求安全

1. 前端啟動時先取得同源 bootstrap／meta 回應，後端發出可讀但 `Secure; SameSite=Lax` 的 CSRF Cookie。
2. 所有可能改變狀態的 `POST`、`PATCH`、`PUT`、`DELETE` 必須同時符合：
   - `Origin`／`Referer` 為允許同源；
   - 請求頭 `X-CSRF-Token` 與 CSRF Cookie 值一致；
   - 使用有效 Session 或該匿名流程允許的 challenge。
3. 所有寫入 API 以 `Idempotency-Key` 處理雙擊、逾時及重試；冪等結果以伺服器記錄為準。
4. CORS 只允許已配置前端來源；不使用 `Access-Control-Allow-Origin: *` 配合 Cookie。
5. 錯誤格式保持 `code`、`message`、`fields`、`traceId`，不向無權使用者泄露其他資源是否存在。

## 5. 角色與資源權限模型

### 5.1 角色

- 帳號角色只來自伺服器 Session／資料庫，不接受前端自行聲明。
- MVP 只實作 `teacher`、`student`；`admin` 與 `guest` 的詳細規則仍按需求保留待確認，不在 MVP 建立可越權入口。

### 5.2 FastAPI dependency 組合

| Dependency | 用途 |
|---|---|
| `get_current_user()` | 讀取 Session、驗證帳號有效並載入使用者 |
| `require_roles("teacher")`／`require_roles("student")` | 限制角色，不自行讀取前端角色參數 |
| `get_owned_course(course_id, user)` | 只放行負責老師本人課程 |
| `get_course_member(course_id, user)` | 只放行已加入課程的學生；重複加入仍返回原成員關係 |
| `get_successful_courseware(course_id, courseware_id)` | 只放行已存在且轉換成功的課件版本 |
| `require_annotation_owner(annotation_id, user)` | 個人標註僅作者本人可查看、修改及刪除 |
| `require_teacher_courseware_access()` | 老師可查看完整狀態、失敗歷史及重試資料 |
| `require_student_courseware_preview()` | 學生僅可在本人已加入課程的成功課件頁取得必要預覽資料 |

### 5.3 MVP 權限落地

| 操作 | 後端判定 |
|---|---|
| 老師建立／查看課程 | 已登入老師；課程 `owner_id` 等於目前使用者 |
| 學生查看已加入課程 | 已登入學生；存在有效 course membership |
| 老師上傳課件 | 已登入老師；課程歸屬正確；格式、100 MiB 及頁數由服務端重新校驗 |
| 學生預覽成功課件 | 已登入學生；已加入該課程；課件狀態成功；不回傳失敗歷史、內部嘗試或 `conversionDueAt` |
| 學生個人標註 CRUD | 已登入學生；作者為本人；課件版本及頁面合法；僅本人可見 |
| 未加入課程學生、其他老師、訪客 | 一律拒絕；錯誤回饋不得泄露課件內容或儲存位置 |

### 5.4 管理員分類權限（已確認）

| 分類 | 允許範圍 | 必要控制 |
|---|---|---|
| 帳號與課程管理 | 管理老師／學生帳號狀態、課程／課堂基本資料及異常狀態 | 服務端角色檢查、操作審計；不得預設查看教學內容 |
| 課堂強制處理 | 安全、違規或系統異常時強制結束或刪除任意課堂 | 二次確認、必填原因、記錄操作者／時間／課堂／理由 |
| 學生個人標註 | 不可查看 | 管理員與老師一樣不得查看個人標註內容 |
| 營運／安全審計 | 唯讀查看共享標註、答題及簽到的必要審計資料 | 默認摘要及必要欄位，不默認完整內容，所有查看記入審計 |
| TXT 刪除審計 | 查看操作者、時間、課堂、範圍及原因 | 不可查看或恢復已刪內容；老師、學生及訪客無入口 |

FastAPI 落地時管理員功能不使用單一 `is_admin` 放行，而使用 `require_admin_scope(scope, reason)`；`content_read` 類權限預設關閉，須另行限時授權、填寫原因並記錄審計。MVP 不建管理員後台，但資料模型及權限判斷須避免未來補介面時繞過同一套服務端授權。

## 6. 前後端并行開發契約

1. **契約先行**：後端先在 FastAPI route／Pydantic schema 定義路徑、請求、回應及錯誤；`GET /openapi.json` 是前後端共同依據。
2. **型別生成**：前端使用 `openapi-typescript` 產生型別，再使用 `openapi-fetch` 呼叫 API；不得手寫與 OpenAPI 不一致的 DTO。
3. **錯誤先行**：後端固定錯誤 envelope；前端以錯誤 `code` 對應欄位錯誤、401、403、404、409、429 及 500 狀態。
4. **權限先行**：後端先完成 dependency 及測試資料，再開放前端頁面；前端只隱藏無權操作，不當作安全邊界。
5. **並行節奏**：
   - 後端：schema → dependency → route → OpenAPI；
   - 前端：生成型別 → API client → 表單／頁面 → 錯誤與 loading；
   - 雙方以同一 `openapi.json` 及固定錯誤碼集成。
6. **契約防漂移**：CI 檢查 FastAPI OpenAPI 與前端生成型別；若 schema 改動，必須同步更新 API 文件與前端型別。

## 7. MVP 演示資料

- 使用初始化程序建立老師、學生帳號、一門課程及學生課程成員關係。
- 不建立管理員後台，不由前端手寫資料庫資料。
- 初始密碼只存在開發／演示環境配置或一次性初始化輸出，不寫入文件、日誌或前端。

## 8. 驗收重點

1. 未登入、工作階段失效、跨角色及跨課程存取均由後端拒絕。
2. 註冊 challenge 無法透過修改最終請求替換角色、名稱、識別資料或密碼。
3. 所有寫入介面具備 CSRF、Origin、冪等及安全錯誤處理。
4. 前端型別由 OpenAPI 產生，禁止與 API schema 手寫漂移。
5. 個人標註與課件資料只向合法本人及合法資源範圍返回。

## 9. 待確認

1. 開發及正式環境的前端來源網址清單。
2. Session 主要存 PostgreSQL 還是 Redis，以及滾動續期的精確更新策略。
3. 密碼重設驗證碼是否與註冊驗證碼共用同一發送服務配置。
4. MVP 初始化演示帳號的最終密碼交付方式。
