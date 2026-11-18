import { Avatar, Box, Button, Divider, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconLogout, IconUser } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import type { UserRole } from '../../types/domain'
import { homePath } from '../../utils/home-path'
import { BrandMark } from './BrandMark'

const navItems: Record<UserRole, { label: string; to: string; active: boolean }[]> = {
  TEACHER: [
    { label: '我的課程', to: '/teacher', active: true },
    { label: '課堂記錄', to: '/teacher/sessions', active: false },
  ],
  STUDENT: [
    { label: '學習中心', to: '/student', active: true },
    { label: '課堂記錄', to: '/student/sessions', active: false },
  ],
}

/** 內頁頂欄（高 96）：品牌 + 中間導航 + 帳號選單（OL-001） */
export function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <Box component="header" bg="#FFFFFF" h={96} style={{ display: 'flex', alignItems: 'center' }}>
      <Group justify="space-between" w="100%" px={48} wrap="nowrap">
        <UnstyledButton onClick={() => navigate(homePath(user.role))} aria-label="回到首頁">
          <BrandMark variant="light" />
        </UnstyledButton>

        <Group gap={48} wrap="nowrap">
          {navItems[user.role].map((item) =>
            item.active ? (
              <Button
                key={item.label}
                variant="transparent"
                px={0}
                fz={20}
                fw={700}
                c="#0B6455"
                onClick={() => navigate(item.to)}
              >
                {item.label}
              </Button>
            ) : (
              <Text key={item.label} fz={20} fw={500} c="#5D7184">
                {item.label}
              </Text>
            ),
          )}
        </Group>

        <Menu width={224} position="bottom-end" radius="lg" shadow="md" withinPortal>
          <Menu.Target>
            <UnstyledButton aria-label="帳號選單">
              <Group gap="md" wrap="nowrap">
                <Text fz={16} fw={600} c="#17324D">
                  {user.displayName}
                </Text>
                <Avatar size={48} radius="xl" bg="#DDF4EC" c="#0B6455" fz={20} fw={600}>
                  {user.displayName.slice(0, 1)}
                </Avatar>
                <IconChevronDown size={16} color="#5D7184" aria-hidden />
              </Group>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown p={8}>
            <Menu.Item
              fz={16}
              fw={600}
              c="#0B6455"
              leftSection={<IconUser size={20} aria-hidden />}
              onClick={() => navigate('/profile')}
              styles={{ item: { borderRadius: 12, height: 48 } }}
            >
              個人中心
            </Menu.Item>
            <Divider my={8} color="#DCE6EA" />
            <Menu.Item
              fz={16}
              fw={600}
              c="#B42318"
              leftSection={<IconLogout size={20} aria-hidden />}
              onClick={() => {
                void logout().then(() => navigate('/login'))
              }}
              styles={{ item: { borderRadius: 12, height: 48 } }}
            >
              登出
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Box>
  )
}
