import { Button, Group, Loader, Paper, Stack, Text } from '@mantine/core'
import { IconArrowLeft, IconPresentation } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

import { coursewareApi } from '../../api/mvp'
import { CoursewareStatusPill } from '../../components/ui/CoursewareStatusPill'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { PageHeading } from '../../components/ui/PageHeading'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { SlideCanvas } from '../../components/ui/SlideCanvas'

function formatSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })
}

const secondaryButton = {
  root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
} as const

/** PG-013 老師課件詳情（轉換資訊 + 封面預覽 + 嘗試歷史） */
export function TeacherCoursewarePage() {
  const { courseId = '', coursewareId = '' } = useParams()

  const queryClient = useQueryClient()
  const coursewareQuery = useQuery({
    queryKey: ['courseware', courseId, coursewareId],
    queryFn: () => coursewareApi.get(courseId, coursewareId),
    enabled: Boolean(courseId && coursewareId),
    // 轉換為非同步背景工作：排隊/轉換中每 3 秒輪詢
    refetchInterval: (query) =>
      query.state.data && ['QUEUED', 'CONVERTING'].includes(query.state.data.status) ? 3000 : false,
  })
  const retryMutation = useMutation({
    mutationFn: () => coursewareApi.retry(courseId, coursewareId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['courseware', courseId, coursewareId] })
    },
  })

  const { showError } = useErrorAlert()
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

  if (coursewareQuery.isPending) {
    return <Loader aria-label="課件載入中" mx="auto" my="xl" />
  }

  if (!coursewareQuery.data) {
    // 錯誤已統一由頂部 Alert 顯示（見上方 useEffect）
    return null
  }

  const courseware = coursewareQuery.data

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
        <Group gap="md" wrap="nowrap">
          <Button
            component={Link}
            to={`/teacher/courses/${courseId}/courseware/${coursewareId}/preview`}
            variant="default"
            styles={secondaryButton}
          >
            逐頁預覽
          </Button>
          <Button disabled title="即時授課功能將於後續版本推出">
            開始授課
          </Button>
        </Group>
      </Group>

      <PageHeading
        title={courseware.fileName}
        meta={`${courseware.pageCount} 頁 · ${formatSize(courseware.sizeBytes)} · 今天 09:12 更新`}
      />

      <Group gap="md" align="center">
        <CoursewareStatusPill status={courseware.status} />
        {courseware.status === 'FAILED' || courseware.status === 'TIMED_OUT' ? (
          <>
            <Text fz={16} c="#B42318">
              {courseware.status === 'TIMED_OUT'
                ? '轉換逾時，可重新嘗試。'
                : '轉換失敗，可重新嘗試。'}
            </Text>
            <Button
              variant="default"
              size="sm"
              h={40}
              loading={retryMutation.isPending}
              styles={secondaryButton}
              onClick={() => retryMutation.mutate()}
            >
              重試轉換
            </Button>
          </>
        ) : (
          <Text fz={16} fw={600} c="#0B6455">
            {courseware.status === 'QUEUED' || courseware.status === 'CONVERTING'
              ? '課件轉換中，完成後即可預覽。'
              : '全部頁面已準備好，可以預覽或開始授課。'}
          </Text>
        )}
      </Group>

      <Group align="flex-start" gap="lg" wrap="wrap">
        <Paper
          radius="xl"
          bg="#FFFFFF"
          p="xl"
          style={{ border: '1px solid #D8E2E8', flex: '1 1 24rem' }}
        >
          <Stack gap="md">
            <Text fz={20} fw={700} c="#17324D">
              轉換資訊
            </Text>
            <Group justify="space-between" fz={16}>
              <Text c="#5D7184">目前狀態</Text>
              <CoursewareStatusPill status={courseware.status} />
            </Group>
            <Group justify="space-between" fz={16}>
              <Text c="#5D7184">輸出格式</Text>
              <Text fw={600} c="#17324D">
                {courseware.pageCount} 張 WebP 圖片
              </Text>
            </Group>
            <Group justify="space-between" fz={16}>
              <Text c="#5D7184">最近完成</Text>
              <Text fw={600} c="#17324D">
                今天 09:12
              </Text>
            </Group>
            <Group justify="space-between" fz={16}>
              <Text c="#5D7184">相容性</Text>
              <Text fw={600} c="#17324D">
                {courseware.status === 'READY_WITH_WARNINGS' ? '存在相容性警告' : '無已知問題'}
              </Text>
            </Group>
          </Stack>
        </Paper>

        <Paper
          radius="xl"
          bg="#FFFFFF"
          p="xl"
          style={{ border: '1px solid #D8E2E8', flex: '1 1 24rem' }}
        >
          <Stack gap="md">
            <Group gap="sm">
              <IconPresentation size={20} color="#5D7184" aria-hidden />
              <Text fz={20} fw={700} c="#17324D">
                封面預覽
              </Text>
            </Group>
            <SlideCanvas
              pageNumber={1}
              totalPages={courseware.pageCount}
              imageUrl={courseware.pages[0]?.imageUrl || undefined}
            />
          </Stack>
        </Paper>
      </Group>

      <section aria-labelledby="attempt-history">
        <SectionHeader title="嘗試歷史" />
        <Stack gap="md" mt="lg">
          {[...courseware.attempts].reverse().map((attempt) => (
            <Paper
              key={attempt.attempt}
              radius="lg"
              bg="#FFFFFF"
              p="lg"
              style={{ border: '1px solid #D8E2E8' }}
            >
              <Group justify="space-between" fz={16}>
                <Text fw={600} c="#17324D">
                  第 {attempt.attempt} 次
                </Text>
                <Text c={attempt.status === 'SUCCESS' ? '#0B6455' : '#B42318'} fw={600}>
                  {attempt.summary}
                </Text>
                <Text c="#5D7184">{formatTime(attempt.finishedAt)}</Text>
              </Group>
            </Paper>
          ))}
        </Stack>
      </section>
    </Stack>
  )
}
