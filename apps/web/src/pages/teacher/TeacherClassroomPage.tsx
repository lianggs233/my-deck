import { Button, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconLock,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { classroomApi, coursewareApi } from '../../api/mvp'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { PageHeading } from '../../components/ui/PageHeading'
import { SlideCanvas } from '../../components/ui/SlideCanvas'
import { StatusPill } from '../../components/ui/StatusPill'
import type { ClassroomDetail, PageDirection } from '../../types/domain'

const secondaryButton = {
  root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
} as const

/** 老師即時授課控制頁（REQ-006）：頁碼／翻頁／加入資訊開關，不含學生或訪客控制項 */
export function TeacherClassroomPage() {
  const { courseId = '', classroomId = '' } = useParams()
  const queryClient = useQueryClient()
  const { showError } = useErrorAlert()
  const [showJoinInfo, setShowJoinInfo] = useState(true)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

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

  const turnMutation = useMutation({
    mutationFn: (direction: PageDirection) =>
      classroomApi.turnPage(classroomId, direction, classroom?.stateVersion ?? 1),
    onSuccess: (state) => {
      queryClient.setQueryData<ClassroomDetail>(['classroom', courseId, classroomId], (previous) =>
        previous
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
      showError(cause instanceof Error ? cause.message : '翻頁失敗，請稍後再試。')
      // 版本衝突或網路失敗時，以伺服器狀態為準
      await queryClient.invalidateQueries({ queryKey: ['classroom', courseId, classroomId] })
    },
  })

  const classroomLoadError = classroomQuery.error
  useEffect(() => {
    if (classroomLoadError) {
      showError(
        classroomLoadError instanceof Error
          ? classroomLoadError.message
          : '課堂不存在或你沒有權限查看。',
      )
    }
  }, [classroomLoadError, showError])

  const coursewareLoadError = coursewareQuery.error
  useEffect(() => {
    if (coursewareLoadError) {
      showError(
        coursewareLoadError instanceof Error ? coursewareLoadError.message : '課件載入失敗。',
      )
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
            />
            <Group justify="center" gap="md">
              <Button
                variant="default"
                styles={secondaryButton}
                leftSection={<IconChevronLeft size={16} aria-hidden />}
                disabled={!canPrev}
                onClick={() => turnMutation.mutate('PREV')}
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
                onClick={() => turnMutation.mutate('NEXT')}
              >
                下一頁
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Paper
          radius="xl"
          bg="#FFFFFF"
          p="xl"
          style={{ border: '1px solid #D8E2E8', flex: '1 1 22rem' }}
        >
          <Stack gap="md">
            <Group justify="space-between">
              <Text fz={20} fw={700} c="#17324D">
                加入資訊
              </Text>
              <Button variant="subtle" size="sm" onClick={() => setShowJoinInfo((value) => !value)}>
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
      </Group>
    </Stack>
  )
}
