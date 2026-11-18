export type UserRole = 'TEACHER' | 'STUDENT'

export interface User {
  id: string
  displayName: string
  role: UserRole
}

export interface SessionInfo {
  expiresAt: string
  absoluteExpiresAt: string
}

export interface AuthSession {
  user: User
  session: SessionInfo
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
