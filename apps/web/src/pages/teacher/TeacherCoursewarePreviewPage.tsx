import {
  Box,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconPresentation,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { coursewareApi } from '../../api/mvp'
import { SlideCanvas } from '../../components/ui/SlideCanvas'
import { StatusPill } from '../../components/ui/StatusPill'

const secondaryButton = {
  root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
} as const

/** PG-014 逐頁預覽（老師） */
export function TeacherCoursewarePreviewPage() {
  const { courseId = '', coursewareId = '' } = useParams()
  const [pageIndex, setPageIndex] = useState(0)

  const coursewareQuery = useQuery({
    queryKey: ['courseware', courseId, coursewareId],
    queryFn: () => coursewareApi.get(courseId, coursewareId),
    enabled: Boolean(courseId && coursewareId),
  })

  if (coursewareQuery.isPending) {
    return <Loader aria-label="課件載入中" mx="auto" my="xl" />
  }

  if (!coursewareQuery.data) {
    return (
      <Text fz={16} c="#B42318" role="alert">
        課件不存在或你沒有權限查看。
      </Text>
    )
  }

  const courseware = coursewareQuery.data
  const page = courseware.pages[pageIndex] ?? courseware.pages[0]

  return (
    <Stack gap={32}>
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="lg" wrap="nowrap">
          <Button
            component={Link}
            to={`/teacher/courses/${courseId}/courseware/${coursewareId}`}
            variant="default"
            leftSection={<IconArrowLeft size={16} aria-hidden />}
            styles={secondaryButton}
          >
            返回詳情
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

      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Paper
          radius="xl"
          bg="#FFFFFF"
          p="lg"
          w={280}
          style={{ border: '1px solid #D8E2E8', flexShrink: 0 }}
          visibleFrom="md"
        >
          <Text fz={20} fw={700} c="#17324D" mb="md">
            全部頁面
          </Text>
          <Stack gap="xs" style={{ maxHeight: '32rem', overflowY: 'auto' }}>
            {courseware.pages.map((item) => {
              const selected = item.pageIndex === pageIndex
              return (
                <UnstyledButton
                  key={item.pageIndex}
                  aria-current={selected}
                  onClick={() => setPageIndex(item.pageIndex)}
                >
                  <Box
                    px="md"
                    py="sm"
                    style={{
                      borderRadius: 12,
                      background: selected ? '#DDF4EC' : 'transparent',
                      border: selected ? '1px solid #12836F' : '1px solid transparent',
                    }}
                  >
                    <Text fz={14} c="#5D7184">
                      第 {item.pageNumber} 頁
                    </Text>
                    <Text fz={16} fw={600} c="#17324D" truncate>
                      {item.title}
                    </Text>
                  </Box>
                </UnstyledButton>
              )
            })}
          </Stack>
        </Paper>

        <Box style={{ flex: 1, minWidth: 0 }}>
          <SlideCanvas pageNumber={page?.pageNumber ?? 1} totalPages={courseware.pageCount} />

          <Group justify="space-between" mt="lg">
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
              選擇左側縮圖可快速跳頁
            </Text>
            <Button
              rightSection={<IconChevronRight size={16} aria-hidden />}
              disabled={pageIndex >= courseware.pageCount - 1}
              onClick={() => setPageIndex((value) => Math.min(courseware.pageCount - 1, value + 1))}
            >
              下一頁
            </Button>
          </Group>
        </Box>
      </Group>
    </Stack>
  )
}
