import { Box, Button, Group, Paper, Text, UnstyledButton } from '@mantine/core'
import { IconChevronRight, IconFile } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import type { Courseware } from '../../types/domain'
import { CoursewareStatusPill } from './CoursewareStatusPill'
import { coursewareStatusTone } from './courseware-status'
import { IconBox } from './IconBox'

interface CoursewareRowProps {
  courseware: Courseware
  /** 查看詳情／開始預覽的連結前綴，如 /teacher/courses/:id 或 /student/courses/:id */
  linkPrefix: string
}

/** 課件列卡（PG-011/PG-012 共用）：icon 方塊 + 檔名中繼 + 狀態 pill + 查看詳情 */
export function CoursewareRow({ courseware, linkPrefix }: CoursewareRowProps) {
  const navigate = useNavigate()

  return (
    <Paper
      radius="lg"
      bg="#FFFFFF"
      p="lg"
      style={{ border: '1px solid #D8E2E8' }}
      className="md-clickable"
    >
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <Group gap="lg" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <IconBox tone={coursewareStatusTone(courseware.status)} size={56}>
            <IconFile size={26} stroke={1.8} aria-hidden />
          </IconBox>
          <Box style={{ minWidth: 0 }}>
            <Text fz={20} fw={600} c="#17324D" truncate>
              {courseware.fileName}
            </Text>
            <Text fz={16} c="#5D7184" mt={2}>
              {courseware.pageCount > 0 ? `${courseware.pageCount} 頁 · ` : ''}更新於 今天 09:12
            </Text>
          </Box>
        </Group>
        <CoursewareStatusPill status={courseware.status} />
        <UnstyledButton
          aria-label={`查看 ${courseware.fileName} 詳情`}
          onClick={() => navigate(`${linkPrefix}/courseware/${courseware.id}`)}
        >
          <Group gap={4} wrap="nowrap">
            <Button variant="transparent" px={0} fz={16} fw={600} c="#0B6455">
              查看詳情
            </Button>
            <IconChevronRight size={16} color="#5D7184" aria-hidden />
          </Group>
        </UnstyledButton>
      </Group>
    </Paper>
  )
}
