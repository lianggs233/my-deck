import {
  Anchor,
  Button,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { StatusPill } from '../../components/ui/StatusPill'
import type { UserRole } from '../../types/domain'
import { homePath } from '../../utils/home-path'

/** PG-001 登入 */
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const session = await login(identifier, password)
      const state = location.state as { from?: string } | null
      navigate(state?.from ?? homePath(session.user.role), { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登入失敗')
    } finally {
      setSubmitting(false)
    }
  }

  async function loginAs(role: UserRole) {
    setSubmitting(true)
    setError('')
    try {
      const session = await login(
        role === 'TEACHER' ? 'teacher@demo.local' : 'student@demo.local',
        'demo-password',
      )
      navigate(homePath(session.user.role), { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登入失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      kicker="歡迎回來"
      title="繼續你的課堂旅程。"
      subtitle="登入 my-deck，管理課程、預覽課件，並延續每一次互動。"
    >
      <Stack gap="xl">
        <div>
          <StatusPill tone="mint">歡迎回來</StatusPill>
          <Title order={2} c="#17324D" mt="md">
            登入
          </Title>
          <Text fz={16} c="#5D7184" mt={4}>
            使用手機號碼或電郵登入
          </Text>
        </div>

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)}>
          <Stack gap="lg">
            <TextInput
              label="手機號碼或電郵"
              placeholder="teacher@demo.local"
              value={identifier}
              onChange={(event) => setIdentifier(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="密碼"
              placeholder="輸入密碼"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            <Group justify="space-between" fz={16}>
              <Anchor component={Link} to="/register" fz={16} fw={600} c="#0B6455">
                立即註冊
              </Anchor>
              <Anchor component={Link} to="/forgot-password" fz={16} fw={600} c="#0B6455">
                忘記密碼？
              </Anchor>
            </Group>
            <Button type="submit" loading={submitting} fullWidth>
              登入
            </Button>
          </Stack>
        </form>

        <Divider color="#DCE6EA" />

        <Stack gap="sm">
          <Text fz={16} c="#5D7184" ta="center">
            MVP 開發模式：使用演示帳號快速登入
          </Text>
          <Group grow>
            <Button
              variant="default"
              styles={{
                root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
              }}
              onClick={() => void loginAs('TEACHER')}
              disabled={submitting}
            >
              老師演示
            </Button>
            <Button
              variant="default"
              styles={{
                root: { background: '#FFFFFF', border: '1px solid #D8E2E8', color: '#0B6455' },
              }}
              onClick={() => void loginAs('STUDENT')}
              disabled={submitting}
            >
              學生演示
            </Button>
          </Group>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
