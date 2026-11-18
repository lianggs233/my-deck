import { Group, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  note?: ReactNode
  right?: ReactNode
}

/** 區塊標頭：24px 標題 + 右側註記或操作 */
export function SectionHeader({ title, note, right }: SectionHeaderProps) {
  return (
    <Group justify="space-between" align="center" wrap="wrap">
      <Group gap="md" align="baseline">
        <Title order={2} c="#17324D">
          {title}
        </Title>
        {note ? (
          <Text fz={20} c="#5D7184">
            {note}
          </Text>
        ) : null}
      </Group>
      {right}
    </Group>
  )
}
