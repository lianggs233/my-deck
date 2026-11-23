import { useEffect, useRef, useState } from 'react'

import { classroomApi } from '../api/mvp'

/** 即時通道模式：WebSocket 優先，失敗降級 SSE；心跳逾時判定失效後改輪詢 */
export type ClassroomChannelMode = 'connecting' | 'ws' | 'sse' | 'polling'

/** 超過此時間未收到任何訊息（含 15 秒心跳）即判定推送通道失效（毫秒） */
const STALE_MS = 20_000
/** 失效偵測巡檢週期（毫秒） */
const WATCHDOG_MS = 5_000
/** 降級為輪詢後，每隔此時間嘗試重建即時通道（毫秒） */
const RETRY_MS = 30_000

interface UseClassroomChannelParams {
  classroomId: string
  guestId?: string | null
  enabled?: boolean
  /** 收到課堂事件（翻頁 state／shared-annotation／activity）時呼叫 */
  onEvent: (payload: Record<string, unknown>) => void
}

interface UseClassroomChannelResult {
  mode: ClassroomChannelMode
  /** 推送通道存活（ws 或 sse）；false 表示已降級為輪詢 */
  live: boolean
}

/**
 * 課堂即時通道（REQ-008 延遲優化）：優先 WebSocket（Cloudflare Tunnel 等代理
 * 會緩衝 SSE 但不緩衝 WS），連不上降級 SSE，SSE 心跳逾時再降級輪詢。
 * 降級期間每 30 秒自動嘗試重建即時通道；成功即回到即時模式。
 */
export function useClassroomChannel({
  classroomId,
  guestId,
  enabled = true,
  onEvent,
}: UseClassroomChannelParams): UseClassroomChannelResult {
  const [mode, setMode] = useState<ClassroomChannelMode>('connecting')
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled || !classroomId) return undefined

    let ws: WebSocket | null = null
    let es: EventSource | null = null
    let disposed = false
    /** 最後收到任何位元組（事件或心跳）的時間；起始給予連線建立寬限 */
    let lastMessageAt = Date.now()
    let sseAttempted = false

    const touch = () => {
      lastMessageAt = Date.now()
    }

    const dispatch = (raw: string) => {
      touch()
      try {
        const payload = JSON.parse(raw) as Record<string, unknown>
        if (payload.type === 'ping') return
        onEventRef.current(payload)
      } catch {
        // 無法解析的事件不影響同步，輪詢會校正
      }
    }

    const teardown = () => {
      ws?.close()
      ws = null
      es?.close()
      es = null
    }

    const startSse = () => {
      if (disposed || es) return
      es = new EventSource(classroomApi.eventStreamUrl(classroomId, guestId))
      es.addEventListener('state', (event) => dispatch(String(event.data)))
      // 後端每 15 秒送 ping 事件作心跳（註解行 EventSource 不派發事件）
      es.addEventListener('ping', touch)
      es.onopen = () => {
        if (disposed) return
        touch()
        setMode('sse')
      }
      // onerror 時 EventSource 會自動重連；整段被代理緩衝（收不到任何位元組）由巡檢判定
    }

    const startWs = () => {
      if (disposed) return
      ws = new WebSocket(classroomApi.wsUrl(classroomId, guestId))
      ws.onopen = () => {
        if (disposed) return
        touch()
        setMode('ws')
      }
      ws.onmessage = (event) => dispatch(String(event.data))
      ws.onclose = () => {
        if (disposed) return
        ws = null
        // WS 不可用（代理不支援或後端拒絕）：降級 SSE 一次，之後由巡檢接管
        if (!sseAttempted) {
          sseAttempted = true
          startSse()
        }
      }
      ws.onerror = () => {
        // onclose 會接著觸發，統一在那裡降級
      }
    }

    startWs()

    const watchdog = window.setInterval(() => {
      if (disposed) return
      if (Date.now() - lastMessageAt <= STALE_MS) return
      // 心跳逾時：推送通道已失效（例如被代理緩衝）→ 降級輪詢，由查詢的 refetchInterval 接手
      teardown()
      setMode('polling')
      // 降級後定時嘗試重建即時通道；成功（onopen）即回到 ws/sse 模式
      window.setTimeout(() => {
        if (disposed) return
        lastMessageAt = Date.now()
        startWs()
      }, RETRY_MS)
    }, WATCHDOG_MS)

    return () => {
      disposed = true
      window.clearInterval(watchdog)
      teardown()
    }
  }, [classroomId, guestId, enabled])

  return { mode, live: mode === 'ws' || mode === 'sse' }
}
