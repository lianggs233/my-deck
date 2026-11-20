import {
  Anchor,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconCheckbox, IconWifi, IconWifiOff } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ApiError } from '../../api/http'
import { activityApi, annotationApi, classroomApi, sharedAnnotationApi } from '../../api/mvp'
import { useAuth } from '../../auth/useAuth'
import { SharedAnnotationLayer } from '../../components/ui/SharedAnnotationLayer'
import { SlideCanvas } from '../../components/ui/SlideCanvas'
import { StatusPill } from '../../components/ui/StatusPill'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import type { AnnotationPosition, SharedAnnotation } from '../../types/domain'

/** 輪詢週期（毫秒）；SSE 事件為即時觸發，輪詢作斷線重連與兼容 */
const POLL_MS = 3000

/** 點擊畫布換算 0–1 相對座標（共享標註位置釘選頁面） */
function canvasPosition(event: MouseEvent<HTMLDivElement>): AnnotationPosition {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  }
}

/**
 * 課堂觀看頁（REQ-007～REQ-009）：已加入課程學生、未加入學生及訪客共用。
 * 只顯示老師目前頁；不提供任何翻頁、簽到、作答或標註控件。
 * 學生額外看到本人在目前頁的個人標註（唯讀，TASK-139）；訪客沒有標註層。
 */
export function ClassroomViewPage() {
  const { classroomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const guestId = searchParams.get('guest')
  const queryClient = useQueryClient()
  const { showError } = useErrorAlert()
  const { user } = useAuth()
  const [live, setLive] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [draftPosition, setDraftPosition] = useState<AnnotationPosition | null>(null)
  const [newContent, setNewContent] = useState('')
  /** 已確認的最新狀態版本：較舊的 SSE 事件直接忽略，不回退到舊頁（TASK-141） */
  const stateVersionRef = useRef(0)

  const snapshotQuery = useQuery({
    queryKey: ['classroom-snapshot', classroomId, guestId],
    queryFn: () => classroomApi.snapshot(classroomId, guestId),
    enabled: Boolean(classroomId),
    refetchInterval: online ? POLL_MS : false,
  })

  const data = snapshotQuery.data
  const classroom = data?.classroom
  const snapshot = data?.snapshot
  const participant = data?.participant
  const ended = snapshot?.status === 'ENDED'

  // 學生本人個人標註（唯讀）；訪客與未加入者不查詢
  const isStudentParticipant = participant?.role === 'STUDENT'
  const annotationsQuery = useQuery({
    queryKey: ['classroom-annotations', classroomId, snapshot?.pageIndex ?? 0],
    queryFn: () =>
      annotationApi.list(
        classroom?.courseId ?? '',
        classroom?.coursewareId ?? '',
        snapshot?.pageIndex ?? 0,
      ),
    enabled: Boolean(isStudentParticipant && classroom && snapshot),
  })
  const annotations = annotationsQuery.data ?? []

  // 共享標註層（REQ-011／012）：學生可見 VISIBLE 項目；訪客不查詢不顯示
  const sharedQuery = useQuery({
    queryKey: ['shared-annotations', classroomId, snapshot?.pageIndex ?? 0],
    queryFn: () => sharedAnnotationApi.list(classroomId, snapshot?.pageIndex ?? 0),
    enabled: Boolean(isStudentParticipant && snapshot),
  })
  const sharedItems = sharedQuery.data?.items ?? []
  const canShare = Boolean(sharedQuery.data?.canShare) && !ended && online

  function invalidateShared() {
    void queryClient.invalidateQueries({ queryKey: ['shared-annotations', classroomId] })
  }

  // 課堂簽到（REQ-014）：僅學生身份查詢；訪客無簽到控件
  const activitiesQuery = useQuery({
    queryKey: ['activities', classroomId],
    queryFn: () => activityApi.list(classroomId),
    enabled: Boolean(isStudentParticipant),
    refetchInterval: online && isStudentParticipant ? POLL_MS : false,
  })
  const openCheckin =
    activitiesQuery.data?.openActivity?.type === 'CHECKIN'
      ? activitiesQuery.data.openActivity
      : undefined

  const checkinMutation = useMutation({
    mutationFn: (activityId: string) => activityApi.submit(classroomId, activityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activities', classroomId] })
    },
    onError: (cause) =>
      showError(cause instanceof Error ? cause.message : '簽到失敗，請稍後再試。'),
  })

  const createSharedMutation = useMutation({
    mutationFn: (input: { content: string; position?: AnnotationPosition; groupId?: string }) =>
      sharedAnnotationApi.create(classroomId, {
        pageIndex: snapshot?.pageIndex ?? 0,
        content: input.content,
        position: input.position,
        groupId: input.groupId,
      }),
    onSuccess: () => {
      invalidateShared()
      setDraftPosition(null)
      setNewContent('')
    },
    onError: (cause) =>
      showError(cause instanceof Error ? cause.message : '建立共享標註失敗，請稍後再試。'),
  })
  const updateSharedMutation = useMutation({
    mutationFn: (input: { annotation: SharedAnnotation; content: string }) =>
      sharedAnnotationApi.update(classroomId, input.annotation.id, {
        expectedVersion: input.annotation.version,
        content: input.content,
      }),
    onSuccess: invalidateShared,
    onError: (cause) => showError(cause instanceof Error ? cause.message : '更新共享標註失敗。'),
  })
  const deleteSharedMutation = useMutation({
    mutationFn: (annotation: SharedAnnotation) =>
      sharedAnnotationApi.remove(classroomId, annotation.id),
    onSuccess: invalidateShared,
    onError: (cause) => showError(cause instanceof Error ? cause.message : '刪除共享標註失敗。'),
  })
  const sharedBusy =
    createSharedMutation.isPending ||
    updateSharedMutation.isPending ||
    deleteSharedMutation.isPending

  // 連線狀態：離線保留最後確認畫面並明確標示；恢復時立即取最新快照（TASK-146／147）
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      // 重連後補齊離線期間可能漏收的變更（SSE 無回放）：快照＋個人標註＋共享標註層＋簽到活動
      void queryClient.invalidateQueries({ queryKey: ['classroom-snapshot', classroomId, guestId] })
      void queryClient.invalidateQueries({ queryKey: ['classroom-annotations', classroomId] })
      void queryClient.invalidateQueries({ queryKey: ['shared-annotations', classroomId] })
      void queryClient.invalidateQueries({ queryKey: ['activities', classroomId] })
    }
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [classroomId, guestId, queryClient])

  // 記錄已確認的最新狀態版本（只升不降）
  const confirmedVersion = snapshot?.stateVersion
  useEffect(() => {
    if (typeof confirmedVersion === 'number' && confirmedVersion > stateVersionRef.current) {
      stateVersionRef.current = confirmedVersion
    }
  }, [confirmedVersion])

  // SSE 觸發器：老師翻頁時立即更新；較舊或重複事件被忽略；連線斷開由 3 秒輪詢補上
  useEffect(() => {
    if (!classroomId) return undefined
    const source = new EventSource(classroomApi.eventStreamUrl(classroomId, guestId))
    const onState = (event: MessageEvent) => {
      let isSharedEvent = false
      let isActivityEvent = false
      try {
        const payload = JSON.parse(String(event.data)) as {
          stateVersion?: number
          type?: string
        }
        if (
          typeof payload.stateVersion === 'number' &&
          payload.stateVersion < stateVersionRef.current
        ) {
          return
        }
        isSharedEvent = payload.type === 'shared-annotation'
        isActivityEvent = payload.type === 'activity'
      } catch {
        // 無法解析的事件不影響同步，仍以快照校正
      }
      setLive(true)
      if (isSharedEvent) {
        // 共享標註變更不影響頁碼版本，只重整共享層（REQ-011 即時同步）
        void queryClient.invalidateQueries({ queryKey: ['shared-annotations', classroomId] })
        return
      }
      if (isActivityEvent) {
        // 簽到發布／結束／人數變更不影響頁碼版本，只重整活動（REQ-014 即時同步）
        void queryClient.invalidateQueries({ queryKey: ['activities', classroomId] })
        return
      }
      void queryClient.invalidateQueries({
        queryKey: ['classroom-snapshot', classroomId, guestId],
      })
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
  // 401／403 屬授權失效：即使保留舊快照資料也不得繼續顯示（不冒用，REQ-009）
  const blockingError =
    loadError instanceof ApiError && (loadError.status === 401 || loadError.status === 403)
      ? loadError
      : null
  useEffect(() => {
    if (
      loadError &&
      !(loadError instanceof ApiError && (loadError.status === 403 || loadError.status === 401))
    ) {
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

  const annotationDots = isStudentParticipant ? (
    <>
      {annotations.map((annotation) => (
        <Tooltip key={annotation.id} label={annotation.content} withArrow>
          <Box
            component="button"
            type="button"
            aria-label={`查看標註：${annotation.content}`}
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'absolute',
              left: `${annotation.position.x * 100}%`,
              top: `${annotation.position.y * 100}%`,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#12836F',
              border: '2px solid #FFFFFF',
              boxShadow: '0 1px 4px rgba(23, 50, 77, 0.35)',
              transform: 'translate(-50%, -50%)',
              cursor: 'default',
              padding: 0,
            }}
          />
        </Tooltip>
      ))}
    </>
  ) : null

  const statusPill = !online ? (
    <StatusPill tone="red" leftSection={<IconWifiOff size={16} aria-hidden />}>
      已離線，顯示最後確認畫面
    </StatusPill>
  ) : ended ? (
    <StatusPill tone="gray" leftSection={<IconWifiOff size={16} aria-hidden />}>
      課堂已結束
    </StatusPill>
  ) : (
    <StatusPill
      tone={live ? 'mint' : 'yellow'}
      leftSection={
        live ? <IconWifi size={16} aria-hidden /> : <IconWifiOff size={16} aria-hidden />
      }
    >
      {live ? '即時同步' : '輪詢同步'}
    </StatusPill>
  )

  const errorView = (() => {
    // 401／403 屬授權失效：即使保留舊快照也必須顯示錯誤視圖（不冒用，REQ-009）
    if (data && !blockingError) return null
    if (loadError instanceof ApiError && loadError.status === 401) {
      return {
        title: '工作階段已失效',
        description: '你的登入工作階段已失效，請重新登入後再進入課堂。',
        actions: (
          <Anchor component={Link} to="/login" fz={16} fw={600} c="#0B6455">
            重新登入
          </Anchor>
        ),
      }
    }
    if (loadError instanceof ApiError && loadError.status === 403) {
      return {
        title: '你尚未加入此課堂',
        description: '請使用課堂碼重新加入，或請老師確認課堂仍在進行中。',
        actions: (
          <>
            <Anchor component={Link} to="/join" fz={16} fw={600} c="#0B6455">
              以課堂碼加入
            </Anchor>
            <Anchor component={Link} to="/login" fz={16} fw={600} c="#0B6455">
              登入
            </Anchor>
          </>
        ),
      }
    }
    return {
      title: '無法讀取課堂',
      description: '恢復失敗，不會顯示其他課堂或舊版本的快取資料。請重試。',
      actions: (
        <Button variant="default" onClick={() => void snapshotQuery.refetch()}>
          重試恢復
        </Button>
      ),
    }
  })()

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
        px={16}
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
          {statusPill}
          {snapshot ? (
            <Text fz={16} fw={600} c="#17324D" style={{ whiteSpace: 'nowrap' }}>
              第 {snapshot.pageIndex + 1} / {snapshot.pageCount} 頁
            </Text>
          ) : null}
        </Group>
      </Box>

      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box className="md-container" py={32}>
          {data && snapshot && !blockingError ? (
            <Stack gap="lg">
              <Paper radius="lg" bg="#FFFFFF" p="md" style={{ border: '1px solid #D8E2E8' }}>
                <SlideCanvas
                  pageNumber={snapshot.pageIndex + 1}
                  totalPages={snapshot.pageCount}
                  imageUrl={snapshot.pageImageUrl}
                  interactive={canShare}
                  onClick={(event) => {
                    if (!canShare) return
                    setDraftPosition(canvasPosition(event))
                    setNewContent('')
                  }}
                  draftMarker={
                    draftPosition ? (
                      <Box
                        aria-hidden
                        style={{
                          position: 'absolute',
                          left: `${draftPosition.x * 100}%`,
                          top: `${draftPosition.y * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'rgba(18, 131, 111, 0.35)',
                          border: '2px dashed #12836F',
                          zIndex: 4,
                          pointerEvents: 'none',
                        }}
                      />
                    ) : undefined
                  }
                  annotations={
                    <>
                      {annotationDots}
                      {isStudentParticipant ? (
                        <SharedAnnotationLayer
                          annotations={sharedItems}
                          canShare={canShare}
                          currentUserId={user?.id ?? ''}
                          isTeacher={false}
                          busy={sharedBusy}
                          onAddComment={(groupId, content) =>
                            createSharedMutation.mutate({ groupId, content })
                          }
                          onEdit={(annotation, content) =>
                            updateSharedMutation.mutate({ annotation, content })
                          }
                          onDelete={(annotation) => deleteSharedMutation.mutate(annotation)}
                          onReply={() => undefined}
                          onEditReply={() => undefined}
                          onDeleteReply={() => undefined}
                        />
                      ) : null}
                    </>
                  }
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

              {isStudentParticipant && openCheckin && !ended ? (
                openCheckin.mySubmission ? (
                  <div className="md-notice" role="status">
                    <IconCheckbox size={18} stroke={1.8} aria-hidden style={{ flexShrink: 0 }} />
                    <Text fz={16} fw={600}>
                      已完成簽到（
                      {new Date(openCheckin.mySubmission.submittedAt).toLocaleTimeString('zh-TW', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      ）
                    </Text>
                  </div>
                ) : (
                  <Paper radius="xl" bg="#FFFFFF" p="lg" style={{ border: '2px solid #12836F' }}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text fz={16} fw={600} c="#17324D">
                        老師發起了課堂簽到，請按「簽到」完成
                      </Text>
                      <Button
                        color="teal"
                        leftSection={<IconCheckbox size={16} aria-hidden />}
                        loading={checkinMutation.isPending}
                        disabled={!online}
                        onClick={() => checkinMutation.mutate(openCheckin.id)}
                      >
                        簽到
                      </Button>
                    </Group>
                  </Paper>
                )
              ) : null}

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
                {errorView?.title}
              </Title>
              <Text fz={16} c="#5D7184">
                {errorView?.description}
              </Text>
              <Group gap="md">{errorView?.actions}</Group>
            </Stack>
          )}
        </Box>
      </Box>

      <Modal
        opened={draftPosition !== null}
        onClose={() => setDraftPosition(null)}
        title="新增共享標註"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="標註內容"
            placeholder="輸入 1–100 字標註"
            value={newContent}
            onChange={(event) => setNewContent(event.currentTarget.value)}
            maxLength={100}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setDraftPosition(null)}>
              取消
            </Button>
            <Button
              loading={createSharedMutation.isPending}
              disabled={!newContent.trim()}
              onClick={() =>
                createSharedMutation.mutate({
                  content: newContent.trim(),
                  position: draftPosition ?? undefined,
                })
              }
            >
              建立標註
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  )
}
