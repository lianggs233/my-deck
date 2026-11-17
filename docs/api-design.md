# My Deck MVP API 設計

- 文件版本：V0.1
- 文件狀態：待確認
- 建立時間：2026-11-17 16:16:36 HKT
- 適用範圍：`docs/mvp-priority.md` V0.1 的 P0 MVP
- 需求基準：`docs/requirements.md` V0.17、`docs/permissions.md` V0.6
- 技術基準：`docs/tech-stack.md` V0.3，後端採 FastAPI
- 範圍假設：「標簽功能」暫按 **PPT 個人文字標註**設計；課程分類標籤不在本版

## 1. 設計原則

1. 基礎路徑為 `/api/v1`；資源名稱使用小寫英文及連字號。
2. 一般請求與回應使用 JSON；檔案本體透過私有物件儲存的上傳 URL 傳輸，不由 FastAPI 進程長時間持有 100 MiB 請求內容。
3. 身份、角色、課程歸屬及資源所有權一律由服務端根據工作階段判定，不接受用戶端指定操作者 ID。
4. 建立課程、加入課程、完成上傳、重新轉換及建立標註均須支援安全重試。
5. 所有時間使用 UTC ISO 8601；檔案大小使用 bytes；標註座標使用相對頁面寬高的 `0–1` 浮點數。
6. 本版只設計 P0；即時課堂、共享標註、簽到、答題、統計、匯出、刪除及管理員 API 不在本版。

## 2. 通用約定

### 2.1 認證與 CSRF

- 登入成功後以 `Secure`、`HttpOnly`、`SameSite=Lax` 的 `mydeck_session` Cookie 維持工作階段。
- 所有會改變資料的請求，除登入及註冊相關端點外，必須帶 `X-CSRF-Token`；Token 由登入或 `GET /auth/me` 回應取得。
- 前端與 API 在正式環境使用相同站點；開發環境由 Vite proxy 轉發，避免跨站 Cookie 差異。

### 2.2 冪等

以下端點必須接受 `Idempotency-Key`：

- `POST /courses`
- `POST /courses/join`
- `POST /courses/{courseId}/coursewares/uploads`
- `POST /courses/{courseId}/coursewares/uploads/{uploadId}/complete`
- `POST /coursewares/{coursewareId}/conversion-attempts`
- `POST /coursewares/{coursewareId}/pages/{pageNumber}/annotations`

同一使用者的相同 Key 與相同請求內容返回原結果；相同 Key 但內容不同返回 `409 IDEMPOTENCY_CONFLICT`。加入課程及標註另以業務唯一鍵兜底。

### 2.3 分頁

查詢參數：`page` 從 1 開始，`pageSize` 預設 20、最大 50。

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

### 2.4 錯誤格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "請檢查輸入內容",
    "fields": {
      "displayName": "顯示名稱須為 2–30 個字元"
    },
    "requestId": "req_01J..."
  }
}
```

常用 HTTP 狀態：`400` 格式錯誤、`401` 未登入或工作階段失效、`403` 無權、`404` 資源不存在或不可見、`409` 狀態／唯一性衝突、`413` 檔案過大、`422` 業務校驗失敗、`429` 限流、`500` 服務失敗。限流回應附 `Retry-After`。

## 3. 帳號與工作階段

### 3.1 端點

| 方法 | 路徑 | 用途 | 成功回應 |
|---|---|---|---|
| POST | `/auth/register/verification-codes` | 發送註冊擁有者驗證碼 | 202 |
| POST | `/auth/register` | 驗證碼校驗並建立老師或學生帳號 | 201，同時建立工作階段 |
| POST | `/auth/login` | 手機號碼或電郵加密碼登入 | 200 |
| POST | `/auth/logout` | 登出目前裝置 | 204 |
| GET | `/auth/me` | 取得目前使用者、角色及 CSRF Token | 200 |

### 3.2 發送註冊驗證碼

```json
{
  "identifier": "user@example.com"
}
```

回應：

```json
{
  "verificationId": "ver_01J...",
  "maskedIdentifier": "u***@example.com",
  "expiresAt": "2026-11-17T08:30:00Z",
  "resendAfterSeconds": 60
}
```

手機只接受香港 `+852` 8 位本地號碼，服務端正規化為 `+852XXXXXXXX`；電郵按既有需求校驗。回應不得暴露驗證碼。

### 3.3 註冊

```json
{
  "verificationId": "ver_01J...",
  "verificationCode": "123456",
  "displayName": "陳老師",
  "role": "teacher",
  "password": "使用者輸入的密碼"
}
```

`role` 只接受 `teacher`、`student`；顯示名稱 trim 後 2–30 字元；密碼為 8–64 個 Unicode 字元並按共同測試向量達到 `zxcvbn` 至少 3 分。識別資料已被有效帳號使用時返回 `409 IDENTIFIER_EXISTS`，但驗證碼發送端點不得成為帳號列舉途徑。

### 3.4 登入及目前使用者

登入請求：

```json
{
  "identifier": "user@example.com",
  "password": "使用者輸入的密碼"
}
```

登入及 `/auth/me` 的使用者資料：

```json
{
  "user": {
    "id": "usr_01J...",
    "displayName": "陳老師",
    "role": "teacher"
  },
  "csrfToken": "csrf_...",
  "sessionExpiresAt": "2026-11-24T08:00:00Z"
}
```

## 4. 課程

### 4.1 端點

| 方法 | 路徑 | 用途 | 權限 |
|---|---|---|---|
| POST | `/courses` | 建立課程並產生固定 8 位課程碼 | 老師 |
| GET | `/courses` | 查看本人教授或已加入課程 | 老師／學生 |
| GET | `/courses/{courseId}` | 查看課程基本資料及本人上下文 | 負責老師／已加入學生 |
| POST | `/courses/join` | 使用課程碼加入課程 | 學生 |

### 4.2 建立課程

請求：

```json
{
  "name": "中國語文"
}
```

回應 `201`：

```json
{
  "id": "crs_01J...",
  "name": "中國語文",
  "code": "ABCD2345",
  "teacher": {
    "id": "usr_01J...",
    "displayName": "陳老師"
  },
  "createdAt": "2026-11-17T08:00:00Z"
}
```

名稱 trim 後 1–50 字元，允許同名；課程碼只含排除 `0/O/1/I` 的大寫字母及數字，資料庫保證全域唯一。

### 4.3 課程列表與詳情

`GET /courses?scope=teaching&page=1&pageSize=20`：

- 老師使用 `scope=teaching`，按建立時間由新至舊。
- 學生使用 `scope=learning`，按加入時間由新至舊。
- 角色與 scope 不符時返回 `403 FORBIDDEN`，不接受以查詢參數提升權限。

老師項目包含 `id`、`name`、`code`、`createdAt`、`coursewareCount`；學生項目包含 `id`、`name`、`teacher`、`joinedAt`，不返回完整成員名單或原始 PPT 下載權限。

### 4.4 加入課程

```json
{
  "courseCode": "ABCD2345"
}
```

首次加入返回 `201`，重複加入返回 `200` 及原成員資料：

```json
{
  "course": {
    "id": "crs_01J...",
    "name": "中國語文",
    "teacher": {
      "displayName": "陳老師"
    }
  },
  "joinedAt": "2026-11-17T08:10:00Z",
  "alreadyJoined": false
}
```

課程碼自動 trim 及轉大寫，只接受 8 位合法字元；無效碼返回 `422 COURSE_CODE_INVALID`，不可加入返回 `409 COURSE_NOT_JOINABLE`，頻繁無效嘗試返回 `429 RATE_LIMITED`。

## 5. PPT 上傳、轉換與預覽

### 5.1 端點

| 方法 | 路徑 | 用途 | 權限 |
|---|---|---|---|
| POST | `/courses/{courseId}/coursewares/uploads` | 建立單檔上傳工作及私有儲存 URL | 負責老師 |
| POST | `/courses/{courseId}/coursewares/uploads/{uploadId}/complete` | 完成上傳、校驗原檔並建立待轉換課件 | 負責老師 |
| GET | `/courses/{courseId}/coursewares` | 課件列表及處理狀態 | 負責老師／已加入學生 |
| GET | `/coursewares/{coursewareId}` | 課件詳情、轉換狀態及可用頁面 | 負責老師／已加入學生 |
| POST | `/coursewares/{coursewareId}/conversion-attempts` | 失敗或逾時後在同一課件版本重新轉換 | 負責老師 |

### 5.2 建立上傳工作

請求：

```json
{
  "fileName": "第一課.pptx",
  "sizeBytes": 52428800,
  "contentType": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
}
```

回應 `201`：

```json
{
  "uploadId": "upl_01J...",
  "method": "PUT",
  "uploadUrl": "https://private-storage.example/authorized-upload",
  "requiredHeaders": {
    "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  "expiresAt": "2026-11-17T08:20:00Z"
}
```

只接受 `.ppt`／`.pptx` 及對應 MIME；上限為 `104857600` bytes。每次只建立一個上傳工作，不支援多檔、拖曳 API、雲端匯入或斷點續傳。上傳 URL 只能寫入指定暫存位置，不能成為公開讀取網址。

### 5.3 完成上傳

請求可為空 JSON `{}`。服務端重新計算位元組大小、檢查實際檔案結構、解析 1–100 頁、將原檔轉入香港私有正式儲存，再建立課件版本及待轉換工作。

回應 `202`：

```json
{
  "id": "cw_01J...",
  "courseId": "crs_01J...",
  "version": 1,
  "originalFileName": "第一課.pptx",
  "sizeBytes": 52428800,
  "pageCount": 24,
  "status": "pending",
  "uploadedAt": "2026-11-17T08:12:00Z",
  "conversionDueAt": "2026-11-17T08:17:00Z"
}
```

損毀、偽造副檔名、加密、需密碼或頁數不合法時返回 `422`；無效或不完整內容不得進入正式課件列表。

### 5.4 狀態與頁面資源

狀態列舉：`pending`、`converting`、`succeeded`、`succeeded_with_warnings`、`failed`、`timed_out`。

列表按上傳時間由新至舊，返回原始檔名、大小、實際頁數、上傳時間及狀態。列表及詳情由前端每 3 秒查詢；返回頁面立即查詢，查詢失敗保留最後已知狀態。

成功詳情可包含：

```json
{
  "id": "cw_01J...",
  "status": "succeeded",
  "pageCount": 24,
  "warnings": [],
  "pages": [
    {
      "pageNumber": 1,
      "imageUrl": "https://private-storage.example/signed-page-url",
      "thumbnailUrl": "https://private-storage.example/signed-thumbnail-url",
      "expiresAt": "2026-11-17T08:30:00Z"
    }
  ]
}
```

只有轉換成功或成功但有相容性警告才返回頁面 URL；失敗、待轉換或逾時課件不得泄露儲存位置。學生只可在已加入課程中預覽可用課件；老師的完整狀態、失敗歷史及重試權限不開放給學生。

### 5.5 重新轉換

請求可為空 JSON `{}`。只有 `failed` 或 `timed_out` 可建立新嘗試；回應 `202` 並返回新的 `attemptId` 及目前課件。進行中重複請求返回 `200` 原工作；其他狀態返回 `409 CONVERSION_NOT_RETRYABLE`。舊嘗試回調不得覆蓋最新狀態。

## 6. PPT 個人文字標註

### 6.1 端點

| 方法 | 路徑 | 用途 | 權限 |
|---|---|---|---|
| GET | `/coursewares/{coursewareId}/pages/{pageNumber}/annotations` | 查看本人在指定頁的個人標註 | 已加入課程的學生 |
| POST | `/coursewares/{coursewareId}/pages/{pageNumber}/annotations` | 建立個人文字標註 | 已加入課程的學生 |
| PATCH | `/annotations/{annotationId}` | 修改本人標註文字 | 標註作者 |
| DELETE | `/annotations/{annotationId}` | 刪除本人標註 | 標註作者 |

老師、其他學生及訪客不可讀取學生個人標註；未加入課程的學生不可存取課件頁面或建立標註。對不可見資源統一返回 `404`，避免泄露他人標註是否存在。

### 6.2 建立標註

```json
{
  "clientAnnotationId": "01JCLIENT...",
  "content": "這裡是重點",
  "position": {
    "x": 0.35,
    "y": 0.62
  }
}
```

規則：

- `content` 不可只含空白，最多 100 個 Unicode 字元。
- `x`、`y` 必須是有限數值且介於 `0` 與 `1`；相對課件頁面寬高，不使用螢幕像素。
- `clientAnnotationId` 在同一學生、課件版本及頁面內唯一，用於雙擊及重試去重。
- 頁碼必須在課件實際頁數內，課件必須已有可用頁面資源。

回應 `201`：

```json
{
  "id": "ann_01J...",
  "coursewareId": "cw_01J...",
  "coursewareVersion": 1,
  "pageNumber": 1,
  "content": "這裡是重點",
  "position": {
    "x": 0.35,
    "y": 0.62
  },
  "version": 1,
  "createdAt": "2026-11-17T08:25:00Z",
  "updatedAt": "2026-11-17T08:25:00Z"
}
```

### 6.3 修改與刪除

修改請求：

```json
{
  "content": "更新後的重點",
  "expectedVersion": 1
}
```

成功返回更新後標註並將 `version` 加 1；版本不符返回 `409 ANNOTATION_VERSION_CONFLICT`。刪除成功返回 `204`；重複刪除返回 `404 ANNOTATION_NOT_FOUND`，不得恢復或返回其他學生資料。

## 7. 最小資料實體與約束

| 實體 | 關鍵欄位／唯一性 |
|---|---|
| User | `id`、顯示名稱、角色、已驗證手機／電郵；手機及電郵分別唯一 |
| Session | 工作階段、使用者、CSRF、無活動及最長到期時間 |
| Course | 名稱、負責老師、8 位唯一課程碼、建立時間 |
| CourseMembership | 課程、學生、加入時間；`(courseId, studentId)` 唯一 |
| CoursewareUpload | 上傳 ID、課程、暫存位置、狀態、到期時間、冪等鍵 |
| Courseware | 課程、版本、原檔位置、檔名、位元組大小、頁數、上傳時間 |
| ConversionAttempt | 課件版本、嘗試序號、狀態、警告、開始／完成時間；舊回調以嘗試身份拒絕覆蓋 |
| CoursewarePage | 課件版本、頁碼、私有頁面及縮圖位置；`(coursewareId, version, pageNumber)` 唯一 |
| Annotation | 作者、課件版本、頁碼、文字、歸一化座標、版本及時間；個人標註查詢必帶作者條件 |

## 8. P0 端到端 API 流程

1. 老師發送註冊驗證碼、註冊並登入；建立課程並取得課程碼。
2. 老師建立上傳工作、向私有儲存 PUT 原檔、呼叫 complete；其後每 3 秒查詢課件狀態。
3. 學生註冊並登入，以課程碼加入課程，查看本人課程及可用課件。
4. 學生開啟課件第一頁，讀取本人標註，建立、修改及刪除文字標註。
5. 任一寫入失敗可安全重試；重新整理後以服務端工作階段及資料恢復，不由前端假造成功狀態。

## 9. 待確認邊界

1. 「標簽功能」是否確定為 PPT 個人文字標註；若是課程分類標籤，須另設 `/courses/{courseId}/tags` 等資源。
2. 為讓 P0 在不實作即時課堂的情況下完成學生標註演示，本設計暫允許 **已加入課程學生**讀取該課程成功課件的頁面並管理本人標註；這是 MVP 範圍調整，須確認後同步 `docs/permissions.md`。若不允許，REQ-006～REQ-009 的最小課堂路徑必須升為 P0。
3. 本版暫採私有儲存單次預簽 PUT 上傳，不支援分片續傳；若目標網絡或代理限制不適合直傳，須改為 FastAPI 接收 multipart 並重新估算。

## 10. 下一步實作順序

1. FastAPI 建立 `/api/v1` routers、統一錯誤 envelope、request ID、Cookie session 與 CSRF dependency。
2. 建立 Pydantic request／response schemas 及 OpenAPI 分組：`auth`、`courses`、`coursewares`、`annotations`。
3. 先完成 auth 與 courses，再接私有儲存上傳／轉換，最後完成個人標註 CRUD。
4. 以本文件產生可判定的 API 契約測試；不在原型確認前提前建立 `docs/test-cases.md`。
