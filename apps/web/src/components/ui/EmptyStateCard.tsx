import { Group, Paper, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

import { IconBox } from './IconBox'

interface EmptyStateCardProps {
  icon: ReactNode
  title: string
  description: string
  note?: string
}

/** 空白狀態卡（白卡 r24 高 248：淡色 icon + 標題 + 描述 + 註） */
export function EmptyStateCard({ icon, title, description, note }: EmptyStateCardProps) {
  return (
    <Paper radius="xl" bg="#FFFFFF" p={48} style={{ border: '1px solid #D8E2E8' }}>
      <Group gap="xl" wrap="nowrap" align="center">
        <IconBox tone="yellow" size={96} radius={24} c="#17324D">
          {icon}
        </IconBox>
        <Stack gap="xs">
          <Title order={2} c="#17324D">
            {title}
          </Title>
          <Text fz={20} c="#5D7184" lh={1.6}>
            {description}
          </Text>
          {note ? (
            <Text fz={16} c="#5D7184" mt={4}>
              {note}
            </Text>
          ) : null}
        </Stack>
      </Group>
    </Paper>
  )
}
