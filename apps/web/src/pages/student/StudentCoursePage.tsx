import { Loader, Paper, Stack, Tabs, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { courseApi, coursewareApi } from '../../api/mvp'
import { CoursewareRow } from '../../components/ui/CoursewareRow'
import { useErrorAlert } from '../../components/ui/error-alert-context'
import { PageHeading } from '../../components/ui/PageHeading'

/**
 * PG-012 學生課程詳情。
 * 依 MVP 批准例外：「課件」tab 供學生預覽轉換成功的課件並管理個人標註。
 */
export function StudentCoursePage() {
  const { courseId = '' } = useParams()

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

  const { showError } = useErrorAlert()
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

  return (
    <Stack gap={32}>
      <PageHeading
        roleLabel="學生"
        title={course.name}
        meta={`${course.teacherName} · ${course.schoolYear ?? ''} · ${course.studentCount ?? 0} 位學生`}
      />

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
