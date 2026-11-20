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

/** 課堂進行中狀態（學生／訪客可見，不含課堂碼與老師 ID） */
export interface ClassroomLiveState {
  id: string
  name: string
  courseId: string
  coursewareId: string
  coursewareVersion: number
  status: ClassroomStatus
  pageIndex: number
  pageCount: number
  stateVersion: number
  startedAt: string
}

export type ParticipantRole = 'STUDENT' | 'GUEST'

export interface ClassroomParticipant {
  id: string
  role: ParticipantRole
  displayName: string
  guestId?: string
  /** 個人標註／寫入能力；訪客一律 false */
  canWrite: boolean
  /** 共享標註層可見性；訪客一律 false */
  canViewShared: boolean
}

export interface ClassroomSnapshotState {
  pageIndex: number
  pageCount: number
  stateVersion: number
  status: ClassroomStatus
  pageImageUrl?: string
  pageThumbUrl?: string
}

export interface ClassroomJoinResult {
  participant: ClassroomParticipant
  classroom: ClassroomLiveState
  snapshot: ClassroomSnapshotState
  courseName?: string
}

export interface ClassroomSnapshotResult {
  classroom: ClassroomLiveState
  snapshot: ClassroomSnapshotState
  participant?: ClassroomParticipant
  courseName: string
}

export interface ActiveClassroom {
  classroom?: ClassroomLiveState
  courseName: string
}

/** 共享標註可見性（REQ-011～013）；DELETED／CLEARED 永不回傳給前端 */
export type SharedVisibility = 'VISIBLE' | 'HIDDEN'

export interface SharedAuthor {
  id: string
  displayName: string
  role: 'TEACHER' | 'STUDENT'
}

export interface SharedReply {
  id: string
  author: SharedAuthor
  content: string
  version: number
  createdAt: string
}

export interface SharedAnnotation {
  id: string
  classroomId: string
  pageIndex: number
  groupId: string
  content: string
  position: AnnotationPosition
  author: SharedAuthor
  visibility: SharedVisibility
  version: number
  createdAt: string
  replies: SharedReply[]
}

export interface SharedAnnotationListResult {
  items: SharedAnnotation[]
  /** 目前使用者是否可新增共享標註／留言（老師恒 true；學生需被授權） */
  canShare: boolean
}

export interface SharePermissionStudent {
  studentId: string
  displayName: string
  granted: boolean
}

/** 課堂活動類型（REQ-014 簽到；答題／投票於 REQ-015 啟用） */
export type ActivityType = 'CHECKIN' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'JUDGE' | 'POLL'
export type ActivityStatus = 'DRAFT' | 'OPEN' | 'CLOSED'

export interface ActivitySubmission {
  id: string
  activityId: string
  studentId: string
  submittedAt: string
}

export interface ClassroomActivity {
  id: string
  classroomId: string
  type: ActivityType
  status: ActivityStatus
  submissionCount: number
  participantCount: number
  publishedAt?: string
  closedAt?: string
  createdAt: string
  /** 學生呼叫時附本人提交；老師／未提交為 undefined */
  mySubmission?: ActivitySubmission
}

export interface ActivityListResult {
  items: ClassroomActivity[]
  openActivity?: ClassroomActivity
}

export interface SignedStudent {
  studentId: string
  displayName: string
  submittedAt: string
}

export interface ActivityResults {
  activity: ClassroomActivity
  signed: SignedStudent[]
  unsigned: { studentId: string; displayName: string }[]
}
