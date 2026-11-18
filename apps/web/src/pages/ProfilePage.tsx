import {
  Anchor,
  Avatar,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/useAuth'
import { homePath } from '../utils/home-path'

/** PG-009/PG-010 個人中心（老師／學生共用） */
export function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const roleName = user.role === 'TEACHER' ? '老師' : '學生'

  return (
    <Stack gap={32}>
      <Group gap={8} fz={16} c="#5D7184">
        <Anchor component={Link} to={homePath(user.role)} fz={16} c="#5D7184" fw={400}>
          首頁
        </Anchor>
        <IconChevronRight size={14} aria-hidden />
        <Text fz={16} c="#5D7184">
          個人中心
        </Text>
      </Group>

      <div>
        <Title order={1} c="#17324D">
          個人中心
        </Title>
        <Text fz={20} c="#5D7184" mt={4}>
          查看你的帳號資料
        </Text>
      </div>

      <Paper
        radius="xl"
        bg="#FFFFFF"
        p={48}
        maw={640}
        mx="auto"
        w="100%"
        style={{ border: '1px solid #D8E2E8' }}
      >
        <Stack gap="lg" align="center">
          <Avatar size={64} radius="xl" bg="#DDF4EC" c="#0B6455" fz={24} fw={600}>
            {user.displayName.slice(0, 1)}
          </Avatar>
          <Box ta="center">
            <Text fz={24} fw={700} c="#17324D">
              {user.displayName}
            </Text>
            <Text fz={16} c="#5D7184" mt={4}>
              {roleName}帳號
            </Text>
          </Box>

          <Divider w="100%" color="#DCE6EA" />

          <Stack gap="md" w="100%">
            <Group justify="space-between" fz={16}>
              <Text c="#5D7184">顯示名稱</Text>
              <Text fw={600} c="#17324D">
                {user.displayName}
              </Text>
            </Group>
            <Group justify="space-between" fz={16}>
              <Text c="#5D7184">帳號角色</Text>
              <Text fw={600} c="#17324D">
                {roleName}
              </Text>
            </Group>
          </Stack>

          <Button onClick={() => navigate(homePath(user.role))} mt="md">
            返回首頁
          </Button>
        </Stack>
      </Paper>
    </Stack>
  )
}
