import { Anchor, Box, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { IconWifi, IconWifiOff } from '@tabler/icons-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ApiError } from '../../api/http'
import { classroomApi } from '../../api/mvp'
import { SlideCanvas } from '../../components/ui/SlideCanvas'
import { StatusPill } from '../../components/ui/StatusPill'
import { useErrorAlert } from '../../components/ui/error-alert-context'

/** 輪詢週期（毫秒）；SSE 事件為即時觸發，輪詢作斷線重連與兼容 */
const POLL_MS = 3000

/**
 * 課堂觀看頁（REQ-007）：已加入課程學生、未加入學生及訪客共用。
 * 只顯示老師目前頁；不提供任何翻頁、簽到、作答或標註控件。
 */
export function ClassroomViewPage() {
  const { classroomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const guestId = searchParams.get('guest')
  const queryClient = useQueryClient()
  const { showError } = useErrorAlert()
  const [live, setLive] = useState(false)

  const snapshotQuery = useQuery({
    queryKey: ['classroom-snapshot', classroomId, guestId],
    queryFn: () => classroomApi.snapshot(classroomId, guestId),
    enabled: Boolean(classroomId),
    refetchInterval: POLL_MS,
  })

  // SSE 觸發器：老師翻頁時立即更新，連線斷開則由 3 秒輪詢補上
  useEffect(() => {
    if (!classroomId) return undefined
    const source = new EventSource(classroomApi.eventStreamUrl(classroomId, guestId))
    const onState = () => {
      setLive(true)
      void queryClient.invalidateQueries({ queryKey: ['classroom-snapshot', classroomId, guestId] })
    }
    source.addEventListener('state', onState)
    source.onopen = () => setLive(true)
    source.onerror = () => setLive(false)
    return () => {
      source.removeEventListener('state', onState)
      source.close()
    }
  }, [classroomId, guestId, queryClient])

  const loadError = snapshotQuery.error
  useEffect(() => {
    if (loadError && !(loadError instanceof ApiError && loadError.status === 403)) {
      showError(loadError instanceof Error ? loadError.message : '無法讀取課堂，請稍後再試。')
    }
  }, [loadError, showError])

  if (snapshotQuery.isPending) {
    return (
      <Box
        component="main"
        className="md-viewport"
        bg="#F5F8F6"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Loader aria-label="課堂載入中" />
      </Box>
    )
  }

  const data = snapshotQuery.data
  const classroom = data?.classroom
  const snapshot = data?.snapshot
  const participant = data?.participant
  const ended = snapshot?.status === 'ENDED'

  return (
    <Box
      component="main"
      className="md-viewport"
      bg="#F5F8F6"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <Box
        component="header"
        bg="#FFFFFF"
        px="clamp(16px, 3vw, 40px)"
        h={96}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: '1px solid #D8E2E8',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Text fz={14} c="#5D7184">
            {data?.courseName ?? '即時課堂'}
          </Text>
          <Text fz={24} fw={700} c="#17324D" truncate>
            {classroom?.name ?? '課堂'}
          </Text>
        </div>
        <Group gap="md" wrap="nowrap">
          <StatusPill
            tone={ended ? 'gray' : live ? 'mint' : 'yellow'}
            leftSection={
              live ? <IconWifi size={16} aria-hidden /> : <IconWifiOff size={16} aria-hidden />
            }
          >
            {ended ? '課堂已結束' : live ? '即時同步' : '輪詢同步'}
          </StatusPill>
          {snapshot ? (
            <Text fz={16} fw={600} c="#17324D" style={{ whiteSpace: 'nowrap' }}>
              第 {snapshot.pageIndex + 1} / {snapshot.pageCount} 頁
            </Text>
          ) : null}
        </Group>
      </Box>

      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box className="md-container" py={32}>
          {data && snapshot ? (
            <Stack gap="lg">
              <Paper radius="lg" bg="#FFFFFF" p="md" style={{ border: '1px solid #D8E2E8' }}>
                <SlideCanvas
                  pageNumber={snapshot.pageIndex + 1}
                  totalPages={snapshot.pageCount}
                  imageUrl={snapshot.pageImageUrl}
                />
              </Paper>

              {ended ? (
                <div className="md-notice md-notice-blue">
                  <Text fz={16} fw={600}>
                    課堂已結束，無法再同步頁面。
                  </Text>
                </div>
              ) : (
                <Text fz={16} c="#5D7184" ta="center">
                  頁面由老師同步控制，你看到的是課堂目前頁。
                </Text>
              )}

              {participant ? (
                <Text fz={16} c="#5D7184" ta="center">
                  以{participant.role === 'GUEST' ? '訪客' : '學生'}身份「
                  {participant.displayName}」加入
                </Text>
              ) : null}

              {participant?.role === 'GUEST' ? (
                <div className="md-notice md-notice-blue">
                  <Text fz={16} fw={600}>
                    訪客只能觀看目前頁面
                  </Text>
                  <Text fz={16} c="#5D7184">
                    你不可簽到、作答、標註，也看不到共享標註或下載課件。
                  </Text>
                </div>
              ) : null}
            </Stack>
          ) : (
            <Stack gap="lg" align="center" py="xl">
              <Title order={3} fz={24} c="#17324D">
                {loadError instanceof ApiError && loadError.status === 403
                  ? '你尚未加入此課堂'
                  : '無法讀取課堂'}
              </Title>
              <Text fz={16} c="#5D7184">
                {loadError instanceof ApiError && loadError.status === 403
                  ? '請使用課堂碼重新加入，或請老師確認課堂仍在進行中。'
                  : '請確認課堂仍在進行中，稍後重新整理再試。'}
              </Text>
              <Group gap="md">
                <Anchor component={Link} to="/join" fz={16} fw={600} c="#0B6455">
                  以課堂碼加入
                </Anchor>
                <Anchor component={Link} to="/login" fz={16} fw={600} c="#0B6455">
                  登入
                </Anchor>
              </Group>
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  )
}
