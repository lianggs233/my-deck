import { Anchor, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconKey } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../auth/useAuth'
import { AuthLayout } from '../../components/ui/AuthLayout'
import { IconBox } from '../../components/ui/IconBox'
import { PasswordStrengthField } from '../../components/ui/PasswordStrengthField'

/** PG-004 忘記密碼（本期以舊密碼驗證直接重設，不發驗證碼） */
export function ForgotPasswordPage() {
  const { resetPasswordDirect } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (password.length < 8) throw new Error('新密碼需至少 8 個字元')
      if (password !== confirm) throw new Error('兩次輸入的新密碼不一致')
      await resetPasswordDirect(identifier, oldPassword, password)
      navigate('/login', { replace: true, state: { reset: true } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重設密碼失敗')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title={'驗證舊密碼\n即可重設'} subtitle={'重設成功後，所有舊工作階段\n都會撤銷。'}>
      <Stack gap="xl">
        <div>
          <IconBox tone="yellow" size={64} c="#17324D">
            <IconKey size={30} stroke={1.8} aria-hidden />
          </IconBox>
          <Title order={2} fz={32} c="#17324D" mt="md">
            重設密碼
          </Title>
          <Text fz={16} c="#5D7184" mt={4} style={{ whiteSpace: 'pre-line' }}>
            {'輸入帳號及目前使用的舊密碼，\n驗證通過後即可設定新密碼。'}
          </Text>
        </div>

        {error ? (
          <Text fz={16} c="#B42318" role="alert">
            {error}
          </Text>
        ) : null}

        <form onSubmit={(event) => void submit(event)}>
          <Stack gap="lg">
            <TextInput
              label="手機號碼或電郵"
              placeholder="+852 9123 4567"
              value={identifier}
              onChange={(event) => setIdentifier(event.currentTarget.value)}
              required
            />
            <PasswordInput
              label="舊密碼"
              placeholder="輸入目前使用的密碼"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.currentTarget.value)}
              required
            />
            <PasswordStrengthField label="新密碼" value={password} onChange={setPassword} />
            <PasswordInput
              label="再次輸入新密碼"
              placeholder="再次輸入新密碼"
              value={confirm}
              onChange={(event) => setConfirm(event.currentTarget.value)}
              required
            />
            <div className="md-notice md-notice-yellow">
              <Text ta="center" fz={16} fw={600} style={{ flex: 1 }}>
                完成後，所有裝置都需要重新登入。
              </Text>
            </div>
            <Button type="submit" loading={submitting} fullWidth>
              重設密碼並返回登入
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
