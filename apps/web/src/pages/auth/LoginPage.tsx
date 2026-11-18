import { Anchor, Button, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { StatusPill } from '../../components/ui/StatusPill'
import { homePath } from '../../utils/home-path'

/** PG-001 登入 */
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { from?: string; registered?: boolean; reset?: boolean } | null
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const notice = state?.registered
    ? '註冊成功！請使用新帳號登入。'
    : state?.reset
      ? '密碼已重設，請使用新密碼登入。'
      : ''

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const session = await login(identifier, password)
      navigate(state?.from ?? homePath(session.user.role), { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登入失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={'回到你的\n互動課堂'}
      subtitle={'登入後繼續備課、同步學習，\n保留每一份課堂筆記。'}
    >
      <Stack gap="xl">
        <div>
          <StatusPill tone="mint">歡迎回來</StatusPill>
          <Title order={2} fz={32} c="#17324D" mt="md">
            登入 my-deck
          </Title>
          <Text fz={16} c="#5D7184" mt={4}>
            使用已驗證的手機號碼或電郵。
          </Text>
        </div>

        {notice ? (
          <Text fz={16} fw={600} c="#0B6455" role="status">
            {notice}
          </Text>
        ) : null}

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)}>
          <Stack gap="lg">
            <TextInput
              label="手機號碼或電郵"
              placeholder="+852 9123 4567"
              value={identifier}
              onChange={(event) => setIdentifier(event.currentTarget.value)}
              required
            />
            <div>
              <PasswordInput
                label="密碼"
                placeholder="輸入密碼"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
              />
              <Group justify="flex-end" mt="xs">
                <Anchor component={Link} to="/forgot-password" fz={16} fw={600} c="#0B6455">
                  忘記密碼？
                </Anchor>
              </Group>
            </div>
            <Button type="submit" loading={submitting} fullWidth>
              登入
            </Button>
          </Stack>
        </form>

        <Text ta="center" fz={16} c="#5D7184">
          還沒有帳號？{' '}
          <Anchor component={Link} to="/register" fz={16} fw={700} c="#0B6455">
            立即註冊
          </Anchor>
        </Text>
        <Text ta="center" fz={16} c="#5D7184">
          受保護的課堂空間 · 香港地區服務
        </Text>
      </Stack>
    </AuthLayout>
  )
}
