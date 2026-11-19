import { Group, Paper, Text, UnstyledButton } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import { collectError } from '../../utils/error-collector'
import { ErrorAlertContext } from './error-alert-context'

const AUTO_DISMISS_MS = 10_000

/**
 * 全站統一錯誤提示（Library 元件「Alert / Error（置頂）」）：
 * 固定於視窗頂部置中，10 秒自動關閉，最右 × 可手動關閉；
 * 同時把錯誤寫入錯誤收集器（僅開發模式輸出）。
 */
export function ErrorAlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<{ message: string; id: number } | null>(null)
  const timerRef = useRef<number | null>(null)

  const dismiss = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setAlert(null)
  }, [])

  const showError = useCallback((message: string) => {
    collectError('alert', message)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    setAlert({ message, id: Date.now() })
    timerRef.current = window.setTimeout(() => {
      setAlert(null)
      timerRef.current = null
    }, AUTO_DISMISS_MS)
  }, [])

  const value = useMemo(() => ({ showError }), [showError])

  return (
    <ErrorAlertContext.Provider value={value}>
      {children}
      {alert ? (
        <Paper
          key={alert.id}
          role="alert"
          bg="#FEF2F2"
          px="md"
          py="sm"
          radius={12}
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            border: '1px solid #FECACA',
            maxWidth: 'min(32rem, calc(100vw - 2rem))',
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <span
              aria-hidden
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#B42318',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              !
            </span>
            <Text fz={16} fw={600} c="#B42318" style={{ flex: 1, minWidth: 0 }}>
              {alert.message}
            </Text>
            <UnstyledButton
              aria-label="關閉錯誤提示"
              onClick={dismiss}
              style={{ flexShrink: 0, lineHeight: 1 }}
            >
              <IconX size={18} color="#B42318" aria-hidden />
            </UnstyledButton>
          </Group>
        </Paper>
      ) : null}
    </ErrorAlertContext.Provider>
  )
}
