import { Group, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

interface PageHeadingProps {
  /** 角色小字（teal），如「老師」 */
  roleLabel?: string
  title: string
  meta?: ReactNode
  actions?: ReactNode
}

/** 內頁標頭：角色小字 + 40px 標題 + 中繼資料 + 右側操作區（PG-011/012/013） */
export function PageHeading({ roleLabel, title, meta, actions }: PageHeadingProps) {
  return (
    <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap">
      <div>
        {roleLabel ? (
          <Text fz={20} fw={600} c="#12836F" mb={4}>
            {roleLabel}
          </Text>
        ) : null}
        <Title order={1} c="#17324D">
          {title}
        </Title>
        {meta ? (
          <Text fz={20} c="#5D7184" mt="xs">
            {meta}
          </Text>
        ) : null}
      </div>
      {actions ? (
        <Group gap="md" wrap="nowrap">
          {actions}
        </Group>
      ) : null}
    </Group>
  )
}
