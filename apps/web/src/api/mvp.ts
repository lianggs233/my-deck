import type { components } from './schema'
import { apiFetch, apiPutRaw, sha256Hex } from './http'
import type {
  ActiveClassroom,
  ActivityListResult,
  ActivityResults,
  ActivitySubmission,
  ActivityType,
  Annotation,
  AnnotationPosition,
  AuthSession,
  Classroom,
  ClassroomActivity,
  ClassroomDetail,
  ClassroomJoinInfo,
  ClassroomJoinResult,
  ClassroomLiveState,
  ClassroomPageState,
  ClassroomParticipant,
  ClassroomSnapshotResult,
  ClassroomSnapshotState,
  ConversionAttempt,
  Course,
  CourseDetail,
  CourseMembership,
  Courseware,
  CoursewareDetail,
  CoursewarePage,
  CreateAnnotationRequest,
  Page,
  PageDirection,
  RegisterRequest,
  RegistrationChallenge,
  SharedAnnotation,
  SharedAnnotationListResult,
  SharedAuthor,
  SharedReply,
  SharePermissionStudent,
  UpdateAnnotationRequest,
  User,
  UserRole,
} from '../types/domain'

/**
 * API adapter：對接 apps/api 的 MVP P0 後端。
 * 頁面只依賴這裡的 domain 型別與函式，不直接接觸 schema.d.ts。
 */

type Schemas = components['schemas']
type ApiUser = Schemas['UserPublic']
type ApiCourseSummary = Schemas['CourseSummary']
type ApiCourseDetail = Schemas['CourseDetailCourse']
type ApiMembership = Schemas['MembershipSummary']
type ApiCoursewareSummary = Schemas['CoursewareSummary']
type ApiCoursewareDetail = Schemas['CoursewareDetail']
type ApiPreviewPage = Schemas['PreviewPage']
type ApiAttempt = Schemas['ConversionAttemptItem']
type ApiAnnotation = Schemas['AnnotationItem']
type ApiRegisterStart = Schemas['RegisterStartResponse']
type ApiClassroomSummary = Schemas['ClassroomSummary']
type ApiClassroomStartResponse = Schemas['ClassroomStartResponse']
type ApiClassroomDetailResponse = Schemas['ClassroomDetailResponse']
type ApiJoinInfo = Schemas['JoinInfo']
type ApiPageState = Schemas['PageStateResponse']
type ApiClassroomLiveState = Schemas['ClassroomLiveState']
type ApiParticipant = Schemas['ParticipantSummary']
type ApiClassroomSnapshot = Schemas['ClassroomSnapshot']
type ApiClassroomJoinResponse = Schemas['ClassroomJoinResponse']
type ApiClassroomSnapshotResponse = Schemas['ClassroomSnapshotResponse']
type ApiActiveClassroomResponse = Schemas['ActiveClassroomResponse']

function toUser(user: ApiUser): User {
  return { id: user.id, displayName: user.displayName, role: user.role as UserRole }
}

function toCourse(course: ApiCourseSummary): Course {
  return { id: course.id, name: course.name, code: course.code, createdAt: course.createdAt }
}

function schoolYearOf(createdAt: string): string {
  return `${new Date(createdAt).getFullYear()} 學年`
}

function toCourseDetail(course: ApiCourseDetail): CourseDetail {
  return {
    id: course.id,
    name: course.name,
    teacherName: course.teacherName,
    code: course.code ?? undefined,
    studentCount: course.studentCount,
    schoolYear: schoolYearOf(course.createdAt),
  }
}

function toMembership(membership: ApiMembership): CourseMembership {
  return {
    id: membership.id,
    joinedAt: membership.joinedAt,
    course: {
      id: membership.course.id,
      name: membership.course.name,
      teacherName: membership.teacherName,
    },
  }
}

function toCourseware(courseId: string, item: ApiCoursewareSummary): Courseware {
  return {
    id: item.id,
    courseId,
    fileName: item.fileName,
    sizeBytes: item.byteSize,
    pageCount: item.pageCount ?? 0,
    status: item.status as Courseware['status'],
    latestAttempt: 0,
    uploadedAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function toAttempt(attempt: ApiAttempt): ConversionAttempt {
  const failed = attempt.status === 'FAILED'
  return {
    attempt: attempt.attemptNo,
    status: failed ? 'FAILURE' : 'SUCCESS',
    finishedAt: attempt.finishedAt ?? attempt.startedAt,
    summary:
      attempt.status === 'RUNNING' ? '轉換中' : failed ? (attempt.errorMessage ?? '失敗') : '成功',
  }
}

function toPage(page: ApiPreviewPage): CoursewarePage {
  return {
    pageIndex: page.index,
    pageNumber: page.index + 1,
    title: `第 ${page.index + 1} 頁`,
    imageUrl: page.full,
    thumbnailUrl: page.thumb,
    width: page.width,
    height: page.height,
  }
}

function toCoursewareDetail(
  courseId: string,
  detail: ApiCoursewareDetail,
  pages: CoursewarePage[],
): CoursewareDetail {
  return {
    ...toCourseware(courseId, detail),
    pageCount: detail.pageCount ?? pages.length,
    latestAttempt: detail.latestAttempt,
    pages,
    attempts: detail.attempts.map(toAttempt),
  }
}

function toAnnotation(annotation: ApiAnnotation): Annotation {
  return {
    id: annotation.id,
    pageIndex: annotation.pageIndex,
    content: annotation.content,
    position: annotation.position,
    version: annotation.version,
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
  }
}

export const authApi = {
  async getCurrentUser(): Promise<User | null> {
    const data = await apiFetch<{ user: ApiUser } | null>('/me', { allowUnauthorized: true })
    return data ? toUser(data.user) : null
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    const data = await apiFetch<{ user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
    })
    return { user: toUser(data.user) }
  },

  /** 免驗證碼註冊（本版本註冊流程不使用驗證碼）；成功後需另行登入 */
  async register(request: RegisterRequest): Promise<User> {
    const data = await apiFetch<{ user: ApiUser }>('/auth/register/direct', {
      method: 'POST',
      body: {
        identifier: request.identifier,
        displayName: request.displayName,
        role: request.role,
        password: request.password,
      },
    })
    return toUser(data.user)
  },

  /** 本期忘記密密碼流程：舊密碼驗證直接重設（不發驗證碼）；成功後撤銷全部工作階段 */
  async resetPasswordDirect(
    identifier: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    await apiFetch('/auth/password-reset/direct', {
      method: 'POST',
      body: { identifier, oldPassword, newPassword },
    })
  },

  /** 後續優化：驗證碼重設流程（後端端點保留，本期前端不使用） */
  async requestPasswordReset(identifier: string): Promise<RegistrationChallenge> {
    const data = await apiFetch<ApiRegisterStart>('/auth/password-reset/verification-codes', {
      method: 'POST',
      body: { identifier },
    })
    return {
      challengeId: data.challengeId,
      delivery: data.delivery.toUpperCase() === 'EMAIL' ? 'EMAIL' : 'SMS',
      resendAfterSeconds: data.resendAfter,
    }
  },

  /** 重設密碼驗證碼僅作前端格式檢查；真正驗證在 resetPassword 一併送出 */
  async verifyPasswordResetCode(challengeId: string, code: string): Promise<void> {
    if (!challengeId || code.trim().length !== 6) {
      throw new Error('請輸入 6 位驗證碼')
    }
  },

  /** 後續優化：驗證碼重設流程（後端端點保留，本期前端不使用） */
  async resetPassword(challengeId: string, code: string, password: string): Promise<void> {
    await apiFetch('/auth/password-reset', {
      method: 'POST',
      body: { challengeId, code, password },
    })
  },

  async logout(): Promise<void> {
    await apiFetch('/auth/logout', { method: 'POST' })
  },
}

export const courseApi = {
  async listTeacherCourses(): Promise<Page<Course>> {
    const data = await apiFetch<{
      items: ApiCourseSummary[]
      page: number
      pageSize: number
      total: number
    }>('/courses')
    return {
      items: data.items.map(toCourse),
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
    }
  },

  async listStudentMemberships(): Promise<Page<CourseMembership>> {
    const data = await apiFetch<{
      items: ApiMembership[]
      page: number
      pageSize: number
      total: number
    }>('/me/course-memberships')
    return {
      items: data.items.map(toMembership),
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
    }
  },

  async createCourse(name: string): Promise<Course> {
    const data = await apiFetch<{ course: ApiCourseSummary }>('/courses', {
      method: 'POST',
      body: { name },
    })
    return toCourse(data.course)
  },

  async getCourse(courseId: string): Promise<CourseDetail> {
    const data = await apiFetch<{ course: ApiCourseDetail }>(`/courses/${courseId}`)
    return toCourseDetail(data.course)
  },

  async joinByCode(code: string): Promise<CourseMembership> {
    const data = await apiFetch<{ membership: ApiMembership }>('/course-memberships/join', {
      method: 'POST',
      body: { code },
    })
    return toMembership(data.membership)
  },
}

export const coursewareApi = {
  async list(courseId: string): Promise<Page<Courseware>> {
    const data = await apiFetch<{
      items: ApiCoursewareSummary[]
      page: number
      pageSize: number
      total: number
    }>(`/courses/${courseId}/coursewares`)
    return {
      items: data.items.map((item) => toCourseware(courseId, item)),
      page: data.page,
      pageSize: data.pageSize,
      total: data.total,
    }
  },

  async get(courseId: string, coursewareId: string): Promise<CoursewareDetail> {
    const detailData = await apiFetch<{ courseware: ApiCoursewareDetail }>(
      `/courses/${courseId}/coursewares/${coursewareId}`,
    )
    let pages: CoursewarePage[] = []
    try {
      const pagesData = await apiFetch<{ pages: ApiPreviewPage[] }>(
        `/courses/${courseId}/coursewares/${coursewareId}/pages`,
      )
      pages = pagesData.pages.map(toPage)
    } catch (cause) {
      // 課件未就緒（409 COURSEWARE_NOT_READY）：以空頁面列表回傳
      if (!(cause instanceof Error && cause.name === 'COURSEWARE_NOT_READY')) throw cause
    }
    return toCoursewareDetail(courseId, detailData.courseware, pages)
  },

  /** 三步上傳：建立上傳 → PUT 原始檔案 → 完成回報（自動開始轉換） */
  async upload(courseId: string, file: File): Promise<Courseware> {
    const created = await apiFetch<{
      uploadId: string
      uploadUrl: string
      headers: Record<string, string>
    }>(`/courses/${courseId}/coursewares/uploads`, {
      method: 'POST',
      body: {
        fileName: file.name,
        byteSize: file.size,
        contentType:
          file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    })
    await apiPutRaw(created.uploadUrl, file, created.headers)
    const digest = await sha256Hex(file)
    const completed = await apiFetch<{ courseware: ApiCoursewareDetail }>(
      `/courses/${courseId}/coursewares/${created.uploadId}/upload/complete`,
      { method: 'POST', body: { sha256: digest } },
    )
    return toCoursewareDetail(courseId, completed.courseware, [])
  },

  /** 轉換失敗／逾時後重試（後端 202 非同步執行） */
  async retry(courseId: string, coursewareId: string): Promise<void> {
    await apiFetch(`/courses/${courseId}/coursewares/${coursewareId}/conversion-attempts`, {
      method: 'POST',
    })
  },
}

function toClassroom(classroom: ApiClassroomSummary): Classroom {
  return {
    id: classroom.id,
    courseId: classroom.courseId,
    coursewareId: classroom.coursewareId,
    coursewareVersion: classroom.coursewareVersion,
    name: classroom.name,
    code: classroom.code ?? undefined,
    status: classroom.status as Classroom['status'],
    pageIndex: classroom.pageIndex,
    pageCount: classroom.pageCount,
    stateVersion: classroom.stateVersion,
    startedAt: classroom.startedAt,
  }
}

function toJoinInfo(joinInfo: ApiJoinInfo): ClassroomJoinInfo {
  return { code: joinInfo.code, joinUrl: joinInfo.joinUrl, canCopy: joinInfo.canCopy }
}

function toLiveState(classroom: ApiClassroomLiveState): ClassroomLiveState {
  return {
    id: classroom.id,
    name: classroom.name,
    courseId: classroom.courseId,
    coursewareId: classroom.coursewareId,
    coursewareVersion: classroom.coursewareVersion,
    status: classroom.status as ClassroomLiveState['status'],
    pageIndex: classroom.pageIndex,
    pageCount: classroom.pageCount,
    stateVersion: classroom.stateVersion,
    startedAt: classroom.startedAt,
  }
}

function toParticipant(participant: ApiParticipant): ClassroomParticipant {
  return {
    id: participant.id,
    role: participant.role as ClassroomParticipant['role'],
    displayName: participant.displayName,
    guestId: participant.guestId ?? undefined,
    canWrite: participant.canWrite,
    canViewShared: participant.canViewShared,
  }
}

function toSnapshot(snapshot: ApiClassroomSnapshot): ClassroomSnapshotState {
  return {
    pageIndex: snapshot.pageIndex,
    pageCount: snapshot.pageCount,
    stateVersion: snapshot.stateVersion,
    status: snapshot.status as ClassroomSnapshotState['status'],
    pageImageUrl: snapshot.pageImageUrl ?? undefined,
    pageThumbUrl: snapshot.pageThumbUrl ?? undefined,
    prefetchImageUrls: snapshot.prefetchImageUrls ?? [],
  }
}

export const classroomApi = {
  /** 開始授課：建立進行中課堂並回傳課堂碼／加入連結 */
  async start(
    courseId: string,
    coursewareId: string,
    name: string,
  ): Promise<{ classroom: Classroom; joinInfo: ClassroomJoinInfo }> {
    const data = await apiFetch<ApiClassroomStartResponse>(`/courses/${courseId}/classrooms`, {
      method: 'POST',
      body: { coursewareId, name },
    })
    return { classroom: toClassroom(data.classroom), joinInfo: toJoinInfo(data.joinInfo) }
  },

  async get(courseId: string, classroomId: string): Promise<ClassroomDetail> {
    const data = await apiFetch<ApiClassroomDetailResponse>(
      `/courses/${courseId}/classrooms/${classroomId}`,
    )
    return { classroom: toClassroom(data.classroom), courseName: data.courseName }
  },

  /** 加入資訊（課堂碼＋加入連結）：僅負責老師可讀 */
  async joinInfo(classroomId: string): Promise<ClassroomJoinInfo> {
    const data = await apiFetch<{ joinInfo: ApiJoinInfo; classroomStatus: string }>(
      `/classrooms/${classroomId}/join-info`,
    )
    return toJoinInfo(data.joinInfo)
  },

  /** 翻頁：帶 expectedStateVersion，亂序請求回 409 */
  async turnPage(
    classroomId: string,
    direction: PageDirection,
    expectedStateVersion: number,
    pageIndex?: number,
  ): Promise<ClassroomPageState> {
    const data = await apiFetch<ApiPageState>(`/classrooms/${classroomId}/pages`, {
      method: 'POST',
      body: { direction, expectedStateVersion, pageIndex: pageIndex ?? null },
    })
    return {
      pageIndex: data.pageIndex,
      pageCount: data.pageCount,
      stateVersion: data.stateVersion,
    }
  },

  /** 以課堂碼加入（學生或訪客）；guest 首次加入不帶 guestId，回應會附新身份 */
  async join(code: string, guestId?: string | null): Promise<ClassroomJoinResult> {
    const data = await apiFetch<ApiClassroomJoinResponse>('/classrooms/join', {
      method: 'POST',
      body: { code, guestId: guestId ?? null },
    })
    return {
      participant: toParticipant(data.participant),
      classroom: toLiveState(data.classroom),
      snapshot: toSnapshot(data.snapshot),
    }
  },

  /** 已加入課程學生由課程入口直接加入（重複加入回傳同一參與者） */
  async joinFromCourse(classroomId: string): Promise<ClassroomJoinResult> {
    const data = await apiFetch<ApiClassroomJoinResponse>(`/classrooms/${classroomId}/join`, {
      method: 'POST',
    })
    return {
      participant: toParticipant(data.participant),
      classroom: toLiveState(data.classroom),
      snapshot: toSnapshot(data.snapshot),
    }
  },

  /** 重連／輪詢快照：老師、已加入課堂的學生或帶 guestId 的訪客 */
  async snapshot(classroomId: string, guestId?: string | null): Promise<ClassroomSnapshotResult> {
    const query = guestId ? `?guestId=${encodeURIComponent(guestId)}` : ''
    const data = await apiFetch<ApiClassroomSnapshotResponse>(
      `/classrooms/${classroomId}/snapshot${query}`,
    )
    return {
      classroom: toLiveState(data.classroom),
      snapshot: toSnapshot(data.snapshot),
      participant: data.participant ? toParticipant(data.participant) : undefined,
      courseName: data.courseName,
    }
  },

  /** 課程目前是否有進行中課堂（課程頁橫幅入口） */
  async active(courseId: string): Promise<ActiveClassroom> {
    const data = await apiFetch<ApiActiveClassroomResponse>(
      `/courses/${courseId}/classrooms/active`,
    )
    return {
      classroom: data.classroom ? toLiveState(data.classroom) : undefined,
      courseName: data.courseName,
    }
  },

  /** 即時事件串流（SSE）位址：翻頁觸發器，連線失敗時由輪詢補上 */
  eventStreamUrl(classroomId: string, guestId?: string | null): string {
    const query = guestId ? `?guestId=${encodeURIComponent(guestId)}` : ''
    return `/api/v1/classrooms/${classroomId}/events${query}`
  },

  /** 即時事件 WebSocket 位址：代理環境（Cloudflare Tunnel）下優先於 SSE */
  wsUrl(classroomId: string, guestId?: string | null): string {
    const query = guestId ? `?guestId=${encodeURIComponent(guestId)}` : ''
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${scheme}://${window.location.host}/api/v1/classrooms/${classroomId}/ws${query}`
  },
}

export const annotationApi = {
  async list(courseId: string, coursewareId: string, pageIndex: number): Promise<Annotation[]> {
    const data = await apiFetch<{ items: ApiAnnotation[] }>(
      `/courses/${courseId}/coursewares/${coursewareId}/annotations?page_index=${pageIndex}`,
    )
    return data.items.map(toAnnotation)
  },

  async create(
    courseId: string,
    coursewareId: string,
    request: CreateAnnotationRequest,
  ): Promise<Annotation> {
    const data = await apiFetch<{ annotation: ApiAnnotation }>(
      `/courses/${courseId}/coursewares/${coursewareId}/annotations`,
      { method: 'POST', body: request },
    )
    return toAnnotation(data.annotation)
  },

  async update(
    courseId: string,
    coursewareId: string,
    annotationId: string,
    request: UpdateAnnotationRequest,
  ): Promise<Annotation> {
    const data = await apiFetch<{ annotation: ApiAnnotation }>(
      `/courses/${courseId}/coursewares/${coursewareId}/annotations/${annotationId}`,
      { method: 'PATCH', body: request },
    )
    return toAnnotation(data.annotation)
  },

  async remove(courseId: string, coursewareId: string, annotationId: string): Promise<void> {
    await apiFetch(`/courses/${courseId}/coursewares/${coursewareId}/annotations/${annotationId}`, {
      method: 'DELETE',
    })
  },
}

type ApiSharedAnnotation = Schemas['SharedAnnotationItem']
type ApiSharedAnnotationListResponse = Schemas['SharedAnnotationListResponse']
type ApiSharedAnnotationResponse = Schemas['SharedAnnotationResponse']
type ApiSharedReply = Schemas['SharedReplyItem']
type ApiSharePermissionListResponse = Schemas['SharePermissionListResponse']

function toSharedReply(reply: ApiSharedReply): SharedReply {
  return {
    id: reply.id,
    author: reply.author as SharedAuthor,
    content: reply.content,
    version: reply.version,
    createdAt: reply.createdAt,
  }
}

function toSharedAnnotation(item: ApiSharedAnnotation): SharedAnnotation {
  return {
    id: item.id,
    classroomId: item.classroomId,
    pageIndex: item.pageIndex,
    groupId: item.groupId,
    content: item.content,
    position: item.position,
    author: item.author as SharedAuthor,
    visibility: item.visibility as SharedAnnotation['visibility'],
    version: item.version,
    createdAt: item.createdAt,
    replies: item.replies.map(toSharedReply),
  }
}

/** 共享標註（REQ-011～013）：課堂層級，老師與被授權學生可寫入；訪客無共享層 */
export const sharedAnnotationApi = {
  async list(
    classroomId: string,
    pageIndex: number,
    visibility?: 'ALL' | 'VISIBLE' | 'HIDDEN',
  ): Promise<SharedAnnotationListResult> {
    const query = visibility
      ? `page_index=${pageIndex}&visibility=${visibility}`
      : `page_index=${pageIndex}`
    const data = await apiFetch<ApiSharedAnnotationListResponse>(
      `/classrooms/${classroomId}/shared-annotations?${query}`,
    )
    return { items: data.items.map(toSharedAnnotation), canShare: data.canShare }
  },

  async create(
    classroomId: string,
    request: {
      pageIndex: number
      content: string
      position?: AnnotationPosition
      groupId?: string
    },
  ): Promise<SharedAnnotation> {
    const data = await apiFetch<ApiSharedAnnotationResponse>(
      `/classrooms/${classroomId}/shared-annotations`,
      { method: 'POST', body: request },
    )
    return toSharedAnnotation(data.annotation)
  },

  async update(
    classroomId: string,
    annotationId: string,
    request: { expectedVersion: number; content?: string; position?: AnnotationPosition },
  ): Promise<SharedAnnotation> {
    const data = await apiFetch<ApiSharedAnnotationResponse>(
      `/classrooms/${classroomId}/shared-annotations/${annotationId}`,
      { method: 'PATCH', body: request },
    )
    return toSharedAnnotation(data.annotation)
  },

  async remove(classroomId: string, annotationId: string): Promise<void> {
    await apiFetch(`/classrooms/${classroomId}/shared-annotations/${annotationId}`, {
      method: 'DELETE',
    })
  },

  async addReply(classroomId: string, annotationId: string, content: string): Promise<SharedReply> {
    const data = await apiFetch<{ reply: ApiSharedReply }>(
      `/classrooms/${classroomId}/shared-annotations/${annotationId}/replies`,
      { method: 'POST', body: { content } },
    )
    return toSharedReply(data.reply)
  },

  async updateReply(
    classroomId: string,
    replyId: string,
    request: { expectedVersion: number; content: string },
  ): Promise<SharedReply> {
    const data = await apiFetch<{ reply: ApiSharedReply }>(
      `/classrooms/${classroomId}/shared-annotations/replies/${replyId}`,
      { method: 'PATCH', body: request },
    )
    return toSharedReply(data.reply)
  },

  async removeReply(classroomId: string, replyId: string): Promise<void> {
    await apiFetch(`/classrooms/${classroomId}/shared-annotations/replies/${replyId}`, {
      method: 'DELETE',
    })
  },

  async setVisibility(
    classroomId: string,
    annotationId: string,
    visibility: 'VISIBLE' | 'HIDDEN',
  ): Promise<SharedAnnotation> {
    const data = await apiFetch<ApiSharedAnnotationResponse>(
      `/classrooms/${classroomId}/shared-annotations/${annotationId}/visibility`,
      { method: 'PUT', body: { visibility } },
    )
    return toSharedAnnotation(data.annotation)
  },

  async clearPage(classroomId: string, pageIndex: number): Promise<number> {
    const data = await apiFetch<{ clearedCount: number }>(
      `/classrooms/${classroomId}/shared-annotations/clear`,
      { method: 'POST', body: { pageIndex, confirm: true } },
    )
    return data.clearedCount
  },

  async listPermissions(classroomId: string): Promise<SharePermissionStudent[]> {
    const data = await apiFetch<ApiSharePermissionListResponse>(
      `/classrooms/${classroomId}/share-permissions`,
    )
    return data.items.map((item) => ({
      studentId: item.studentId,
      displayName: item.displayName,
      granted: item.granted,
    }))
  },

  async setPermission(classroomId: string, studentId: string, granted: boolean): Promise<void> {
    await apiFetch(`/classrooms/${classroomId}/students/${studentId}/share-permission`, {
      method: 'PUT',
      body: { granted },
    })
  },
}

type ApiActivityItem = Schemas['ActivityItem']
type ApiActivityListResponse = Schemas['ActivityListResponse']
type ApiActivityResponse = Schemas['ActivityResponse']
type ApiActivityResultsResponse = Schemas['ActivityResultsResponse']
type ApiSubmissionItem = Schemas['SubmissionItem']
type ApiSubmissionResponse = Schemas['SubmissionResponse']
type ApiMyResultResponse = Schemas['MyResultResponse']

function toSubmission(item: ApiSubmissionItem): ActivitySubmission {
  return {
    id: item.id,
    activityId: item.activityId,
    studentId: item.studentId,
    submittedAt: item.submittedAt,
  }
}

function toActivity(item: ApiActivityItem): ClassroomActivity {
  return {
    id: item.id,
    classroomId: item.classroomId,
    type: item.type as ActivityType,
    status: item.status as ClassroomActivity['status'],
    submissionCount: item.submissionCount,
    participantCount: item.participantCount,
    publishedAt: item.publishedAt ?? undefined,
    closedAt: item.closedAt ?? undefined,
    createdAt: item.createdAt,
    mySubmission: item.mySubmission ? toSubmission(item.mySubmission) : undefined,
  }
}

export const activityApi = {
  /** 建立簽到活動（DRAFT）；帶 Idempotency-Key 防重複建立 */
  async create(classroomId: string, idempotencyKey: string): Promise<ClassroomActivity> {
    const data = await apiFetch<ApiActivityResponse>(`/classrooms/${classroomId}/activities`, {
      method: 'POST',
      body: { type: 'CHECKIN' },
      idempotencyKey,
    })
    return toActivity(data.activity)
  },

  /** 發布活動（DRAFT→OPEN）；重複發布回 200 原狀態 */
  async publish(classroomId: string, activityId: string): Promise<ClassroomActivity> {
    const data = await apiFetch<ApiActivityResponse>(
      `/classrooms/${classroomId}/activities/${activityId}/publish`,
      { method: 'POST' },
    )
    return toActivity(data.activity)
  },

  /** 結束活動（OPEN→CLOSED）；重複結束回 200 原結果 */
  async close(classroomId: string, activityId: string): Promise<ClassroomActivity> {
    const data = await apiFetch<ApiActivityResponse>(
      `/classrooms/${classroomId}/activities/${activityId}/close`,
      { method: 'POST' },
    )
    return toActivity(data.activity)
  },

  /** 課堂活動列表＋目前開放中的活動 */
  async list(classroomId: string): Promise<ActivityListResult> {
    const data = await apiFetch<ApiActivityListResponse>(`/classrooms/${classroomId}/activities`)
    return {
      items: data.items.map(toActivity),
      openActivity: data.openActivity ? toActivity(data.openActivity) : undefined,
    }
  },

  /** 簽到結果：已簽／未簽名單（僅負責老師） */
  async results(classroomId: string, activityId: string): Promise<ActivityResults> {
    const data = await apiFetch<ApiActivityResultsResponse>(
      `/classrooms/${classroomId}/activities/${activityId}/results`,
    )
    return {
      activity: toActivity(data.activity),
      signed: data.signed.map((s) => ({
        studentId: s.studentId,
        displayName: s.displayName,
        submittedAt: s.submittedAt,
      })),
      unsigned: data.unsigned.map((s) => ({ studentId: s.studentId, displayName: s.displayName })),
    }
  },

  /** 學生簽到；重複提交回 alreadySubmitted=true 原記錄 */
  async submit(
    classroomId: string,
    activityId: string,
  ): Promise<{ submission: ActivitySubmission; alreadySubmitted: boolean }> {
    const data = await apiFetch<ApiSubmissionResponse>(
      `/classrooms/${classroomId}/activities/${activityId}/submissions`,
      { method: 'POST', body: {} },
    )
    return { submission: toSubmission(data.submission), alreadySubmitted: data.alreadySubmitted }
  },

  /** 學生本人提交結果 */
  async myResult(
    classroomId: string,
    activityId: string,
  ): Promise<{ activity: ClassroomActivity; submission?: ActivitySubmission }> {
    const data = await apiFetch<ApiMyResultResponse>(
      `/classrooms/${classroomId}/activities/${activityId}/me/result`,
    )
    return {
      activity: toActivity(data.activity),
      submission: data.submission ? toSubmission(data.submission) : undefined,
    }
  },
}
