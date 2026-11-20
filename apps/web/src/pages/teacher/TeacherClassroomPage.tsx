import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardCheck,
  IconCopy,
  IconListCheck,
  IconLock,
  IconMessagePlus,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type MouseEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { activityApi, classroomApi, coursewareApi, sharedAnnotationApi } from '../../api/mvp'
import { useAuth } from '../../auth/useAuth'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { PageHeading } from '../../components/ui/PageHeading'
import { SharedAnnotationLayer } from '../../components/ui/SharedAnnotationLayer'
import { SlideCanvas } from '../../components/ui/SlideCanvas'
import { StatusPill } from '../../components/ui/StatusPill'
import type {
  AnnotationPosition,
  ClassroomDetail,
  PageDirection,
  SharedAnnotation,
  SharedReply,
  SharedVisibility,
} from '../../types/domain'

const secondaryButton = {
  root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
} as const

type ManageFilter = SharedVisibility | 'ALL'

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

/** 點擊畫布換算 0–1 相對座標（共享標註位置釘選頁面） */
function canvasPosition(event: MouseEvent<HTMLDivElement>): AnnotationPosition {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  }
}

/** 老師即時授課控制頁（REQ-006 翻頁；REQ-011～013 共享標註、留言回覆與管理） */
export function TeacherClassroomPage() {
  const { courseId = '', classroomId = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { showError } = useErrorAlert()
  const [showJoinInfo, setShowJoinInfo] = useState(true)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [annotateMode, setAnnotateMode] = useState(false)
  const [draftPosition, setDraftPosition] = useState<AnnotationPosition | null>(null)
  const [newContent, setNewContent] = useState('')
  const [permissionOpened, setPermissionOpened] = useState(false)
  const [manageOpened, setManageOpened] = useState(false)
  const [manageFilter, setManageFilter] = useState<ManageFilter>('ALL')
  const [clearOpened, setClearOpened] = useState(false)
  const [checkinConfirmOpened, setCheckinConfirmOpened] = useState(false)
  const [checkinIdemKey, setCheckinIdemKey] = useState('')

  const classroomQuery = useQuery({
    queryKey: ['classroom', courseId, classroomId],
    queryFn: () => classroomApi.get(courseId, classroomId),
    enabled: Boolean(courseId && classroomId),
  })
  const classroom = classroomQuery.data?.classroom
  const coursewareQuery = useQuery({
    queryKey: ['courseware', courseId, classroom?.coursewareId ?? ''],
    queryFn: () => coursewareApi.get(courseId, classroom?.coursewareId ?? ''),
    enabled: Boolean(classroom?.coursewareId),
  })
  const joinInfoQuery = useQuery({
    queryKey: ['classroom-join-info', classroomId],
    queryFn: () => classroomApi.joinInfo(classroomId),
    enabled: Boolean(classroomId) && showJoinInfo,
    staleTime: 60_000,
  })

  // 畫布共享層只顯示可見標註；隱藏項目由「管理共享標註」處理
  const sharedQuery = useQuery({
    queryKey: ['shared-annotations', classroomId, classroom?.pageIndex ?? 0],
    queryFn: () => sharedAnnotationApi.list(classroomId, classroom?.pageIndex ?? 0),
    enabled: Boolean(classroom),
  })
  const manageQuery = useQuery({
    queryKey: ['shared-annotations-manage', classroomId, classroom?.pageIndex ?? 0, manageFilter],
    queryFn: () => sharedAnnotationApi.list(classroomId, classroom?.pageIndex ?? 0, manageFilter),
    enabled: manageOpened && Boolean(classroom),
  })
  const permissionsQuery = useQuery({
    queryKey: ['share-permissions', classroomId],
    queryFn: () => sharedAnnotationApi.listPermissions(classroomId),
    enabled: permissionOpened && Boolean(classroomId),
  })

  // 課堂簽到（REQ-014）：SSE 觸發為主，3 秒輪詢補上即時人數
  const activitiesQuery = useQuery({
    queryKey: ['activities', classroomId],
    queryFn: () => activityApi.list(classroomId),
    enabled: Boolean(classroom),
    refetchInterval: 3000,
  })
  const openActivity = activitiesQuery.data?.openActivity
  const activityItems = activitiesQuery.data?.items ?? []
  // 後端列表不保證排序，取 createdAt 最新者作為「上次簽到」
  const latestActivity =
    openActivity ??
    activityItems.reduce<(typeof activityItems)[number] | undefined>(
      (latest, item) => (!latest || item.createdAt > latest.createdAt ? item : latest),
      undefined,
    )
  const checkinResultsQuery = useQuery({
    queryKey: ['activity-results', classroomId, latestActivity?.id ?? ''],
    queryFn: () => activityApi.results(classroomId, latestActivity?.id ?? ''),
    enabled: Boolean(classroom) && latestActivity?.status === 'CLOSED',
  })

  function invalidateShared() {
    void queryClient.invalidateQueries({ queryKey: ['shared-annotations', classroomId] })
    void queryClient.invalidateQueries({ queryKey: ['shared-annotations-manage', classroomId] })
  }

  function invalidateActivities() {
    void queryClient.invalidateQueries({ queryKey: ['activities', classroomId] })
    void queryClient.invalidateQueries({ queryKey: ['activity-results', classroomId] })
  }

  // SSE 觸發器：學生留言／標註變更即時重整共享層（REQ-011 即時同步）；輪詢由查詢本身補上
  useEffect(() => {
    if (!classroomId) return undefined
    const source = new EventSource(classroomApi.eventStreamUrl(classroomId))
    const onState = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data)) as { type?: string }
        if (payload.type === 'shared-annotation') {
          void queryClient.invalidateQueries({ queryKey: ['shared-annotations', classroomId] })
          void queryClient.invalidateQueries({
            queryKey: ['shared-annotations-manage', classroomId],
          })
        }
        if (payload.type === 'activity') {
          // 學生簽到／活動狀態變更即時重整（REQ-014）
          void queryClient.invalidateQueries({ queryKey: ['activities', classroomId] })
          void queryClient.invalidateQueries({ queryKey: ['activity-results', classroomId] })
        }
      } catch {
        // 無法解析的事件不影響控制頁，重新整理時以伺服器資料為準
      }
    }
    source.addEventListener('state', onState)
    return () => {
      source.removeEventListener('state', onState)
      source.close()
    }
  }, [classroomId, queryClient])

  const createSharedMutation = useMutation({
    mutationFn: (input: { content: string; position?: AnnotationPosition; groupId?: string }) =>
      sharedAnnotationApi.create(classroomId, {
        pageIndex: classroom?.pageIndex ?? 0,
        content: input.content,
        position: input.position,
        groupId: input.groupId,
      }),
    onSuccess: () => {
      invalidateShared()
      setDraftPosition(null)
      setNewContent('')
    },
    onError: (cause) => showError(errorMessage(cause, '建立共享標註失敗，請稍後再試。')),
  })
  const updateSharedMutation = useMutation({
    mutationFn: (input: { annotation: SharedAnnotation; content: string }) =>
      sharedAnnotationApi.update(classroomId, input.annotation.id, {
        expectedVersion: input.annotation.version,
        content: input.content,
      }),
    onSuccess: invalidateShared,
    onError: (cause) => showError(errorMessage(cause, '更新共享標註失敗。')),
  })
  const deleteSharedMutation = useMutation({
    mutationFn: (annotation: SharedAnnotation) =>
      sharedAnnotationApi.remove(classroomId, annotation.id),
    onSuccess: invalidateShared,
    onError: (cause) => showError(errorMessage(cause, '刪除共享標註失敗。')),
  })
  const replyMutation = useMutation({
    mutationFn: (input: { annotation: SharedAnnotation; content: string }) =>
      sharedAnnotationApi.addReply(classroomId, input.annotation.id, input.content),
    onSuccess: invalidateShared,
    onError: (cause) => showError(errorMessage(cause, '回覆失敗，請稍後再試。')),
  })
  const editReplyMutation = useMutation({
    mutationFn: (input: { reply: SharedReply; content: string }) =>
      sharedAnnotationApi.updateReply(classroomId, input.reply.id, {
        expectedVersion: input.reply.version,
        content: input.content,
      }),
    onSuccess: invalidateShared,
    onError: (cause) => showError(errorMessage(cause, '更新回覆失敗。')),
  })
  const deleteReplyMutation = useMutation({
    mutationFn: (reply: SharedReply) => sharedAnnotationApi.removeReply(classroomId, reply.id),
    onSuccess: invalidateShared,
    onError: (cause) => showError(errorMessage(cause, '刪除回覆失敗。')),
  })
  const visibilityMutation = useMutation({
    mutationFn: (input: { annotation: SharedAnnotation; visibility: SharedVisibility }) =>
      sharedAnnotationApi.setVisibility(classroomId, input.annotation.id, input.visibility),
    onSuccess: invalidateShared,
    onError: (cause) => showError(errorMessage(cause, '更新可見狀態失敗。')),
  })
  const clearPageMutation = useMutation({
    mutationFn: () => sharedAnnotationApi.clearPage(classroomId, classroom?.pageIndex ?? 0),
    onSuccess: () => {
      invalidateShared()
      setClearOpened(false)
      setManageOpened(false)
    },
    onError: (cause) => showError(errorMessage(cause, '清除共享標註失敗。')),
  })
  const permissionMutation = useMutation({
    mutationFn: (input: { studentId: string; granted: boolean }) =>
      sharedAnnotationApi.setPermission(classroomId, input.studentId, input.granted),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['share-permissions', classroomId] })
    },
    onError: (cause) => showError(errorMessage(cause, '更新共享權限失敗。')),
  })

  // 發起簽到：建立（帶每次對話框一組冪等鍵，重試不重複建立）＋發布一氣呵成
  const startCheckinMutation = useMutation({
    mutationFn: async () => {
      const created = await activityApi.create(classroomId, checkinIdemKey)
      return activityApi.publish(classroomId, created.id)
    },
    onSuccess: () => {
      invalidateActivities()
      setCheckinConfirmOpened(false)
    },
    onError: (cause) => showError(errorMessage(cause, '發起簽到失敗，請稍後再試。')),
  })
  const closeCheckinMutation = useMutation({
    mutationFn: (activityId: string) => activityApi.close(classroomId, activityId),
    onSuccess: invalidateActivities,
    onError: (cause) => showError(errorMessage(cause, '結束簽到失敗，請稍後再試。')),
  })

  const sharedBusy =
    createSharedMutation.isPending ||
    updateSharedMutation.isPending ||
    deleteSharedMutation.isPending ||
    replyMutation.isPending ||
    editReplyMutation.isPending ||
    deleteReplyMutation.isPending

  const turnMutation = useMutation({
    mutationFn: (request: { direction: PageDirection; pageIndex?: number }) =>
      classroomApi.turnPage(
        classroomId,
        request.direction,
        classroom?.stateVersion ?? 1,
        request.pageIndex,
      ),
    onSuccess: (state) => {
      queryClient.setQueryData<ClassroomDetail>(['classroom', courseId, classroomId], (previous) =>
        // 舊請求的延遲回應不得覆蓋較新頁碼（TASK-142／TASK-145）
        previous && state.stateVersion > previous.classroom.stateVersion
          ? {
              ...previous,
              classroom: {
                ...previous.classroom,
                pageIndex: state.pageIndex,
                pageCount: state.pageCount,
                stateVersion: state.stateVersion,
              },
            }
          : previous,
      )
    },
    onError: async (cause) => {
      showError(errorMessage(cause, '翻頁失敗，請稍後再試。'))
      // 版本衝突或網路失敗時，以伺服器狀態為準
      await queryClient.invalidateQueries({ queryKey: ['classroom', courseId, classroomId] })
    },
  })

  const classroomLoadError = classroomQuery.error
  useEffect(() => {
    if (classroomLoadError) {
      showError(errorMessage(classroomLoadError, '課堂不存在或你沒有權限查看。'))
    }
  }, [classroomLoadError, showError])

  const coursewareLoadError = coursewareQuery.error
  useEffect(() => {
    if (coursewareLoadError) {
      showError(errorMessage(coursewareLoadError, '課件載入失敗。'))
    }
  }, [coursewareLoadError, showError])

  if (classroomQuery.isPending) {
    return <Loader aria-label="課堂載入中" mx="auto" my="xl" />
  }

  if (!classroomQuery.data || !classroom) {
    // 錯誤已統一由頂部 Alert 顯示（見上方 useEffect）
    return null
  }

  const pages = coursewareQuery.data?.pages ?? []
  const currentPage = pages[classroom.pageIndex]
  const code = joinInfoQuery.data?.code ?? classroom.code ?? ''
  const joinUrl = joinInfoQuery.data?.joinUrl ?? (code ? `/join/${code}` : '')
  const canPrev = classroom.pageIndex > 0 && !turnMutation.isPending
  const canNext = classroom.pageIndex < classroom.pageCount - 1 && !turnMutation.isPending
  const sharedItems = sharedQuery.data?.items ?? []
  const manageItems = manageQuery.data?.items ?? []
  const permissionItems = permissionsQuery.data ?? []

  /** 複製課堂碼：剪貼簿不可用時明確提示手動選取，不誤報成功 */
  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <Stack gap={32}>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Text fz={20} fw={600} c="#12836F">
            老師
          </Text>
          <Button
            component={Link}
            to={`/teacher/courses/${courseId}`}
            variant="default"
            w={160}
            leftSection={<IconArrowLeft size={16} aria-hidden />}
            styles={secondaryButton}
          >
            返回課程
          </Button>
        </Stack>
        <Group gap="md">
          <StatusPill tone="mint">課堂進行中</StatusPill>
        </Group>
      </Group>

      <PageHeading
        title={classroom.name}
        meta={`${classroomQuery.data.courseName} · 第 ${classroom.pageIndex + 1} / ${classroom.pageCount} 頁`}
      />

      <Group align="flex-start" gap="lg" wrap="wrap">
        <Paper
          radius="xl"
          bg="#FFFFFF"
          p="xl"
          style={{ border: '1px solid #D8E2E8', flex: '1 1 40rem' }}
        >
          <Stack gap="lg">
            <SlideCanvas
              pageNumber={classroom.pageIndex + 1}
              totalPages={classroom.pageCount}
              imageUrl={currentPage?.imageUrl || undefined}
              interactive={annotateMode}
              onClick={(event) => {
                if (!annotateMode) return
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
                <SharedAnnotationLayer
                  annotations={sharedItems}
                  canShare
                  currentUserId={user?.id ?? ''}
                  isTeacher
                  busy={sharedBusy}
                  onAddComment={(groupId, content) =>
                    createSharedMutation.mutate({ groupId, content })
                  }
                  onEdit={(annotation, content) =>
                    updateSharedMutation.mutate({ annotation, content })
                  }
                  onDelete={(annotation) => deleteSharedMutation.mutate(annotation)}
                  onReply={(annotation, content) => replyMutation.mutate({ annotation, content })}
                  onEditReply={(reply, content) => editReplyMutation.mutate({ reply, content })}
                  onDeleteReply={(reply) => deleteReplyMutation.mutate(reply)}
                />
              }
            />
            {annotateMode ? (
              <Text fz={14} c="#0B6455" ta="center" role="status">
                標註模式：點擊投影片任何位置建立共享標註
              </Text>
            ) : null}
            <Group justify="center" gap="md">
              <Button
                variant="default"
                styles={secondaryButton}
                leftSection={<IconChevronLeft size={16} aria-hidden />}
                disabled={!canPrev}
                onClick={() => turnMutation.mutate({ direction: 'PREV' })}
              >
                上一頁
              </Button>
              <Text fz={16} fw={600} c="#17324D">
                {classroom.pageIndex + 1} / {classroom.pageCount}
              </Text>
              <Button
                variant="default"
                styles={secondaryButton}
                rightSection={<IconChevronRight size={16} aria-hidden />}
                disabled={!canNext}
                onClick={() => turnMutation.mutate({ direction: 'NEXT' })}
              >
                下一頁
              </Button>
            </Group>

            {pages.length > 1 ? (
              <Box
                component="nav"
                aria-label="選擇頁面"
                style={{
                  display: 'flex',
                  gap: 12,
                  overflowX: 'auto',
                  paddingBottom: 4,
                }}
              >
                {pages.map((page) => {
                  const isCurrent = page.pageIndex === classroom.pageIndex
                  return (
                    <Box
                      key={page.pageIndex}
                      component="button"
                      type="button"
                      aria-label={`跳至第 ${page.pageNumber} 頁`}
                      aria-current={isCurrent ? 'page' : undefined}
                      disabled={turnMutation.isPending || isCurrent}
                      onClick={() =>
                        turnMutation.mutate({ direction: 'GOTO', pageIndex: page.pageIndex })
                      }
                      style={{
                        flexShrink: 0,
                        width: 128,
                        aspectRatio: '16 / 9',
                        padding: 0,
                        borderRadius: 12,
                        border: isCurrent ? '3px solid #12836F' : '1px solid #D8E2E8',
                        background: '#FFFFFF',
                        cursor: turnMutation.isPending || isCurrent ? 'default' : 'pointer',
                        opacity: turnMutation.isPending && !isCurrent ? 0.6 : 1,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      {page.thumbnailUrl ? (
                        <img
                          src={page.thumbnailUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Text fz={14} c="#5D7184" ta="center" mt="25%">
                          第 {page.pageNumber} 頁
                        </Text>
                      )}
                    </Box>
                  )
                })}
              </Box>
            ) : null}
          </Stack>
        </Paper>

        <Stack gap="lg" style={{ flex: '1 1 22rem' }}>
          <Paper radius="xl" bg="#FFFFFF" p="xl" style={{ border: '1px solid #D8E2E8' }}>
            <Stack gap="md">
              <Group justify="space-between">
                <Text fz={20} fw={700} c="#17324D">
                  加入資訊
                </Text>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => setShowJoinInfo((value) => !value)}
                >
                  {showJoinInfo ? '隱藏加入資訊' : '顯示加入資訊'}
                </Button>
              </Group>

              {showJoinInfo ? (
                <>
                  <Stack gap={4}>
                    <Text fz={16} c="#5D7184">
                      課堂碼
                    </Text>
                    <Text
                      fz={40}
                      fw={700}
                      c="#12836F"
                      style={{ letterSpacing: '0.12em', userSelect: 'all' }}
                    >
                      {code || '------'}
                    </Text>
                  </Stack>
                  <Group gap="sm">
                    <Button
                      variant="default"
                      size="sm"
                      h={40}
                      leftSection={<IconCopy size={16} aria-hidden />}
                      styles={secondaryButton}
                      onClick={() => void copyCode()}
                      disabled={!code}
                    >
                      {copyState === 'copied'
                        ? '已複製'
                        : copyState === 'failed'
                          ? '無法複製，請手動選取'
                          : '複製課堂碼'}
                    </Button>
                  </Group>
                  <div className="md-notice md-notice-blue">
                    <IconLock size={18} stroke={1.8} aria-hidden style={{ flexShrink: 0 }} />
                    <Text fz={16} fw={600}>
                      課堂碼只在課堂進行中有效
                    </Text>
                  </div>
                  {joinUrl ? (
                    <Text fz={16} c="#5D7184" style={{ wordBreak: 'break-all' }}>
                      加入連結：{joinUrl}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text fz={16} c="#5D7184">
                  加入資訊已隱藏，可隨時重新顯示。
                </Text>
              )}
            </Stack>
          </Paper>

          <Paper radius="xl" bg="#FFFFFF" p="xl" style={{ border: '1px solid #D8E2E8' }}>
            <Stack gap="md">
              <Group justify="space-between">
                <Text fz={20} fw={700} c="#17324D">
                  課堂簽到
                </Text>
                {openActivity ? (
                  <Badge color="teal" variant="filled">
                    進行中
                  </Badge>
                ) : null}
              </Group>
              {activitiesQuery.isPending ? (
                <Loader aria-label="簽到載入中" mx="auto" />
              ) : openActivity ? (
                <>
                  <Text fz={16} c="#17324D">
                    已簽到{' '}
                    <Text component="span" fz={24} fw={700} c="#12836F">
                      {openActivity.submissionCount}
                    </Text>{' '}
                    / {openActivity.participantCount} 人
                  </Text>
                  <Button
                    variant="default"
                    styles={secondaryButton}
                    leftSection={<IconClipboardCheck size={16} aria-hidden />}
                    loading={closeCheckinMutation.isPending}
                    onClick={() => closeCheckinMutation.mutate(openActivity.id)}
                  >
                    結束簽到
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    leftSection={<IconClipboardCheck size={16} aria-hidden />}
                    onClick={() => {
                      setCheckinIdemKey(crypto.randomUUID())
                      setCheckinConfirmOpened(true)
                    }}
                  >
                    發起簽到
                  </Button>
                  {latestActivity?.status === 'CLOSED' ? (
                    checkinResultsQuery.isPending ? (
                      <Loader aria-label="簽到結果載入中" mx="auto" />
                    ) : checkinResultsQuery.data ? (
                      <Stack gap={6} mah={260} style={{ overflowY: 'auto' }}>
                        <Text fz={16} fw={600} c="#17324D">
                          上次簽到：已簽 {checkinResultsQuery.data.signed.length} 人，未簽{' '}
                          {checkinResultsQuery.data.unsigned.length} 人
                        </Text>
                        <Text fz={14} fw={600} c="#17324D">
                          已簽到
                        </Text>
                        {checkinResultsQuery.data.signed.length === 0 ? (
                          <Text fz={14} c="#5D7184">
                            無
                          </Text>
                        ) : (
                          checkinResultsQuery.data.signed.map((student) => (
                            <Text key={student.studentId} fz={14} c="#5D7184">
                              {student.displayName}・
                              {new Date(student.submittedAt).toLocaleTimeString('zh-TW', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          ))
                        )}
                        <Text fz={14} fw={600} c="#17324D">
                          未簽到
                        </Text>
                        <Text fz={14} c="#5D7184">
                          {checkinResultsQuery.data.unsigned.length === 0
                            ? '無'
                            : checkinResultsQuery.data.unsigned
                                .map((student) => student.displayName)
                                .join('、')}
                        </Text>
                      </Stack>
                    ) : null
                  ) : null}
                </>
              )}
            </Stack>
          </Paper>

          <Paper radius="xl" bg="#FFFFFF" p="xl" style={{ border: '1px solid #D8E2E8' }}>
            <Stack gap="md">
              <Group justify="space-between">
                <Text fz={20} fw={700} c="#17324D">
                  共享標註
                </Text>
                <Text fz={14} c="#5D7184">
                  本頁 {sharedItems.length} 則
                </Text>
              </Group>
              <Button
                variant={annotateMode ? 'filled' : 'default'}
                styles={annotateMode ? undefined : secondaryButton}
                leftSection={<IconMessagePlus size={16} aria-hidden />}
                onClick={() => {
                  setAnnotateMode((value) => !value)
                  setDraftPosition(null)
                }}
              >
                {annotateMode ? '退出標註模式' : '新增共享標註'}
              </Button>
              <Button
                variant="default"
                styles={secondaryButton}
                leftSection={<IconUsers size={16} aria-hidden />}
                onClick={() => setPermissionOpened(true)}
              >
                共享權限
              </Button>
              <Button
                variant="default"
                styles={secondaryButton}
                leftSection={<IconListCheck size={16} aria-hidden />}
                onClick={() => {
                  setManageFilter('ALL')
                  setManageOpened(true)
                }}
              >
                管理共享標註
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Group>

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

      <Modal
        opened={permissionOpened}
        onClose={() => setPermissionOpened(false)}
        title="共享標註權限"
        centered
        size={520}
      >
        <Stack gap="md">
          <Text fz={14} c="#5D7184">
            授權後學生可在本課堂新增共享標註，並編輯或刪除自己的標註；收回權限後既有內容保留，但不可再新增或修改。
          </Text>
          {permissionsQuery.isPending ? (
            <Loader aria-label="權限載入中" mx="auto" />
          ) : permissionItems.length === 0 ? (
            <Text fz={16} c="#5D7184" ta="center" py="md">
              尚未有學生加入本課堂
            </Text>
          ) : (
            permissionItems.map((student) => (
              <Group key={student.studentId} justify="space-between" wrap="nowrap">
                <Text fz={16} c="#17324D">
                  {student.displayName}
                </Text>
                <Switch
                  checked={student.granted}
                  disabled={permissionMutation.isPending}
                  onChange={(event) =>
                    permissionMutation.mutate({
                      studentId: student.studentId,
                      granted: event.currentTarget.checked,
                    })
                  }
                  aria-label={`共享權限：${student.displayName}`}
                />
              </Group>
            ))
          )}
        </Stack>
      </Modal>

      <Modal
        opened={manageOpened}
        onClose={() => setManageOpened(false)}
        title="管理共享標註"
        centered
        size={640}
      >
        <Stack gap="md">
          <SegmentedControl
            value={manageFilter}
            onChange={(value) => setManageFilter(value as ManageFilter)}
            data={[
              { value: 'ALL', label: '全部' },
              { value: 'VISIBLE', label: '可見' },
              { value: 'HIDDEN', label: '隱藏' },
            ]}
            aria-label="共享標註篩選"
          />
          <Stack gap="sm" mah={360} style={{ overflowY: 'auto' }}>
            {manageQuery.isPending ? (
              <Loader aria-label="共享標註載入中" mx="auto" />
            ) : manageItems.length === 0 ? (
              <Text fz={16} c="#5D7184" ta="center" py="md">
                此篩選沒有共享標註
              </Text>
            ) : (
              manageItems.map((annotation) => (
                <Group key={annotation.id} justify="space-between" wrap="nowrap" align="flex-start">
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Group gap={8} wrap="nowrap">
                      <Text fz={14} fw={600} c="#17324D">
                        {annotation.author.displayName}
                      </Text>
                      <Badge
                        size="sm"
                        variant={annotation.author.role === 'TEACHER' ? 'filled' : 'light'}
                        color={annotation.author.role === 'TEACHER' ? '#17324D' : '#12836F'}
                      >
                        {annotation.author.role === 'TEACHER' ? '老師' : '學生'}
                      </Badge>
                      {annotation.visibility === 'HIDDEN' ? (
                        <Badge size="sm" color="gray" variant="light">
                          已隱藏
                        </Badge>
                      ) : null}
                    </Group>
                    <Text fz={14} c="#5D7184" style={{ wordBreak: 'break-word' }}>
                      {annotation.content}
                    </Text>
                  </Stack>
                  <Button
                    size="xs"
                    variant="default"
                    disabled={visibilityMutation.isPending}
                    onClick={() =>
                      visibilityMutation.mutate({
                        annotation,
                        visibility: annotation.visibility === 'HIDDEN' ? 'VISIBLE' : 'HIDDEN',
                      })
                    }
                  >
                    {annotation.visibility === 'HIDDEN' ? '顯示' : '隱藏'}
                  </Button>
                </Group>
              ))
            )}
          </Stack>
          <Group justify="flex-end">
            <Button
              color="red"
              variant="light"
              leftSection={<IconTrash size={16} aria-hidden />}
              onClick={() => setClearOpened(true)}
            >
              清除本頁共享標註
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDialog
        opened={clearOpened}
        onClose={() => setClearOpened(false)}
        title="清除本頁共享標註"
        message="將永久清除本頁全部共享標註（包含已隱藏項目），清除後不可恢復；其他頁面與學生的個人標註不受影響。確定清除？"
        confirmLabel="確認清除"
        cancelLabel="取消"
        danger
        loading={clearPageMutation.isPending}
        onConfirm={() => clearPageMutation.mutate()}
      />

      <ConfirmDialog
        opened={checkinConfirmOpened}
        onClose={() => setCheckinConfirmOpened(false)}
        title="發起課堂簽到？"
        message="發起後，已加入課堂的學生可立即簽到；同一時間只會有一個進行中的活動。"
        confirmLabel="發起簽到"
        cancelLabel="取消"
        loading={startCheckinMutation.isPending}
        onConfirm={() => startCheckinMutation.mutate()}
      />
    </Stack>
  )
}
