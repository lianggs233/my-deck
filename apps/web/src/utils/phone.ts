/** 固定地區碼 +852；預留後續改為可選不同地區的選擇框（屆時換回 Select 元件） */
export const REGION_CODE = '+852'

/**
 * 將輸入的手機號碼標準化為 `+852XXXXXXXX`。
 * 校驗僅針對本地號碼（不含「+」），容忍貼上時的空格／破折號／已含 852 前綴。
 * 非 8 位本地號碼時回傳 null。
 */
export function normalizeHongKongPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  const local = digits.startsWith('852') && digits.length === 11 ? digits.slice(3) : digits
  return /^\d{8}$/.test(local) ? `${REGION_CODE}${local}` : null
}
