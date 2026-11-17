# My Deck MVP API 設計

- 文件版本：V0.3
- 文件狀態：已同步使用者確認的 MVP 方案；完整 API 契約仍待實作確認
- 更新時間：2026-11-17 HKT
- 適用範圍：`docs/mvp-priority.md` V0.3 的 P0／可選 P0 候選範圍；**完整 P0 契約不是已確認 6 天全部交付清單**
- 需求基準：`docs/requirements.md` V0.19
- 權限基準：`docs/permissions.md` V0.8
- 技術基準：`docs/tech-stack.md` V0.4
- API 風格：FastAPI、REST/JSON，統一前綴 `/api/v1`
- 「標籤功能」已確認為 PPT 個人文字標註；若日後改指課程分類標籤，須另設 CourseTag API

## 1. 設計原則

1. 瀏覽器不直接信任用戶端提交的身份、角色、課程歸屬、課件版本或標註作者。
2. 工作階段使用伺服端 Session；瀏覽器只保存安全 Cookie，不在 localStorage 保存密碼或敏感資料。
3. 寫入介面使用統一錯誤格式；欄位錯誤與業務拒絕分開表示。
4. 建立課程、加入課程、發送註冊驗證碼、完成註冊、完成上傳、重新轉換及建立標註均須支援安全重試；註冊驗證碼 challenge 必須綁定完整註冊內容，防止驗證後替換資料。
5. 轉換以背景工作執行，API 只提交工作及查詢狀態，不在請求內等待完整轉換。
6. PPT 原檔、轉換資源及個人標註均須按課程／課堂與作者授權。
7. 已批准的非課堂例外：已加入課程學生可在本人課程頁預覽轉換成功課件並管理本人個人標註；不得延伸至未加入課程、共享標註、回覆、匯出或即時課堂。REQ-003 完整加入流程在 6 天 MVP 暫緩，但本契約保留完整產品端點。

## 2. 通用約定

### 2.1 認證與 CSRF

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

按加入時間由新至舊，回傳課程名稱、負責老師及加入時間。

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

1. 老師／學生註冊：提交完整註冊資料並發送驗證碼 → 以同一 challenge 完成註冊 → 自動登入。
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
