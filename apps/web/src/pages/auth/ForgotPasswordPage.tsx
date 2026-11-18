import { Anchor, Button, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconKey } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { IconBox } from '../../components/ui/IconBox'

/** PG-004 忘記密碼 */
export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const challenge = await requestPasswordReset(identifier)
      navigate('/reset/verify', { state: { identifier, challenge } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '驗證碼發送失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title={'安全找回\n你的帳號'} subtitle={'完成擁有者驗證後，\n即可設定新的密碼。'}>
      <Stack gap="xl">
        <div>
          <IconBox tone="yellow" size={64} c="#17324D">
            <IconKey size={30} stroke={1.8} aria-hidden />
          </IconBox>
          <Title order={2} fz={32} c="#17324D" mt="md">
            忘記密碼？
          </Title>
          <Text fz={16} c="#5D7184" mt={4} style={{ whiteSpace: 'pre-line' }}>
            {'輸入註冊時使用的手機號碼或電郵，\n我們會發送驗證碼。'}
          </Text>
        </div>

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <form onSubmit={(event) => void sendCode(event)}>
          <Stack gap="lg">
            <TextInput
              label="手機號碼或電郵"
              placeholder="+852 9123 4567"
              value={identifier}
              onChange={(event) => setIdentifier(event.currentTarget.value)}
              required
            />
            <Button type="submit" loading={submitting} fullWidth>
              發送驗證碼
            </Button>
            <Anchor component={Link} to="/login" ta="center" fz={16} fw={700} c="#0B6455">
              返回登入
            </Anchor>
          </Stack>
        </form>
      </Stack>
    </AuthLayout>
  )
}
