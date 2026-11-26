import { Button, Group, Loader, Paper, Stack, Tabs, Text } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ApiError } from '../../api/http'
import { classroomApi, courseApi, coursewareApi } from '../../api/mvp'
import { CoursewareRow } from '../../components/ui/CoursewareRow'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { PageHeading } from '../../components/ui/PageHeading'

/**
 * PG-012 學生課程詳情。
 * 依 MVP 批准例外：「課件」tab 供學生預覽轉換成功的課件並管理個人標註。
 */
export function StudentCoursePage() {
  const { courseId = '' } = useParams()
  const navigate = useNavigate()

  const courseQuery = useQuery({
    queryKey: ['course', courseId, 'STUDENT'],
    queryFn: () => courseApi.getCourse(courseId),
    enabled: Boolean(courseId),
  })
  const coursewareQuery = useQuery({
    queryKey: ['coursewares', courseId],
    queryFn: () => coursewareApi.list(courseId),
    enabled: Boolean(courseId),
  })
  const activeClassroomQuery = useQuery({
    queryKey: ['classroom-active', courseId],
    queryFn: () => classroomApi.active(courseId),
    enabled: Boolean(courseId),
    refetchInterval: 15_000,
  })
  const { showError } = useErrorAlert()
  const queryClient = useQueryClient()
  const joinMutation = useMutation({
    mutationFn: (classroomId: string) => classroomApi.joinFromCourse(classroomId),
    onSuccess: (result) => navigate(`/classrooms/${result.classroom.id}`),
    onError: (cause) => {
      // 橫幅為快取資料時可能點到已結束課堂：提示並立即重整橫幅，讓入口消失
      if (cause instanceof ApiError && cause.code === 'CLASSROOM_ENDED') {
        showError('課堂已結束，無法進入。')
        void queryClient.invalidateQueries({ queryKey: ['classroom-active', courseId] })
        return
      }
      showError(cause instanceof Error ? cause.message : '加入課堂失敗')
    },
  })
  const courseLoadError = courseQuery.error
  useEffect(() => {
    if (courseLoadError) {
      showError(
        courseLoadError instanceof Error ? courseLoadError.message : '課程不存在或你沒有權限查看。',
      )
    }
  }, [courseLoadError, showError])

  if (courseQuery.isPending || coursewareQuery.isPending) {
    return <Loader aria-label="課程資料載入中" mx="auto" my="xl" />
  }

  if (!courseQuery.data) {
    // 錯誤已統一由頂部 Alert 顯示（見上方 useEffect）
    return null
  }

  const course = courseQuery.data
  const readyCoursewares = (coursewareQuery.data?.items ?? []).filter(
    (item) => item.status === 'READY' || item.status === 'READY_WITH_WARNINGS',
  )
  const activeClassroom = activeClassroomQuery.data?.classroom

  return (
    <Stack gap={32}>
      <PageHeading
        roleLabel="學生"
        title={course.name}
        meta={`${course.teacherName} · ${course.schoolYear ?? ''} · ${course.studentCount ?? 0} 位學生`}
      />

      {activeClassroom ? (
        <Paper radius="lg" bg="#DDF4EC" p="lg" style={{ border: '1px solid #BFE6D6' }}>
          <Group justify="space-between" wrap="wrap" gap="md">
            <div>
              <Text fz={14} fw={600} c="#0B6455">
                課堂進行中
              </Text>
              <Text fz={20} fw={700} c="#17324D">
                {activeClassroom.name}
              </Text>
              <Text fz={16} c="#5D7184">
                第 {activeClassroom.pageIndex + 1} / {activeClassroom.pageCount} 頁
              </Text>
            </div>
            <Button
              radius="md"
              loading={joinMutation.isPending}
              onClick={() => joinMutation.mutate(activeClassroom.id)}
            >
              進入課堂
            </Button>
          </Group>
        </Paper>
      ) : null}

      <Paper radius="lg" bg="#FFFFFF" style={{ border: '1px solid #D8E2E8' }}>
        <Tabs defaultValue="courseware">
          <Tabs.List px="xl" pt="md">
            <Tabs.Tab value="courseware" fz={20} fw={600}>
              課件
            </Tabs.Tab>
            <Tabs.Tab value="sessions" fz={20} fw={600} c="#5D7184">
              課堂記錄
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="courseware" px="xl" py="lg">
            <Stack gap="md">
              {readyCoursewares.length === 0 ? (
                <Text fz={16} c="#5D7184" ta="center" py="xl">
                  老師尚未上傳可預覽的課件
                </Text>
              ) : (
                readyCoursewares.map((courseware) => (
                  <CoursewareRow
                    key={courseware.id}
                    courseware={courseware}
                    linkPrefix={`/student/courses/${courseId}`}
                  />
                ))
              )}
              <Text fz={16} c="#5D7184" mt="sm">
                課件頁面只供課程學生預覽；個人標註只有你自己可以看到。
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="sessions" px="xl" py="xl">
            <Text fz={16} c="#5D7184" ta="center" py="xl">
              尚未有課堂記錄
            </Text>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Stack>
  )
}
