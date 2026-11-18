import type { CoursewareStatus } from '../../types/domain'

export const coursewareStatusPillMap: Record<
  CoursewareStatus,
  { tone: 'mint' | 'blue' | 'yellow' | 'red' | 'gray'; label: string }
> = {
  QUEUED: { tone: 'gray', label: '待轉換' },
  CONVERTING: { tone: 'blue', label: '轉換中' },
  READY: { tone: 'mint', label: '轉換成功' },
  READY_WITH_WARNINGS: { tone: 'yellow', label: '相容性警告' },
  FAILED: { tone: 'red', label: '轉換失敗' },
  TIMED_OUT: { tone: 'red', label: '轉換逾時' },
}

export const coursewareStatusIconTone: Record<
  CoursewareStatus,
  'mint' | 'blue' | 'yellow' | 'gray' | 'red'
> = {
  QUEUED: 'gray',
  CONVERTING: 'blue',
  READY: 'mint',
  READY_WITH_WARNINGS: 'yellow',
  FAILED: 'gray',
  TIMED_OUT: 'gray',
}

export function coursewareStatusTone(status: CoursewareStatus) {
  return coursewareStatusIconTone[status]
}
