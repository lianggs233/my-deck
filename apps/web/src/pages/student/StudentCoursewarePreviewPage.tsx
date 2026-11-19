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
import { useEffect, useState, type MouseEvent } from 'react'
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
      {annotations.map((annotation) => (
        <Box
          key={annotation.id}
          component="button"
          type="button"
          aria-label={`查看標註：${annotation.content}`}
          onClick={(event) => {
            event.stopPropagation()
            setDetail(annotation)
          }}
          style={{
            position: 'absolute',
            left: `${annotation.position.x * 100}%`,
            top: `${annotation.position.y * 100}%`,
            width: 20,
            height: 20,
            padding: 0,
            borderRadius: '50%',
            background: '#FFC94A',
            border: '2px solid #0B6455',
            transform: 'translate(-50%, -50%)',
            cursor: 'pointer',
          }}
        />
      ))}
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

      <SlideCanvas
        pageNumber={page?.pageNumber ?? 1}
        totalPages={courseware.pageCount}
        imageUrl={page?.imageUrl || undefined}
        onClick={selectCanvasPosition}
        interactive
        annotations={annotationDots}
      />

      <Group justify="space-between">
        <Button
          variant="default"
          leftSection={<IconChevronLeft size={16} aria-hidden />}
          styles={secondaryButton}
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
        >
          上一頁
        </Button>
        <Text fz={16} c="#5D7184">
          點選頁面任何位置可新增個人標註
        </Text>
        <Button
          rightSection={<IconChevronRight size={16} aria-hidden />}
          disabled={pageIndex >= courseware.pageCount - 1}
          onClick={() => setPageIndex((value) => Math.min(courseware.pageCount - 1, value + 1))}
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
