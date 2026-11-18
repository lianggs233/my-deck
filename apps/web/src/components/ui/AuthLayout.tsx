import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

import { BrandMark } from './BrandMark'

interface AuthLayoutProps {
  /** 左欄黃字標籤，如「歡迎回來」 */
  kicker: string
  /** 左欄主標題（兩行大白字） */
  title: string
  /** 左欄副標 */
  subtitle: string
  children: ReactNode
}

/** 認證頁版式（PG-001~006 共用）：左 600px navy 品牌欄 + 右 Paper 置中白卡（640/r24） */
export function AuthLayout({ kicker, title, subtitle, children }: AuthLayoutProps) {
  return (
    <Box component="main" mih="100vh" style={{ display: 'flex' }}>
      <Box
        component="aside"
        bg="#17324D"
        w={600}
        mih="100vh"
        p={64}
        style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}
        visibleFrom="lg"
      >
        <BrandMark />
        <Box mt={80}>
          <Text className="md-kicker" component="p" m={0}>
            {kicker}
          </Text>
          <Title order={1} c="#FFFFFF" mt="lg" lh={1.2}>
            {title}
          </Title>
          <Text fz={20} c="#C9D8E2" mt="md" maw={440} lh={1.7}>
            {subtitle}
          </Text>
        </Box>

        {/* Classroom preview 裝飾卡 */}
        <Paper bg="#24445F" radius="xl" p={32} mt={80} w={400}>
          <Paper bg="#FFFFFF" radius="lg" p={24}>
            <Stack gap="sm">
              <Box h={16} w={128} bg="#12836F" style={{ borderRadius: 8 }} />
              <Box h={8} w="90%" bg="#DCE6EA" style={{ borderRadius: 4 }} />
              <Box h={8} w="70%" bg="#DCE6EA" style={{ borderRadius: 4 }} />
              <Box
                h={40}
                w={136}
                bg="#FFC94A"
                mt={8}
                px="1rem"
                style={{ borderRadius: 16, display: 'flex', alignItems: 'center' }}
              >
                <Text fz={14} fw={600} c="#17324D">
                  重點記下！
                </Text>
              </Box>
            </Stack>
          </Paper>
          <Group mt="md" gap="sm">
            <Box
              h={32}
              w={80}
              bg="#DDF4EC"
              style={{
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text fz={14} fw={600} c="#0B6455">
                同步
              </Text>
            </Box>
          </Group>
        </Paper>

        <Box mt="auto">
          <Text fz={20} fw={500} c="#FFFFFF">
            一份帳號，連結每一次課堂互動。
          </Text>
          <Text fz={16} c="#C9D8E2" mt={8}>
            安全驗證 · 私隱保障 · 隨時繼續學習
          </Text>
        </Box>
      </Box>

      <Box
        component="section"
        flex={1}
        bg="#F5F8F6"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        py="xl"
        px="md"
      >
        <Paper bg="#FFFFFF" radius="xl" w={640} p={64} maw="100%">
          <Box maw={512} mx="auto">
            {children}
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}
