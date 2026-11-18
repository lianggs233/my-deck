import type { CoursewareStatus } from '../../types/domain'
import { coursewareStatusPillMap } from './courseware-status'
import { StatusPill } from './StatusPill'

/** 課件狀態 pill（轉換成功 Mint／轉換中淡藍／相容性警告淡黃） */
export function CoursewareStatusPill({ status }: { status: CoursewareStatus }) {
  const config = coursewareStatusPillMap[status]
  return <StatusPill tone={config.tone}>{config.label}</StatusPill>
}
