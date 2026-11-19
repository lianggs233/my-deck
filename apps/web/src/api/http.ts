import type { ApiFailure } from '../types/domain'
import { collectError } from '../utils/error-collector'

/**
 * API HTTP 基礎層：Session Cookie（credentials）＋ CSRF double-submit。
 * - 非 GET 請求自動帶上 `x-csrf-token`（讀自 `my_deck_csrf` cookie，缺失時先 GET /auth/csrf）
 * - 403 CSRF_INVALID 時重新取 token 並重試一次
 * - 錯誤統一解析成 ApiFailure（{error:{code,message,fields,requestId}}）
 */

const CSRF_COOKIE = 'my_deck_csrf'
const API_PREFIX = '/api/v1'

export class ApiError extends Error implements ApiFailure {
  code: string
  fields?: Record<string, string>
  requestId?: string
  status: number

  constructor(status: number, failure: ApiFailure) {
    super(failure.message)
    this.name = failure.code
    this.code = failure.code
    this.fields = failure.fields
    this.requestId = failure.requestId
    this.status = status
  }
}

function readCsrfCookie(): string | null {
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${CSRF_COOKIE}=`))
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null
}

async function refreshCsrfToken(): Promise<string> {
  const response = await fetch(`${API_PREFIX}/auth/csrf`, { credentials: 'include' })
  if (!response.ok) throw toApiError(response.status, null)
  const token = readCsrfCookie()
  if (!token) throw new Error('CSRF token 取得失敗')
  return token
}

async function ensureCsrfToken(): Promise<string> {
  return readCsrfCookie() ?? refreshCsrfToken()
}

function toApiError(status: number, body: unknown): ApiError {
  const failure = (body as { error?: ApiFailure } | null)?.error
  const error = failure?.code
    ? new ApiError(status, failure)
    : new ApiError(status, {
        code: status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED',
        message: status >= 500 ? '伺服器暫時未能處理，請稍後再試。' : '請求失敗，請稍後再試。',
      })
  // 錯誤收集器（僅開發模式輸出）
  collectError('api', error.message, {
    status: error.status,
    code: error.code,
    requestId: error.requestId,
  })
  return error
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON body（自動 stringify） */
  body?: unknown
  /** 跳過 401 拋錯，回傳 null（用於 getCurrentUser） */
  allowUnauthorized?: boolean
  /** 內部使用：CSRF 重試標記 */
  _retried?: boolean
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (method !== 'GET') headers['x-csrf-token'] = await ensureCsrfToken()
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${API_PREFIX}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 401 && options.allowUnauthorized) return null as T

  if (response.status === 403 && !options._retried) {
    const body = await safeJson(response)
    const code = (body as { error?: { code?: string } } | null)?.error?.code
    if (code === 'CSRF_INVALID' || code === 'CSRF_MISSING') {
      await refreshCsrfToken()
      return apiFetch<T>(path, { ...options, _retried: true })
    }
    throw toApiError(response.status, body)
  }

  if (!response.ok) throw toApiError(response.status, await safeJson(response))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** 原始位元組 PUT（後端回傳的 uploadUrl 已含 /api/v1 前綴，直接使用） */
export async function apiPutRaw(
  uploadUrl: string,
  data: Blob,
  headers: Record<string, string>,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    credentials: 'include',
    headers: { ...headers, 'x-csrf-token': await ensureCsrfToken() },
    body: data,
  })
  if (!response.ok) throw toApiError(response.status, await safeJson(response))
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/** 以 Web Crypto 計算檔案 SHA-256（完成上傳時回報） */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
