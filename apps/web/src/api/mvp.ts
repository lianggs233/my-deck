import type { components } from './schema'
import { apiFetch, apiPutRaw, sha256Hex } from './http'
import type {
  Annotation,
  AuthSession,
  ConversionAttempt,
  Course,
  CourseDetail,
  CourseMembership,
  Courseware,
  CoursewareDetail,
  CoursewarePage,
  CreateAnnotationRequest,
  Page,
  RegisterRequest,
  RegistrationChallenge,
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
