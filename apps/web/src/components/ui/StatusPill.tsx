import { Badge, type BadgeProps } from '@mantine/core'
import type { ReactNode } from 'react'

type Tone = 'mint' | 'yellow' | 'blue' | 'red' | 'gray'

const toneStyle: Record<Tone, { bg: string; c: string }> = {
  mint: { bg: '#DDF4EC', c: '#0B6455' },
  yellow: { bg: '#FFF4CF', c: '#17324D' },
  blue: { bg: '#E7F0FB', c: '#1E5FA8' },
  red: { bg: '#FEE4E2', c: '#B42318' },
  gray: { bg: '#EDF2F6', c: '#5D7184' },
}

interface StatusPillProps {
  tone?: Tone
  children: ReactNode
  size?: BadgeProps['size']
  leftSection?: ReactNode
}

/** 狀態 pill（高 32–40、r16）：Mint/淡黃/淡藍/紅/灰 */
export function StatusPill({ tone = 'mint', children, size = 'lg', leftSection }: StatusPillProps) {
  const style = toneStyle[tone]
  return (
    <Badge
      size={size}
      radius="xl"
      leftSection={leftSection}
      styles={{
        root: {
          background: style.bg,
          color: style.c,
          fontWeight: 600,
          height: '2.25rem',
          paddingInline: '1rem',
          fontSize: '1rem',
          textTransform: 'none',
        },
      }}
    >
      {children}
    </Badge>
  )
}
