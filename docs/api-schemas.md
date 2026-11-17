# My Deck API Schema 契約

- 文件版本：V0.1
- 文件狀態：已補全 P0 與完整產品 schema；待確認
- 更新時間：2026-11-17 23:02:23 HKT
- API 基準：`docs/api-design.md` V0.4
- 登入／權限基準：`docs/auth-permission-design.md` V0.2
- 需求基準：`docs/requirements.md` V0.20
- 權限基準：`docs/permissions.md` V0.9

## 1. 目的與共用規則

本文件是 FastAPI Pydantic model、OpenAPI components 及前端 TypeScript 型別的欄位級契約。端點與業務規則以 `docs/api-design.md` 為準；本文件不重述流程，只固定 schema、必填欄位、型別及限制。

1. JSON 欄位統一 `camelCase`；Pydantic 使用 alias 對應 Python `snake_case`。
2. request／response model 預設 `extra="forbid"`；不得接受未宣告欄位。
3. ID、時間、頁碼、版本及狀態均由服務端產生或最終判定；用戶端不得指定他人作者或角色。
4. 寫入端點的欄位驗證失敗回 `400 VALIDATION_ERROR`；業務拒絕使用 `docs/api-design.md` 的穩定錯誤碼。
5. 所有時間為 ISO-8601 UTC 字串；`pageIndex` 由 0 起算；標註座標為 0–1 的歸一化數值。
6. 除另有說明，列表回應均包含 `items`、`page`、`pageSize`、`total`。

## 2. 共用 scalar、enum 與 envelope

| 名稱 | JSON 型別 | 規則 |
|---|---|---|
| `Id` | string | 非空；服務端產生，格式如 `usr_`、`crs_`、`cw_`、`cls_` 前綴 |
| `IsoDateTime` | string | RFC 3339／ISO-8601 UTC，例：`2026-11-17T23:00:00Z` |
| `Role` | string enum | `TEACHER`、`STUDENT`、`ADMIN`；訪客不是帳號角色 |
| `ParticipantRole` | string enum | `TEACHER`、`STUDENT`、`GUEST` |
| `CoursewareStatus` | string enum | `PENDING`、`CONVERTING`、`SUCCESS`、`SUCCESS_WITH_WARNINGS`、`FAILED`、`TIMED_OUT` |
| `ClassroomStatus` | string enum | `LIVE`、`ENDED`、`DELETED` |
| `Visibility` | string enum | `VISIBLE`、`HIDDEN`、`CLEARED` |
| `ActivityType` | string enum | `ATTENDANCE`、`SINGLE_CHOICE`、`MULTIPLE_CHOICE`、`TRUE_FALSE`、`POLL` |
| `ActivityStatus` | string enum | `DRAFT`、`OPEN`、`CLOSED` |
| `ExportFormat` | string enum | `PPT`、`PPTX` |
| `ExportStatus` | string enum | `QUEUED`、`PROCESSING`、`SUCCESS`、`FAILED`、`EXPIRED` |
| `AdminScope` | string enum | `account_manage`、`classroom_ops`、`audit_read`；`content_read` 預設關閉 |
| `PageIndex` | integer | `>= 0`，並須小於實際 `pageCount` |
| `Version` | integer | `>= 1`，用於樂觀鎖 |
| `StateVersion` | integer | `>= 1`，每個課堂遞增 |
| `Position` | object | `{ x: number, y: number }`，兩者均為 0–1 |

### 2.1 分頁

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `items` | array | 是 | 各端點指定的 item schema |
| `page` | integer | 是 | `>= 1` |
| `pageSize` | integer | 是 | 1–100，預設 20 |
| `total` | integer | 是 | `>= 0` |

### 2.2 ErrorEnvelope（錯誤 envelope）

`ErrorEnvelope` 是所有 4xx／5xx 回應的統一 response model；成功回應不得使用此外層。

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `code` | string | 是 | 穩定錯誤碼，不直接顯示例外或 SQL |
| `message` | string | 是 | 可供使用者理解的訊息 |
| `requestId` | string | 是 | 服務端追蹤 ID |
| `fieldErrors` | object／null | 否 | 欄位名稱對應錯誤陣列 |
| `retryable` | boolean | 是 | 是否可安全重試 |

### 2.3 冪等與版本標頭

| 名稱 | 位置 | 必填時機 | 規則 |
|---|---|---|---|
| `Idempotency-Key` | HTTP header | 建立、提交、結束、刪除、匯出 | 相同 key 只對應同一操作；內容不同回 `409 IDEMPOTENCY_CONFLICT` |
| `expectedVersion` | body | 標註／回覆修改、刪除 | 版本不符回 `409 VERSION_CONFLICT` |
| `expectedStateVersion` | body | 翻頁、共享標註、活動及課堂操作 | 舊版本不得覆蓋新狀態 |
| `lastStateVersion` | Socket.IO join／snapshot query | 重連 | 只用於判斷是否需要完整快照 |

## 3. 認證與帳號 schema

### 3.1 `User`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 使用者 ID |
| `displayName` | string | 是 | trim 後 2–30 字元 |
| `role` | Role | 是 | 服務端帳號角色 |
| `identifier` | string | 是 | 已驗證手機或電郵；回應可遮罩 |
| `status` | string enum | 是 | `ACTIVE`、`DISABLED` |

### 3.2 註冊驗證碼

`RegisterStartRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `identifier` | string | 是 | `+852` 8 位手機或合法電郵 |
| `displayName` | string | 是 | trim 後 2–30 字元 |
| `role` | string enum | 是 | 只可 `TEACHER` 或 `STUDENT` |
| `password` | string | 是 | 8–64 個 Unicode 字元，不 trim；`zxcvbn >= 3` |

`RegisterStartResponse`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `challengeId` | Id | 是 | 綁定完整註冊內容摘要 |
| `deliveryHint` | string | 是 | 遮罩後的手機／電郵 |
| `expiresAt` | IsoDateTime | 是 | 驗證碼到期時間 |
| `resendAvailableAt` | IsoDateTime | 是 | 可重發時間 |

`RegisterCompleteRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `challengeId` | Id | 是 | 必須與發送時相同 |
| `code` | string | 是 | 驗證碼；不得出現在日誌 |

`RegisterCompleteResponse`：`201`，欄位為 `user: User`、`session: SessionInfo`。服務端重新檢查 challenge、用途、完整註冊內容摘要及識別資料唯一性，不允許註冊時替換 displayName、role 或 password。

### 3.3 登入、登出、目前使用者

`LoginRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `identifier` | string | 是 | 已驗證手機或電郵 |
| `password` | string | 是 | 密碼，不寫入日誌 |

`SessionInfo`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `expiresAt` | IsoDateTime | 是 | 目前工作階段到期時間 |
| `absoluteExpiresAt` | IsoDateTime | 是 | 最長 30 天絕對到期時間 |

`LoginResponse`：`200`，`user: User`、`session: SessionInfo`。

`LogoutResponse`：`204`，空 body；撤銷目前裝置工作階段。

`MeResponse`：`200`，直接回傳 `User`；未登入或失效回 `401`。

`CsrfResponse`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `csrfToken` | string | 是 | 綁定目前 Session，不放在 localStorage |
| `headerName` | string | 是 | 固定 `X-CSRF-Token` |

### 3.4 忘記密碼

`PasswordResetStartRequest`：`identifier: string`。

`PasswordResetStartResponse`：`challengeId`、`deliveryHint`、`expiresAt`、`resendAvailableAt`；無論帳號是否存在都使用一致防列舉回饋。

`PasswordResetCompleteRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `challengeId` | Id | 是 | 綁定重設用途及識別資料 |
| `code` | string | 是 | 重設驗證碼 |
| `newPassword` | string | 是 | 與註冊相同密碼規則 |

成功回 `204`，撤銷該帳號全部工作階段。

## 4. 課程 schema

### 4.1 `CourseSummary`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 課程 ID |
| `name` | string | 是 | trim 後 1–50 字元 |
| `code` | string | 是 | 固定 8 位，排除 `0/O/1/I` |
| `teacherName` | string | 是 | 負責老師顯示名稱 |
| `createdAt` | IsoDateTime | 是 | 建立時間 |

`CourseCreateRequest`：`name: string`，trim 後 1–50 字元。

`CourseCreateResponse`：`201`，`course: CourseSummary`。

`CourseListResponse`：`items: CourseSummary[]` 加分頁欄位；老師只看本人負責課程。

### 4.2 `CourseMembershipSummary`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `membershipId` | Id | 是 | 成員記錄 ID |
| `course` | CourseSummary | 是 | 只含學生可見基本資料 |
| `joinedAt` | IsoDateTime | 是 | 首次加入時間 |

`MembershipListResponse`：`items: CourseMembershipSummary[]` 加分頁欄位；按加入時間新至舊。

`JoinCourseRequest`：`code: string`，trim、轉大寫後 8 位合法字元。

`JoinCourseResponse`：`membership: { id, joinedAt }`、`course: CourseSummary`。重複加入返回原記錄，不改寫 `joinedAt`。

### 4.3 `CourseDetail`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 課程 ID |
| `name` | string | 是 | 課程名稱 |
| `code` | string | 老師必填；學生可選 | 學生不必持續看到課程碼 |
| `teacherName` | string | 是 | 負責老師 |
| `createdAt` | IsoDateTime | 是 | 建立時間 |
| `canManage` | boolean | 是 | 只有負責老師為 true |
| `coursewares` | CoursewareSummary[] | 是 | 只含目前角色可見課件 |

學生回應不得包含完整成員名單或原始 PPT 下載權。

## 5. 課件上傳、轉換與預覽 schema

### 5.1 上傳

`UploadCreateRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `fileName` | string | 是 | 原始檔名，只作顯示，不作唯一鍵 |
| `byteSize` | integer | 是 | 1–104,857,600 bytes |
| `contentType` | string | 是 | `.ppt`／`.pptx` 對應 MIME；服務端重新檢查實際格式 |

`UploadCreateResponse`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `uploadId` | Id | 是 | 同一上傳操作的冪等識別 |
| `method` | string | 是 | 固定 `PUT` |
| `uploadUrl` | string | 是 | 私有儲存單次預簽 URL |
| `headers` | object | 是 | 必須附帶的標頭 |
| `expiresAt` | IsoDateTime | 是 | 預簽 URL 到期時間 |

`UploadCompleteRequest`：`uploadId: Id`、`checksum: string`。

### 5.2 `CoursewareSummary`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 課件 ID |
| `fileName` | string | 是 | 原始檔名 |
| `byteSize` | integer | 是 | 原檔位元組大小 |
| `pageCount` | integer／null | 是 | 成功解析後 1–100；未完成可為 null |
| `status` | CoursewareStatus | 是 | 服務端狀態 |
| `version` | Version | 是 | 上傳版本 |
| `updatedAt` | IsoDateTime | 是 | 最後狀態更新時間 |

`CoursewareDetail` 在老師端額外包含：

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `conversionDueAt` | IsoDateTime／null | 是 | 5 分鐘期限，只供老師 |
| `latestAttemptId` | Id／null | 是 | 最新轉換嘗試 |
| `failureHistory` | array | 是 | 失敗／逾時歷史，不對學生開放 |
| `canRetry` | boolean | 是 | 只有失敗／逾時且無進行中工作時 true |
| `canPreview` | boolean | 是 | 只有成功狀態 true |

學生 `CoursewareSummary` 只含 `id`、`fileName`、`status`、`pageCount`、`updatedAt`，不含失敗歷史、內部嘗試或 `conversionDueAt`。

### 5.3 預覽與重試

`PreviewPage`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `pageIndex` | PageIndex | 是 | 0 起算 |
| `imageUrl` | string | 是 | 授權頁面資源 URL |
| `thumbnailUrl` | string | 是 | 授權縮圖 URL |
| `width` | integer | 是 | 實際輸出寬度 |
| `height` | integer | 是 | 實際輸出高度 |
| `compatibilityWarnings` | string[] | 是 | 可為空陣列 |

`PreviewResponse`：`coursewareId`、`version`、`pageCount`、`pages: PreviewPage[]`、`warnings: string[]`。

`RetryConversionRequest`：`expectedVersion: Version`。

`RetryConversionResponse`：`202`，`attemptId`、`status: PENDING`、`coursewareVersion`。

## 6. 個人文字標註 schema

### 6.1 `PersonalAnnotation`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 標註 ID |
| `coursewareId` | Id | 是 | 課件 ID |
| `coursewareVersion` | Version | 是 | 對應課件版本 |
| `pageIndex` | PageIndex | 是 | 頁碼 |
| `content` | string | 是 | trim 後 1–100 字元 |
| `position` | Position | 是 | 歸一化座標 |
| `authorId` | Id | 是 | 只能是目前學生 |
| `version` | Version | 是 | 樂觀鎖版本 |
| `createdAt` | IsoDateTime | 是 | 建立時間 |
| `updatedAt` | IsoDateTime | 是 | 最後修改時間 |

`PersonalAnnotationCreateRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `pageIndex` | PageIndex | 是 | 必須存在於課件 |
| `content` | string | 是 | trim 後保存及計長，1–100 字元 |
| `position` | Position | 是 | x、y 均 0–1 |

`PersonalAnnotationUpdateRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `content` | string | 否 | 可提供；trim 後 1–100 字元 |
| `position` | Position | 否 | 可提供；只移動本人標註 |
| `expectedVersion` | Version | 是 | 必須符合目前版本 |

`content` 與 `position` 至少提供一項；可獨立或同時更新。成功回傳完整 `PersonalAnnotation`，`version` 遞增。

`PersonalAnnotationListResponse`：`items: PersonalAnnotation[]` 加分頁欄位；只回傳目前學生本人標註。老師、其他學生、訪客及管理員均無個人標註內容端點。

## 7. 即時課堂 schema

### 7.1 `Classroom`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 課堂 ID |
| `courseId` | Id | 是 | 所屬課程 |
| `name` | string | 是 | 課堂名稱 |
| `code` | string | 老師／加入時必填 | 6 位大寫字母數字，排除 `0/O/1/I` |
| `coursewareId` | Id | 是 | 課件 ID |
| `coursewareVersion` | Version | 是 | 同一課件版本 |
| `status` | ClassroomStatus | 是 | 服務端狀態 |
| `pageIndex` | PageIndex | 是 | 權威目前頁 |
| `pageCount` | integer | 是 | 1–100 |
| `stateVersion` | StateVersion | 是 | 課堂遞增版本 |
| `startedAt` | IsoDateTime | 是 | 開始時間 |
| `endedAt` | IsoDateTime／null | 是 | 未結束為 null |
| `retentionUntil` | IsoDateTime／null | 是 | 結束起 168 小時 |

`ClassroomCreateRequest`：`coursewareId: Id`、`name: string`。

`ClassroomCreateResponse`：`201`，`classroom: Classroom`、`joinInfo: { code, joinUrl, canCopy }`。

### 7.2 加入與參與者

`JoinClassroomRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `code` | string | 是 | 6 位課堂碼，trim、轉大寫 |
| `guestId` | Id／null | 訪客重連必填 | 學生不使用；首次訪客可為 null |

`Participant`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 參與者 ID |
| `role` | ParticipantRole | 是 | 老師、學生或訪客 |
| `displayName` | string | 是 | 學生顯示名稱或訪客隨機名 |
| `guestId` | Id／null | 是 | 訪客唯一 ID；學生為 null |
| `canWrite` | boolean | 是 | 訪客固定 false |

`JoinClassroomResponse`：`participant: Participant`、`classroom: Classroom`、`snapshot: ClassroomSnapshot`。

訪客只在 localStorage 保存 `guestId`；失效後須確認才建立新身份。

### 7.3 快照與翻頁

`ClassroomSnapshot`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `classroom` | Classroom | 是 | 權威課堂狀態 |
| `currentPage` | PreviewPage | 是 | 目前頁資源 |
| `personalAnnotations` | PersonalAnnotation[] | 是 | 只含本人個人標註 |
| `sharedAnnotations` | SharedAnnotation[] | 是 | 學生可見共享層；訪客固定空陣列 |
| `activities` | Activity[] | 是 | 目前可見活動；訪客只含必要狀態 |

`PageChangeRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `direction` | string enum | 是 | `PREVIOUS`、`NEXT`、`GO_TO` |
| `pageIndex` | PageIndex | `GO_TO` 必填 | 其他方向不提供 |
| `expectedStateVersion` | StateVersion | 是 | 防止舊操作覆蓋新頁碼 |

`PageChangeResponse`：`classroomId`、`pageIndex`、`pageCount`、`stateVersion`、`currentPage: PreviewPage`。

`EndClassroomResponse`：`classroomId`、`status: ENDED`、`endedAt`、`retentionUntil`、`stateVersion`。

## 8. 共享標註與回覆 schema

### 8.1 `SharedAnnotation`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 共享標註 ID |
| `classroomId` | Id | 是 | 所屬課堂 |
| `pageIndex` | PageIndex | 是 | 頁碼 |
| `groupId` | Id | 是 | 明確標記群組，不依距離合併 |
| `content` | string | 是 | trim 後 1–100 字元 |
| `position` | Position | 是 | 歸一化座標 |
| `author` | `{ id, displayName, role }` | 是 | 作者名稱、角色及樣式依據 |
| `visibility` | Visibility | 是 | 老師管理狀態 |
| `version` | Version | 是 | 樂觀鎖版本 |
| `createdAt` | IsoDateTime | 是 | 建立時間 |
| `replies` | SharedReply[] | 是 | 獨立回覆，不覆蓋原文 |

`SharedAnnotationCreateRequest`：`pageIndex`、`groupId`、`content`、`position`、`expectedStateVersion`。

`SharedAnnotationUpdateRequest`：可選 `content`、`position`，加必填 `expectedVersion`；不得修改作者或群組。

`SharedVisibilityRequest`：`visibility: VISIBLE|HIDDEN`、`expectedVersion`。

`ClearSharedAnnotationsRequest`：`pageIndex`、`confirm: true`、`expectedStateVersion`。

`SharePermissionRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `granted` | boolean | 是 | true 授權，false 收回 |
| `reason` | string | 否 | 收回時建議記錄 |

收回後保留既有共享內容，但禁止該學生新增、修改、移動或刪除。

### 8.2 `SharedReply`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 回覆 ID |
| `annotationId` | Id | 是 | 目標共享標註 |
| `content` | string | 是 | trim 後 1–100 字元 |
| `author` | `{ id, displayName, role }` | 是 | 必須為負責老師 |
| `version` | Version | 是 | 回覆版本 |
| `createdAt` | IsoDateTime | 是 | 建立時間 |

`ReplyCreateRequest`：`content`、`expectedVersion`（目標標註版本）。

`ReplyUpdateRequest`：`content`、`expectedVersion`（回覆版本）。老師只能修改／刪除自己的回覆，不得改學生原文；學生不可回覆。

## 9. 簽到、答題與統計 schema

### 9.1 `ActivityOption`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | string | 是 | 選項識別，如 `A`、`B` |
| `text` | string | 是 | trim 後 1–100 字元 |

### 9.2 `ActivityCreateRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `type` | ActivityType | 是 | 簽到、單選、多選、判斷或投票 |
| `question` | string | 答題必填 | trim 後 1–200 字元；簽到可省略 |
| `options` | ActivityOption[] | 答題必填 | 2–6 個；判斷固定正誤 |
| `correctOptionIds` | string[] | 客觀題必填 | 單選恰一個，多選至少一個；投票為空 |
| `expectedStateVersion` | StateVersion | 是 | 課堂版本 |

### 9.3 `Activity`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 活動 ID |
| `classroomId` | Id | 是 | 所屬課堂 |
| `type` | ActivityType | 是 | 活動類型 |
| `question` | string／null | 是 | 簽到可為 null |
| `status` | ActivityStatus | 是 | 服務端狀態 |
| `options` | ActivityOption[] | 是 | 學生只見可公開欄位 |
| `submissionCount` | integer | 是 | 有效提交數 |
| `participantCount` | integer | 是 | 可參與學生數，不含訪客 |
| `stateVersion` | StateVersion | 是 | 課堂版本 |
| `publishedAt` | IsoDateTime／null | 是 | 發布時間 |
| `closedAt` | IsoDateTime／null | 是 | 結束時間 |

學生端 `Activity` 在結束前不得包含 `correctOptionIds`；老師端可包含。

### 9.4 提交與結果

`SubmissionCreateRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `answers` | string[] | 答題必填 | 單選一項，多選至少一項，判斷固定正誤 |
| `expectedStateVersion` | StateVersion | 是 | 活動必須 OPEN |

`Submission`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 提交 ID |
| `activityId` | Id | 是 | 活動 ID |
| `studentId` | Id | 老師端必填 | 學生本人端可省略 |
| `answers` | string[] | 是 | 簽到可為空陣列 |
| `submittedAt` | IsoDateTime | 是 | 首次有效提交時間 |

`ActivityResults`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `activityId` | Id | 是 | 活動 ID |
| `submissionCount` | integer | 是 | 有效提交人數 |
| `optionCounts` | object | 是 | 選項 ID 對應人數；簽到可為空 |
| `correctOptionIds` | string[] | 老師必填 | 學生只可在結束後取得 |
| `computedAt` | IsoDateTime | 是 | 統計計算時間 |

`StudentResult`：`submission: Submission`、`correctOptionIds: string[]／null`、`isCorrect: boolean／null`。活動結束前 `correctOptionIds` 必為 null。

## 10. 摘要、匯出與刪除 schema

### 10.1 `ClassroomSummary`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `classroom` | Classroom | 是 | 課堂資料 |
| `attendance` | ActivityResults[] | 老師必填 | 老師簽到摘要；學生不包含全班資料 |
| `quizResults` | ActivityResults[] | 老師必填 | 老師答題／投票摘要 |
| `sharedAnnotations` | SharedAnnotation[] | 是 | 老師看共享層；學生只看本人共享及相關回覆 |
| `personalAnnotations` | PersonalAnnotation[] | 學生必填 | 只含本人個人標註；老師端必為空 |
| `expiresAt` | IsoDateTime | 是 | 168 小時到期時間 |

### 10.2 匯出

`ExportCreateRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `format` | ExportFormat | 是 | PPT 或 PPTX |
| `scope` | string enum | 是 | 老師 `CLASSROOM_SHARED`；學生只可 `STUDENT_OWN` |

`ExportJob`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 匯出工作 ID |
| `classroomId` | Id | 是 | 課堂 ID |
| `format` | ExportFormat | 是 | 格式 |
| `scope` | string | 是 | 匯出範圍 |
| `status` | ExportStatus | 是 | 狀態 |
| `fileName` | string／null | 是 | 安全處理後的 `課堂名_老師名` 加副檔名 |
| `downloadAvailableAt` | IsoDateTime／null | 是 | 可下載時間 |
| `expiresAt` | IsoDateTime | 是 | 下載到期時間 |
| `createdAt` | IsoDateTime | 是 | 建立時間 |

### 10.3 刪除

`DeleteClassroomRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `confirmClassroomName` | string | 是 | 必須與課堂名稱完全一致 |
| `reason` | string | 是 | 刪除原因，納入審計 |

管理員另須 `confirm: true` 及 `require_admin_scope("classroom_ops", reason)`。

## 11. 管理員 schema

### 11.1 `AdminStatusUpdateRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `status` | string enum | 是 | `ACTIVE`、`DISABLED` |
| `reason` | string | 是 | 非空，納入審計 |

### 11.2 `AdminActionRequest`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `reason` | string | 是 | 安全／營運原因 |
| `confirm` | boolean | 是 | 必須為 true |

### 11.3 `AdminOperation`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `operationId` | Id | 是 | 管理操作 ID |
| `scope` | AdminScope | 是 | 實際使用 scope |
| `actorAdminId` | Id | 是 | 操作管理員 |
| `targetType` | string | 是 | `USER`、`COURSE`、`CLASSROOM` 等 |
| `targetId` | Id | 是 | 目標 ID |
| `reason` | string | 是 | 操作原因 |
| `createdAt` | IsoDateTime | 是 | 審計時間 |

### 11.4 `AuditRecord`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `id` | Id | 是 | 審計記錄 ID |
| `category` | string enum | 是 | `SHARED_ANNOTATION`、`ATTENDANCE`、`QUIZ`、`DELETION` |
| `classroomId` | Id／null | 是 | 相關課堂 |
| `actorId` | Id／null | 是 | 操作者；系統操作可為 null |
| `action` | string | 是 | 審計動作 |
| `summary` | object | 是 | 必要欄位及摘要，不默認完整內容 |
| `reason` | string／null | 是 | 高風險操作原因 |
| `createdAt` | IsoDateTime | 是 | 發生時間 |

管理員審計 schema 不包含個人標註內容、原始 PPT、學生個人匯出或已刪內容。

## 12. Socket.IO event payload schema

### 12.1 `ClassroomJoinPayload`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `classroomId` | Id | 是 | 已加入課堂 |
| `lastStateVersion` | StateVersion | 否 | 重連時提供 |

### 12.2 `ClassroomSnapshotEvent`

| 欄位 | 型別 | 必填 | 規則 |
|---|---|---|---|
| `classroom` | Classroom | 是 | 權威狀態 |
| `page` | PreviewPage | 是 | 目前頁 |
| `stateVersion` | StateVersion | 是 | 快照版本 |
| `sharedAnnotations` | SharedAnnotation[] | 是 | 訪客固定空陣列 |
| `activities` | Activity[] | 是 | 目前可見活動 |

### 12.3 其他事件

| Event | payload |
|---|---|
| `page:changed` | `{ classroomId, pageIndex, pageCount, stateVersion, currentPage: PreviewPage }` |
| `shared-annotation:changed` | `{ classroomId, annotationId, groupId, operation: CREATED／UPDATED／DELETED／VISIBILITY_CHANGED／CLEARED, stateVersion }` |
| `activity:changed` | `{ classroomId, activityId, status: ActivityStatus, stateVersion }` |
| `classroom:ended` | `{ classroomId, endedAt, retentionUntil, stateVersion }` |
| `error` | `{ code, message, requestId, retryable }` |

所有事件必須由服務端發出並攜帶 `stateVersion`；用戶端忽略舊版本，不以事件直接宣告寫入成功。

## 13. Endpoint ↔ schema 對應

| 端點群組 | Request schema | Response schema |
|---|---|---|
| 註冊驗證碼／完成註冊 | `RegisterStartRequest`、`RegisterCompleteRequest` | `RegisterStartResponse`、`RegisterCompleteResponse` |
| 登入／登出／me／CSRF | `LoginRequest` | `LoginResponse`、`LogoutResponse`、`MeResponse`、`CsrfResponse` |
| 忘記密碼 | `PasswordResetStartRequest`、`PasswordResetCompleteRequest` | `PasswordResetStartResponse`、204 |
| 建立／列出課程 | `CourseCreateRequest` | `CourseCreateResponse`、`CourseListResponse` |
| 學生課程成員列表 | query 分頁 | `MembershipListResponse` |
| 課程碼加入 | `JoinCourseRequest` | `JoinCourseResponse` |
| 課程詳情 | path `courseId` | `CourseDetail` |
| 建立上傳／完成上傳 | `UploadCreateRequest`、`UploadCompleteRequest` | `UploadCreateResponse`、`CoursewareDetail` |
| 課件列表／詳情／狀態 | path／query | `CoursewareSummary[]`、`CoursewareDetail` |
| 課件預覽 | path `coursewareId` | `PreviewResponse` |
| 重新轉換 | `RetryConversionRequest` | `RetryConversionResponse` |
| 個人標註 CRUD | `PersonalAnnotationCreateRequest`、`PersonalAnnotationUpdateRequest` | `PersonalAnnotation`、`PersonalAnnotationListResponse` |
| 建立／查看課堂 | `ClassroomCreateRequest` | `ClassroomCreateResponse`、`Classroom` |
| 加入課堂 | `JoinClassroomRequest` | `JoinClassroomResponse` |
| 課堂快照 | `lastStateVersion` query | `ClassroomSnapshot` |
| 翻頁 | `PageChangeRequest` | `PageChangeResponse` |
| 結束課堂 | path＋Idempotency-Key | `EndClassroomResponse` |
| 共享標註 CRUD | `SharedAnnotationCreateRequest`、`SharedAnnotationUpdateRequest` | `SharedAnnotation` |
| 老師回覆 | `ReplyCreateRequest`、`ReplyUpdateRequest` | `SharedReply` |
| 共享權限／可見性／清除 | `SharePermissionRequest`、`SharedVisibilityRequest`、`ClearSharedAnnotationsRequest` | 更新後 `SharedAnnotation` 或 `ClassroomSnapshot` |
| 活動建立／發布／結束 | `ActivityCreateRequest` | `Activity` |
| 活動提交 | `SubmissionCreateRequest` | `Submission` |
| 活動結果 | path | `ActivityResults`、`StudentResult` |
| 課堂摘要 | path | `ClassroomSummary` |
| 匯出 | `ExportCreateRequest` | `ExportJob` |
| 刪除課堂 | `DeleteClassroomRequest` | 204 或刪除結果 |
| 管理員帳號／課程／課堂 | `AdminStatusUpdateRequest`、`AdminActionRequest` | `AdminOperation` |
| 管理員審計 | query 篩選 | `AuditRecord[]` 加分頁欄位 |

## 14. FastAPI／OpenAPI／前端落地規則

1. 每個 FastAPI route 必須設定 `response_model`；成功、201、202、204、400、401、403、404、409、410、422、429、500、503 的 schema 與本文件一致。
2. Pydantic model 使用 `ConfigDict(extra="forbid", populate_by_name=True, alias_generator=to_camel)`；必填／可選及 nullability 不得與本文件不同。
3. request model 負責格式及長度校驗；角色、課程歸屬、資源狀態、作者所有權、活動開放狀態及正確答案公開時機由服務端再次判定。
4. OpenAPI `components.schemas` 以本文件的 model 名稱註冊；錯誤 envelope 共用 `ApiError`，不得每條路由自訂不同錯誤格式。
5. 前端只使用 `openapi-typescript` 生成型別及 `openapi-fetch` 呼叫；不得手寫另一份漂移的 interface。
6. Socket.IO 事件在前端建立獨立 event map，與第 12 節一致；版本檢查及 snapshot 重連放入共用邏輯。
7. 任何 schema 改動須同步更新本文件、`docs/api-design.md`、OpenAPI、前端生成型別及權限 dependency，並在 PR 顯示契約 diff。

## 15. 驗收清單

- P0 與完整產品端點均有 request／response schema，無只寫「回傳物件」而未定型欄位的情況。
- 所有列舉值、必填欄位、nullability、頁碼、版本、時間及分頁格式一致。
- 老師／學生課件 response schema 分離，學生看不到失敗歷史及內部排程資料。
- 個人標註只可由本人讀寫；管理員沒有個人標註內容 schema 或端點。
- 老師／學生共享標註、回覆、活動及匯出 schema 不泄露未授權資料。
- OpenAPI 生成的 TypeScript 型別可直接對應本文件，前後端可并行開發及後期對接。
