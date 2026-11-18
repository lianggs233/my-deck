import { Box, Paper, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

import { BrandMark } from './BrandMark'

interface AuthLayoutProps {
  /** 左欄主標題（可用 \n 換行，40px 白字） */
  title: string
  /** 左欄副標（可用 \n 換行，20px #C9D8E2） */
  subtitle: string
  children: ReactNode
}

/**
 * 認證頁版式（PG-001~006 共用）。
 * 左：navy 品牌欄（帳號與安全 kicker、標題、Classroom preview 裝飾卡、底部標語）；
 * 右：Paper 底置中白卡（640/r24，內容欄 512）。
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <Box component="main" mih="100vh" style={{ display: 'flex' }}>
      <Box
        component="aside"
        bg="#17324D"
        mih="100vh"
        w="clamp(400px, 42vw, 600px)"
        px={48}
        py="clamp(16px, 4vh, 48px)"
        style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}
        visibleFrom="md"
      >
        <BrandMark />

        <Box mt="clamp(20px, 5vh, 64px)">
          <Text className="md-kicker" component="p" m={0}>
            帳號與安全
          </Text>
          <Title order={1} c="#FFFFFF" mt="lg" lh={1.25} style={{ whiteSpace: 'pre-line' }}>
            {title}
          </Title>
          <Text fz={20} c="#C9D8E2" mt="md" lh={1.7} style={{ whiteSpace: 'pre-line' }}>
            {subtitle}
          </Text>
        </Box>

        {/* Classroom preview 裝飾卡（切片圖形：白 slide + 黃色標註 + Mint 同步徽章） */}
        <Paper
          className="md-auth-preview"
          bg="#24445F"
          radius={24}
          p={32}
          mt="clamp(20px, 5vh, 64px)"
          maw={400}
          w="100%"
        >
          <Paper bg="#FFFFFF" radius={16} p={24} style={{ position: 'relative' }}>
            <Stack gap={12}>
              <Box h={16} w={128} bg="#12836F" style={{ borderRadius: 8 }} />
              <Box h={8} w="88%" bg="#DCE6EA" style={{ borderRadius: 4 }} mt={4} />
              <Box h={8} w="68%" bg="#DCE6EA" style={{ borderRadius: 4 }} />
            </Stack>
            <Box
              h={40}
              w={136}
              bg="#FFC94A"
              px={16}
              style={{
                position: 'absolute',
                right: 24,
                bottom: -20,
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Text fz={16} fw={600} c="#17324D" style={{ whiteSpace: 'nowrap' }}>
                重點記下！
              </Text>
            </Box>
          </Paper>
          <Box
            h={32}
            w={80}
            bg="#DDF4EC"
            mt={44}
            style={{
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text fz={16} fw={600} c="#0B6455">
              同步
            </Text>
          </Box>
        </Paper>

        <Box mt="auto" pt="clamp(16px, 4vh, 64px)">
          <Text fz={20} fw={500} c="#FFFFFF">
            一個帳號，連結每一次課堂互動。
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
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}
        px="md"
      >
        <Paper
          bg="#FFFFFF"
          radius="xl"
          w={640}
          px="clamp(24px, 5vw, 64px)"
          py="clamp(20px, 3.5vh, 64px)"
          maw="100%"
        >
          <Box maw={512} mx="auto">
            {children}
          </Box>
        </Paper>
      </Box>
    </Box>
  )
}
