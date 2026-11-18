import { Box, type BoxProps } from '@mantine/core'
import type { ReactNode } from 'react'

type Tone = 'mint' | 'yellow' | 'blue' | 'gray' | 'red'

const toneBg: Record<Tone, string> = {
  mint: '#DDF4EC',
  yellow: '#FFF4CF',
  blue: '#E7F0FB',
  gray: '#EDF2F6',
  red: '#FEE4E2',
}

interface IconBoxProps extends BoxProps {
  tone?: Tone
  size?: number
  radius?: number
  children: ReactNode
}

/** 淡色圓角 icon 方塊（課件狀態／空狀態圖標） */
export function IconBox({
  tone = 'mint',
  size = 56,
  radius = 16,
  children,
  ...rest
}: IconBoxProps) {
  return (
    <Box
      w={size}
      h={size}
      style={{ borderRadius: radius, background: toneBg[tone], flexShrink: 0 }}
      c="#0B6455"
      p={size * 0.22}
      {...rest}
    >
      {children}
    </Box>
  )
}
