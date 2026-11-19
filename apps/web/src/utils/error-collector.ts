/**
 * 錯誤收集器（僅開發模式）：收集操作錯誤與 API 失敗。
 * - 僅在 `import.meta.env.DEV` 時收集並以 console.error 輸出；生產環境完全不收集、不輸出。
 * - 開發模式下可於 DevTools 以 `window.__MD_ERRORS__` 檢視已收集的錯誤（最多保留 200 筆）。
 */

export type CollectedErrorSource = 'alert' | 'api'

export interface CollectedError {
  at: string
  source: CollectedErrorSource
  message: string
  detail?: unknown
}

const MAX_ENTRIES = 200
const buffer: CollectedError[] = []

declare global {
  interface Window {
    __MD_ERRORS__?: CollectedError[]
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__MD_ERRORS__ = buffer
}

/** 記錄一筆錯誤（僅開發模式生效） */
export function collectError(
  source: CollectedErrorSource,
  message: string,
  detail?: unknown,
): void {
  if (!import.meta.env.DEV) return
  const entry: CollectedError = { at: new Date().toISOString(), source, message, detail }
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) buffer.shift()
  console.error(`[error-collector][${source}] ${message}`, detail ?? '')
}

/** 取得目前已收集的錯誤（僅開發模式有內容） */
export function getCollectedErrors(): readonly CollectedError[] {
  return buffer
}
