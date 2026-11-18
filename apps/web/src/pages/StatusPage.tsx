import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import {
  IconAlertCircle,
  IconApi,
  IconArrowUpRight,
  IconBook2,
  IconCircleCheck,
  IconCode,
  IconRefresh,
} from '@tabler/icons-react'

import { apiClient } from '../api/client'

export function StatusPage() {
  const healthQuery = useQuery({
    queryKey: ['api-health'],
    queryFn: async () => {
      const { data, response } = await apiClient.GET('/api/v1/health')
      if (!response.ok || !data) {
        throw new Error(`後端回應異常（HTTP ${response.status}）`)
      }
      return data
    },
  })

  const isHealthy = healthQuery.isSuccess

  return (
    <Box component="main" py="xl">
      <Container size="lg">
        <Stack gap="xl">
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <ThemeIcon size={40} radius="md" variant="light" color="teal">
                <IconBook2 size={24} aria-hidden />
              </ThemeIcon>
              <div>
                <Title order={2}>My Deck</Title>
                <Text size="sm" c="dimmed">
                  Web PPT 互動教學系統
                </Text>
              </div>
            </Group>
            <Badge variant="light" color="gray" size="lg">
              初始化驗證頁
            </Badge>
          </Group>

          <Paper className="hero" p="xl" radius="lg" withBorder>
            <Stack gap="lg" maw={640}>
              <Badge
                variant="light"
                color={isHealthy ? 'teal' : 'gray'}
                leftSection={isHealthy ? <IconCircleCheck size={16} aria-hidden /> : undefined}
              >
                {isHealthy ? '前後端連線正常' : '開發環境檢查'}
              </Badge>
              <Stack gap="sm">
                <Title order={1}>讓每一頁簡報，成為互動的起點。</Title>
                <Text size="lg" c="dimmed" lh={1.7}>
                  此頁確認 React 前端、FastAPI 後端及 OpenAPI 型別鏈已接通；
                  登入、課程與標註功能會按後續任務逐項加入。
                </Text>
              </Stack>
              <Group gap="sm">
                <Button
                  leftSection={<IconRefresh size={18} aria-hidden />}
                  loading={healthQuery.isFetching}
                  onClick={() => void healthQuery.refetch()}
                >
                  重新檢查連線
                </Button>
                <Button
                  component="a"
                  href="/docs"
                  target="_blank"
                  rel="noreferrer"
                  variant="default"
                  rightSection={<IconArrowUpRight size={18} aria-hidden />}
                >
                  開啟 API 文件
                </Button>
              </Group>
            </Stack>
          </Paper>

          {healthQuery.isError ? (
            <Alert color="red" title="暫時無法連接後端" icon={<IconAlertCircle aria-hidden />}>
              請確認 FastAPI 已在 port 8000 啟動。{healthQuery.error.message}
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Paper className="status-card" p="lg" radius="md" withBorder>
              <Stack gap="sm">
                <ThemeIcon variant="light" color="teal" size="lg">
                  <IconApi size={22} aria-hidden />
                </ThemeIcon>
                <Title order={3}>FastAPI 後端</Title>
                <Text c="dimmed" size="sm">
                  {healthQuery.isPending
                    ? '正在檢查 /api/v1/health'
                    : healthQuery.isSuccess
                      ? `${healthQuery.data.service} · v${healthQuery.data.version}`
                      : '等待後端服務啟動'}
                </Text>
              </Stack>
            </Paper>

            <Paper className="status-card" p="lg" radius="md" withBorder>
              <Stack gap="sm">
                <ThemeIcon variant="light" color="blue" size="lg">
                  <IconCode size={22} aria-hidden />
                </ThemeIcon>
                <Title order={3}>React 前端</Title>
                <Text c="dimmed" size="sm">
                  Vite、TypeScript strict、Mantine 及 TanStack Query 已配置。
                </Text>
              </Stack>
            </Paper>

            <Paper className="status-card" p="lg" radius="md" withBorder>
              <Stack gap="sm">
                <ThemeIcon variant="light" color="violet" size="lg">
                  <IconCircleCheck size={22} aria-hidden />
                </ThemeIcon>
                <Title order={3}>共用 API 契約</Title>
                <Text c="dimmed" size="sm">
                  由 FastAPI 生成 OpenAPI，再生成 TypeScript 型別與 typed client。
                </Text>
                <Anchor href="/openapi.json" target="_blank" rel="noreferrer" size="sm">
                  查看 OpenAPI JSON
                </Anchor>
              </Stack>
            </Paper>
          </SimpleGrid>

          <Text size="sm" c="dimmed" ta="center">
            此頁只用於初始化驗證，不代表業務功能或測試用例已完成。
          </Text>
        </Stack>
      </Container>
    </Box>
  )
}
