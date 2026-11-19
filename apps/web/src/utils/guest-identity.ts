/**
 * 訪客身份（REQ-007）：localStorage 只保存唯一 ID，不保存密碼或課堂私密內容。
 * 讀寫失敗（例如無痕模式停用儲存空間）時回報失敗，由呼叫方明確提示。
 */

const GUEST_ID_KEY = 'my_deck_guest_id'

export function readGuestId(): string | null {
  try {
    return window.localStorage.getItem(GUEST_ID_KEY)
  } catch {
    return null
  }
}

/** 回傳是否成功寫入；失敗時呼叫方須提示使用者無法恢復原訪客身份 */
export function saveGuestId(guestId: string): boolean {
  try {
    window.localStorage.setItem(GUEST_ID_KEY, guestId)
    return true
  } catch {
    return false
  }
}

export function clearGuestId(): void {
  try {
    window.localStorage.removeItem(GUEST_ID_KEY)
  } catch {
    // 清除失敗不影響本次加入；下次仍會用舊 ID 嘗試並由服務端回報失效
  }
}
