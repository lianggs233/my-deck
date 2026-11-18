import type {
  Annotation,
  AnnotationPosition,
  AuthSession,
  Course,
  CourseDetail,
  CourseMembership,
  Courseware,
  CoursewareDetail,
  CreateAnnotationRequest,
  Page,
  RegisterRequest,
  RegistrationChallenge,
  UpdateAnnotationRequest,
  User,
} from '../types/domain'

/**
 * MVP 開發用 mock adapter。
 *
 * 這裡先集中定義頁面所需的資料契約，後端業務 API 尚未實作；
 * 後續只需把這些函式替換成 openapi-fetch client，頁面不需直接耦合 mock 資料。
 */
const demoTeacher: User = { id: 'usr_teacher', displayName: '陳老師', role: 'TEACHER' }
const demoStudent: User = { id: 'usr_student', displayName: '林同學', role: 'STUDENT' }

const now = '2026-11-18T08:00:00.000Z'
let currentUser: User | null = null
let nextCourseId = 2
let nextCoursewareId = 4
let nextAnnotationId = 3

const course: Course = {
  id: 'crs_demo',
  name: '英語文學・四年級',
  code: 'ABCD2345',
  createdAt: now,
}

const pageTitles = [
  '封面：課程導覽',
  '學習目標',
  '作者生平',
  '故事背景',
  '人物關係',
  '情節梳理（一）',
  '情節梳理（二）',
  '經典獨白賞析',
  '主題：猶豫與復仇',
  '象徵手法',
  '語言風格',
  '舞台呈現',
  '改編作品',
  '課堂討論',
  '延伸閱讀',
  '段落大意',
  '修辭分析',
  '比較閱讀',
  '寫作手法',
  '課後練習',
  '複習重點',
  '評估量表',
  '總結與回顧',
  '致謝',
]

function buildPages(count: number, titlePrefix: string) {
  return Array.from({ length: count }, (_, pageIndex) => ({
    pageIndex,
    pageNumber: pageIndex + 1,
    title: pageTitles[pageIndex] ?? `${titlePrefix} 第 ${pageIndex + 1} 頁`,
    imageUrl: '',
    thumbnailUrl: '',
    width: 1920,
    height: 1080,
  }))
}

const coursewares: CoursewareDetail[] = [
  {
    id: 'cw_demo',
    courseId: course.id,
    fileName: '莎士比亞戲劇導讀.pptx',
    sizeBytes: 18_600_000,
    pageCount: 24,
    status: 'READY',
    latestAttempt: 2,
    uploadedAt: now,
    updatedAt: now,
    pages: buildPages(24, '莎士比亞戲劇導讀'),
    attempts: [
      { attempt: 2, status: 'SUCCESS', finishedAt: '2026-11-18T01:12:00.000Z', summary: '成功' },
      { attempt: 1, status: 'FAILURE', finishedAt: '2026-11-18T00:54:00.000Z', summary: '失敗' },
    ],
  },
  {
    id: 'cw_converting',
    courseId: course.id,
    fileName: '現代詩選讀.pptx',
    sizeBytes: 9_800_000,
    pageCount: 12,
    status: 'CONVERTING',
    latestAttempt: 1,
    uploadedAt: now,
    updatedAt: now,
    pages: buildPages(12, '現代詩選讀'),
    attempts: [{ attempt: 1, status: 'SUCCESS', finishedAt: now, summary: '轉換中' }],
  },
  {
    id: 'cw_warn',
    courseId: course.id,
    fileName: '文學體裁比較.ppt',
    sizeBytes: 22_400_000,
    pageCount: 18,
    status: 'READY_WITH_WARNINGS',
    latestAttempt: 3,
    uploadedAt: now,
    updatedAt: now,
    pages: buildPages(18, '文學體裁比較'),
    attempts: [
      { attempt: 3, status: 'SUCCESS', finishedAt: now, summary: '成功（含相容性警告）' },
      { attempt: 2, status: 'FAILURE', finishedAt: now, summary: '失敗' },
      { attempt: 1, status: 'FAILURE', finishedAt: now, summary: '失敗' },
    ],
  },
]

let annotations: Annotation[] = [
  {
    id: 'ann_001',
    pageIndex: 2,
    content: '哈姆雷特的猶豫與家庭壓力有關。',
    position: { x: 0.58, y: 0.38 },
    version: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'ann_002',
    pageIndex: 7,
    content: '記下這裡要再複習。',
    position: { x: 0.42, y: 0.31 },
    version: 1,
    createdAt: now,
    updatedAt: now,
  },
]

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

function toApiError(code: string, message: string) {
  const error = new Error(message)
  error.name = code
  return error
}

export const authApi = {
  async getCurrentUser(): Promise<User | null> {
    await delay(100)
    return currentUser
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    await delay()

    if (!identifier.trim() || !password) {
      throw toApiError('VALIDATION_ERROR', '請輸入帳號及密碼')
    }

    const user = identifier.toLowerCase().includes('student') ? demoStudent : demoTeacher
    currentUser = user

    return {
      user,
      session: {
        expiresAt: '2026-11-25T08:00:00.000Z',
        absoluteExpiresAt: '2026-12-18T08:00:00.000Z',
      },
    }
  },

  async requestRegistrationCode(request: RegisterRequest): Promise<RegistrationChallenge> {
    await delay()

    if (!request.identifier.trim() || !request.displayName.trim() || !request.password) {
      throw toApiError('VALIDATION_ERROR', '請完成註冊資料')
    }

    return {
      challengeId: 'vc_demo',
      delivery: request.identifier.includes('@') ? 'EMAIL' : 'SMS',
      resendAfterSeconds: 60,
    }
  },

  async register(role: RegisterRequest['role'], displayName: string): Promise<AuthSession> {
    await delay()
    const user: User = {
      id: role === 'TEACHER' ? 'usr_new_teacher' : 'usr_new_student',
      displayName,
      role,
    }
    currentUser = user
    return {
      user,
      session: {
        expiresAt: '2026-11-25T08:00:00.000Z',
        absoluteExpiresAt: '2026-12-18T08:00:00.000Z',
      },
    }
  },

  async requestPasswordReset(identifier: string): Promise<RegistrationChallenge> {
    await delay()
    if (!identifier.trim()) throw toApiError('VALIDATION_ERROR', '請輸入手機號碼或電郵')
    return {
      challengeId: 'prc_demo',
      delivery: identifier.includes('@') ? 'EMAIL' : 'SMS',
      resendAfterSeconds: 60,
    }
  },

  async verifyPasswordResetCode(challengeId: string, code: string): Promise<void> {
    await delay()
    if (!challengeId || code.trim().length !== 6) {
      throw toApiError('VALIDATION_ERROR', '請輸入 6 位驗證碼')
    }
  },

  async resetPassword(challengeId: string, password: string): Promise<void> {
    await delay()
    if (!challengeId || password.length < 8) {
      throw toApiError('VALIDATION_ERROR', '密碼需至少 8 個字元')
    }
  },

  async logout(): Promise<void> {
    await delay(100)
    currentUser = null
  },
}

export const courseApi = {
  async listTeacherCourses(): Promise<Page<Course>> {
    await delay()
    if (currentUser?.role !== 'TEACHER') throw toApiError('AUTH_REQUIRED', '請先登入老師帳號')
    return { items: [course], page: 1, pageSize: 20, total: 1 }
  },

  async listStudentMemberships(): Promise<Page<CourseMembership>> {
    await delay()
    if (currentUser?.role !== 'STUDENT') throw toApiError('AUTH_REQUIRED', '請先登入學生帳號')
    return {
      items: [
        {
          id: 'mem_demo',
          joinedAt: now,
          course: { id: course.id, name: course.name, teacherName: '陳老師' },
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    }
  },

  async createCourse(name: string): Promise<Course> {
    await delay()
    if (currentUser?.role !== 'TEACHER') throw toApiError('AUTH_REQUIRED', '請先登入老師帳號')
    const created: Course = {
      id: `crs_${String(nextCourseId).padStart(3, '0')}`,
      name,
      code: `ABCD${String(nextCourseId * 1000).slice(0, 4)}`,
      createdAt: now,
    }
    nextCourseId += 1
    return created
  },

  async getCourse(courseId: string, role: User['role']): Promise<CourseDetail> {
    await delay()
    if (course.id !== courseId) throw toApiError('NOT_FOUND', '找不到課程')
    return {
      id: course.id,
      name: course.name,
      teacherName: '陳老師',
      code: role === 'TEACHER' ? course.code : undefined,
      studentCount: 24,
      schoolYear: '2026 學年',
    }
  },

  async joinByCode(code: string): Promise<CourseMembership> {
    await delay()
    if (currentUser?.role !== 'STUDENT') throw toApiError('AUTH_REQUIRED', '請先登入學生帳號')
    if (code.trim().toUpperCase() !== course.code) {
      throw toApiError('COURSE_CODE_INVALID', '課程碼不正確，請確認後再試')
    }
    return {
      id: 'mem_demo',
      joinedAt: now,
      course: { id: course.id, name: course.name, teacherName: '陳老師' },
    }
  },
}

export const coursewareApi = {
  async list(courseId: string): Promise<Page<Courseware>> {
    await delay()
    if (course.id !== courseId) throw toApiError('NOT_FOUND', '找不到課程')
    return { items: coursewares, page: 1, pageSize: 20, total: coursewares.length }
  },

  async get(courseId: string, coursewareId: string): Promise<CoursewareDetail> {
    await delay()
    const found = coursewares.find((item) => item.courseId === courseId && item.id === coursewareId)
    if (!found) throw toApiError('NOT_FOUND', '找不到課件')
    return found
  },

  async createUpload() {
    await delay()
    throw toApiError('API_RESERVED', '課件上傳 API 尚未對接，此按鈕目前只保留入口')
  },

  /**
   * mock 上傳完成回報：把新課件加入列表（狀態為轉換中）。
   * 實際串接時改為「取得預簽 PUT → 上傳 → 完成」三步。
   */
  async completeUpload(
    courseId: string,
    input: { fileName: string; sizeBytes: number },
  ): Promise<Courseware> {
    await delay(400)
    if (course.id !== courseId) throw toApiError('NOT_FOUND', '找不到課程')
    const id = `cw_${String(nextCoursewareId).padStart(3, '0')}`
    nextCoursewareId += 1
    const created: CoursewareDetail = {
      id,
      courseId,
      fileName: input.fileName,
      sizeBytes: input.sizeBytes,
      pageCount: 0,
      status: 'CONVERTING',
      latestAttempt: 1,
      uploadedAt: now,
      updatedAt: now,
      pages: [],
      attempts: [{ attempt: 1, status: 'SUCCESS', finishedAt: now, summary: '轉換中' }],
    }
    coursewares.push(created)
    return created
  },
}

export const annotationApi = {
  async list(coursewareId: string, pageIndex: number): Promise<Annotation[]> {
    await delay()
    if (currentUser?.role !== 'STUDENT') throw toApiError('AUTH_REQUIRED', '請先登入學生帳號')
    return annotations.filter(
      (annotation) => annotation.pageIndex === pageIndex && isDemoCourseware(coursewareId),
    )
  },

  async create(coursewareId: string, request: CreateAnnotationRequest): Promise<Annotation> {
    await delay()
    if (currentUser?.role !== 'STUDENT') throw toApiError('AUTH_REQUIRED', '請先登入學生帳號')
    if (!isDemoCourseware(coursewareId)) throw toApiError('NOT_FOUND', '找不到課件')

    const annotation: Annotation = {
      id: `ann_${String(nextAnnotationId).padStart(3, '0')}`,
      pageIndex: request.pageIndex,
      content: request.content.trim(),
      position: normalizePosition(request.position),
      version: 1,
      createdAt: now,
      updatedAt: now,
    }
    nextAnnotationId += 1
    annotations = [...annotations, annotation]
    return annotation
  },

  async update(annotationId: string, request: UpdateAnnotationRequest): Promise<Annotation> {
    await delay()
    const found = annotations.find((annotation) => annotation.id === annotationId)
    if (!found) throw toApiError('NOT_FOUND', '找不到標註')
    if (found.version !== request.expectedVersion) {
      throw toApiError('ANNOTATION_VERSION_CONFLICT', '標註已被更新，請重新整理後再試')
    }

    const updated: Annotation = {
      ...found,
      content: request.content?.trim() ?? found.content,
      position: request.position ? normalizePosition(request.position) : found.position,
      version: found.version + 1,
      updatedAt: now,
    }
    annotations = annotations.map((annotation) =>
      annotation.id === annotationId ? updated : annotation,
    )
    return updated
  },

  async remove(annotationId: string, expectedVersion: number): Promise<void> {
    await delay()
    const found = annotations.find((annotation) => annotation.id === annotationId)
    if (!found) throw toApiError('NOT_FOUND', '找不到標註')
    if (found.version !== expectedVersion) {
      throw toApiError('ANNOTATION_VERSION_CONFLICT', '標註已被更新，請重新整理後再試')
    }
    annotations = annotations.filter((annotation) => annotation.id !== annotationId)
  },
}

function isDemoCourseware(coursewareId: string) {
  return coursewareId === 'cw_demo'
}

function normalizePosition(position: AnnotationPosition): AnnotationPosition {
  return {
    x: Math.min(1, Math.max(0, position.x)),
    y: Math.min(1, Math.max(0, position.y)),
  }
}
