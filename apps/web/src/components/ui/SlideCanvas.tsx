import { Box, Stack, Text } from '@mantine/core'
import type { MouseEvent, ReactNode } from 'react'

interface SlideCanvasProps {
  /** 顯示的頁碼（右下角） */
  pageNumber?: number
  totalPages?: number
  /** 轉換後的頁面圖（WebP）；未提供時顯示佔位骨架 */
  imageUrl?: string
  onClick?: (event: MouseEvent<HTMLDivElement>) => void
  interactive?: boolean
  annotations?: ReactNode
  draftMarker?: ReactNode
}

/** 課件頁畫布（16:9）：有轉換頁圖時顯示真圖，否則顯示佔位骨架；封面預覽／逐頁預覽／學生預覽共用 */
export function SlideCanvas({
  pageNumber,
  totalPages,
  imageUrl,
  onClick,
  interactive = false,
  annotations,
  draftMarker,
}: SlideCanvasProps) {
  return (
    <Box
      component="section"
      aria-label={pageNumber ? `課件第 ${pageNumber} 頁` : '課件頁面預覽'}
      onClick={onClick}
      style={{
        position: 'relative',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        borderRadius: '1.5rem',
        background: '#FFFFFF',
        border: '1px solid #D8E2E8',
        cursor: interactive ? 'crosshair' : 'default',
      }}
    >
      {imageUrl ? (
        <Box
          component="img"
          src={imageUrl}
          alt={pageNumber ? `課件第 ${pageNumber} 頁` : '課件頁面'}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      ) : (
        <Stack gap="sm" p={48} maw="72%">
          <Box h={20} w="62%" bg="#12836F" style={{ borderRadius: 10 }} />
          <Box h={10} w="88%" bg="#DCE6EA" style={{ borderRadius: 5 }} mt={12} />
          <Box h={10} w="76%" bg="#DCE6EA" style={{ borderRadius: 5 }} />
          <Box h={10} w="58%" bg="#DCE6EA" style={{ borderRadius: 5 }} />
          <Box h={10} w="70%" bg="#DCE6EA" style={{ borderRadius: 5 }} />
        </Stack>
      )}
      {annotations}
      {draftMarker}
      {pageNumber ? (
        <Text fz={14} c="#5D7184" style={{ position: 'absolute', right: 24, bottom: 16 }}>
          {pageNumber} / {totalPages ?? pageNumber}
        </Text>
      ) : null}
    </Box>
  )
}
