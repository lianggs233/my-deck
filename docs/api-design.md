# My Deck API 設計（MVP 與完整產品）

- 文件版本：V0.5
- 文件狀態：已按使用者「先補全 API 設計」補齊 REQ-001～REQ-018 及管理員契約；可作前後端并行開發基線，MVP 實作範圍不變；註冊擁有者驗證碼端點已確認移至後續優化（2026-11-18），本期註冊採免驗證碼 `register/direct`
- 更新時間：2026-11-18 HKT
- 適用範圍：P0 MVP 契約，以及 REQ-006～REQ-018 與管理員完整產品契約；標示 P1／P2 的端點只供後續對接，**不代表納入 6 天 MVP 實作**
- 需求基準：`docs/requirements.md` V0.21
- 權限基準：`docs/permissions.md` V0.9
- 技術基準：`docs/tech-stack.md` V0.4
- API 風格：FastAPI、REST/JSON，統一前綴 `/api/v1`
- 「標籤功能」已確認為 PPT 個人文字標註；若日後改指課程分類標籤，須另設 CourseTag API

## 1. 設計原則

1. 瀏覽器不直接信任用戶端提交的身份、角色、課程歸屬、課件版本或標註作者。
2. 工作階段使用伺服端 Session；瀏覽器只保存安全 Cookie，不在 localStorage 保存密碼或敏感資料。
3. 寫入介面使用統一錯誤格式；欄位錯誤與業務拒絕分開表示。
4. 建立課程、加入課程、發送註冊驗證碼（後續優化端點）、完成註冊（後續優化端點）、完成上傳、重新轉換及建立標註均須支援安全重試；註冊驗證碼 challenge 必須綁定完整註冊內容，防止驗證後替換資料。
5. 轉換以背景工作執行，API 只提交工作及查詢狀態，不在請求內等待完整轉換。
6. PPT 原檔、轉換資源及個人標註均須按課程／課堂與作者授權。
7. 已批准的非課堂例外：已加入課程學生可在本人課程頁預覽轉換成功課件並管理本人個人標註；不得延伸至未加入課程、共享標註、回覆、匯出或即時課堂。REQ-003 完整加入流程在 6 天 MVP 暫緩，但本契約保留完整產品端點。

## 2. 通用約定

### 2.1 認證與 CSRF

登入、工作階段、CSRF、角色及資源權限的 FastAPI／React 實作約定，以 `docs/auth-permission-design.md` V0.2 為準；本文件中的端點與錯誤格式須與該方案一致。
- Schema 契約：`docs/api-schemas.md` V0.1；所有 request／response、共用 model、Socket.IO payload 及錯誤 envelope 以該文件為單一欄位基準，避免前後端雙份定義漂移。

- 登入後由伺服端簽發 `HttpOnly`、`Secure`、`SameSite=Lax` 的 Session Cookie。
- 所有 Cookie 認證的修改請求必須驗證 `X-CSRF-Token`。
- 註冊、登入前可從 `GET /api/v1/auth/csrf` 取得 CSRF Token；登入及重設工作階段後重新簽發。

### 2.2 請求標頭

| 標頭 | 必要時機 | 用途 |
|---|---|---|
| `Content-Type: application/json` | JSON 請求 | 請求格式 |
| `X-CSRF-Token` | Cookie 認證下的修改請求 | 防止跨站請求偽造 |
| `Idempotency-Key` | 下列可重試建立／提交請求 | 同一操作安全重試 |
| `If-Match` 或 `expectedVersion` | 標註修改／刪除 | 樂觀鎖，避免覆蓋較新版本 |

必須支援冪等的介面：

- `POST /courses`
- `POST /course-memberships/join`（可選 P0）
- `POST /courses/{courseId}/coursewares/{coursewareId}/upload/complete`
- `POST /courses/{courseId}/coursewares/{coursewareId}/conversion-attempts`
- `POST /courses/{courseId}/coursewares/{coursewareId}/annotations`
- `POST /auth/register/verification-codes`
- `POST /auth/register`

同一 key 重試返回原結果；不同操作使用不同 key；驗證碼發送冪等不得繞過重發間隔與發送限流，註冊冪等不得繞過 challenge 綁定。

### 2.3 統一錯誤格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "請修正標示的欄位",
    "fields": {
      "code": "課程碼必須為 8 位有效字元"
    },
    "requestId": "req_01..."
  }
}
```

常用 HTTP 狀態：

- `400`：JSON、欄位或狀態前置條件錯誤。
- `401`：未登入或工作階段失效。
- `403`：已登入但無權、CSRF 失敗或角色不符。
- `404`：資源不存在；不可因此泄露他人私有資源。
- `409`：重複操作、版本衝突或資源狀態不允許。
- `413`：檔案超過 100 MiB。
- `422`：課件結構、頁數、加密或內容無法解析。
- `429`：登入、驗證碼、課程碼、課堂碼或無效嘗試限流。

### 2.4 列表分頁

```text
GET ...?page=1&pageSize=20
```

回應：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

## 3. 帳號與工作階段 API

### 3.1 取得 CSRF Token

```http
GET /api/v1/auth/csrf
```

### 3.2 發送註冊／密碼重設驗證碼

> 註冊驗證碼端點已移至後續優化（2026-11-18 確認），本期前端不使用；本期註冊採免驗證碼 `POST /api/v1/auth/register/direct`（成功後不簽發工作階段，需另行登入）。密碼重設驗證碼端點維持本期交付。後端註冊驗證碼端點已實作並保留，供後續優化啟用。

```http
POST /api/v1/auth/register/verification-codes
POST /api/v1/auth/password-reset/verification-codes
```

註冊發送驗證碼時必須提交完整註冊資料，服務端先完成全部格式、角色、密碼強度及識別資料可用性校驗，再建立 challenge 並發送：

```json
{
  "identifier": "+85291234567",
  "displayName": "陳老師",
  "role": "TEACHER",
  "password": "使用者密碼"
}
```

密碼重設發送驗證碼只需：

```json
{
  "identifier": "+85291234567"
}
```

回應：

```json
{
  "challengeId": "vc_01...",
  "delivery": "SMS",
  "resendAfterSeconds": 60
}
```

- 註冊 challenge 綁定用途、正規化識別資料及完整註冊內容摘要；最終註冊請求不可替換 `displayName`、`role`、`password` 或 `identifier`。
- 電郵使用相同介面，以識別資料格式判斷 SMS／EMAIL。
- 發送間隔、有效期、最大嘗試次數及帳號／IP 限流由服務端配置。
- 驗證碼不得出現在 API 回應、日誌或瀏覽器持久化儲存。

### 3.3 完成註冊

> 後續優化端點（2026-11-18 確認）：本期前端不使用；本期註冊採免驗證碼 `POST /api/v1/auth/register/direct`，成功後不簽發工作階段，需另行登入。

```http
POST /api/v1/auth/register
```

```json
{
  "challengeId": "vc_01...",
  "verificationCode": "123456"
}
```

成功：

- 驗證碼、challenge 用途、完整註冊內容綁定及識別資料唯一性全部通過後建立帳號。
- 自動建立工作階段。
- 回應 `201` 及目前使用者資料。
- 重複提交同一註冊操作返回原結果；不得建立第二個有效帳號。

### 3.4 登入／登出／目前使用者

```http
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/me
```

登入請求：

```json
{
  "identifier": "+85291234567",
  "password": "使用者密碼"
}
```

目前使用者：

```json
{
  "id": "usr_01...",
  "displayName": "陳老師",
  "role": "TEACHER"
}
```

登入成功 `200`：
```json
{
  "user": {"id": "usr_01...", "displayName": "陳老師", "role": "TEACHER"},
  "session": {"expiresAt": "2026-11-24T08:00:00Z", "absoluteExpiresAt": "2026-12-17T08:00:00Z"}
}
```
登出成功 `204 No Content`；`GET /me` 回傳相同 `user`，未登入或 Session 失效回傳 `401 AUTH_REQUIRED`。

## 4. 課程 API

### 4.1 建立課程（老師）

```http
POST /api/v1/courses
```

```json
{
  "name": "中四數學"
}
```

- `name` trim 後 1–50 字元。
- 由 Session 決定負責老師。
- 產生固定 8 位課程碼，排除 `0/O/1/I`。
- 同名課程允許，以課程 ID 及課程碼區分。

建立成功 `201`：
```json
{
  "course": {
    "id": "crs_01...",
    "name": "中四數學",
    "code": "ABCD2345",
    "createdAt": "2026-11-17T08:00:00Z"
  }
}
```

### 4.2 老師本人課程列表

```http
GET /api/v1/courses?page=1&pageSize=20
```

只回傳目前老師負責課程，按建立時間由新至舊：

```json
{
  "items": [
    {
      "id": "crs_01...",
      "name": "中四數學",
      "code": "ABCD2345",
      "createdAt": "2026-11-17T08:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

### 4.3 學生本人課程列表

```http
GET /api/v1/me/course-memberships?page=1&pageSize=20
```

按加入時間由新至舊，回傳課程名稱、負責老師及加入時間：
```json
{
  "items": [
    {
      "membershipId": "mem_01...",
      "joinedAt": "2026-11-17T08:30:00Z",
      "course": {"id": "crs_01...", "name": "中四數學", "teacherName": "陳老師"}
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

### 4.4 學生透過課程碼加入課程（可選 P0）

```http
POST /api/v1/course-memberships/join
```

```json
{
  "code": "ABCD2345"
}
```

- 課程碼 trim、轉大寫，只接受 8 位合法字元。
- 學生身份由 Session 判定。
- 重複加入返回原成員記錄，不新增記錄。
- 無效碼、不可加入、帳號／IP 限流有對應錯誤。
- REQ-003 完整加入流程在 6 天 MVP 暫緩；本端點保留完整產品契約，待後續實作。

成功回應：

```json
{
  "membership": {
    "id": "mem_01...",
    "joinedAt": "2026-11-17T08:30:00Z"
  },
  "course": {
    "id": "crs_01...",
    "name": "中四數學",
    "code": "ABCD2345",
    "teacherName": "陳老師"
  }
}
```

### 4.5 課程詳情

```http
GET /api/v1/courses/{courseId}
```

老師限本人課程；學生限本人已加入課程。學生回應不含完整成員名單或原始 PPT 下載權。

```json
{
  "course": {
    "id": "crs_01...",
    "name": "中四數學",
    "teacherName": "陳老師",
    "code": "ABCD2345"
  }
}
```
老師可取得 `code`；學生回應可省略 `code`，但不得包含其他成員資料。

## 5. 課件上傳與轉換 API

### 5.1 建立上傳工作

```http
POST /api/v1/courses/{courseId}/coursewares/uploads
```

```json
{
  "fileName": "chapter-1.pptx",
  "sizeBytes": 10485760,
  "contentType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
}
```

- 只接受 `.ppt`／`.pptx`，`sizeBytes` 不得超過 104,857,600。
- 老師必須負責該課程。
- 回應 `uploadId`、單次預簽 `PUT` URL、必要 headers 及過期時間。
- 不使用公開原檔 URL。

```json
{
  "uploadId": "upl_01...",
  "method": "PUT",
  "url": "https://private-storage.example/...",
  "headers": {
    "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  "expiresAt": "2026-11-17T08:10:00Z"
}
```

### 5.2 完成上傳並建立課件

```http
POST /api/v1/courses/{courseId}/coursewares/{uploadId}/upload/complete
```

服務端重新校驗：

1. 上傳身份、課程歸屬及 uploadId。
2. 實際檔案大小、副檔名及可識別格式。
3. 原檔是否完整保存於香港私有儲存。
4. 檔案未損毀、未加密、無需密碼且可解析。
5. 實際頁數為 1–100 頁。

全部成功後才建立課件及首個待轉換工作；否則清理或隔離暫存內容，不建立可用課件。

```json
{
  "courseware": {
    "id": "cw_01...",
    "courseId": "crs_01...",
    "fileName": "chapter-1.pptx",
    "sizeBytes": 10485760,
    "pageCount": 24,
    "status": "QUEUED",
    "latestAttempt": 1,
    "uploadedAt": "2026-11-17T08:05:00Z"
  }
}
```

### 5.3 課件列表

```http
GET /api/v1/courses/{courseId}/coursewares
```

- 老師只見本人負責課程。
- 已加入課程學生可查看本人已加入課程的成功課件列表，用於課程頁預覽及本人標註；不得查看未加入課程或其他課程資料。
- 按上傳時間由新至舊。

老師列表項目：

```json
{
  "id": "cw_01...",
  "fileName": "chapter-1.pptx",
  "status": "CONVERTING",
  "pageCount": 24,
  "latestAttempt": 1,
  "updatedAt": "2026-11-17T08:06:00Z"
}
```

學生列表項目（僅在已批准入口中）：只含 `id`、`fileName`、`status`、`pageCount`、`updatedAt`，不含失敗歷史、內部嘗試、`conversionDueAt` 或其他內部排程資料。

### 5.4 課件轉換狀態與預覽

```http
GET /api/v1/courses/{courseId}/coursewares/{coursewareId}
```

- 老師完整預覽限本人負責課程。
- 學生端可在本人已加入課程的課程頁完整預覽轉換成功課件；此為已批准非課堂例外。
- 老師可查看待轉換、轉換中、成功、成功但有相容性警告、失敗及轉換逾時。

老師成功回應：

```json
{
  "id": "cw_01...",
  "courseId": "crs_01...",
  "fileName": "chapter-1.pptx",
  "pageCount": 24,
  "status": "READY_WITH_WARNINGS",
  "latestAttempt": 1,
  "conversionDueAt": "2026-11-17T08:10:00Z",
  "currentPageIndex": 0,
  "pages": [
    {
      "pageIndex": 0,
      "pageNumber": 1,
      "imageUrl": "https://signed-resource.example/...",
      "thumbnailUrl": "https://signed-resource.example/...",
      "width": 1920,
      "height": 1080
    }
  ],
  "pageRetry": {
    "0": "https://signed-resource.example/retry-..."
  }
}
```

- 正式頁／縮圖使用等比 WebP，長邊最高 1920px／320px。
- 老師失敗／逾時回應包含可理解錯誤及是否可重試，失敗歷史僅老師可見。
- 學生回應 schema 僅含課件 ID、課程 ID、頁數、狀態、目前獲授權頁面及短期簽名資源 URL；不得含失敗歷史、內部嘗試、`conversionDueAt` 或其他非授權頁面。

### 5.5 重新轉換（可選 P0）

```http
POST /api/v1/courses/{courseId}/coursewares/{coursewareId}/conversion-attempts
```

- 只有負責老師可在失敗／逾時後手動發起。
- 同一課件版本新增轉換嘗試，不建立新上傳版本。
- 原檔及舊失敗記錄保留；舊回調不得覆蓋新嘗試。
- 進行中禁止重複發起，不自動反覆重試。
- 此端點不屬已確認 6 天必做項目；未納入 MVP-S 時可延期。

## 6. 個人文字標註 API

> 以下標註 API 的服務端資料隔離、本人所有權及樂觀鎖屬 P0；已批准已加入課程學生在本人課程頁的成功課件使用，其他角色及未加入課程學生不可使用。

### 6.1 列出本人標註

```http
GET /api/v1/courses/{courseId}/coursewares/{coursewareId}/annotations?pageIndex=0
```

- 學生只取得自己建立的個人標註。
- 老師不能透過此介面取得學生個人標註。
- 課件／頁面必須屬於目前有效授權上下文。

### 6.2 建立個人標註

```http
POST /api/v1/courses/{courseId}/coursewares/{coursewareId}/annotations
```

```json
{
  "pageIndex": 0,
  "content": "這裡要再複習",
  "position": {
    "x": 0.42,
    "y": 0.31
  }
}
```

- `content` trim 後 1–100 字元，按 trim 後內容保存及計長。
- `pageIndex` 必須在實際頁數範圍。
- `x`、`y` 使用相對頁面寬高的 0–1 數值。
- 作者由 Session 判定，不能由請求指定他人。

### 6.3 修改／刪除本人標註

```http
PATCH  /api/v1/courses/{courseId}/coursewares/{coursewareId}/annotations/{annotationId}
DELETE /api/v1/courses/{courseId}/coursewares/{coursewareId}/annotations/{annotationId}
```

修改請求：

```json
{
  "content": "更新後內容",
  "position": {
    "x": 0.5,
    "y": 0.4
  },
  "expectedVersion": 3
}
```

- `content` 與 `position` 均為可選，但至少提供一項；可只改文字、只改位置或同時修改。
- 修改文字時 trim 後重新執行 1–100 字元校驗；位置繼續使用 0–1 歸一化座標。
- 只有作者本人可修改或刪除。
- `expectedVersion` 不符回應 `409 ANNOTATION_VERSION_CONFLICT`，客戶端取得最新本人標註後再操作。
- 成功修改後遞增版本並回傳更新後的 `content`、`position`、`version` 及 `updatedAt`。

## 7. 最小資料實體

| 實體 | 必要欄位／約束 |
|---|---|
| User | id、正規化識別資料、顯示名稱、角色、密碼雜湊、狀態 |
| VerificationChallenge | id、用途、正規化識別資料、註冊內容摘要、驗證碼雜湊、過期時間、嘗試次數、使用狀態 |
| Session | id、userId、建立時間、最後活動時間、絕對到期時間、撤銷狀態 |
| Course | id、teacherId、name、code、建立時間 |
| CourseMembership | id、courseId、studentId、joinedAt；courseId + studentId 唯一 |
| Courseware | id、courseId、原檔位置、檔名、位元組大小、實際頁數、版本、狀態、上傳時間 |
| ConversionAttempt | id、coursewareId、attemptNo、狀態、開始／完成時間、錯誤、課件版本 |
| CoursewarePage | id、coursewareId、pageIndex、正式頁位置、縮圖位置、寬高、版本 |
| Annotation | id、coursewareId、pageIndex、studentId、文字、position、version、建立／更新／刪除狀態 |

所有列表及直接資源存取都須由服務端套用角色與歸屬條件，不只依靠前端隱藏入口。

## 8. P0 端到端流程

1. 老師／學生註冊（本期）：以免驗證碼 `POST /api/v1/auth/register/direct` 提交完整註冊資料 → 建立帳號後返回登入頁登入。（後續優化：提交完整註冊資料並發送驗證碼 → 以同一 challenge 完成註冊 → 自動登入。）
2. 老師建立課程 → 在本人課程列表看到課程。
3. MVP 使用預建老師、學生帳號及課程成員關係；REQ-003 完整課程碼加入流程暫緩但保留契約。
4. 老師建立上傳工作 → 以預簽 URL 上傳原檔 → 完成上傳 → 建立待轉換課件。
5. 老師查詢狀態 → 成功後預覽正式頁及縮圖；失敗時顯示原因，重新轉換是否開放取決於 MVP-S 範圍。
6. 學生從本人已加入課程頁開啟成功課件，逐頁預覽並建立、查看、修改及刪除本人文字標註；不得查看他人標註。
7. 重新整理後只能看到本人標註，不能看到其他學生個人標註。

## 9. 已確認範圍決策與剩餘技術邊界

1. 「標籤功能」已確認為 PPT 個人文字標註；課程分類標籤不在本期範圍。
2. 已正式批准已加入課程學生在本人課程頁預覽成功課件並管理本人標註，不要求即時課堂；共享標註、回覆、匯出及即時同步不在 MVP。
3. 暫按私有儲存單次預簽 `PUT`；不支援分片續傳。若網絡／代理不適合瀏覽器直傳，可改為 FastAPI multipart 上傳，但需重估傳輸與逾時處理。

## 10. 建議實施順序

1. FastAPI app、設定、資料庫、Session／CSRF、統一錯誤格式。
2. Pydantic schemas、OpenAPI、認證與角色依賴。
3. 使用者、驗證碼 challenge、註冊、登入及登出。
4. REQ-003 完整加入流程在 6 天 MVP 暫緩；MVP 演示使用預建老師、學生帳號及課程成員關係，端點契約仍保留，待後續實作。
5. 私有儲存、上傳工作、完成上傳及課件資料。
6. Celery 轉換、狀態查詢及靜態預覽。
7. 直接實作個人標註 CRUD、版本控制及本人資料隔離。
8. 最後以 MVP-S 端到端情境驗證權限、錯誤及安全重試。

---

# 第二部分：完整產品 API（P1／P2 與後續對接）

> 本部分把 REQ-006～REQ-018 及已確認管理員權限納入同一契約，方便前後端并行開發及後期對接；P1／P2 端點不代表納入 6 天 MVP。各端點實作前，必須先以 OpenAPI response model、權限 dependency 及錯誤碼註冊表固定契約。

## 11. 完整產品通用契約

- REST API 負責所有寫入及權威狀態；Socket.IO 只負責即時通知及快照，不接受用戶端直接宣告身份或權限。
- `pageIndex` 由 0 起算；標註位置使用 `x`、`y` 歸一化座標（0–1）；時間使用 ISO-8601 UTC。
- 所有建立／提交／結束／刪除操作支援 `Idempotency-Key`；涉及版本的操作使用 `expectedStateVersion` 或 `expectedVersion`，衝突回 `409`。
- `stateVersion` 為每個課堂遞增整數；`lastStateVersion` 只用於重連及亂序訊息比對。
- 個人標註與共享標註永遠分開；管理員 `content_read` 預設關閉，個人標註不得提供管理員內容端點。

## 12. REQ-006～REQ-009 即時課堂、加入、翻頁與重連

### 12.1 課堂端點

| 方法與路徑 | 使用者 | 用途 |
|---|---|---|
| `POST /courses/{courseId}/classrooms` | 負責老師 | 以成功課件建立課堂；同課程及同老師只允許一個進行中課堂 |
| `GET /courses/{courseId}/classrooms/{classroomId}` | 老師／已加入課程學生 | 取得課堂基本資料、課件版本、頁碼、狀態及 stateVersion |
| `GET /classrooms/{classroomId}/join-info` | 負責老師／管理員 `classroom_ops` | 取得課堂碼及加入狀態；不公開完整成員名單 |
| `POST /classrooms/join` | 學生／訪客 | 以課堂碼加入；學生不因此加入課程，訪客以 guestId 識別 |
| `GET /classrooms/{classroomId}/snapshot` | 已加入學生／訪客／老師 | 重連取得權威快照及本人可見資料 |
| `POST /classrooms/{classroomId}/pages` | 負責老師 | 上一頁、下一頁或指定頁；攜帶 expectedStateVersion |
| `POST /classrooms/{classroomId}/end` | 負責老師 | 結束課堂，停止新互動；不重複結束 |
| `DELETE /classrooms/{classroomId}` | 負責老師／管理員 `classroom_ops` | 刪除整課；管理員必須二次確認、原因及審計 |

開始課堂請求：

```json
{
  "coursewareId": "cw_01...",
  "name": "中四數學第一課"
}
```

開始課堂成功回應 `201`：

```json
{
  "classroom": {
    "id": "cls_01...",
    "courseId": "crs_01...",
    "name": "中四數學第一課",
    "code": "ABCD23",
    "status": "LIVE",
    "coursewareId": "cw_01...",
    "coursewareVersion": 1,
    "pageIndex": 0,
    "pageCount": 12,
    "stateVersion": 1,
    "startedAt": "2026-11-17T22:00:00Z",
    "endsAt": null
  },
  "joinInfo": {
    "code": "ABCD23",
    "joinUrl": "/join/ABCD23",
    "canCopy": true
  }
}
```

加入課堂請求：

```json
{
  "code": "ABCD23",
  "guestId": null
}
```

加入成功回應：

```json
{
  "participant": {
    "id": "prt_01...",
    "role": "STUDENT",
    "displayName": "陳同學",
    "guestId": null,
    "canWrite": true
  },
  "classroom": {
    "id": "cls_01...",
    "status": "LIVE",
    "pageIndex": 0,
    "pageCount": 12,
    "stateVersion": 4
  },
  "snapshot": {
    "currentPageImageUrl": "/api/v1/classrooms/cls_01/pages/0",
    "personalAnnotations": [],
    "sharedAnnotations": []
  }
}
```

訪客首次加入時由服務端產生不可修改的 `guestName` 及 `guestId`；瀏覽器只在 localStorage 保存 `guestId`，不保存密碼或課堂私密內容。ID 失效時，必須在訪客確認後才建立新身份。訪客只能看目前同步頁，不可簽到、答題、標註、共享層或下載資源。

### 12.2 核心 schema

```json
{
  "Classroom": {
    "id": "cls_01...",
    "courseId": "crs_01...",
    "coursewareId": "cw_01...",
    "coursewareVersion": 1,
    "status": "LIVE",
    "pageIndex": 0,
    "pageCount": 12,
    "stateVersion": 8,
    "startedAt": "2026-11-17T22:00:00Z",
    "endedAt": null,
    "retentionUntil": null
  }
}
```

翻頁請求：

```json
{
  "direction": "NEXT",
  "expectedStateVersion": 8
}
```

成功回應只回傳目前老師頁面及新版本；學生／訪客收到同一權威頁碼，亂序或舊版本事件不得回退頁面。

重連以 `lastStateVersion` 查詢／接收快照；若版本落後，服務端回傳完整目前頁、可見共享標註、活動狀態及本人個人標註。離線操作不自動重放。

## 13. REQ-011～REQ-013 共享標註、回覆與管理

| 方法與路徑 | 使用者 | 用途 |
|---|---|---|
| `GET /classrooms/{classroomId}/shared-annotations` | 老師／學生 | 依頁面、可見性及群組查詢共享標註 |
| `POST /classrooms/{classroomId}/shared-annotations` | 老師／獲授權學生 | 建立共享文字標註；學生須有當前課堂授權 |
| `PATCH /classrooms/{classroomId}/shared-annotations/{annotationId}` | 作者 | 修改文字或位置；不可改作者或群組 |
| `DELETE /classrooms/{classroomId}/shared-annotations/{annotationId}` | 作者／老師管理 | 刪除自己的共享標註；老師只能依管理權操作 |
| `POST /classrooms/{classroomId}/shared-annotations/{annotationId}/replies` | 負責老師 | 回覆學生共享標註，建立獨立回覆記錄 |
| `PATCH /classrooms/{classroomId}/shared-annotations/replies/{replyId}` | 負責老師本人 | 修改自己的回覆，保留學生原文 |
| `DELETE /classrooms/{classroomId}/shared-annotations/replies/{replyId}` | 負責老師本人 | 刪除自己的回覆，保留學生原文 |
| `PUT /classrooms/{classroomId}/shared-annotations/{annotationId}/visibility` | 負責老師 | 顯示／隱藏共享標註；不改作者或群組 |
| `POST /classrooms/{classroomId}/shared-annotations/clear` | 負責老師 | 二次確認後清除目前頁共享內容，不可經介面恢復 |
| `PUT /classrooms/{classroomId}/students/{studentId}/share-permission` | 負責老師 | 授予／收回學生共享標註權限 |

共享標註請求：

```json
{
  "pageIndex": 0,
  "groupId": "grp_01...",
  "content": "這裡的公式需要再解釋",
  "position": {"x": 0.42, "y": 0.36},
  "expectedStateVersion": 8
}
```

回覆請求：

```json
{
  "content": "我會在下一步拆解。",
  "expectedVersion": 1
}
```

回覆 PATCH／DELETE 使用相同 `expectedVersion` 樂觀鎖；只影響老師自己的回覆，不得覆蓋或刪除學生原始標註。

回應共同欄位：

```json
{
  "id": "ann_01...",
  "classroomId": "cls_01...",
  "pageIndex": 0,
  "groupId": "grp_01...",
  "content": "這裡的公式需要再解釋",
  "position": {"x": 0.42, "y": 0.36},
  "author": {"id": "usr_02...", "displayName": "陳同學", "role": "STUDENT"},
  "visibility": "VISIBLE",
  "version": 2,
  "createdAt": "2026-11-17T22:10:00Z",
  "replies": []
}
```

- 群組只由明確 `groupId` 決定，不依距離自動合併。
- 老師與學生原始標註分開保存；回覆是獨立記錄，不覆蓋原文。
- 收回學生授權後保留既有共享內容，但禁止其新增、修改、移動或刪除。
- 訪客不可使用本節端點；老師不可查看學生個人標註。

## 14. REQ-014～REQ-016 簽到、答題與統計

### 14.1 活動端點

| 方法與路徑 | 使用者 | 用途 |
|---|---|---|
| `POST /classrooms/{classroomId}/activities` | 負責老師 | 建立簽到或答題活動 |
| `POST /classrooms/{classroomId}/activities/{activityId}/publish` | 負責老師 | 發布活動；同課堂同時只允許一個進行中活動 |
| `POST /classrooms/{classroomId}/activities/{activityId}/close` | 負責老師 | 結束活動，拒絕遲交 |
| `GET /classrooms/{classroomId}/activities` | 老師／學生 | 查詢活動及目前狀態 |
| `GET /classrooms/{classroomId}/activities/{activityId}/results` | 負責老師 | 取得即時統計，由原始提交重算 |
| `POST /classrooms/{classroomId}/activities/{activityId}/submissions` | 學生 | 簽到或提交答案，每生每活動一次 |
| `GET /classrooms/{classroomId}/activities/{activityId}/me/result` | 學生 | 查看本人提交及結束後公開的正確答案 |

建立答題請求：

```json
{
  "type": "SINGLE_CHOICE",
  "question": "2 + 2 = ?",
  "options": [
    {"id": "A", "text": "3"},
    {"id": "B", "text": "4"}
  ],
  "correctOptionIds": ["B"],
  "expectedStateVersion": 8
}
```

提交請求：

```json
{
  "answers": ["B"],
  "expectedStateVersion": 9
}
```

活動回應：

```json
{
  "id": "act_01...",
  "classroomId": "cls_01...",
  "type": "SINGLE_CHOICE",
  "question": "2 + 2 = ?",
  "status": "OPEN",
  "options": [
    {"id": "A", "text": "3"},
    {"id": "B", "text": "4"}
  ],
  "submissionCount": 18,
  "participantCount": 25,
  "stateVersion": 9,
  "publishedAt": "2026-11-17T22:12:00Z",
  "closedAt": null
}
```

- 題目 trim 後 1–200 字元；選項 2–6 個、每項 1–100 字元。
- 單選恰一個正確答案，多選至少一個，判斷固定正誤，投票沒有正確答案。
- 學生提交後不可修改；重複提交返回原提交或 `ACTIVITY_ALREADY_SUBMITTED`，不產生第二份有效答卷。
- 客觀題在活動結束前不得向學生泄露正確答案；訪客所有提交均被拒絕。
- 統計可由原始簽到／答案記錄重算，快取不是唯一資料來源。

## 15. REQ-017～REQ-018 摘要、保留、匯出與刪除

| 方法與路徑 | 使用者 | 用途 |
|---|---|---|
| `GET /classrooms/{classroomId}/summary` | 老師／學生 | 老師看互動及共享摘要；學生只看本人內容及相關回覆 |
| `POST /classrooms/{classroomId}/exports` | 老師／學生 | 建立背景 PPT／PPTX 匯出工作 |
| `GET /classrooms/{classroomId}/exports/{exportId}` | 申請者／授權老師 | 查詢匯出狀態、到期時間及下載資格 |
| `GET /classrooms/{classroomId}/exports/{exportId}/download` | 申請者／授權老師 | 在 168 小時保留期內下載獨立匯出檔 |
| `DELETE /classrooms/{classroomId}` | 老師／管理員 `classroom_ops` | 刪除整課；TXT 刪除審計獨立保存 |

匯出請求：

```json
{
  "format": "PPTX",
  "scope": "CLASSROOM_SHARED"
}
```

匯出回應：

```json
{
  "id": "exp_01...",
  "classroomId": "cls_01...",
  "format": "PPTX",
  "scope": "CLASSROOM_SHARED",
  "status": "QUEUED",
  "fileName": null,
  "downloadAvailableAt": null,
  "expiresAt": "2026-11-24T22:20:00Z",
  "createdAt": "2026-11-17T22:20:00Z"
}
```

- 學生 `scope` 只能為 `STUDENT_OWN`；不可匯出他人個人標註或全班原始答案。
- 檔名使用安全處理後的 `課堂名_老師名.ppt` 或 `.pptx`，非法字元以下底線替換，不覆蓋原始 PPT。
- 課堂結束起 168 小時後關閉查看及下載；刪除整課前須確認，原始課程及原始課件不因此刪除。
- TXT 刪除記錄獨立保存；老師、學生及訪客不可查看。

刪除請求：

```json
{
  "confirmClassroomName": "中四數學第一課",
  "reason": "課堂資料已到期，申請刪除"
}
```

## 16. 管理員 API（已確認分類權限）

> 管理員 API 不在 6 天 MVP 建後台，但契約先行；每個端點仍必須使用 `require_admin_scope(scope, reason)`。個人標註內容查看永遠不提供管理員端點。

| 方法與路徑 | scope | 規則 |
|---|---|---|
| `GET /admin/users` | `account_manage` | 查詢老師／學生帳號及狀態 |
| `PATCH /admin/users/{userId}/status` | `account_manage` | 停用／恢復帳號；原因及審計 |
| `GET /admin/courses` | `account_manage` | 查詢課程基本資料及狀態；不含原始 PPT 或個人標註 |
| `GET /admin/classrooms` | `classroom_ops` | 查詢課堂基本資料及異常狀態 |
| `POST /admin/classrooms/{classroomId}/force-end` | `classroom_ops` | 二次確認、原因及審計；不代替老師日常授課 |
| `DELETE /admin/classrooms/{classroomId}` | `classroom_ops` | 二次確認、原因及審計；不可恢復已刪內容 |
| `GET /admin/audit/shared-annotations` | `audit_read` | 只看營運／安全審計摘要及必要欄位，不默認完整內容 |
| `GET /admin/audit/attendance` | `audit_read` | 只看簽到審計摘要及必要欄位 |
| `GET /admin/audit/quiz-submissions` | `audit_read` | 只看答題審計摘要及必要欄位 |
| `GET /admin/audit/deletion-records` | `audit_read` | 查看 TXT 刪除審計記錄，不查看或恢復已刪內容 |

管理員狀態變更／強制處理請求：

```json
{
  "reason": "安全事件調查，案件編號 SEC-2026-001",
  "confirm": true
}
```

回應至少包含：

```json
{
  "operationId": "adm_01...",
  "scope": "classroom_ops",
  "actorAdminId": "adm_root...",
  "targetType": "CLASSROOM",
  "targetId": "cls_01...",
  "reason": "安全事件調查，案件編號 SEC-2026-001",
  "createdAt": "2026-11-17T22:25:00Z"
}
```

禁止提供：

- `/admin/personal-annotations` 或任何可查看學生個人標註內容的路徑。
- 管理員代學生簽到、答題、建立／修改／刪除標註。
- 管理員默認下載原始 PPT、學生個人匯出或查看完整課堂教學內容。

## 17. Socket.IO 即時事件契約

REST 成功後由服務端發出事件；用戶端只接收及重連，不把事件視為權威寫入。

| 事件 | 方向 | 主要欄位 |
|---|---|---|
| `classroom:join` | client → server | `classroomId`、`lastStateVersion` |
| `classroom:snapshot` | server → client | `classroom`、`page`、`stateVersion`、可見標註、活動 |
| `page:changed` | server → client | `classroomId`、`pageIndex`、`pageCount`、`stateVersion` |
| `shared-annotation:changed` | server → client | `annotationId`、`groupId`、`operation`、`stateVersion` |
| `activity:changed` | server → client | `activityId`、`status`、`stateVersion` |
| `classroom:ended` | server → client | `classroomId`、`endedAt`、`stateVersion` |
| `error` | server → client | 穩定 `code`、`message`、`requestId` |

- 每個事件攜帶 `stateVersion`；用戶端忽略較舊版本。
- 斷線重連先取得 snapshot，再恢復監聽；不得重放未確認的舊操作。
- 訪客只接收目前頁及課堂狀態，不接收共享標註、活動明細或老師回覆。

## 18. 完整錯誤碼註冊表

| HTTP | 錯誤碼 | 使用情境 |
|---|---|---|
| 400 | `VALIDATION_ERROR`、`INVALID_PAGE_INDEX`、`INVALID_POSITION` | 欄位、頁碼或座標不合法 |
| 401 | `SESSION_INVALID`、`SESSION_EXPIRED`、`CSRF_INVALID` | 未登入、工作階段或 CSRF 失敗 |
| 403 | `ROLE_FORBIDDEN`、`COURSE_FORBIDDEN`、`CLASSROOM_FORBIDDEN`、`CONTENT_READ_DISABLED` | 角色、資源或內容權限不足 |
| 404 | `COURSE_NOT_FOUND`、`COURSEWARE_NOT_FOUND`、`CLASSROOM_NOT_FOUND`、`ANNOTATION_NOT_FOUND`、`ACTIVITY_NOT_FOUND` | 資源不存在或不可見 |
| 409 | `IDEMPOTENCY_CONFLICT`、`VERSION_CONFLICT`、`CLASSROOM_ALREADY_LIVE`、`ACTIVITY_ALREADY_OPEN`、`ACTIVITY_ALREADY_SUBMITTED` | 冪等、版本、唯一課堂或提交衝突 |
| 410 | `CLASSROOM_ENDED`、`RETENTION_EXPIRED` | 課堂已結束或保留期已過 |
| 422 | `COURSEWARE_NOT_CONVERTED`、`FILE_INVALID`、`QUESTION_INVALID`、`ANSWER_INVALID` | 課件不可用、檔案、題目或答案不合法 |
| 429 | `RATE_LIMITED`、`CODE_ATTEMPTS_LIMITED` | 帳號／IP 或課程／課堂碼嘗試過多 |
| 500 | `INTERNAL_ERROR`、`CONVERSION_FAILED`、`EXPORT_FAILED` | 未預期服務或背景工作失敗 |
| 503 | `SERVICE_UNAVAILABLE`、`REALTIME_UNAVAILABLE` | 暫時不可用，可安全重試 |

## 19. 前後端并行開發與後期對接

1. FastAPI 以 Pydantic request／response model 實作本文件 schema，OpenAPI 作為唯一 HTTP 契約來源。
2. 所有路由固定 `response_model`、狀態碼、權限 dependency、錯誤碼及冪等策略；禁止只回傳未定型 dict。
3. 前端以 `openapi-typescript` 由 OpenAPI 生成型別，`openapi-fetch` 呼叫 API；不得手寫一份與後端漂移的介面型別。
4. 把 `Idempotency-Key`、`expectedStateVersion`、`expectedVersion`、分頁及錯誤 envelope 放入共用 client／interceptor。
5. Socket.IO 事件以獨立 TypeScript event map 對應本文件第 17 節；事件只更新快取，必要時重新拉取 REST snapshot。
6. 每次契約改動必須同時更新本文件、OpenAPI schema、前端生成型別及權限 dependency；先在 PR 顯示 OpenAPI diff，再進行并行開發。
