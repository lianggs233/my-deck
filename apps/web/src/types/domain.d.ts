export type UserRole = 'TEACHER' | 'STUDENT'

export interface User {
  id: string
  displayName: string
  role: UserRole
}

export interface AuthSession {
  user: User
}

export interface RegistrationChallenge {
  challengeId: string
  delivery: 'SMS' | 'EMAIL'
  resendAfterSeconds: number
}

export interface RegisterRequest {
  identifier: string
  displayName: string
  role: UserRole
  password: string
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface Course {
  id: string
  name: string
  code: string
  createdAt: string
}

export interface CourseDetail {
  id: string
  name: string
  teacherName: string
  code?: string
  studentCount?: number
  schoolYear?: string
}

export interface CourseMembership {
  id: string
  joinedAt: string
  course: {
    id: string
    name: string
    teacherName: string
  }
}

export type CoursewareStatus =
  'QUEUED' | 'CONVERTING' | 'READY' | 'READY_WITH_WARNINGS' | 'FAILED' | 'TIMED_OUT'

export interface Courseware {
  id: string
  courseId: string
  fileName: string
  sizeBytes: number
  pageCount: number
  status: CoursewareStatus
  latestAttempt: number
  uploadedAt: string
  updatedAt: string
}

export interface ConversionAttempt {
  attempt: number
  status: 'SUCCESS' | 'FAILURE'
  finishedAt: string
  summary: string
}

export interface CoursewareDetail extends Courseware {
  pages: CoursewarePage[]
  attempts: ConversionAttempt[]
}

export interface CoursewarePage {
  pageIndex: number
  pageNumber: number
  title: string
  imageUrl: string
  thumbnailUrl: string
  width: number
  height: number
}

export interface AnnotationPosition {
  x: number
  y: number
}

export interface Annotation {
  id: string
  pageIndex: number
  content: string
  position: AnnotationPosition
  version: number
  createdAt: string
  updatedAt: string
}

export interface ApiFailure {
  code: string
  message: string
  fields?: Record<string, string>
  requestId?: string
}

export interface CreateAnnotationRequest {
  pageIndex: number
  content: string
  position: AnnotationPosition
}

export interface UpdateAnnotationRequest {
  content?: string
  position?: AnnotationPosition
  expectedVersion: number
}

export type ClassroomStatus = 'LIVE' | 'ENDED'
export type PageDirection = 'NEXT' | 'PREV' | 'GOTO'

export interface Classroom {
  id: string
  courseId: string
  coursewareId: string
  coursewareVersion: number
  name: string
  /** 課堂碼僅負責老師可見（6 位大寫字母＋數字） */
  code?: string
  status: ClassroomStatus
  pageIndex: number
  pageCount: number
  stateVersion: number
  startedAt: string
}

export interface ClassroomJoinInfo {
  code: string
  joinUrl: string
  canCopy: boolean
}

export interface ClassroomDetail {
  classroom: Classroom
  courseName: string
}

export interface ClassroomPageState {
  pageIndex: number
  pageCount: number
  stateVersion: number
}
