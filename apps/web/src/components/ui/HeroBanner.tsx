import { Box, Group, Paper, Title, type PaperProps } from '@mantine/core'
import type { ReactNode } from 'react'

interface HeroBannerProps extends PaperProps {
  /** navy：老師首頁；teal：學生首頁 */
  tone: 'navy' | 'teal'
  icon: ReactNode
  title: string
  subtitle: string
  action?: ReactNode
}

/** 首頁 Hero banner（r24、高約 200、padding 48） */
export function HeroBanner({ tone, icon, title, subtitle, action, ...rest }: HeroBannerProps) {
  const background = tone === 'navy' ? '#17324D' : '#0F6C5B'
  return (
    <Paper radius="xl" p={48} bg={background} {...rest}>
      <Group justify="space-between" align="center" wrap="wrap" gap="xl">
        <Group gap="xl" wrap="nowrap">
          <Box
            w={64}
            h={64}
            style={{ borderRadius: 16, background: '#FFC94A', flexShrink: 0 }}
            c="#17324D"
            p={14}
          >
            {icon}
          </Box>
          <div>
            <Title order={2} c="#FFFFFF" lh={1.3}>
              {title}
            </Title>
            <Title order={4} c="#C9D8E2" fw={400} mt={4}>
              {subtitle}
            </Title>
          </div>
        </Group>
        {action}
      </Group>
    </Paper>
  )
}
