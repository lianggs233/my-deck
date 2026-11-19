import {
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconLock,
  IconPresentation,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { annotationApi, coursewareApi } from '../../api/mvp'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { SlideCanvas } from '../../components/ui/SlideCanvas'
import { StatusPill } from '../../components/ui/StatusPill'
import type { Annotation, AnnotationPosition } from '../../types/domain'

const secondaryButton = {
  root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
} as const

const dangerButton = {
  root: {
    background: '#FFFFFF',
    border: '1px solid #B42318',
    color: '#B42318',
  },
} as const

const MAX_LENGTH = 2000

/** 「移動位置」模式狀態：original 為服務端原位置，candidate 為拖動／待確認的候選位置 */
interface MoveState {
  annotationId: string
  original: AnnotationPosition
  candidate: AnnotationPosition
  version: number
  dragging: boolean
}

function positionLabel(position: AnnotationPosition) {
  const horizontal = position.x >= 0.5 ? '右' : '左'
  const vertical = position.y >= 0.5 ? '下方' : '上方'
  return `頁面${horizontal}${vertical}方`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })
}

/** 學生課件預覽：逐頁瀏覽 + 個人標註（OL-010 編輯器 / OL-011 詳情） */
export function StudentCoursewarePreviewPage() {
  const { courseId = '', coursewareId = '' } = useParams()
  const queryClient = useQueryClient()
  const [pageIndex, setPageIndex] = useState(0)
  const [draftPosition, setDraftPosition] = useState<AnnotationPosition | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorText, setEditorText] = useState('')
  const [editingId, setEditingId] = useState('')
  const [detail, setDetail] = useState<Annotation | null>(null)
  const [moveState, setMoveState] = useState<MoveState | null>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  const coursewareQuery = useQuery({
    queryKey: ['courseware', courseId, coursewareId],
    queryFn: () => coursewareApi.get(courseId, coursewareId),
    enabled: Boolean(courseId && coursewareId),
  })
  const annotationsQuery = useQuery({
    queryKey: ['annotations', courseId, coursewareId, pageIndex],
    queryFn: () => annotationApi.list(courseId, coursewareId, pageIndex),
    enabled: Boolean(courseId && coursewareId),
  })

  const invalidateAnnotations = () =>
    queryClient.invalidateQueries({ queryKey: ['annotations', courseId, coursewareId] })

  const createMutation = useMutation({
    mutationFn: () =>
      annotationApi.create(courseId, coursewareId, {
        pageIndex,
        content: editorText,
        position: draftPosition ?? { x: 0.5, y: 0.5 },
      }),
    onSuccess: async () => {
      closeEditor()
      await invalidateAnnotations()
    },
  })
  const updateMutation = useMutation({
    mutationFn: () =>
      annotationApi.update(courseId, coursewareId, editingId, {
        content: editorText,
        expectedVersion:
          annotationsQuery.data?.find((annotation) => annotation.id === editingId)?.version ?? 1,
      }),
    onSuccess: async () => {
      closeEditor()
      setDetail(null)
      await invalidateAnnotations()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (annotation: Annotation) =>
      annotationApi.remove(courseId, coursewareId, annotation.id),
    onSuccess: async () => {
      setDetail(null)
      await invalidateAnnotations()
    },
  })
  // TASK-172～174：移動標註位置（PATCH 只帶 position＋expectedVersion，文字／頁面／所有權不變）
  const moveMutation = useMutation({
    mutationFn: (input: { id: string; position: AnnotationPosition; expectedVersion: number }) =>
      annotationApi.update(courseId, coursewareId, input.id, {
        position: input.position,
        expectedVersion: input.expectedVersion,
      }),
    onSuccess: async () => {
      setMoveState(null)
      await invalidateAnnotations()
    },
    onError: async (cause) => {
      // 失敗（服務端拒絕／409 衝突／斷網或結果未知）：退出移動模式並重新拉取，
      // 標記回到服務端原位置，絕不保留只存在於本地的移動成功狀態
      setMoveState(null)
      showError(
        cause instanceof Error
          ? `${cause.message}（位置未變更，請重新移動。）`
          : '移動失敗，位置未變更，請重新移動。',
      )
      await invalidateAnnotations()
    },
  })

  const submitting = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error ?? updateMutation.error

  const { showError } = useErrorAlert()
  useEffect(() => {
    if (mutationError) {
      showError(mutationError instanceof Error ? mutationError.message : '保存標註失敗')
    }
  }, [mutationError, showError])

  const coursewareLoadError = coursewareQuery.error
  useEffect(() => {
    if (coursewareLoadError) {
      showError(
        coursewareLoadError instanceof Error
          ? coursewareLoadError.message
          : '課件不存在或你沒有權限查看。',
      )
    }
  }, [coursewareLoadError, showError])

  // 拖動期間以 window 事件追蹤指標；放開時在範圍內才產生候選位置，拖出範圍取消本次候選
  const dragging = moveState?.dragging ?? false
  useEffect(() => {
    if (!dragging) return
    function toCandidate(clientX: number, clientY: number) {
      const rect = canvasWrapRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return null
      const rawX = (clientX - rect.left) / rect.width
      const rawY = (clientY - rect.top) / rect.height
      return {
        inside: rawX >= 0 && rawX <= 1 && rawY >= 0 && rawY <= 1,
        position: {
          x: Math.min(1, Math.max(0, rawX)),
          y: Math.min(1, Math.max(0, rawY)),
        },
      }
    }
    function onPointerMove(event: globalThis.PointerEvent) {
      const result = toCandidate(event.clientX, event.clientY)
      if (!result) return
      setMoveState((state) => (state ? { ...state, candidate: result.position } : state))
    }
    function onPointerUp(event: globalThis.PointerEvent) {
      const result = toCandidate(event.clientX, event.clientY)
      setMoveState((state) => {
        if (!state) return state
        if (!result || !result.inside) {
          // 拖出幻燈片範圍：取消本次候選位置，回到服務端原位置，不保存無效座標
          return { ...state, dragging: false, candidate: state.original }
        }
        return { ...state, dragging: false, candidate: result.position }
      })
      if (!result || !result.inside) {
        showError('請將標記放在幻燈片範圍內，本次拖動已取消。')
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragging, showError])

  function startMove(annotation: Annotation) {
    setDetail(null)
    setMoveState({
      annotationId: annotation.id,
      original: annotation.position,
      candidate: annotation.position,
      version: annotation.version,
      dragging: false,
    })
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setMoveState((state) => (state ? { ...state, dragging: true } : state))
  }

  function cancelMove() {
    setMoveState(null)
  }

  function confirmMove() {
    if (!moveState || moveState.dragging || moveMutation.isPending) return
    moveMutation.mutate({
      id: moveState.annotationId,
      position: moveState.candidate,
      expectedVersion: moveState.version,
    })
  }

  function changePage(next: number) {
    if (moveState) {
      // 頁面切換：取消本次候選位置並提示
      setMoveState(null)
      showError('已切換頁面，本次移動已取消。')
    }
    setPageIndex(next)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditorText('')
    setEditingId('')
    setDraftPosition(null)
  }

  function openEditorForNew(position: AnnotationPosition) {
    setDraftPosition(position)
    setEditorText('')
    setEditingId('')
    setEditorOpen(true)
  }

  function openEditorForEdit(annotation: Annotation) {
    setEditorText(annotation.content)
    setEditingId(annotation.id)
    setEditorOpen(true)
  }

  function selectCanvasPosition(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    openEditorForNew({
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    })
  }

  function saveAnnotation() {
    if (editingId) updateMutation.mutate()
    else createMutation.mutate()
  }

  if (coursewareQuery.isPending) {
    return <Loader aria-label="課件載入中" mx="auto" my="xl" />
  }

  if (!coursewareQuery.data) {
    // 錯誤已統一由頂部 Alert 顯示（見上方 useEffect）
    return null
  }

  const courseware = coursewareQuery.data
  const page = courseware.pages[pageIndex] ?? courseware.pages[0]
  const annotations = annotationsQuery.data ?? []

  const annotationDots = (
    <>
      {moveState ? (
        // 服務端原位置殘影：拖動參考；取消或失敗時標記回到此處
        <Box
          aria-hidden
          style={{
            position: 'absolute',
            left: `${moveState.original.x * 100}%`,
            top: `${moveState.original.y * 100}%`,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '2px dashed #5D7184',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      {annotations.map((annotation) => {
        const isMoving = moveState?.annotationId === annotation.id
        const position = isMoving ? moveState.candidate : annotation.position
        return (
          <Box
            key={annotation.id}
            component="button"
            type="button"
            aria-label={isMoving ? '拖動以移動標註位置' : `查看標註：${annotation.content}`}
            onClick={(event) => {
              event.stopPropagation()
              if (moveState) return
              setDetail(annotation)
            }}
            onPointerDown={isMoving ? beginDrag : undefined}
            style={{
              position: 'absolute',
              left: `${position.x * 100}%`,
              top: `${position.y * 100}%`,
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: '50%',
              background: '#FFC94A',
              border: isMoving ? '3px solid #0B6455' : '2px solid #0B6455',
              boxShadow: isMoving ? '0 0 0 4px rgba(11, 100, 85, 0.25)' : undefined,
              transform: 'translate(-50%, -50%)',
              cursor: isMoving ? (moveState.dragging ? 'grabbing' : 'grab') : 'pointer',
              pointerEvents: moveState && !isMoving ? 'none' : 'auto',
              touchAction: isMoving ? 'none' : 'auto',
              zIndex: isMoving ? 2 : 1,
            }}
          />
        )
      })}
    </>
  )

  return (
    <Stack gap={32}>
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="lg" wrap="nowrap">
          <Button
            component={Link}
            to={`/student/courses/${courseId}`}
            variant="default"
            leftSection={<IconArrowLeft size={16} aria-hidden />}
            styles={secondaryButton}
          >
            返回課程
          </Button>
          <Group gap="sm" wrap="nowrap">
            <Box c="#17324D">
              <IconPresentation size={24} aria-hidden />
            </Box>
            <Title order={3} c="#17324D" lh={1.2}>
              {courseware.fileName}
            </Title>
          </Group>
        </Group>
        <StatusPill tone="mint">
          第 {page?.pageNumber ?? 1} / {courseware.pageCount} 頁
        </StatusPill>
      </Group>

      <Box ref={canvasWrapRef}>
        <SlideCanvas
          pageNumber={page?.pageNumber ?? 1}
          totalPages={courseware.pageCount}
          imageUrl={page?.imageUrl || undefined}
          onClick={moveState ? undefined : selectCanvasPosition}
          interactive={!moveState}
          annotations={annotationDots}
        />
      </Box>

      <Group justify="space-between">
        <Button
          variant="default"
          leftSection={<IconChevronLeft size={16} aria-hidden />}
          styles={secondaryButton}
          disabled={pageIndex === 0}
          onClick={() => changePage(Math.max(0, pageIndex - 1))}
        >
          上一頁
        </Button>
        {moveState ? (
          <Group gap="sm" justify="center" wrap="nowrap">
            <Text fz={16} c="#0B6455" fw={600}>
              拖動黃色標記到新位置（候選位置：x {moveState.candidate.x.toFixed(3)} · y{' '}
              {moveState.candidate.y.toFixed(3)}）
            </Text>
            <Button
              variant="default"
              styles={secondaryButton}
              onClick={cancelMove}
              disabled={moveMutation.isPending}
            >
              取消移動
            </Button>
            <Button
              loading={moveMutation.isPending}
              disabled={moveState.dragging}
              onClick={confirmMove}
            >
              確認保存新位置
            </Button>
          </Group>
        ) : (
          <Text fz={16} c="#5D7184">
            點選頁面任何位置可新增個人標註
          </Text>
        )}
        <Button
          rightSection={<IconChevronRight size={16} aria-hidden />}
          disabled={pageIndex >= courseware.pageCount - 1}
          onClick={() => changePage(Math.min(courseware.pageCount - 1, pageIndex + 1))}
        >
          下一頁
        </Button>
      </Group>

      {/* OL-010 個人標註編輯器 */}
      <Modal opened={editorOpen} onClose={closeEditor} withCloseButton={false} centered size={560}>
        <Stack gap="lg">
          <div>
            <Title order={2} c="#17324D">
              個人標註
            </Title>
            <Text fz={16} c="#5D7184" mt={4}>
              只有你可以看到這則標註。
            </Text>
          </div>
          <StatusPill tone="blue">第 {page?.pageNumber ?? pageIndex + 1} 頁 · 個人</StatusPill>
          <Textarea
            label="標註內容"
            placeholder="記下這一頁的重點、疑問或自己的想法……"
            value={editorText}
            onChange={(event) => setEditorText(event.currentTarget.value)}
            minRows={6}
            maxLength={MAX_LENGTH}
            styles={{ input: { minHeight: 150 } }}
            data-autofocus
          />
          <Text fz={14} c="#5D7184" ta="right" mt={-8}>
            {editorText.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
          </Text>
          <div className="md-notice md-notice-blue">
            <IconLock size={18} stroke={1.8} aria-hidden style={{ flexShrink: 0 }} />
            <Text fz={16} fw={600}>
              個人內容不會顯示給老師或其他學生
            </Text>
          </div>
          <Group grow>
            <Button variant="default" styles={secondaryButton} onClick={closeEditor}>
              取消
            </Button>
            <Button loading={submitting} disabled={!editorText.trim()} onClick={saveAnnotation}>
              保存標註
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* OL-011 個人標註詳情 */}
      <Modal
        opened={Boolean(detail)}
        onClose={() => setDetail(null)}
        withCloseButton={false}
        centered
        size={520}
      >
        {detail ? (
          <Stack gap="lg">
            <div>
              <Title order={2} c="#17324D">
                個人標註
              </Title>
              <Text fz={16} c="#5D7184" mt={4}>
                第 {detail.pageIndex + 1} 頁 · 今天 {formatTime(detail.updatedAt)}
              </Text>
            </div>
            <StatusPill tone="blue">僅本人可見</StatusPill>
            <Paper bg="#F5F8F6" radius="lg" p="lg">
              <Text fz={16} c="#17324D" lh={1.7}>
                {detail.content}
              </Text>
            </Paper>
            <Text fz={16} c="#5D7184">
              位置：{positionLabel(detail.position)}
            </Text>
            <Group grow>
              <Button
                variant="default"
                styles={dangerButton}
                loading={removeMutation.isPending}
                onClick={() => removeMutation.mutate(detail)}
              >
                刪除
              </Button>
              <Button variant="default" styles={secondaryButton} onClick={() => setDetail(null)}>
                關閉
              </Button>
              <Button variant="default" styles={secondaryButton} onClick={() => startMove(detail)}>
                移動位置
              </Button>
              <Button
                onClick={() => {
                  openEditorForEdit(detail)
                }}
              >
                編輯標註
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  )
}
