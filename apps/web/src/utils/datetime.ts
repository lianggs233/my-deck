/** 全站統一以香港時區顯示時間（不受瀏覽器系統時區影響） */
export const HK_TIME_ZONE = 'Asia/Hong_Kong'

const timeFormatter = new Intl.DateTimeFormat('zh-HK', {
  timeZone: HK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

/** ISO 時間字串 → 香港時區時間（時:分）；無效輸入回空字串 */
export function formatTimeHK(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return timeFormatter.format(date)
}
