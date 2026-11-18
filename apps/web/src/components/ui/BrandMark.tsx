import { Box, Group, Text } from '@mantine/core'
import { IconPresentation } from '@tabler/icons-react'

interface BrandMarkProps {
  /** dark：左欄 navy 底用白字；light：白底用 navy 字 */
  variant?: 'dark' | 'light'
  iconBg?: string
}

/** 品牌標誌：黃底簡報 icon + my-deck 字標（PG-001 切片） */
export function BrandMark({ variant = 'dark', iconBg = '#FFC94A' }: BrandMarkProps) {
  return (
    <Group gap="md" wrap="nowrap">
      <Box
        w={48}
        h={48}
        style={{ borderRadius: '1rem', background: iconBg, flexShrink: 0 }}
        c="#17324D"
        p={10}
      >
        <IconPresentation size={28} stroke={2.2} aria-hidden />
      </Box>
      <Text fz={24} fw={700} c={variant === 'dark' ? '#FFFFFF' : '#17324D'} lh={1}>
        my-deck
      </Text>
    </Group>
  )
}
