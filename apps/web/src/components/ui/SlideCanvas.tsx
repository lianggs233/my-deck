import { Box, Button, Stack, Text } from '@mantine/core'
import { IconPhotoOff } from '@tabler/icons-react'
import { useState, type MouseEvent, type ReactNode } from 'react'

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

/** 課件頁畫布（16:9）：有轉換頁圖時顯示真圖，否則顯示佔位骨架；封面預覽／逐頁預覽／學生預覽共用。
 *  圖片載入失敗時顯示失敗狀態與重試入口，不把空白頁視為成功（REQ-008 TASK-140）。 */
export function SlideCanvas({
  pageNumber,
  totalPages,
  imageUrl,
  onClick,
  interactive = false,
  annotations,
  draftMarker,
}: SlideCanvasProps) {
  // imageFailed.url 記錄是哪個網址失敗；切頁（imageUrl 改變）時於渲染期重設，不沿用舊頁失敗狀態
  const [imageFailed, setImageFailed] = useState<{ url: string; failed: boolean }>({
    url: imageUrl ?? '',
    failed: false,
  })
  const [retryCount, setRetryCount] = useState(0)
  if ((imageUrl ?? '') !== imageFailed.url) {
    setImageFailed({ url: imageUrl ?? '', failed: false })
    setRetryCount(0)
  }

  const showError = Boolean(imageUrl) && imageFailed.failed

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
      {imageUrl && !showError ? (
        <Box
          key={`${imageUrl}#${retryCount}`}
          component="img"
          src={imageUrl}
          alt={pageNumber ? `課件第 ${pageNumber} 頁` : '課件頁面'}
          onError={() => setImageFailed({ url: imageUrl, failed: true })}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      ) : null}
      {!imageUrl ? (
        <Stack gap="sm" p={48} maw="72%">
          <Box h={20} w="62%" bg="#12836F" style={{ borderRadius: 10 }} />
          <Box h={10} w="88%" bg="#DCE6EA" style={{ borderRadius: 5 }} mt={12} />
          <Box h={10} w="76%" bg="#DCE6EA" style={{ borderRadius: 5 }} />
          <Box h={10} w="58%" bg="#DCE6EA" style={{ borderRadius: 5 }} />
          <Box h={10} w="70%" bg="#DCE6EA" style={{ borderRadius: 5 }} />
        </Stack>
      ) : null}
      {showError ? (
        <Stack
          gap="md"
          align="center"
          justify="center"
          role="alert"
          style={{ position: 'absolute', inset: 0 }}
        >
          <IconPhotoOff size={48} color="#5D7184" stroke={1.5} aria-hidden />
          <Text fz={18} fw={600} c="#17324D">
            目前頁面載入失敗
          </Text>
          <Text fz={16} c="#5D7184">
            請檢查網絡連線後重試；重試只會重新載入本頁，不影響課堂頁碼。
          </Text>
          <Button
            variant="default"
            styles={{
              root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
            }}
            onClick={(event) => {
              event.stopPropagation()
              setImageFailed({ url: imageUrl ?? '', failed: false })
              setRetryCount((count) => count + 1)
            }}
          >
            重試
          </Button>
        </Stack>
      ) : null}
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
