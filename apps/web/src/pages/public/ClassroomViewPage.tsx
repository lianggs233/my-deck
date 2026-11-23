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
import {
  IconCheckbox,
  IconDoorExit,
  IconMaximize,
  IconWifi,
  IconWifiOff,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { ApiError } from '../../api/http'
import { activityApi, annotationApi, classroomApi, sharedAnnotationApi } from '../../api/mvp'
import { useAuth } from '../../auth/useAuth'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { SharedAnnotationLayer } from '../../components/ui/SharedAnnotationLayer'
import { SlideCanvas } from '../../components/ui/SlideCanvas'
import { StatusPill } from '../../components/ui/StatusPill'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { useClassroomChannel } from '../../hooks/useClassroomChannel'
import { homePath } from '../../utils/home-path'
import type {
  AnnotationPosition,
  ClassroomSnapshotResult,
  SharedAnnotation,
} from '../../types/domain'

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
  const navigate = useNavigate()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [draftPosition, setDraftPosition] = useState<AnnotationPosition | null>(null)
  const [newContent, setNewContent] = useState('')
  /** 暫離確認對話框 */
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  /** 瀏覽器全屏狀態（Esc 等預設行為退出時由 fullscreenchange 同步） */
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement))
  /** 進入課堂後只嘗試一次預設全屏（瀏覽器要求使用者手勢，被阻擋時靜默降級） */
  const fullscreenTriedRef = useRef(false)
  /** 投影片全屏目標：只放大投影片（含標註層），不含頂欄與其他卡片。
   *  以 state 保存元素：標註相關彈層（Modal／Popover／Tooltip）須 portal 到此容器內，
   *  否則全屏時 portal 到 body 的彈層在全屏元素之外無法渲染 */
  const [slideFsEl, setSlideFsEl] = useState<HTMLDivElement | null>(null)
  /** 全屏時彈層的 portal 目標；非全屏或元素未掛載時回退預設（body） */
  const popupPortalProps = slideFsEl ? { target: slideFsEl } : undefined
  /** 已確認的最新狀態版本：較舊的推送事件直接忽略，不回退到舊頁（TASK-141） */
  const stateVersionRef = useRef(0)

  // 即時通道：優先 WebSocket，降級 SSE，心跳逾時再降級輪詢（REQ-008 延遲優化）
  const channel = useClassroomChannel({
    classroomId,
    guestId,
    enabled: Boolean(classroomId),
    onEvent: (payload) => {
      const stateVersion =
        typeof payload.stateVersion === 'number' ? payload.stateVersion : undefined
      if (stateVersion !== undefined && stateVersion < stateVersionRef.current) {
        return
      }
      if (payload.type === 'shared-annotation') {
        // 共享標註變更不影響頁碼版本，只重整共享層（REQ-011 即時同步）
        void queryClient.invalidateQueries({ queryKey: ['shared-annotations', classroomId] })
        return
      }
      if (payload.type === 'activity') {
        // 簽到發布／結束／人數變更不影響頁碼版本，只重整活動（REQ-014 即時同步）
        void queryClient.invalidateQueries({ queryKey: ['activities', classroomId] })
        return
      }
      if (stateVersion === undefined) return
      stateVersionRef.current = stateVersion
      // 翻頁事件直接附新頁圖片位址：立即更新快取換頁，不等快照往返（REQ-008 延遲優化）
      queryClient.setQueryData<ClassroomSnapshotResult>(
        ['classroom-snapshot', classroomId, guestId],
        (previous) =>
          previous
            ? {
                ...previous,
                snapshot: {
                  ...previous.snapshot,
                  pageIndex:
                    typeof payload.pageIndex === 'number'
                      ? payload.pageIndex
                      : previous.snapshot.pageIndex,
                  pageCount:
                    typeof payload.pageCount === 'number'
                      ? payload.pageCount
                      : previous.snapshot.pageCount,
                  stateVersion,
                  pageImageUrl:
                    typeof payload.pageImageUrl === 'string'
                      ? payload.pageImageUrl
                      : previous.snapshot.pageImageUrl,
                },
              }
            : previous,
      )
      // 仍以權威快照校正（預取清單、課堂狀態等），不阻擋上面的即時換頁
      void queryClient.invalidateQueries({ queryKey: ['classroom-snapshot', classroomId, guestId] })
    },
  })
  const live = channel.live

  const snapshotQuery = useQuery({
    queryKey: ['classroom-snapshot', classroomId, guestId],
    queryFn: () => classroomApi.snapshot(classroomId, guestId),
    enabled: Boolean(classroomId),
    // 推送通道失效時加密輪詢補上即時性；正常時 3 秒輪詢作後備
    refetchInterval: online ? (live ? POLL_MS : POLL_MS / 2) : false,
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

  // 共享標註層（REQ-011／012）：學生可見 VISIBLE 項目；訪客不查詢不顯示；
  // 推送通道失效（降級輪詢）時開 3 秒輪詢兜底，避免只自己看得到變更
  const sharedQuery = useQuery({
    queryKey: ['shared-annotations', classroomId, snapshot?.pageIndex ?? 0],
    queryFn: () => sharedAnnotationApi.list(classroomId, snapshot?.pageIndex ?? 0),
    enabled: Boolean(isStudentParticipant && snapshot),
    refetchInterval: online && !live ? POLL_MS : false,
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

  // 全屏狀態追蹤：Esc 等瀏覽器預設退出方式由 fullscreenchange 同步到按鈕顯示
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 進入課堂後嘗試預設全屏一次（瀏覽器要求使用者手勢；被阻擋時靜默降級，可用「全屏顯示」手動進入）
  useEffect(() => {
    if (fullscreenTriedRef.current || !snapshot || !slideFsEl) return
    fullscreenTriedRef.current = true
    void slideFsEl.requestFullscreen?.().catch(() => undefined)
  }, [snapshot, slideFsEl])

  const enterFullscreen = () => {
    void slideFsEl?.requestFullscreen?.().catch(() => undefined)
  }

  /** 暫離：確認後先退出全屏再離開；學生回其首頁、訪客回加入頁 */
  const handleLeaveConfirm = () => {
    setLeaveConfirmOpen(false)
    const exit = document.fullscreenElement
      ? document.exitFullscreen().catch(() => undefined)
      : Promise.resolve()
    void exit.finally(() => navigate(user ? homePath(user.role) : '/join'))
  }

  // 記錄已確認的最新狀態版本（只升不降）
  const confirmedVersion = snapshot?.stateVersion
  useEffect(() => {
    if (typeof confirmedVersion === 'number' && confirmedVersion > stateVersionRef.current) {
      stateVersionRef.current = confirmedVersion
    }
  }, [confirmedVersion])

  // 預取相鄰頁圖片（快照提供後兩頁＋前一頁）：老師翻頁時立即顯示，不等待下載（REQ-008 延遲優化）
  const prefetchKey = (snapshot?.prefetchImageUrls ?? []).join('|')
  useEffect(() => {
    if (!prefetchKey) return
    for (const url of prefetchKey.split('|')) {
      const image = new Image()
      image.src = url
    }
  }, [prefetchKey])

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
        <Tooltip
          key={annotation.id}
          label={annotation.content}
          withArrow
          portalProps={popupPortalProps}
        >
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
        px={32}
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
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <Button
            variant="default"
            leftSection={<IconDoorExit size={18} aria-hidden />}
            onClick={() => setLeaveConfirmOpen(true)}
            aria-label="暫離課堂"
          >
            暫離
          </Button>
          <div style={{ minWidth: 0 }}>
            <Text fz={14} c="#5D7184">
              {data?.courseName ?? '即時課堂'}
            </Text>
            <Text fz={24} fw={700} c="#17324D" truncate>
              {classroom?.name ?? '課堂'}
            </Text>
          </div>
        </Group>
        <Group gap="md" wrap="nowrap">
          {!isFullscreen ? (
            <Button
              variant="light"
              color="teal"
              leftSection={<IconMaximize size={18} aria-hidden />}
              onClick={enterFullscreen}
            >
              全屏顯示
            </Button>
          ) : null}
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
                <div ref={setSlideFsEl} className="md-slide-fs">
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
                            portalTarget={slideFsEl}
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
                </div>
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
        portalProps={popupPortalProps}
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

      <ConfirmDialog
        opened={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        title="暫離課堂"
        message="確定要暫離課堂嗎？你可以隨時透過課堂碼或課程頁再次進入。"
        confirmLabel="暫離"
        cancelLabel="繼續觀看"
        onConfirm={handleLeaveConfirm}
      />
    </Box>
  )
}
